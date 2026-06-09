import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Users, Music2, Plus, Trash2, Wand2, ArrowRight, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSchedules, createSchedule, deleteSchedule, getSchedule, listAllChurches } from "@/lib/worship-schedule.functions";
import { generateMonthlySchedules } from "@/lib/availability.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/app/technical-scale")({
  component: TechnicalScalePage,
});

function TechnicalScalePage() {
  const { isAdmin, canManageSchedule, user } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);
  const del = useServerFn(deleteSchedule);
  const gen = useServerFn(generateMonthlySchedules);
  const listChurches = useServerFn(listAllChurches);

  const { data, isLoading, refetch } = useQuery({ queryKey: ["schedules", "technical"], queryFn: () => list() });
  
  const profQ = useQuery({ 
    queryKey: ["my-profile-church", user?.id], 
    queryFn: () => supabase.from("profiles").select("church_name").eq("id", user?.id || "").maybeSingle(),
    enabled: !!user?.id
  });
  
  const userRolesQ = useQuery({ 
    queryKey: ["user-roles", user?.id], 
    queryFn: () => supabase.from("user_roles").select("role").eq("user_id", user?.id || ""),
    enabled: !!user?.id
  });

  const roles = (userRolesQ.data as any)?.data ?? [];
  const roleNames = roles.map((r: any) => r.role as string);
  const isNacional = roleNames.includes("lider_nacional");
  const isEstadual = roleNames.includes("lider_estadual");
  const isLocal = roleNames.includes("lider_local");
  const myChurch = (profQ.data as any)?.data?.church_name;

  const churchesQ = useQuery({ 
    queryKey: ["all-churches-picker-tech"], 
    queryFn: () => listChurches(),
    enabled: canManageSchedule && (isAdmin || isNacional || isEstadual)
  });

  const filteredChurches = useMemo(() => {
    const all = (churchesQ.data as any)?.churches ?? [];
    if (isAdmin || isNacional) return all;
    if (isEstadual) {
      const myChurchObj = all.find((c: any) => c.name === myChurch);
      if (myChurchObj?.estadual) {
        return all.filter((c: any) => c.estadual === myChurchObj.estadual);
      }
      return myChurch ? all.filter((c: any) => c.name === myChurch) : [];
    }
    return [];
  }, [churchesQ.data, isAdmin, isNacional, isEstadual, myChurch]);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [churchName, setChurchName] = useState("");
  const [busy, setBusy] = useState(false);
  const [includeWeekdays, setIncludeWeekdays] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const schedules: any[] = ((data as any)?.schedules ?? []).filter((s: any) => 
    s.title.toLowerCase().includes("técnica") || (s.technical_team_assignments?.length > 0)
  );
  const upcoming = schedules.filter((s) => {
    const d = new Date(s.service_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d >= now;
  }).sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime());

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return toast.error("Preencha título e data.");
    try {
      const isoDate = new Date(`${date}T${time || "19:00"}:00`).toISOString();
      const r = await create({ data: {
        title: title.trim().toLowerCase().includes("técnica") ? title.trim() : `${title.trim()} (Técnica)`,
        serviceDate: isoDate,
        churchName: churchName.trim() || null,
      }});
      toast.success("Escala manual criada!");
      setOpen(false);
      refetch();
      setTitle(""); setDate(""); setTime("19:00"); setChurchName("");
      // Navega para a escala recém criada mantendo o contexto técnico
      nav({ to: "/app/scale/$id", params: { id: (r as any).id }, search: { from: "technical" } });
    } catch (err: any) { toast.error(err.message || "Erro"); }
  };

  const handleGenerate = async () => {
    if (!confirm(`Isso gerará as escalas para ${includeWeekdays ? "todos os dias" : "os domingos"} do mês atual com base na disponibilidade. Continuar?`)) return;
    setBusy(true);
    try {
      const now = new Date();
      const r: any = await gen({ data: { year: now.getFullYear(), month: now.getMonth() + 1, includeWeekdays } });
      toast.success(`Geradas ${r.createdSchedules} escalas técnicas automáticas.`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar escala.");
    } finally {
      setBusy(false);
    }
  };

  const stats = {
    som: upcoming.reduce((acc, s) => acc + (s.worship_schedule_assignments?.filter((a: any) => a.role_label.toLowerCase().includes("som")).length || 0), 0),
    luz: upcoming.reduce((acc, s) => acc + (s.worship_schedule_assignments?.filter((a: any) => a.role_label.toLowerCase().includes("iluminacao")).length || 0), 0),
    telao: upcoming.reduce((acc, s) => acc + (s.worship_schedule_assignments?.filter((a: any) => a.role_label.toLowerCase().includes("telao")).length || 0), 0),
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
            <h1 className="font-serif text-4xl text-gold mb-2">Escala Técnica</h1>
            <p className="text-muted-foreground">Gerenciamento da equipe de som, iluminação e telão.</p>
          </div>
          {canManageSchedule && (
            <div className="flex flex-col gap-3 items-end">
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center space-x-2 mr-4 bg-card/40 p-2 rounded-lg border border-border/30">
                  <Checkbox 
                    id="includeWeekdays" 
                    checked={includeWeekdays} 
                    onCheckedChange={(checked) => setIncludeWeekdays(!!checked)}
                  />
                  <Label htmlFor="includeWeekdays" className="text-xs cursor-pointer">Segunda a Sábado</Label>
                </div>
                <Button 
                  variant="outline" 
                  className="gap-2 border-gold/40 text-gold hover:bg-gold/10"
                  onClick={handleGenerate}
                  disabled={busy}
                >
                  <Wand2 className="h-4 w-4" />
                  {busy ? "Gerando..." : "Gerar Escala Automática"}
                </Button>

              </div>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gold hover:bg-gold/90 text-white gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Escala Manual
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Escala Técnica Manual</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={onCreate} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Culto de Celebração" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data</Label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora</Label>
                        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Igreja</Label>
                      <Input value={churchName} onChange={(e) => setChurchName(e.target.value)} placeholder="Nome da igreja" />
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
                locale={undefined} // Falls back to default, pt-BR would be nice if imported
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-card/30 backdrop-blur-sm border-border/30 border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif">
                  {selectedDate ? (
                    `Escalados para: ${selectedDate.toLocaleDateString("pt-BR", { dateStyle: "long" })}`
                  ) : "Selecione uma data"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  {selectedDate ? (() => {
                    const dateStr = selectedDate.toISOString().split("T")[0];
                    const daySchedules = schedules.filter(s => s.service_date.startsWith(dateStr));
                    
                    if (daySchedules.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-10">Nenhuma escala para este dia.</p>;
                    }

                    return (
                      <div className="space-y-6">
                        {daySchedules.map(s => {
                          // Note: the listSchedules fn doesn't include technical assignments in the main list yet,
                          // but for simplicity in this view we can show what we have or just link to detail.
                          // Actually, I should probably update listSchedules to include technical info if I want it here.
                          return (
                            <div key={s.id} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gold">{s.title}</h4>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {new Date(s.service_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {/* For now showing names if assignments are loaded */}
                                {s.worship_schedule_assignments?.length > 0 ? (
                                  s.worship_schedule_assignments.map((a: any) => (
                                    <Badge key={a.id} variant="secondary" className="bg-secondary/50 text-[10px]">
                                      {a.role_label}: {a.user_id.slice(0, 5)}...
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">Ver detalhes para lista completa</span>
                                )}
                              </div>
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-xs text-gold mt-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  nav({ to: "/app/scale/$id", params: { id: s.id }, search: { from: "technical" } });
                                }}
                              >
                                Abrir escala completa <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </div>
                          );
                        })}
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
              <CardTitle className="text-sm font-medium">Equipe de Som</CardTitle>
              <Users className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.som || "--"}</div>
              <p className="text-xs text-muted-foreground mt-1">Escalados nas próximas datas</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Iluminação</CardTitle>
              <CalendarIcon className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.luz || "--"}</div>
              <p className="text-xs text-muted-foreground mt-1">Colaboradores ativos</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Telão</CardTitle>
              <Music2 className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.telao || "--"}</div>
              <p className="text-xs text-muted-foreground mt-1">Pessoas qualificadas</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="font-serif text-2xl mb-6">Próximas Escalas</h2>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando escalas...</div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">Nenhuma escala técnica programada.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {upcoming.map((s) => (
                <div 
                  key={s.id}
                  className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4 hover:border-gold/40 transition-colors group cursor-pointer"
                  onClick={() => nav({ to: "/app/scale/$id", params: { id: s.id }, search: { from: "technical" } })}
                >
                  <div className="flex-1">
                    <h3 className="font-serif text-xl group-hover:text-gold transition-colors">{s.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {new Date(s.service_date).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
                      {s.church_name ? ` · ${s.church_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-wrap gap-2 justify-end">
                      {/* Show tech assignments summary if needed */}
                    </div>
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
