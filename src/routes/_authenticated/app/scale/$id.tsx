import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getSchedule, assignUser, unassignUser, listAssignableUsers, deleteSchedule,
  updateSchedule, listMySetlists, assignTechnicalUser, unassignTechnicalUser,
  listTechnicalCategories,
} from "@/lib/worship-schedule.functions";
import { listAvailableUserIdsFor } from "@/lib/availability.functions";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, CheckCircle2, Music2, Pencil, Plus, UserPlus, X, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/scale/$id")({ 
  component: ScaleDetail,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      from: (search.from as string) || undefined
    };
  }
});


function ScaleDetail() {
  const { id } = useParams({ from: "/_authenticated/app/scale/$id" });
  const { from } = useSearch({ from: "/_authenticated/app/scale/$id" });
  const nav = useNavigate();
  const { canManageSchedule } = useAuth();
  const get = useServerFn(getSchedule);
  const list = useServerFn(listAssignableUsers);
  const assign = useServerFn(assignUser);
  const unassign = useServerFn(unassignUser);
  const assignTech = useServerFn(assignTechnicalUser);
  const unassignTech = useServerFn(unassignTechnicalUser);
  const listTechCats = useServerFn(listTechnicalCategories);
  const del = useServerFn(deleteSchedule);
  const update = useServerFn(updateSchedule);
  const listSetlistsFn = useServerFn(listMySetlists);
  const listAvail = useServerFn(listAvailableUserIdsFor);

  const detailQ = useQuery({ queryKey: ["schedule", id], queryFn: () => get({ data: { id } }) });
  const usersQ = useQuery({ queryKey: ["assignable-users"], queryFn: () => list(), enabled: canManageSchedule });
  const availQ = useQuery({
    queryKey: ["available-for", (detailQ.data as any)?.schedule?.service_date],
    queryFn: () => listAvail({ data: { isoDate: (detailQ.data as any).schedule.service_date } }),
    enabled: canManageSchedule && !!(detailQ.data as any)?.schedule?.service_date,
  });
  const availableSet = useMemo(() => new Set<string>(((availQ.data as any)?.userIds ?? []) as string[]), [availQ.data]);


  const [picker, setPicker] = useState(false);
  const [pickerType, setPickerType] = useState<"worship" | "technical">("worship");
  const [pickedUser, setPickedUser] = useState<string>("");
  const [pickedRole, setPickedRole] = useState<string>("");
  const [pickedRoles, setPickedRoles] = useState<string[]>([]);
  const [pickedTechCat, setPickedTechCat] = useState<string>("");
  const [search, setSearch] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editChurch, setEditChurch] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSetlist, setEditSetlist] = useState("");
  const setlistsQ = useQuery({ queryKey: ["my-setlists"], queryFn: () => listSetlistsFn(), enabled: editOpen });
  const techCatsQ = useQuery({ queryKey: ["technical-categories"], queryFn: () => listTechCats(), enabled: picker && pickerType === "technical" });

  const detail = detailQ.data as any;
  const users: any[] = (usersQ.data as any)?.users ?? [];

  const filteredUsers = useMemo(() => {
    const s = search.trim().toLowerCase();
    const base = users.slice().sort((a, b) => {
      const aAv = availableSet.has(a.id) ? 0 : 1;
      const bAv = availableSet.has(b.id) ? 0 : 1;
      if (aAv !== bAv) return aAv - bAv;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
    
    let filtered = base;
    if (pickerType === "technical") {
      filtered = base.filter(u => 
        (u.technical_roles?.length ?? 0) > 0
      );
    }

    if (!s) return filtered;
    return filtered.filter((u) => (u.full_name ?? "").toLowerCase().includes(s) || (u.church_name ?? "").toLowerCase().includes(s));
  }, [users, search, availableSet, pickerType, pickedTechCat, techCatsQ.data]);


  const pickedUserObj = users.find((u) => u.id === pickedUser);
  const availableRoles: string[] = pickedUserObj
    ? Array.from(new Set([
        ...(pickedUserObj.instruments ?? []), 
        ...(pickedUserObj.vocal_types ?? []),
        ...(pickedUserObj.technical_roles ?? [])
      ])).filter(Boolean)
    : [];

  const doAssign = async () => {
    if (pickerType === "worship") {
      if (!pickedUser || !pickedRole.trim()) return toast.error("Escolha usuário e função.");
      try {
        await assign({ data: { scheduleId: id, userId: pickedUser, roleLabel: pickedRole.trim() } });
        toast.success("Escalado! Notificação enviada.");
        setPicker(false); setPickedUser(""); setPickedRole(""); setSearch("");
        detailQ.refetch();
      } catch (e: any) { toast.error(e.message || "Erro"); }
    } else {
      if (!pickedUser || pickedRoles.length === 0) return toast.error("Escolha colaborador e pelo menos uma função técnica.");
      try {
        const categories = (techCatsQ.data as any)?.categories ?? [];
        
        // Execute assignments sequentially to avoid race conditions or potential bulk issues
        // and to give clear feedback if one fails.
        for (const catId of pickedRoles) {
          const catName = categories.find((c: any) => c.id === catId)?.name || 'técnica';
          try {
            await assignTech({ data: { scheduleId: id, userId: pickedUser, categoryId: catId } });
          } catch (innerErr: any) {
            console.error(`Error assigning role ${catName} (${catId}):`, innerErr);
            // Don't swallow the error, throw it to be caught by the outer catch
            throw new Error(`Erro na função ${catName}: ${innerErr.message || 'Tente novamente.'}`);
          }
        }
        
        toast.success("Colaborador técnico escalado!");
        setPicker(false); setPickedUser(""); setPickedRoles([]); setSearch("");
        detailQ.refetch();
      } catch (e: any) { 
        toast.error(e.message || "Não foi possível concluir a operação."); 
      }
    }
  };

  const doUnassign = async (aid: string, type: "worship" | "technical") => {
    const msg = type === "worship" ? "Remover este músico da escala?" : "Remover este colaborador técnico?";
    if (!confirm(msg)) return;
    try { 
      if (type === "worship") await unassign({ data: { assignmentId: aid } });
      else await unassignTech({ data: { assignmentId: aid } });
      toast.success("Removido."); 
      detailQ.refetch(); 
    }
    catch (e: any) { toast.error(e.message || "Erro"); }
  };

  const doDelete = async () => {
    if (!confirm("Excluir esta escala inteira?")) return;
    try { 
      await del({ data: { id } }); 
      toast.success("Excluída."); 
      nav({ to: isTechnical ? "/app/technical-scale" : "/app/scale" }); 
    }
    catch (e: any) { toast.error(e.message || "Erro"); }
  };

  const openEdit = () => {
    const sc = (detailQ.data as any)?.schedule;
    if (!sc) return;
    setEditTitle(sc.title ?? "");
    // datetime-local needs "YYYY-MM-DDTHH:mm"
    const d = new Date(sc.service_date);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setEditChurch(sc.church_name ?? "");
    setEditNotes(sc.notes ?? "");
    setEditSetlist(sc.setlist_id ?? "");
    setEditOpen(true);
  };

  const doUpdate = async () => {
    if (!editTitle.trim() || !editDate) return toast.error("Preencha título e data.");
    try {
      await update({ data: {
        id,
        title: editTitle.trim(),
        serviceDate: new Date(editDate).toISOString(),
        notes: editNotes.trim() || null,
        churchName: editChurch.trim() || null,
        setlistId: editSetlist || null,
      } });
      toast.success("Escala atualizada.");
      setEditOpen(false);
      detailQ.refetch();
    } catch (e: any) { toast.error(e.message || "Erro"); }
  };

  if (detailQ.isLoading) return <div className="p-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!detail) return <div className="p-12 text-sm text-muted-foreground">Escala não encontrada.</div>;

  const s = detail.schedule;
  const assignments: any[] = detail.assignments ?? [];
  const techAssignments: any[] = detail.techAssignments ?? [];
  const setlistSongs: any[] = detail.setlistSongs ?? [];

  // Group assignments by role for nicer display
  const grouped = assignments.reduce((acc: Record<string, any[]>, a) => {
    (acc[a.role_label] ||= []).push(a); return acc;
  }, {});

  const techGrouped = techAssignments.reduce((acc: Record<string, any[]>, a) => {
    (acc[a.role_label] ||= []).push(a); return acc;
  }, {});

  const isTechnical = s.title.toLowerCase().includes("técnica") || from === "technical";

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <Link to={isTechnical ? "/app/technical-scale" : "/app/scale"} className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-gold mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> {isTechnical ? "Escala Técnica" : "Escala"}
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Culto</p>
          <h1 className="font-serif text-4xl md:text-5xl">{s.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {new Date(s.service_date).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
            {s.church_name ? ` · ${s.church_name}` : ""}
          </p>
          {s.notes && <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap">{s.notes}</p>}
        </div>
        {canManageSchedule && (
          <div className="flex flex-wrap gap-2">
            <button onClick={openEdit} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest hover:text-gold hover:border-gold/40">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button onClick={doDelete} className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive hover:border-destructive/40">
              Excluir escala
            </button>
          </div>
        )}
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Escalados */}
        {(!s.title.toLowerCase().includes("técnica") || assignments.length > 0) && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-xl">Músicos e Vozes</h2>
            {canManageSchedule && !s.title.toLowerCase().includes("técnica") && (
              <button onClick={() => { setPickerType("worship"); setPicker(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground">
                <UserPlus className="h-3.5 w-3.5" /> Escalar
              </button>
            )}
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém escalado ainda.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([role, list]) => (
                <div key={role}>
                  <p className="text-[10px] uppercase tracking-widest text-gold mb-2">{role}</p>
                  <div className="space-y-1.5">
                    {(list as any[]).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg bg-background border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{a.full_name ?? "Sem nome"}</p>
                          {a.church_name && <p className="text-[10px] text-muted-foreground truncate">{a.church_name}</p>}
                        </div>
                        {canManageSchedule && (
                          <button onClick={() => doUnassign(a.id, "worship")} className="p-1 text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {(s.title.toLowerCase().includes("técnica") || techAssignments.length > 0) && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-xl">Equipe Técnica</h2>
            {canManageSchedule && (s.title.toLowerCase().includes("técnica") || techAssignments.length > 0) && (
              <button onClick={() => { setPickerType("technical"); setPicker(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white">
                <Settings2 className="h-3.5 w-3.5" /> Escalar Técnica
              </button>
            )}
          </div>
          {techAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém escalado para técnica.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(techGrouped).map(([role, list]) => (
                <div key={role}>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">{role}</p>
                  <div className="space-y-1.5">
                    {(list as any[]).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg bg-background border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm truncate font-medium">{a.full_name ?? "Sem nome"}</p>
                        </div>
                        {canManageSchedule && (
                          <button onClick={() => doUnassign(a.id, "technical")} className="p-1 text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {/* Repertório */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl mb-5 flex items-center gap-2"><Music2 className="h-4 w-4 text-gold" /> Repertório</h2>
          {!s.setlist_id ? (
            <p className="text-sm text-muted-foreground">Nenhum repertório vinculado.</p>
          ) : setlistSongs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{s.setlist_name ?? "Repertório"} (sem músicas).</p>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{s.setlist_name}</p>
              <ol className="space-y-1.5">
                {setlistSongs.map((ss, i) => (
                  <li key={ss.id} className="flex items-center gap-3 rounded-lg bg-background border border-border px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground/60 w-5">{i + 1}</span>
                    <Link to="/app/songs/$songId" params={{ songId: ss.songs?.id }} className="flex-1 truncate text-sm hover:text-gold">
                      {ss.songs?.title}
                    </Link>
                    <span className="font-mono text-xs text-gold">{ss.custom_key || ss.songs?.original_key}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>

      {/* Picker modal */}
      {picker && canManageSchedule && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setPicker(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-2xl">{pickerType === "worship" ? "Escalar músico / vocal" : "Escalar equipe técnica"}</h3>
              <button onClick={() => setPicker(false)} className="p-1"><X className="h-4 w-4" /></button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou igreja…"
              className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm mb-3 focus:border-gold/50 focus:outline-none" />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border mb-4">
              {filteredUsers.map((u) => {
                const isAv = availableSet.has(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => { setPickedUser(u.id); setPickedRole(""); setPickedRoles([]); }}
                    className={`w-full text-left px-3 py-2 border-b border-border last:border-0 hover:bg-accent ${pickedUser === u.id ? "bg-gold-soft" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{u.full_name ?? "Sem nome"}</p>
                        <p className="text-[10px] text-muted-foreground">{u.church_name ?? "—"}</p>
                      </div>
                      {isAv && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] px-2 py-0.5 shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Disponível
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredUsers.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum usuário.</p>}
            </div>

            {pickerType === "worship" ? (
              <>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Função</label>
                {availableRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {availableRoles.map((r) => (
                      <button key={r} type="button" onClick={() => setPickedRole(r)}
                        className={`rounded-full px-3 py-1 text-[11px] border ${pickedRole === r ? "bg-gold text-primary-foreground border-gold" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
                <input value={pickedRole} onChange={(e) => setPickedRole(e.target.value)} placeholder="Ex: Violão, Vocal Soprano…"
                  className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm mb-4 focus:border-gold/50 focus:outline-none" />
              </>
            ) : (
              <div className="mb-4">
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Funções Técnicas</label>
                <div className="flex flex-wrap gap-1.5">
                  {((techCatsQ.data as any)?.categories ?? []).map((c: any) => {
                    const selected = pickedRoles.includes(c.id);
                    return (
                      <button key={c.id} type="button" 
                        onClick={() => setPickedRoles(prev => 
                          selected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                        )}
                        className={`rounded-full px-3 py-1 text-[11px] border transition-colors ${selected ? "bg-slate-700 text-white border-slate-700" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setPicker(false)} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest">Cancelar</button>
              <button onClick={doAssign} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
                <Plus className="h-3.5 w-3.5" /> {pickerType === "worship" ? "Escalar" : "Escalar Técnica"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && canManageSchedule && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-2xl">Editar escala</h3>
              <button onClick={() => setEditOpen(false)} className="p-1"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Título</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Data e hora</label>
                <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Igreja</label>
                <input value={editChurch} onChange={(e) => setEditChurch(e.target.value)} placeholder="Nome da igreja"
                  className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Repertório</label>
                <select value={editSetlist} onChange={(e) => setEditSetlist(e.target.value)}
                  className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none">
                  <option value="">— Sem repertório —</option>
                  {((setlistsQ.data as any)?.setlists ?? []).map((sl: any) => (
                    <option key={sl.id} value={sl.id}>{sl.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Observações</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditOpen(false)} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest">Cancelar</button>
              <button onClick={doUpdate} className="rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
