import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLE_VALUES = ["admin", "lider_nacional", "lider_estadual", "lider_local"] as const;
const USER_VIEW_ROLES = ["admin", "lider_nacional", "lider_estadual", "lider_local"] as const;
type UserViewRole = (typeof USER_VIEW_ROLES)[number];

function pickHighestUserViewRole(roles: string[]): UserViewRole | null {
  for (const role of USER_VIEW_ROLES) {
    if (roles.includes(role)) return role;
  }
  return null;
}

async function assertCanViewUsers(supabase: any, callerId: string): Promise<UserViewRole> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", USER_VIEW_ROLES as unknown as string[]);
  if (error) throw new Error(error.message);

  const role = pickHighestUserViewRole((data ?? []).map((r: any) => r.role as string));
  if (!role) {
    throw new Error("Acesso negado: apenas administradores e líderes podem visualizar usuários.");
  }
  return role;
}

export const createUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(6).max(128),
        fullName: z.string().min(1).max(255),
        churchName: z.string().max(255).optional(),
        roles: z.array(z.enum(ROLE_VALUES)).max(4),
        instruments: z.array(z.string().max(64)).max(40).optional(),
        vocalTypes: z.array(z.string().max(64)).max(10).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertAdmin(supabase, callerId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, church_name: data.churchName ?? null },
    });
    if (createErr) throw new Error(createErr.message);
    const newId = created.user!.id;

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        church_name: data.churchName || null,
        instruments: data.instruments ?? [],
        vocal_types: data.vocalTypes ?? [],
      } as any)
      .eq("id", newId);

    const uniqueRoles = Array.from(new Set(data.roles));
    if (uniqueRoles.length > 0) {
      await supabaseAdmin
        .from("user_roles")
        .insert(uniqueRoles.map((r) => ({ user_id: newId, role: r as any })));
    }

    return { ok: true, userId: newId };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;

    // Verify caller is admin
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Acesso negado: apenas administradores podem excluir usuários.");

    if (data.userId === callerId) {
      throw new Error("Você não pode excluir sua própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clean up related rows (no FK cascade defined)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("favorites").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("access_history").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("setlists").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (authErr) throw new Error(authErr.message);

    return { ok: true };
  });

async function assertAdmin(supabase: any, callerId: string) {
  const { data: roleRow, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!roleRow) throw new Error("Acesso negado: apenas administradores.");
}

export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId: callerId } = context;
    const viewerRole = await assertCanViewUsers(supabase, callerId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("church_name")
      .eq("id", callerId)
      .maybeSingle();
    if (callerProfileErr) throw new Error(callerProfileErr.message);

    const callerChurchName = (callerProfile as any)?.church_name as string | null | undefined;
    let callerEstadual: string | null = null;
    if (callerChurchName) {
      const { data: callerChurch, error: callerChurchErr } = await supabaseAdmin
        .from("churches")
        .select("estadual")
        .eq("name", callerChurchName)
        .maybeSingle();
      if (callerChurchErr) throw new Error(callerChurchErr.message);
      callerEstadual = ((callerChurch as any)?.estadual ?? null) as string | null;
    }

    // Fetch all auth users (paginated)
    const emailMap = new Map<string, { email: string | null; last_sign_in_at: string | null }>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      data.users.forEach((u) =>
        emailMap.set(u.id, { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null })
      );
      if (data.users.length < perPage) break;
      page += 1;
    }

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: churches, error: churchesErr } = await supabaseAdmin
      .from("churches")
      .select("name,estadual");
    if (churchesErr) throw new Error(churchesErr.message);

    const churchEstadualMap = new Map<string, string | null>();
    (churches ?? []).forEach((church: any) => {
      churchEstadualMap.set(church.name, church.estadual ?? null);
    });

    const { data: roles, error: rErr } = await supabaseAdmin.from("user_roles").select("*");
    if (rErr) throw new Error(rErr.message);

    const roleMap = new Map<string, string[]>();
    roles?.forEach((r: any) => {
      const a = roleMap.get(r.user_id) || [];
      a.push(r.role);
      roleMap.set(r.user_id, a);
    });

    const visibleProfiles = (profiles ?? []).filter((profile: any) => {
      if (viewerRole === "admin" || viewerRole === "lider_nacional") return true;
      if (viewerRole === "lider_estadual") {
        return !!callerEstadual && churchEstadualMap.get(profile.church_name) === callerEstadual;
      }
      if (viewerRole === "lider_local") {
        return !!callerChurchName && profile.church_name === callerChurchName;
      }
      return false;
    });

    const users = visibleProfiles.map((p: any) => ({
      ...p,
      email: emailMap.get(p.id)?.email ?? null,
      last_sign_in_at: emailMap.get(p.id)?.last_sign_in_at ?? null,
      roles: roleMap.get(p.id) ?? [],
      church_estadual: churchEstadualMap.get(p.church_name) ?? null,
    }));

    return { users, viewerRole };
  });

export const toggleAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        isAdmin: z.boolean(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertAdmin(supabase, callerId);

    if (data.userId === callerId) {
      throw new Error("Você não pode alterar sua própria função.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.isAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
    } else {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
    }

    return { ok: true };
  });

export const updateUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().min(1).max(255),
        churchName: z.string().max(255).optional(),
        roles: z.array(z.enum(ROLE_VALUES)).max(4),
        instruments: z.array(z.string().max(64)).max(40).optional(),
        vocalTypes: z.array(z.string().max(64)).max(10).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertAdmin(supabase, callerId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        church_name: data.churchName || null,
        instruments: data.instruments ?? [],
        vocal_types: data.vocalTypes ?? [],
      } as any)
      .eq("id", data.userId);

    if (profileError) throw new Error(profileError.message);

    const desired = Array.from(new Set(data.roles));
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const currentRoles = (existingRoles ?? []).map((r: any) => r.role as string);
    const wasAdmin = currentRoles.includes("admin");

    if (wasAdmin && !desired.includes("admin") && data.userId === callerId) {
      throw new Error("Você não pode remover sua própria função de administrador.");
    }

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ROLE_VALUES as any);

    if (desired.length > 0) {
      await supabaseAdmin
        .from("user_roles")
        .insert(desired.map((r) => ({ user_id: data.userId, role: r as any })));
    }

    return { ok: true };
  });

export const impersonateUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertAdmin(supabase, callerId);

    if (data.userId === callerId) {
      throw new Error("Você já está conectado como você mesmo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetUser, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr || !targetUser?.user?.email) {
      throw new Error("Usuário alvo não encontrado ou sem e-mail.");
    }

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
    });
    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error(linkErr?.message || "Falha ao gerar link de acesso.");
    }

    return { actionLink: linkData.properties.action_link, email: targetUser.user.email };
  });

