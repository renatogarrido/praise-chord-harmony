import { createServerFn } from "@tanstack/react-start";
import { requireVerifiedSupabaseAuth as requireSupabaseAuth } from "@/lib/verified-auth-middleware";

export type BadgeRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  tier: number;
  awarded_at: string | null;
  unlocked: boolean;
};

/** Avalia/atribui conquistas com base no nº de acessos e retorna todos os badges com status. */
export const getMyBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Atribui novos badges (RPC SECURITY DEFINER)
    await supabase.rpc("award_user_badges", { _user_id: userId });

    const [{ data: badges }, { data: mine }, { count }] = await Promise.all([
      supabase.from("badges").select("*").order("threshold", { ascending: true }),
      supabase.from("user_badges").select("badge_id, awarded_at").eq("user_id", userId),
      supabase.from("access_history").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    const awardedMap = new Map((mine ?? []).map((r: any) => [r.badge_id, r.awarded_at]));
    const rows: BadgeRow[] = (badges ?? []).map((b: any) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      icon: b.icon,
      threshold: b.threshold,
      tier: b.tier,
      awarded_at: awardedMap.get(b.id) ?? null,
      unlocked: awardedMap.has(b.id),
    }));

    return { badges: rows, accessCount: count ?? 0 };
  });
