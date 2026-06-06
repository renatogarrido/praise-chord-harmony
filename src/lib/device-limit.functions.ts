import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Limita usuários comuns a no máximo 2 sessões ativas (dispositivos).
 * Administradores não têm limite.
 * A sessão atual é preservada; as mais antigas excedentes são revogadas.
 */
export const enforceDeviceLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const MAX_SESSIONS = 2;
    const { userId, claims } = context;
    const currentSessionId = (claims as any)?.session_id as string | undefined;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Admins têm sessões ilimitadas
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (isAdmin) return { ok: true, skipped: "admin" as const };

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[device-limit] missing supabase env");
      return { ok: false };
    }

    // Lista sessões do usuário via Admin REST API
    let sessions: Array<{ id: string; created_at: string; updated_at: string }> = [];
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!res.ok) {
        console.error("[device-limit] listSessions failed", res.status);
        return { ok: false };
      }
      const json = (await res.json()) as { sessions?: typeof sessions };
      sessions = json.sessions ?? [];
    } catch (e) {
      console.error("[device-limit] listSessions error", e);
      return { ok: false };
    }

    if (sessions.length <= MAX_SESSIONS) return { ok: true, revoked: 0 };

    // Mantém a sessão atual + as mais recentes; revoga o resto
    const sorted = sessions
      .slice()
      .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime());

    const keep = new Set<string>();
    if (currentSessionId && sorted.some((s) => s.id === currentSessionId)) {
      keep.add(currentSessionId);
    }
    for (const s of sorted) {
      if (keep.size >= MAX_SESSIONS) break;
      keep.add(s.id);
    }
    const toRevoke = sorted.filter((s) => !keep.has(s.id));

    let revoked = 0;
    for (const s of toRevoke) {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/sessions/${s.id}`, {
          method: "DELETE",
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
        if (res.ok) revoked++;
        else console.error("[device-limit] revoke failed", s.id, res.status);
      } catch (e) {
        console.error("[device-limit] revoke error", s.id, e);
      }
    }

    return { ok: true, revoked };
  });
