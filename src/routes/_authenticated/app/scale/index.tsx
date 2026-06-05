import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listSchedules, createSchedule, deleteSchedule, listMySetlists } from "@/lib/worship-schedule.functions";
import { generateMonthlySundays } from "@/lib/availability.functions";
import { useAuth } from "@/hooks/use-auth";
import { CalendarDays, Plus, Trash2, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/scale/")({ component: ScalePage });


function ScalePage() {
  const { canManageSchedule, user } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);
  const del = useServerFn(deleteSchedule);
  const setlists = useServerFn(listMySetlists);

  const { data, isLoading, refetch } = useQuery({ queryKey: ["schedules"], queryFn: () => list() });
  const setlistsQ = useQuery({ queryKey: ["my-setlists"], queryFn: () => setlists(), enabled: canManageSchedule });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [notes, setNotes] = useState("");
  const [churchName, setChurchName] = useState("");
  const [setlistId, setSetlistId] = useState<string>("");

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
  const upcoming = schedules.filter((s) => new Date(s.service_date) >= new Date());
  const past = schedules.filter((s) => new Date(s.service_date) < new Date());

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Ministério de Louvor</p>
          <h1 className="font-serif text-4xl md:text-5xl">Escala</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cultos, eventos e os músicos escalados para cada um.</p>
        </div>
        {canManageSchedule && (
          <div className="flex flex-wrap gap-2">
            <GenerateMonthButton onDone={() => refetch()} />
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
              <Plus className="h-4 w-4" /> Nova escala
            </button>
          </div>
        )}
      </header>


      {open && canManageSchedule && (
        <form onSubmit={onCreate} className="mb-8 rounded-2xl border border-border bg-card p-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Título do culto / evento *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Culto de Domingo à noite" />
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Horário</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <Label>Igreja</Label>
            <Input value={churchName} onChange={(e) => setChurchName(e.target.value)} placeholder="Ex: Renascer Local" />
          </div>
          <div>
            <Label>Repertório</Label>
            <select value={setlistId} onChange={(e) => setSetlistId(e.target.value)}
              className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none">
              <option value="">— Sem repertório —</option>
              {(setlistsQ.data as any)?.setlists?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none" />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-widest">Cancelar</button>
            <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground">Criar</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : schedules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            {canManageSchedule ? "Nenhuma escala criada ainda." : "Você ainda não está em nenhuma escala."}
          </p>
        </div>
      ) : (
        <>
          <Group label="Próximas" items={upcoming} userId={user?.id} canManage={canManageSchedule} onDelete={onDelete} />
          {past.length > 0 && <Group label="Anteriores" items={past} userId={user?.id} canManage={canManageSchedule} onDelete={onDelete} muted />}
        </>
      )}
    </div>
  );
}

function Group({ label, items, userId, canManage, onDelete, muted }: any) {
  return (
    <section className="mb-10">
      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/60 mb-3">{label}</p>
      <div className="grid gap-3">
        {items.map((s: any) => {
          const mine = (s.worship_schedule_assignments ?? []).filter((a: any) => a.user_id === userId);
          return (
            <Link key={s.id} to="/app/scale/$id" params={{ id: s.id }}
              className={`rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-3 hover:border-gold/40 transition-colors ${muted ? "opacity-70" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(s.service_date).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
                  {s.church_name ? ` · ${s.church_name}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mine.map((a: any) => (
                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-gold-soft text-gold text-[11px] px-2.5 py-1">
                      Você: {a.role_label}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 rounded-full bg-background border border-border text-muted-foreground text-[11px] px-2.5 py-1">
                    <Users className="h-3 w-3" /> {(s.worship_schedule_assignments ?? []).length} escalados
                  </span>
                </div>
              </div>
              {canManage && (
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(s.id); }}
                  className="rounded-lg p-2 hover:bg-accent text-muted-foreground hover:text-destructive" title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Label({ children }: any) {
  return <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{children}</label>;
}
function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none" />;
}

function GenerateMonthButton({ onDone }: { onDone: () => void }) {
  const gen = useServerFn(generateMonthlySundays);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [church, setChurch] = useState("");
  const [busy, setBusy] = useState(false);

  const opts: { y: number; m: number; label: string }[] = [];
  const base = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    opts.push({ y: d.getFullYear(), m: d.getMonth() + 1, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
  }

  const run = async () => {
    setBusy(true);
    try {
      const r: any = await gen({ data: { year, month, churchName: church.trim() || null } });
      toast.success(`Geradas ${r.createdSchedules} escalas (${r.createdAssignments} escalações) em ${r.sundayCount} domingos.`);
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-5 py-3 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/15">
        <Wand2 className="h-4 w-4" /> Gerar mês
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-2xl mb-1">Gerar escala mensal</h3>
            <p className="text-xs text-muted-foreground mb-5">Cria 4 escalas (08:00, 10:00, 16:00, 18:00) para cada domingo, usando a disponibilidade dos usuários.</p>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Mês</label>
            <select
              value={`${year}-${month}`}
              onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); setYear(y); setMonth(m); }}
              className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm capitalize mb-4 focus:border-gold/50 focus:outline-none"
            >
              {opts.map((o) => <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`} className="capitalize">{o.label}</option>)}
            </select>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Igreja (opcional)</label>
            <Input value={church} onChange={(e) => setChurch(e.target.value)} placeholder="Ex: Renascer Local" />
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setOpen(false)} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest disabled:opacity-50">Cancelar</button>
              <button disabled={busy} onClick={run} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
                <Wand2 className="h-3.5 w-3.5" /> {busy ? "Gerando…" : "Gerar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

