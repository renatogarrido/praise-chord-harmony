import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Music2, Album, BarChart3, ListMusic, Church, CalendarCheck, Award, Mic2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/")({ component: Dashboard });

type VoiceRow = { label: string; n: number };
type BadgeRow = { name: string; icon: string; n: number };

function Dashboard() {
  const [stats, setStats] = useState({
    users: 0,
    songs: 0,
    albums: 0,
    accesses: 0,
    setlists: 0,
    churches: 0,
    availFilled: 0,
    availMissing: 0,
  });
  const [topSongs, setTopSongs] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [u, s, a, h, sl, ch, av, profs, vocCats, ub, bd] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("songs").select("id", { count: "exact", head: true }),
        supabase.from("albums").select("id", { count: "exact", head: true }),
        supabase.from("access_history").select("id", { count: "exact", head: true }),
        supabase.from("setlists").select("id", { count: "exact", head: true }),
        supabase.from("churches").select("id", { count: "exact", head: true }),
        supabase.from("monthly_availability").select("user_id").eq("month", month).eq("year", year),
        supabase.from("profiles").select("id, vocal_types"),
        supabase.from("vocals").select("label, value"),
        supabase.from("user_badges").select("badge_id"),
        supabase.from("badges").select("id, name, icon"),
      ]);

      const totalUsers = u.count ?? 0;
      const filled = new Set((av.data ?? []).map((r: any) => r.user_id)).size;
      setStats({
        users: totalUsers,
        songs: s.count ?? 0,
        albums: a.count ?? 0,
        accesses: h.count ?? 0,
        setlists: sl.count ?? 0,
        churches: ch.count ?? 0,
        availFilled: filled,
        availMissing: Math.max(0, totalUsers - filled),
      });

      // Vozes por naipe — conta usuários por valor em profiles.vocal_types
      const labelByValue = new Map<string, string>();
      (vocCats.data ?? []).forEach((v: any) => labelByValue.set(v.value, v.label));
      const voiceCounts = new Map<string, number>();
      (profs.data ?? []).forEach((p: any) => {
        (p.vocal_types ?? []).forEach((vt: string) => {
          voiceCounts.set(vt, (voiceCounts.get(vt) ?? 0) + 1);
        });
      });
      setVoices(
        [...voiceCounts.entries()]
          .map(([value, n]) => ({ label: labelByValue.get(value) ?? value, n }))
          .sort((a, b) => b.n - a.n)
      );

      // Resumo de badges
      const badgeCounts = new Map<string, number>();
      (ub.data ?? []).forEach((r: any) => {
        badgeCounts.set(r.badge_id, (badgeCounts.get(r.badge_id) ?? 0) + 1);
      });
      const byId = new Map<string, { name: string; icon: string }>();
      (bd.data ?? []).forEach((b: any) => byId.set(b.id, { name: b.name, icon: b.icon }));
      setBadges(
        [...badgeCounts.entries()]
          .map(([id, n]) => ({ ...(byId.get(id) ?? { name: "Badge", icon: "award" }), n }))
          .sort((a, b) => b.n - a.n)
      );

      const { data } = await supabase
        .from("access_history")
        .select("song_id, user_id, songs(title), profiles(full_name)")
        .limit(1000);
      const counts = new Map<string, { title: string; n: number }>();
      const userCounts = new Map<string, { name: string; n: number }>();
      data?.forEach((r: any) => {
        if (r.songs) {
          const c = counts.get(r.song_id) ?? { title: r.songs.title, n: 0 };
          c.n++; counts.set(r.song_id, c);
        }
        if (r.user_id) {
          const name = r.profiles?.full_name ?? "Usuário";
          const c = userCounts.get(r.user_id) ?? { name, n: 0 };
          c.n++; userCounts.set(r.user_id, c);
        }
      });
      setTopSongs([...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([id, v]) => ({ id, ...v })));
      setTopUsers([...userCounts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([id, v]) => ({ id, ...v })));
    })();
  }, []);

  const cards = [
    { label: "Usuários", value: stats.users, icon: Users },
    { label: "Cifras", value: stats.songs, icon: Music2 },
    { label: "Álbuns", value: stats.albums, icon: Album },
    { label: "Acessos", value: stats.accesses, icon: BarChart3 },
    { label: "Repertórios", value: stats.setlists, icon: ListMusic },
    { label: "Igrejas", value: stats.churches, icon: Church },
    { label: "Disp. preenchida", value: stats.availFilled, icon: CalendarCheck },
    { label: "Disp. pendente", value: stats.availMissing, icon: CalendarCheck },
  ];

  const maxVoice = voices[0]?.n ?? 1;
  const maxBadge = badges[0]?.n ?? 1;

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-6xl mx-auto">
      <header className="mb-10">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Administração</p>
        <h1 className="font-serif text-4xl md:text-5xl">Dashboard</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-6">
            <c.icon className="h-5 w-5 text-gold mb-3" />
            <p className="text-3xl font-serif">{c.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Mic2 className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-xl">Vozes por naipe</h2>
          </div>
          {voices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <div className="space-y-3">
              {voices.map((v) => (
                <div key={v.label} className="flex items-center gap-4">
                  <span className="flex-1 truncate">{v.label}</span>
                  <div className="w-32 h-1.5 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${(v.n / maxVoice) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-gold w-10 text-right">{v.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Award className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-xl">Badges concedidos</h2>
          </div>
          {badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum badge concedido ainda.</p>
          ) : (
            <div className="space-y-3">
              {badges.map((b) => (
                <div key={b.name} className="flex items-center gap-4">
                  <span className="flex-1 truncate">{b.name}</span>
                  <div className="w-32 h-1.5 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${(b.n / maxBadge) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-gold w-10 text-right">{b.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl mb-5">Cifras mais acessadas</h2>
          {topSongs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de acesso ainda.</p>
          ) : (
            <div className="space-y-3">
              {topSongs.map((s, i) => (
                <div key={s.id} className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground/60 w-6">{i + 1}</span>
                  <span className="flex-1 truncate">{s.title}</span>
                  <div className="w-32 h-1.5 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${(s.n / topSongs[0].n) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-gold w-10 text-right">{s.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl mb-5">Top 10 usuários mais ativos</h2>
          {topUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de acesso ainda.</p>
          ) : (
            <div className="space-y-3">
              {topUsers.map((u, i) => (
                <div key={u.id} className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground/60 w-6">{i + 1}</span>
                  <span className="flex-1 truncate">{u.name}</span>
                  <div className="w-32 h-1.5 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${(u.n / topUsers[0].n) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-gold w-10 text-right">{u.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
