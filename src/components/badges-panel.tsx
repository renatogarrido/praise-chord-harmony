import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Award, Crown, Heart, Music, Sparkles, Trophy, Lock } from "lucide-react";
import { getMyBadges, type BadgeRow } from "@/lib/badges.functions";

const ICONS: Record<string, any> = { award: Award, crown: Crown, heart: Heart, music: Music, sparkles: Sparkles, trophy: Trophy };

export function BadgesPanel() {
  const fetchBadges = useServerFn(getMyBadges);
  const [data, setData] = useState<{ badges: BadgeRow[]; accessCount: number } | null>(null);

  useEffect(() => {
    fetchBadges({ data: undefined as any }).then(setData).catch(() => setData({ badges: [], accessCount: 0 }));
  }, [fetchBadges]);

  if (!data) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Carregando conquistas…</div>;
  }

  const unlocked = data.badges.filter((b) => b.unlocked).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold">Conquistas</p>
          <h2 className="font-serif text-2xl mt-1">Suas Badges</h2>
        </div>
        <div className="text-right">
          <p className="font-serif text-3xl text-gold">{unlocked}<span className="text-muted-foreground/60 text-base">/{data.badges.length}</span></p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{data.accessCount} acessos</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.badges.map((b) => {
          const Icon = ICONS[b.icon] ?? Award;
          const pct = Math.min(100, Math.round((data.accessCount / b.threshold) * 100));
          return (
            <div
              key={b.id}
              className={`rounded-xl border p-4 transition ${b.unlocked ? "border-gold/40 bg-gold/5" : "border-border bg-background/40 opacity-70"}`}
              title={b.description}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-9 w-9 rounded-full grid place-items-center ${b.unlocked ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"}`}>
                  {b.unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground">{b.threshold} acessos</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
              {!b.unlocked && (
                <div className="mt-3 h-1 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-gold/60" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
