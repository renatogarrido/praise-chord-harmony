import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Plus, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/support")({ component: SupportPage });

const CATEGORY_LABELS: Record<string, string> = {
  erro: "Erro na plataforma",
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

function SupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "outro", message: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user!.id,
      subject: form.subject.trim().slice(0, 200),
      category: form.category as any,
      message: form.message.trim().slice(0, 2000),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao enviar: " + error.message);
      return;
    }
    toast.success("Chamado enviado!");
    setForm({ subject: "", category: "outro", message: "" });
    setOpen(false);
    load();
  };

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8 flex justify-between items-end gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Suporte</p>
          <h1 className="font-serif text-4xl">Meus Chamados</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reporte erros, solicite correções de cifras ou envie sugestões.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold hover:bg-gold/90 text-white gap-2">
              <Plus className="h-4 w-4" /> Novo Chamado
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Abrir novo chamado</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Assunto</Label>
                <Input
                  id="subject"
                  maxLength={200}
                  required
                  placeholder="Resumo curto do problema"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Descrição</Label>
                <Textarea
                  id="message"
                  maxLength={2000}
                  required
                  rows={6}
                  placeholder="Descreva em detalhes..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
                <p className="text-xs text-muted-foreground text-right">{form.message.length}/2000</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-gold hover:bg-gold/90 text-white" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Você ainda não tem chamados abertos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CATEGORY_LABELS[t.category]} · {new Date(t.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${STATUS_COLORS[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-3">{t.message}</p>
              {t.admin_response && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] uppercase tracking-widest text-gold mb-2">Resposta do Suporte</p>
                  <p className="text-sm whitespace-pre-wrap">{t.admin_response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
