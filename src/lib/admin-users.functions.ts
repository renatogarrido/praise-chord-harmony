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
