import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/admin/technical-categories")({ component: AdminTechnicalCategories });

type Cat = { id: string; name: string; sort_order: number | null };

function AdminTechnicalCategories() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState<{ open: boolean; editing?: Cat }>({ open: false });
  const [name, setName] = useState("");
  const [order, setOrder] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("technical_categories").select("*").order("sort_order");
    if (error) toast.error(error.message);
    setCats(data as Cat[] ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDialog = (editing?: Cat) => {
    setName(editing?.name ?? "");
    setOrder(editing?.sort_order ?? (cats.length + 1) * 10);
    setDialog({ open: true, editing });
  };

  const save = async () => {
    const n = name.trim();
    if (!n) return toast.error("Informe o nome.");
    if (dialog.editing) {
      const { error } = await supabase.from("technical_categories")
        .update({ name: n, sort_order: order }).eq("id", dialog.editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("technical_categories")
        .insert({ name: n, sort_order: order });
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo com sucesso.");
    setDialog({ open: false });
    load();
  };

  const remove = async (c: Cat) => {
    if (!confirm(`Excluir a função "${c.name}"?`)) return;
    const { error } = await supabase.from("technical_categories").delete().eq("id", c.id);
    if (error) {
      console.error("Delete error:", error);
      return toast.error("Erro ao excluir: " + error.message);
    }
    toast.success("Excluído.");
    load();
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Administração</p>
          <h1 className="font-serif text-4xl">Funções Técnicas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gerencie as funções disponíveis na equipe técnica (Som, Luz, Telão, etc).
          </p>
        </div>
        <Button onClick={() => openDialog()} className="bg-gold hover:bg-gold/90 text-white gap-2">
          <Plus className="h-4 w-4" /> Nova função
        </Button>
      </header>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors">
              <div className="flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Ordem: {c.sort_order}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openDialog(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {cats.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma função cadastrada.</p>
          )}
        </div>
      </div>

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o, editing: o ? dialog.editing : undefined })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Editar função" : "Nova função"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Função</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Técnico de Som" />
            </div>
            <div className="space-y-2">
              <Label>Ordem de exibição</Label>
              <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog({ open: false })}>Cancelar</Button>
            <Button onClick={save} className="bg-gold hover:bg-gold/90 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
