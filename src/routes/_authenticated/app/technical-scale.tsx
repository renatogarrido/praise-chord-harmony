import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Users, Calendar, Music2, Plus, Trash2, Wand2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSchedules, createSchedule, deleteSchedule } from "@/lib/worship-schedule.functions";
import { generateMonthlySundays } from "@/lib/availability.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/technical-scale")({
  component: TechnicalScalePage,
});

function TechnicalScalePage() {
  const { canManageSchedule } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);
  const del = useServerFn(deleteSchedule);
  const gen = useServerFn(generateMonthlySundays);

  const { data, isLoading, refetch } = useQuery({ queryKey: ["schedules", "technical"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [churchName, setChurchName] = useState("");
  const [busy, setBusy] = useState(false);

  const schedules: any[] = (data as any)?.schedules ?? [];
  const upcoming = schedules.filter((s) => new Date(s.service_date) >= new Date());

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return toast.error("Preencha título e data.");
    try {
      const isoDate = new Date(`${date}T${time || "19:00"}:00`).toISOString();
      const r = await create({ data: {
        title: title.trim(),
        serviceDate: isoDate,
        churchName: churchName.trim() || null,
      }});
      toast.success("Escala manual criada!");
      setOpen(false);
      nav({ to: "/app/scale/$id", params: { id: (r as any).id } });
    } catch (err: any) { toast.error(err.message || "Erro"); }
  };

  const handleGenerate = async () => {
    if (!confirm("Isso gerará as escalas para os domingos do mês atual com base na disponibilidade. Continuar?")) return;
    setBusy(true);
    try {
      const now = new Date();
      const r: any = await gen({ data: { year: now.getFullYear(), month: now.getMonth() + 1 } });
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="font-serif text-4xl text-gold mb-2">Escala Técnica</h1>
            <p className="text-muted-foreground">Gerenciamento da equipe de som, iluminação e telão.</p>
          </div>
          {canManageSchedule && (
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                className="gap-2 border-gold/40 text-gold hover:bg-gold/10"
                onClick={handleGenerate}
                disabled={busy}
              >
                <Wand2 className="h-4 w-4" />
                {busy ? "Gerando..." : "Gerar Escala Automática"}
              </Button>

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
              <Calendar className="w-4 h-4 text-gold" />
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
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">Nenhuma escala técnica programada.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {upcoming.map((s) => (
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
