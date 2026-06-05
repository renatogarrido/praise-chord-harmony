import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LifeBuoy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/admin/support")({ component: AdminSupport });

const CATEGORY_LABELS: Record<string, string> = {
  erro: "Erro",
  correcao_cifra: "Correção de cifra",
  sugestao: "Sugestão",
  outro: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const STATUS_COLORS: Record<string, string> = {
  aberto: "bg-blue-500/15 text-blue-400",
  em_andamento: "bg-yellow-500/15 text-yellow-400",
  resolvido: "bg-green-500/15 text-green-400",
  fechado: "bg-muted text-muted-foreground",
};

function AdminSupport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState("aberto");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setTickets(data || []);
    const userIds = [...new Set((data || []).map((t: any) => t.user_id))];
    if (userIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name, church_name").in("id", userIds);
      const map: Record<string, any> = {};
      ps?.forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (t: any) => {
    setEditing(t);
    setResponse(t.admin_response || "");
    setNewStatus(t.status);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("support_tickets")
      .update({ admin_response: response.trim() || null, status: newStatus as any })
      .eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Chamado atualizado!");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este chamado?")) return;
    const { error } = await supabase.from("support_tickets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Chamado removido");
    load();
  };

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8 flex justify-between items-end gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Administração</p>
          <h1 className="font-serif text-4xl">Suporte</h1>
          <p className="mt-2 text-sm text-muted-foreground">Total: {tickets.length}</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhum chamado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const p = profiles[t.user_id];
            return (
              <div key={t.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p?.full_name || "Usuário"} {p?.church_name ? `· ${p.church_name}` : ""} · {CATEGORY_LABELS[t.category]} · {new Date(t.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${STATUS_COLORS[t.status]}`}>
                    {STATUS_LABELS[t.status]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-3">{t.message}</p>
                {t.admin_response && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-[10px] uppercase tracking-widest text-gold mb-2">Resposta enviada</p>
                    <p className="text-sm whitespace-pre-wrap">{t.admin_response}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => remove(t.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(t)}>Responder / Atualizar</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Responder chamado</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resposta ao usuário</Label>
              <Textarea rows={6} maxLength={2000} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Mensagem para o usuário..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button className="bg-gold hover:bg-gold/90 text-white" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
