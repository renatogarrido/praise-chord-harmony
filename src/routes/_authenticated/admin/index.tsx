import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Music2, Album, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

function Dashboard() {
  const [stats, setStats] = useState({ users: 0, songs: 0, albums: 0, accesses: 0 });
  const [topSongs, setTopSongs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [u, s, a, h] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("songs").select("id", { count: "exact", head: true }),
        supabase.from("albums").select("id", { count: "exact", head: true }),
        supabase.from("access_history").select("id", { count: "exact", head: true }),
      ]);
      setStats({ users: u.count ?? 0, songs: s.count ?? 0, albums: a.count ?? 0, accesses: h.count ?? 0 });

      const { data } = await supabase.from("access_history").select("song_id, songs(title)").limit(500);
      const counts = new Map<string, { title: string; n: number }>();
      data?.forEach((r: any) => {
        if (!r.songs) return;
        const c = counts.get(r.song_id) ?? { title: r.songs.title, n: 0 };
        c.n++; counts.set(r.song_id, c);
      });
      setTopSongs([...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([id, v]) => ({ id, ...v })));
    })();
  }, []);

  const cards = [
    { label: "Usuários", value: stats.users, icon: Users },
    { label: "Cifras", value: stats.songs, icon: Music2 },
    { label: "Álbuns", value: stats.albums, icon: Album },
    { label: "Acessos", value: stats.accesses, icon: BarChart3 },
  ];

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
    </div>
  );
}
