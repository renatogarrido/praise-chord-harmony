import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, Music2, Album, BarChart3, ListMusic, Church, CalendarCheck, Award, Mic2, CheckCircle2, AlertCircle, Calendar, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
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

const GOLD = "#9b87f5"; // Primário (Roxo suave/Vibrant Indigo)
const PIE_COLORS = ["#9b87f5", "#7E69AB", "#D6BCFA", "#6E59A5", "#E9D8FD", "#B794F4"];

function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
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
  const [availByMonth, setAvailByMonth] = useState<{ month: string; n: number }[]>([]);
  const [availDetails, setAvailDetails] = useState<{ filled: string[]; missing: string[] }>({
    filled: [],
    missing: [],
  });

  useEffect(() => {
    (async () => {
      if (!user) return;

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const since = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      since.setHours(0, 0, 0, 0);

      // 1. Obter papéis e perfil para escopo
      const [roleData, profData] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);

      const roles = (roleData.data ?? []).map((r: any) => r.role as string);
      const myProfile = profData.data;
      setUserRoles(roles);
      setProfile(myProfile);

      const isAdmin = roles.includes("admin");
      const isNacional = roles.includes("lider_nacional");
      const isEstadual = roles.includes("lider_estadual");
      const isLocal = roles.includes("lider_local");

      // 2. Definir escopo de busca
      let userQuery = supabase.from("profiles").select("id, full_name, church_name, vocal_types");
      let churchQuery = supabase.from("churches").select("id, name, estadual", { count: "exact", head: true });
      let availQuery = supabase.from("monthly_availability").select("user_id").eq("month", month).eq("year", year);

      if (isLocal && !isAdmin && !isNacional && !isEstadual) {
        userQuery = userQuery.eq("church_name", myProfile?.church_name || "");
        churchQuery = churchQuery.eq("name", myProfile?.church_name || "");
      } else if (isEstadual && !isAdmin && !isNacional) {
        const { data: churchInfo } = await supabase.from("churches").select("estadual").eq("name", myProfile?.church_name || "").maybeSingle();
        if (churchInfo?.estadual) {
          const { data: relatedChurches } = await supabase.from("churches").select("name").eq("estadual", churchInfo.estadual);
          const names = (relatedChurches ?? []).map(c => c.name);
          userQuery = userQuery.in("church_name", names);
          churchQuery = churchQuery.eq("estadual", churchInfo.estadual);
        }
      }

      const [uRes, sl, al, chRes, avRes, vocCats, ub, bd, recent, allAvail] = await Promise.all([
        userQuery,
        supabase.from("songs").select("id", { count: "exact", head: true }),
        supabase.from("albums").select("id", { count: "exact", head: true }),
        churchQuery,
        availQuery,
        supabase.from("vocals").select("label, value"),
        supabase.from("user_badges").select("badge_id"),
        supabase.from("badges").select("id, name, icon"),
        supabase.from("access_history").select("accessed_at").gte("accessed_at", since.toISOString()),
        supabase.from("monthly_availability").select("month, year").gte("year", year - 1),
      ]);

      const profiles = uRes.data ?? [];
      const totalUsers = profiles.length;
      const filledUserIds = new Set((avRes.data ?? []).map((r: any) => r.user_id));
      
      const filledNames: string[] = [];
      const missingNames: string[] = [];

      profiles.forEach(p => {
        if (filledUserIds.has(p.id)) {
          filledNames.push(p.full_name || "Sem Nome");
        } else {
          missingNames.push(p.full_name || "Sem Nome");
        }
      });

      setAvailDetails({
        filled: filledNames.sort(),
        missing: missingNames.sort(),
      });

      const filledCount = filledNames.length;
      setStats({
        users: totalUsers,
        songs: sl.count ?? 0,
        albums: al.count ?? 0,
        accesses: recent.data?.length ?? 0,
        setlists: 0, // Placeholder
        churches: chRes.count ?? 0,
        availFilled: filledCount,
        availMissing: Math.max(0, totalUsers - filledCount),
      });

      // Tendência de acessos
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

      // Disponibilidade por mês
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const availCounts = new Map<string, number>();
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        availCounts.set(`${m}/${y}`, 0);
      }

      (allAvail.data ?? []).forEach((r: any) => {
        const key = `${r.month}/${r.year}`;
        if (availCounts.has(key)) {
          availCounts.set(key, (availCounts.get(key) ?? 0) + 1);
        }
      });

      setAvailByMonth(
        [...availCounts.entries()].map(([key, n]) => {
          const [m] = key.split("/");
          return { month: monthNames[parseInt(m) - 1], n };
        })
      );

      // Vozes
      const labelByValue = new Map<string, string>();
      (vocCats.data ?? []).forEach((v: any) => labelByValue.set(v.value, v.label));
      const voiceCounts = new Map<string, number>();
      profiles.forEach((p: any) => {
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

      const { data: topData } = await supabase
        .from("access_history")
        .select("song_id, user_id, songs(title), profiles(full_name)")
        .limit(1000);
      const counts = new Map<string, { title: string; n: number }>();
      const userCounts = new Map<string, { name: string; n: number }>();
      topData?.forEach((r: any) => {
        if (r.songs) {
          const c = counts.get(r.song_id) ?? { title: r.songs.title, n: 0 };
          c.n++; counts.set(r.song_id, c);
        }
        if (r.user_id && r.profiles) {
          const name = r.profiles.full_name ?? "Usuário";
          const c = userCounts.get(r.user_id) ?? { name, n: 0 };
          c.n++; userCounts.set(r.user_id, c);
        }
      });
      setTopSongs([...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([id, v]) => ({ id, ...v })));
      setTopUsers([...userCounts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([id, v]) => ({ id, ...v })));
      
      // 4. Fetch schedules with filtering based on hierarchy
      setLoadingSchedules(true);
      
      let schedQuery = supabase
        .from("worship_schedules")
        .select("*, worship_schedule_assignments(*), technical_team_assignments(*)")
        .order("service_date", { ascending: true });

      if (isAdmin || isNacional) {
        // No filter for Admins and National Leaders
      } else if (isEstadual) {
        // State leader sees all churches in their state OR their own church (if estadual is null)
        const { data: churchInfo } = await supabase.from("churches").select("estadual").eq("name", myProfile?.church_name || "").maybeSingle();
        
        if (churchInfo?.estadual) {
          const { data: relatedChurches } = await supabase.from("churches").select("name").eq("estadual", churchInfo.estadual);
          const names = (relatedChurches ?? []).map(c => c.name);
          // Ensure their own church is always included even if not returned by 'related' for some reason
          if (myProfile?.church_name && !names.includes(myProfile.church_name)) {
            names.push(myProfile.church_name);
          }
          schedQuery = schedQuery.in("church_name", names);
        } else if (myProfile?.church_name) {
          // Fallback if estadual is not defined: see at least their own church
          schedQuery = schedQuery.eq("church_name", myProfile.church_name);
        }
      } else if (isLocal) {
        // Local leader sees only their church
        schedQuery = schedQuery.eq("church_name", myProfile?.church_name || "");
      }

      const { data: schedData } = await schedQuery;
      setSchedules(schedData ?? []);
      setLoadingSchedules(false);
    })();
  }, [user]);

  const todaySchedules = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return schedules.filter(s => s.service_date.startsWith(today));
  }, [schedules]);

  const upcomingSchedules = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return schedules.filter(s => new Date(s.service_date) >= now);
  }, [schedules]);

  const cards = [
    { label: "Usuários", value: stats.users, icon: Users },
    { label: "Acessos", value: stats.accesses, icon: BarChart3 },
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

  const isAdmin = userRoles.includes("admin");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="px-6 md:px-12 py-8 md:py-12 max-w-6xl mx-auto"
    >
      <header className="mb-10">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">{isAdmin ? "Administração" : "Liderança"}</p>
        <h1 className="font-serif text-4xl md:text-5xl">Dashboard</h1>
      </header>

      <div className="grid gap-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5 text-gold" />
            <h2 className="font-serif text-2xl">Escalas de Hoje</h2>
          </div>
          {loadingSchedules ? (
            <p className="text-sm text-muted-foreground">Carregando escalas...</p>
          ) : todaySchedules.length === 0 ? (
            <div className="text-center py-8 rounded-xl border border-dashed border-border bg-muted/5">
              <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma escala para hoje.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {todaySchedules.map(s => {
                const isNacional = userRoles.includes("lider_nacional");
                const isEstadual = userRoles.includes("lider_estadual");
                const isLocal = userRoles.includes("lider_local");
                const isAdmin = userRoles.includes("admin");
                
                // Simplified view for National/State leaders, detailed for Local/Admin
                const isSimplified = (isNacional || isEstadual) && !isAdmin;

                return (
                  <div key={s.id} className="p-4 rounded-xl border border-border bg-background hover:border-gold/30 transition-colors group cursor-pointer" onClick={() => {
                    const isTech = s.title.toLowerCase().includes("técnica");
                    nav({ to: "/app/scale/$id", params: { id: s.id }, search: isTech ? { from: "technical" } : undefined });
                  }}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm text-gold group-hover:text-gold-hover transition-colors truncate">{s.title}</h3>
                        {s.church_name && (
                          <p className="text-[10px] text-muted-foreground truncate">{s.church_name}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                        {new Date(s.service_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                    </div>
                    {!isSimplified && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {isTech ? (
                          <>
                            <Badge variant="secondary" className="text-[9px] bg-slate-500/10 text-slate-500 border-none">
                              {s.technical_team_assignments?.filter((a: any) => a.category_id === '10229a18-0bf0-4519-90c6-a4e825f4f4df').length || 0} Som
                            </Badge>
                            <Badge variant="secondary" className="text-[9px] bg-slate-500/10 text-slate-500 border-none">
                              {s.technical_team_assignments?.filter((a: any) => a.category_id === '1937ff02-5ecf-4985-83a3-968e1d9db8ba').length || 0} Luz
                            </Badge>
                            <Badge variant="secondary" className="text-[9px] bg-slate-500/10 text-slate-500 border-none">
                              {s.technical_team_assignments?.filter((a: any) => a.category_id === '5f26bc5d-f944-487f-9e9d-845e48610b93').length || 0} Telão
                            </Badge>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary" className="text-[9px] bg-gold/10 text-gold border-none">
                              {s.worship_schedule_assignments?.filter((a: any) => 
                                (profiles.find(p => p.id === a.user_id)?.instruments?.length || 0) > 0
                              ).length || 0} Músicos
                            </Badge>
                            <Badge variant="secondary" className="text-[9px] bg-gold/10 text-gold border-none">
                              {s.worship_schedule_assignments?.filter((a: any) => 
                                (profiles.find(p => p.id === a.user_id)?.vocal_types?.length || 0) > 0
                              ).length || 0} Vozes
                            </Badge>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ListMusic className="h-5 w-5 text-gold" />
              <h2 className="font-serif text-2xl">Próximas Escalas</h2>
            </div>
            {upcomingSchedules.length > 0 && (
              <div className="flex items-center gap-2">
                <select 
                  className="text-xs bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gold/50"
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) {
                      const s = schedules.find(sched => sched.id === id);
                      const isTech = s?.title?.toLowerCase()?.includes("técnica");
                      nav({ to: "/app/scale/$id", params: { id }, search: isTech ? { from: "technical" } : undefined });
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Ver detalhes...</option>
                  {upcomingSchedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.service_date).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })} - {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {loadingSchedules ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : upcomingSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma escala programada.</p>
          ) : (
            <div className="space-y-2">
              {upcomingSchedules.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:border-gold/30 transition-colors group cursor-pointer" onClick={() => {
                  const isTech = s.title.toLowerCase().includes("técnica");
                  nav({ to: "/app/scale/$id", params: { id: s.id }, search: isTech ? { from: "technical" } : undefined });
                }}>
                  <div className="flex-1">
                    <p className="text-xs font-medium group-hover:text-gold transition-colors">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {new Date(s.service_date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-gold group-hover:translate-x-1 transition-all" />
                </div>
              ))}
              {upcomingSchedules.length > 5 && (
                <p className="text-center text-[9px] text-muted-foreground uppercase tracking-widest pt-2">E mais {upcomingSchedules.length - 5} escalas programadas</p>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {cards.map((c, i) => (
            <motion.div 
              key={c.label} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-gold/50 cursor-default"
            >
              <c.icon className="h-5 w-5 text-gold mb-3" />
              <p className="text-3xl font-serif">{c.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{c.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h2 className="font-serif text-xl mb-5">Acessos nos últimos 14 dias</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accessTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar 
                    dataKey="n" 
                    name="Acessos" 
                    fill={GOLD} 
                    radius={[6, 6, 0, 0]} 
                    isAnimationActive={true}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Disponibilidade por Mês */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className={`rounded-2xl border border-border bg-card p-6 ${!isAdmin ? 'md:col-span-2' : ''}`}
        >
          <h2 className="font-serif text-xl mb-5 text-gold">Disponibilidade por mês</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={availByMonth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar 
                  dataKey="n" 
                  name="Preenchimentos" 
                  fill="#7E69AB" 
                  radius={[6, 6, 0, 0]} 
                  isAnimationActive={true}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
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
                    <Bar dataKey="n" name="Usuários" fill={GOLD} radius={[0, 6, 6, 0]} isAnimationActive={true} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}

        {/* Disponibilidade do mês */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className={`rounded-2xl border border-border bg-card p-6 ${!isAdmin ? 'md:col-span-2' : ''}`}
        >
          <div className="flex items-center gap-2 mb-5">
            <CalendarCheck className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-xl">Disponibilidade do mês</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="h-64 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={availData} 
                    dataKey="value" 
                    nameKey="name" 
                    innerRadius={50} 
                    outerRadius={80} 
                    paddingAngle={3}
                    isAnimationActive={true}
                    animationBegin={200}
                    animationDuration={1200}
                  >
                    {availData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-full md:w-1/2 max-h-64 overflow-y-auto pr-2 space-y-4">
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Preencheram
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availDetails.filled.length > 0 ? (
                    availDetails.filled.map((name, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Ninguém preencheu ainda.</span>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-amber-500 mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Pendentes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availDetails.missing.length > 0 ? (
                    availDetails.missing.map((name, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Todos preencheram.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
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
                    <Bar dataKey="n" name="Conquistas" fill={GOLD} radius={[6, 6, 0, 0]} isAnimationActive={true} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}

        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
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
                    <Bar dataKey="n" name="Acessos" fill={GOLD} radius={[0, 6, 6, 0]} isAnimationActive={true} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Top usuários */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
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
                <Bar dataKey="n" name="Acessos" fill={GOLD} radius={[0, 6, 6, 0]} isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
