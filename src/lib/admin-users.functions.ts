import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    await assertAdmin(supabase, callerId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const { data: roles, error: rErr } = await supabaseAdmin.from("user_roles").select("*");
    if (rErr) throw new Error(rErr.message);

    const roleMap = new Map<string, string[]>();
    roles?.forEach((r: any) => {
      const a = roleMap.get(r.user_id) || [];
      a.push(r.role);
      roleMap.set(r.user_id, a);
    });

    const users = (profiles ?? []).map((p: any) => ({
      ...p,
      email: emailMap.get(p.id)?.email ?? null,
      last_sign_in_at: emailMap.get(p.id)?.last_sign_in_at ?? null,
      roles: roleMap.get(p.id) ?? [],
    }));

    return { users };
  });
