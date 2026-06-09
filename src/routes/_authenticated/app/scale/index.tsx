import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Plus, Trash2, Users, Wand2, Music2, ArrowRight, Calendar as CalendarIcon, ListMusic } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSchedules, createSchedule, deleteSchedule, listMySetlists } from "@/lib/worship-schedule.functions";
import { generateMonthlySchedules } from "@/lib/availability.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/app/scale/")({ component: ScalePage });

function ScalePage() {
  const { canManageSchedule, user } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);
  const del = useServerFn(deleteSchedule);
  const setlistsFn = useServerFn(listMySetlists);
  const gen = useServerFn(generateMonthlySchedules);

  const { data, isLoading, refetch } = useQuery({ queryKey: ["schedules"], queryFn: () => list() });
  const setlistsQ = useQuery({ queryKey: ["my-setlists"], queryFn: () => setlistsFn(), enabled: canManageSchedule });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [notes, setNotes] = useState("");
  const [churchName, setChurchName] = useState("");
  const [setlistId, setSetlistId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [busy, setBusy] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return toast.error("Preencha título e data.");
    try {
      const isoDate = new Date(`${date}T${time || "19:00"}:00`).toISOString();
      const r = await create({ data: {
        title: title.trim(),
        serviceDate: isoDate,
        notes: notes.trim() || null,
        churchName: churchName.trim() || null,
        setlistId: setlistId || null,
      }});
      toast.success("Escala criada!");
      setOpen(false);
      setTitle(""); setDate(""); setTime("19:00"); setNotes(""); setChurchName(""); setSetlistId("");
      nav({ to: "/app/scale/$id", params: { id: (r as any).id } });
    } catch (err: any) { toast.error(err.message || "Erro"); }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta escala?")) return;
    try { await del({ data: { id } }); toast.success("Escala excluída."); refetch(); }
    catch (e: any) { toast.error(e.message || "Erro"); }
  };

  const schedules: any[] = (data as any)?.schedules ?? [];
  
  const upcoming = schedules.filter((s) => {
    const d = new Date(s.service_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d >= now;
  }).sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime());

  const stats = {
    total: upcoming.length,
    assigned: upcoming.filter(s => (s.worship_schedule_assignments ?? []).some((a: any) => a.user_id === user?.id)).length,
    musicians: upcoming.reduce((acc, s) => acc + (s.worship_schedule_assignments?.length || 0), 0),
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
          <div>
            <h1 className="font-serif text-4xl text-gold mb-2">Escala de Louvor</h1>
            <p className="text-muted-foreground">Cultos, eventos e músicos escalados.</p>
          </div>
          {canManageSchedule && (
            <div className="flex flex-wrap gap-3">
              <GenerateMonthButton onDone={() => refetch()} />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gold hover:bg-gold/90 text-white gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Escala
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Escala</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={onCreate} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Título do culto / evento *</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Culto de Domingo" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data *</Label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora</Label>
                        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Igreja</Label>
                      <Input value={churchName} onChange={(e) => setChurchName(e.target.value)} placeholder="Ex: Renascer Local" />
                    </div>
                    <div className="space-y-2">
                      <Label>Repertório</Label>
                      <select value={setlistId} onChange={(e) => setSetlistId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50">
                        <option value="">— Sem repertório —</option>
                        {(setlistsQ.data as any)?.setlists?.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                      <Button type="submit" className="bg-gold text-white">Criar</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[350px_1fr] mb-12">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-gold" />
                Calendário de Escalas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex justify-center pb-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(val) => setSelectedDate(val)}
                className="rounded-md"
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-card/30 backdrop-blur-sm border-border/30 border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif">
                  {selectedDate ? (
                    `Escalas em: ${selectedDate.toLocaleDateString("pt-BR", { dateStyle: "long" })}`
                  ) : "Selecione uma data"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  {selectedDate ? (() => {
                    const dateStr = selectedDate.toISOString().split("T")[0];
                    const daySchedules = schedules.filter(s => s.service_date.startsWith(dateStr) && (s.worship_schedule_assignments?.length > 0 || !s.title.toLowerCase().includes("técnica")));
                    
                    if (daySchedules.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-10">Nenhuma escala para este dia.</p>;
                    }

                    return (
                      <div className="space-y-6">
                        {daySchedules.map(s => (
                          <div key={s.id} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gold">{s.title}</h4>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {new Date(s.service_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {s.worship_schedule_assignments?.length > 0 ? (
                                s.worship_schedule_assignments.map((a: any) => (
                                  <Badge key={a.id} variant="secondary" className="bg-secondary/50 text-[10px]">
                                    {a.role_label}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Ninguém escalado ainda</span>
                              )}
                            </div>
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="h-auto p-0 text-xs text-gold"
                              onClick={() => nav({ to: "/app/scale/$id", params: { id: s.id } })}
                            >
                              Ver Detalhes <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })() : null}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-10">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Próximos Cultos</CardTitle>
              <CalendarIcon className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">Escalas programadas</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Minhas Escalações</CardTitle>
              <Users className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assigned}</div>
              <p className="text-xs text-muted-foreground mt-1">Datas em que você toca/canta</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total de Músicos</CardTitle>
              <Music2 className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.musicians}</div>
              <p className="text-xs text-muted-foreground mt-1">Escalações confirmadas</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="font-serif text-2xl mb-6">Lista de Escalas</h2>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando escalas...</div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">Nenhuma escala programada.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {upcoming.filter(s => s.worship_schedule_assignments?.length > 0 || !s.title.toLowerCase().includes("técnica")).map((s) => (
                <div 
                  key={s.id}
                  className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4 hover:border-gold/40 transition-colors group cursor-pointer"
                  onClick={() => nav({ to: "/app/scale/$id", params: { id: s.id } })}
                >
                  <div className="flex-1">
                    <h3 className="font-serif text-xl group-hover:text-gold transition-colors">{s.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {new Date(s.service_date).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
                      {s.church_name ? ` · ${s.church_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {canManageSchedule && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gold transition-all group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function GenerateMonthButton({ onDone }: { onDone: () => void }) {
  const gen = useServerFn(generateMonthlySchedules);
  const setlistsFn = useServerFn(listMySetlists);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [includeWeekdays, setIncludeWeekdays] = useState(false);
  const [sundaySetlists, setSundaySetlists] = useState<Record<string, string>>({});

  const setlistsQ = useQuery({
    queryKey: ["my-setlists", "gen"],
    queryFn: () => setlistsFn(),
    enabled: open,
  });
  const setlists: { id: string; name: string }[] = (setlistsQ.data as any)?.setlists ?? [];

  const opts: { y: number; m: number; label: string }[] = [];
  const base = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    opts.push({ y: d.getFullYear(), m: d.getMonth() + 1, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
  }

  const sundays: { ymd: string; label: string }[] = [];
  {
    const last = new Date(year, month, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const dt = new Date(year, month - 1, d);
      if (dt.getDay() === 0) {
        const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        sundays.push({
          ymd,
          label: dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }),
        });
      }
    }
  }

  const run = async () => {
    setBusy(true);
    try {
      const payloadSetlists: Record<string, string> = {};
      for (const [k, v] of Object.entries(sundaySetlists)) if (v) payloadSetlists[k] = v;
      const r: any = await gen({ data: { year, month, churchName: null, sundaySetlists: payloadSetlists, includeWeekdays } });
      toast.success(`Geradas ${r.createdSchedules} escalas (${r.createdAssignments} escalações).`);
      setOpen(false);
      setSundaySetlists({});
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2 border-gold/40 text-gold hover:bg-gold/10">
        <Wand2 className="h-4 w-4" /> Gerar Mês
      </Button>
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Gerar Escala Mensal Automática</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <select
                  value={`${year}-${month}`}
                  onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); setYear(y); setMonth(m); setSundaySetlists({}); }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 capitalize"
                >
                  {opts.map((o) => <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.label}</option>)}
                </select>
              </div>

              <div className="flex items-center space-x-2 bg-card/40 p-3 rounded-lg border border-border/30">
                <Checkbox 
                  id="genWeekdays" 
                  checked={includeWeekdays} 
                  onCheckedChange={(checked) => setIncludeWeekdays(!!checked)}
                />
                <Label htmlFor="genWeekdays" className="text-xs cursor-pointer">Incluir dias da semana (Segunda a Sábado)</Label>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Repertório por Domingo</Label>
                <ScrollArea className="h-[200px] pr-4">
                  <div className="space-y-3">
                    {sundays.map((s) => (
                      <div key={s.ymd} className="rounded-lg border border-border bg-background p-3">
                        <p className="text-xs font-medium capitalize mb-2">{s.label}</p>
                        <select
                          value={sundaySetlists[s.ymd] ?? ""}
                          onChange={(e) => setSundaySetlists((prev) => ({ ...prev, [s.ymd]: e.target.value }))}
                          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                        >
                          <option value="">— Sem repertório —</option>
                          {setlists.map((sl) => (
                            <option key={sl.id} value={sl.id}>{sl.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button disabled={busy} variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={busy} onClick={run} className="bg-gold text-white gap-2">
                  <Wand2 className="h-4 w-4" /> {busy ? "Gerando..." : "Gerar Escala"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
