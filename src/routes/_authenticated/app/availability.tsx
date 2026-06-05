import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Save } from "lucide-react";
import {
  getMyAvailability,
  saveMyAvailability,
  SUNDAY_SERVICES,
} from "@/lib/availability.functions";

export const Route = createFileRoute("/_authenticated/app/availability")({
  component: AvailabilityPage,
});

const WEEKDAYS: { key: string; label: string }[] = [
  { key: "1", label: "Segunda" },
  { key: "2", label: "Terça" },
  { key: "3", label: "Quarta" },
  { key: "4", label: "Quinta" },
  { key: "5", label: "Sexta" },
  { key: "6", label: "Sábado" },
];

type Slot = { start: string; end: string } | null;

function AvailabilityPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const get = useServerFn(getMyAvailability);
  const save = useServerFn(saveMyAvailability);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-availability", year, month],
    queryFn: () => get({ data: { year, month } }),
  });

  const [weekdays, setWeekdays] = useState<Record<string, Slot>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  // Per-Sunday-date map: { "YYYY-MM-DD": Set<"08:00"|"10:00"|...> }
  const [sundaysByDate, setSundaysByDate] = useState<Record<string, Set<string>>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Compute Sundays in the selected month
  const monthSundays = useMemo(() => {
    const result: { ymd: string; date: Date }[] = [];
    const last = new Date(year, month, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const dt = new Date(year, month - 1, d);
      if (dt.getDay() === 0) {
        const ymd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        result.push({ ymd, date: dt });
      }
    }
    return result;
  }, [year, month]);

  useEffect(() => {
    const a = (data as any)?.availability;
    const wk: Record<string, Slot> = {};
    const en: Record<string, boolean> = {};
    for (const { key } of WEEKDAYS) {
      const slot = a?.weekdays?.[key] ?? null;
      wk[key] = slot ?? { start: "19:00", end: "22:00" };
      en[key] = !!slot;
    }
    setWeekdays(wk);
    setEnabled(en);

    // Hydrate per-Sunday map. Supports legacy array format (apply to every Sunday).
    const raw = a?.sunday_services;
    const next: Record<string, Set<string>> = {};
    if (Array.isArray(raw)) {
      for (const { ymd } of monthSundays) next[ymd] = new Set(raw as string[]);
    } else if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        next[k] = new Set(v as string[]);
      }
    }
    setSundaysByDate(next);
    setNotes(a?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, year, month]);

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [year, month]
  );

  const monthOptions = useMemo(() => {
    const opts: { y: number; m: number; label: string }[] = [];
    const base = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < 6; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      opts.push({
        y: d.getFullYear(),
        m: d.getMonth() + 1,
        label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSunday = (ymd: string, t: string) => {
    setSundaysByDate((prev) => {
      const cur = new Set(prev[ymd] ?? []);
      if (cur.has(t)) cur.delete(t);
      else cur.add(t);
      return { ...prev, [ymd]: cur };
    });
  };

  const setAllForDate = (ymd: string, on: boolean) => {
    setSundaysByDate((prev) => ({
      ...prev,
      [ymd]: new Set(on ? SUNDAY_SERVICES : []),
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payloadWeekdays: Record<string, Slot> = {};
      for (const { key } of WEEKDAYS) {
        payloadWeekdays[key] = enabled[key] ? weekdays[key] : null;
      }
      const sundayPayload: Record<string, string[]> = {};
      for (const { ymd } of monthSundays) {
        const arr = Array.from(sundaysByDate[ymd] ?? []);
        if (arr.length > 0) sundayPayload[ymd] = arr;
      }
      await save({
        data: {
          year,
          month,
          weekdays: payloadWeekdays as any,
          sunday_services: sundayPayload as any,
          notes: notes.trim() || null,
        },
      });
      toast.success("Disponibilidade salva!");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Ministério de Louvor</p>
        <h1 className="font-serif text-4xl md:text-5xl flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-gold" /> Minha Disponibilidade
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe quando você pode servir neste mês. A liderança usa isso para montar a escala automaticamente.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Mês:</label>
        <select
          value={`${year}-${month}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setYear(y); setMonth(m);
          }}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm capitalize focus:border-gold/50 focus:outline-none"
        >
          {monthOptions.map((o) => (
            <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`} className="capitalize">{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground capitalize">{monthLabel}</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-card p-6 mb-6">
            <h2 className="font-serif text-xl mb-1">Segunda a Sábado</h2>
            <p className="text-xs text-muted-foreground mb-5">Marque os dias e informe o horário que você pode servir.</p>
            <div className="space-y-3">
              {WEEKDAYS.map(({ key, label }) => (
                <div key={key} className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-12 sm:col-span-4 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled[key] ?? false}
                      onChange={(e) => setEnabled((p) => ({ ...p, [key]: e.target.checked }))}
                      className="h-4 w-4 accent-gold"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                  <div className="col-span-6 sm:col-span-4">
                    <input
                      type="time"
                      disabled={!enabled[key]}
                      value={weekdays[key]?.start ?? "19:00"}
                      onChange={(e) =>
                        setWeekdays((p) => ({ ...p, [key]: { ...(p[key] ?? { end: "22:00" })!, start: e.target.value } }))
                      }
                      className="w-full rounded-full border border-border bg-background px-3 py-2 text-sm disabled:opacity-40 focus:border-gold/50 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-4">
                    <input
                      type="time"
                      disabled={!enabled[key]}
                      value={weekdays[key]?.end ?? "22:00"}
                      onChange={(e) =>
                        setWeekdays((p) => ({ ...p, [key]: { ...(p[key] ?? { start: "19:00" })!, end: e.target.value } }))
                      }
                      className="w-full rounded-full border border-border bg-background px-3 py-2 text-sm disabled:opacity-40 focus:border-gold/50 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 mb-6">
            <h2 className="font-serif text-xl mb-1">Domingos do mês</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Para cada domingo, marque os cultos em que você pode servir. Você pode estar disponível em horários diferentes em domingos diferentes.
            </p>
            {monthSundays.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum domingo neste mês.</p>
            ) : (
              <div className="space-y-4">
                {monthSundays.map(({ ymd, date }) => {
                  const selected = sundaysByDate[ymd] ?? new Set<string>();
                  const allOn = selected.size === SUNDAY_SERVICES.length;
                  return (
                    <div key={ymd} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div>
                          <p className="font-serif text-lg capitalize">
                            {date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                            {selected.size} de {SUNDAY_SERVICES.length} cultos
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAllForDate(ymd, !allOn)}
                          className="text-[10px] uppercase tracking-widest text-gold hover:underline"
                        >
                          {allOn ? "Limpar dia" : "Marcar todos"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {SUNDAY_SERVICES.map((t) => {
                          const active = selected.has(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => toggleSunday(ymd, t)}
                              className={`rounded-xl border-2 px-3 py-3 text-center transition-all ${
                                active
                                  ? "border-gold bg-gold-soft text-gold"
                                  : "border-border bg-background text-muted-foreground hover:border-gold/30 hover:text-foreground"
                              }`}
                            >
                              <div className="font-serif text-xl">{t}</div>
                              <div className="text-[9px] uppercase tracking-widest mt-0.5">
                                {active ? "Disp." : "—"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>


          <section className="rounded-2xl border border-border bg-card p-6 mb-6">
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex: Estarei viajando no segundo fim de semana."
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none"
            />
          </section>

          <div className="flex justify-end">
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar disponibilidade"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
