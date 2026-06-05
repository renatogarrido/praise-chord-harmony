import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/admin/vocals")({ component: AdminInstruments });

type Cat = { id: string; name: string; sort_order: number };
type Inst = { id: string; category_id: string; value: string; label: string; sort_order: number };

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 64);
}

function AdminInstruments() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [insts, setInsts] = useState<Inst[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [catDialog, setCatDialog] = useState<{ open: boolean; editing?: Cat }>({ open: false });
  const [catName, setCatName] = useState("");
  const [catOrder, setCatOrder] = useState(0);

  const [instDialog, setInstDialog] = useState<{ open: boolean; editing?: Inst; categoryId?: string }>({ open: false });
  const [instLabel, setInstLabel] = useState("");
  const [instValue, setInstValue] = useState("");
  const [instCategory, setInstCategory] = useState<string>("");
  const [instOrder, setInstOrder] = useState(0);

  const load = async () => {
    setLoading(true);
    const [c, i] = await Promise.all([
      supabase.from("instrument_categories").select("*").order("sort_order"),
      supabase.from("instruments").select("*").order("sort_order"),
    ]);
    if (c.error) toast.error(c.error.message);
    if (i.error) toast.error(i.error.message);
    setCats(c.data ?? []);
    setInsts(i.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCat = (editing?: Cat) => {
    setCatName(editing?.name ?? "");
    setCatOrder(editing?.sort_order ?? (cats.length + 1) * 10);
    setCatDialog({ open: true, editing });
  };
  const saveCat = async () => {
    const name = catName.trim();
    if (!name) return toast.error("Informe o nome da categoria.");
    if (catDialog.editing) {
      const { error } = await supabase.from("instrument_categories")
        .update({ name, sort_order: catOrder }).eq("id", catDialog.editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("instrument_categories")
        .insert({ name, sort_order: catOrder });
      if (error) return toast.error(error.message);
    }
    toast.success("Categoria salva.");
    setCatDialog({ open: false });
    load();
  };
  const deleteCat = async (c: Cat) => {
    if (!confirm(`Excluir a categoria "${c.name}" e todos os seus instrumentos?`)) return;
    const { error } = await supabase.from("instrument_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoria excluída.");
    load();
  };

  const openInst = (categoryId: string, editing?: Inst) => {
    setInstLabel(editing?.label ?? "");
    setInstValue(editing?.value ?? "");
    setInstCategory(editing?.category_id ?? categoryId);
    setInstOrder(editing?.sort_order ?? (insts.filter((x) => x.category_id === categoryId).length + 1) * 10);
    setInstDialog({ open: true, editing, categoryId });
  };
  const saveInst = async () => {
    const label = instLabel.trim();
    if (!label) return toast.error("Informe o nome do instrumento.");
    const value = (instValue.trim() || slugify(label));
    if (!instCategory) return toast.error("Selecione uma categoria.");
    if (instDialog.editing) {
      const { error } = await supabase.from("instruments")
        .update({ label, value, category_id: instCategory, sort_order: instOrder })
        .eq("id", instDialog.editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("instruments")
        .insert({ label, value, category_id: instCategory, sort_order: instOrder });
      if (error) return toast.error(error.message);
    }
    toast.success("Instrumento salvo.");
    setInstDialog({ open: false });
    load();
  };
  const deleteInst = async (i: Inst) => {
    if (!confirm(`Excluir o instrumento "${i.label}"?`)) return;
    const { error } = await supabase.from("instruments").delete().eq("id", i.id);
    if (error) return toast.error(error.message);
    toast.success("Instrumento excluído.");
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
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Administração</p>
          <h1 className="font-serif text-4xl">Instrumentos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gerencie as categorias e instrumentos disponíveis no cadastro de músicos.
          </p>
        </div>
        <Button onClick={() => openCat()} className="bg-gold hover:bg-gold/90 text-white gap-2">
          <Plus className="h-4 w-4" /> Nova categoria
        </Button>
      </header>

      <div className="space-y-3">
        {cats.map((c) => {
          const items = insts.filter((i) => i.category_id === c.id);
          const isOpen = expanded[c.id] ?? true;
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 p-4">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [c.id]: !isOpen }))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{items.length} instrumento(s)</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openInst(c.id)} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Instrumento
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openCat(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteCat(c)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4">Nenhum instrumento nesta categoria.</p>
                  )}
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 p-3 pl-10">
                      <div className="flex-1">
                        <p className="text-sm">{i.label}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{i.value}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">ordem {i.sort_order}</span>
                      <Button variant="ghost" size="icon" onClick={() => openInst(c.id, i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteInst(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {cats.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
        )}
      </div>

      <Dialog open={catDialog.open} onOpenChange={(o) => setCatDialog({ open: o, editing: o ? catDialog.editing : undefined })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catDialog.editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={catName} maxLength={120} onChange={(e) => setCatName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={catOrder} onChange={(e) => setCatOrder(Number(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCatDialog({ open: false })}>Cancelar</Button>
            <Button onClick={saveCat} className="bg-gold hover:bg-gold/90 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={instDialog.open} onOpenChange={(o) => setInstDialog({ open: o, editing: o ? instDialog.editing : undefined, categoryId: o ? instDialog.categoryId : undefined })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{instDialog.editing ? "Editar instrumento" : "Novo instrumento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={instLabel} maxLength={120} onChange={(e) => setInstLabel(e.target.value)} placeholder="Ex.: Tecladista — synth" />
            </div>
            <div className="space-y-2">
              <Label>Identificador (opcional)</Label>
              <Input value={instValue} maxLength={64} onChange={(e) => setInstValue(e.target.value)} placeholder="Gerado automaticamente a partir do nome" />
              <p className="text-[11px] text-muted-foreground">Usado para armazenar a escolha. Deixe em branco para gerar automaticamente.</p>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={instCategory} onValueChange={setInstCategory}>
                <SelectTrigger><SelectValue placeholder="Escolher categoria" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={instOrder} onChange={(e) => setInstOrder(Number(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInstDialog({ open: false })}>Cancelar</Button>
            <Button onClick={saveInst} className="bg-gold hover:bg-gold/90 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
