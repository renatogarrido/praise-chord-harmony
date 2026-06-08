import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireVerifiedSupabaseAuth as requireSupabaseAuth } from "@/lib/verified-auth-middleware";

const MANAGER_ROLES = ["admin", "lider_nacional", "lider_estadual"] as const;
type ManagerRole = (typeof MANAGER_ROLES)[number];

function throwSafe(label: string, error: unknown): never {
  console.error(`[leader-users] ${label}`, error);
  throw new Error("Não foi possível concluir a operação. Tente novamente.");
}

async function assertCanManageLocalLeaders(supabase: any, callerId: string): Promise<ManagerRole> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", MANAGER_ROLES as unknown as string[]);
  if (error) throwSafe("check local leader manager role", error);
  const role = (data ?? []).map((r: any) => r.role as string).find((r: string) =>
    (MANAGER_ROLES as readonly string[]).includes(r)
  ) as ManagerRole | undefined;
  if (!role) {
    throw new Error("Acesso negado: apenas líderes nacionais, estaduais ou administradores podem cadastrar líderes locais.");
  }
  return role;
}

export const createLocalLeaderUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(6).max(128),
        fullName: z.string().min(1).max(255),
        churchName: z.string().max(255).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertCanManageLocalLeaders(supabase, callerId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, church_name: data.churchName ?? null },
    });
    if (createErr) throwSafe("create local leader", createErr);
    const newId = created.user!.id;

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        church_name: data.churchName || null,
      } as any)
      .eq("id", newId);

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: "lider_local" as any });

    return { ok: true, userId: newId };
  });

export const listLocalLeaders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId: callerId } = context;
    await assertCanManageLocalLeaders(supabase, callerId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "lider_local" as any);
    if (rErr) throwSafe("list local leader roles", rErr);

    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return { users: [] };

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, church_name, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (pErr) throwSafe("list local leader profiles", pErr);

    // Fetch emails
    const emailMap = new Map<string, string | null>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throwSafe("list auth users", error);
      data.users.forEach((u) => emailMap.set(u.id, u.email ?? null));
      if (data.users.length < perPage) break;
      page += 1;
    }

    const users = (profiles ?? []).map((p: any) => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
    }));

    return { users };
  });
