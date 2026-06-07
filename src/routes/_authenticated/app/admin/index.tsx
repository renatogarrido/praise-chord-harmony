import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Music2, Album, BarChart3, ListMusic, Church, CalendarCheck, Award, Mic2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/app/admin/")({ component: Dashboard });

type VoiceRow = { label: string; n: number };
type BadgeRow = { name: string; icon: string; n: number };

const GOLD = "#C5A059";
const PIE_COLORS = ["#C5A059", "#8B6F3F", "#E0C896", "#5F4A2A", "#F2E0B8", "#A88550"];

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
  const [topSongs, setTopSongs] = useState<{ id: string; title: string; n: number }[]>([]);
  const [topUsers, setTopUsers] = useState<{ id: string; name: string; n: number }[]>([]);
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [accessTrend, setAccessTrend] = useState<{ day: string; n: number }[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const since = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      since.setHours(0, 0, 0, 0);

      const [u, s, a, h, sl, ch, av, profs, vocCats, ub, bd, recent] = await Promise.all([
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
        supabase.from("access_history").select("accessed_at").gte("accessed_at", since.toISOString()),
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

      // Tendência de acessos (últimos 14 dias)
      const dayCounts = new Map<string, number>();
      for (let i = 0; i < 14; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        dayCounts.set(d.toISOString().slice(0, 10), 0);
      }
      (recent.data ?? []).forEach((r: any) => {
        const k = String(r.accessed_at).slice(0, 10);
        if (dayCounts.has(k)) dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
      });
      setAccessTrend(
        [...dayCounts.entries()].map(([k, n]) => ({
          day: `${k.slice(8, 10)}/${k.slice(5, 7)}`,
          n,
        }))
      );

      // Vozes por naipe
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

      // Badges
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

  const availData = [
    { name: "Preenchida", value: stats.availFilled },
    { name: "Pendente", value: stats.availMissing },
  ];

  const tooltipStyle = {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: "hsl(var(--muted-foreground))" },
    itemStyle: { color: GOLD },
  };

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

      {/* Tendência de acessos */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="font-serif text-xl mb-5">Acessos nos últimos 14 dias</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accessTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="n" name="Acessos" fill={GOLD} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Vozes por naipe */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Mic2 className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-xl">Vozes por naipe</h2>
          </div>
          {voices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={voices} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={90} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="n" name="Usuários" fill={GOLD} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Disponibilidade do mês */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <CalendarCheck className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-xl">Disponibilidade do mês</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={availData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {availData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Badges */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Award className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-xl">Badges concedidos</h2>
          </div>
          {badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum badge concedido ainda.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={badges} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="n" name="Conquistas" fill={GOLD} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top cifras */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl mb-5">Cifras mais acessadas</h2>
          {topSongs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de acesso ainda.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSongs} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="title" width={110} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="n" name="Acessos" fill={GOLD} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top usuários */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-serif text-xl mb-5">Top 10 usuários mais ativos</h2>
        {topUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de acesso ainda.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topUsers} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="n" name="Acessos" fill={GOLD} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
