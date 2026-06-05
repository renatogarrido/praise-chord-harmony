import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Church as ChurchIcon, Instagram } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChurchesImportDialog } from "@/components/admin/churches-import-dialog";

const ESTADUAIS = [
  "Alphaville",
  "Bahia",
  "Campinas",
  "Jundiaí",
  "Litoral/SP",
  "Osasco",
  "Santana",
  "Santo André",
  "SBC",
  "Hall Mooca",
  "Sul",
  "Zona Leste",
  "Pernambuco",
  "S.J. Rio Preto",
  "Rio de Janeiro",
  "Tremembé",
] as const;

export const Route = createFileRoute("/_authenticated/app/admin/churches")({
  component: AdminChurches,
});

type Church = {
  id: string;
  name: string;
  address: string;
  country: string | null;
  state: string | null;
  city: string | null;
  estadual: string | null;
  instagram: string | null;
  created_at: string;
};

function AdminChurches() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    country: "Brasil",
    state: "",
    city: "",
    estadual: "",
    instagram: "",
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("churches" as any)
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar igrejas: " + error.message);
      return;
    }
    setChurches((data ?? []) as any);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", address: "", country: "Brasil", state: "", city: "", estadual: "", instagram: "" });
    setEditingId(null);
  };

  const handleEdit = (c: Church) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      address: c.address,
      country: c.country ?? "",
      state: c.state ?? "",
      city: c.city ?? "",
      estadual: c.estadual ?? "",
      instagram: c.instagram ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta igreja? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("churches" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Igreja removida.");
    load();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        country: formData.country.trim() || null,
        state: formData.state.trim() || null,
        city: formData.city.trim() || null,
        estadual: formData.estadual.trim() || null,
        instagram: formData.instagram.trim() || null,
      };
      if (!payload.name || !payload.address) {
        toast.error("Nome e endereço são obrigatórios.");
        return;
      }
      if (editingId) {
        const { error } = await supabase
          .from("churches" as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Igreja atualizada.");
      } else {
        const { error } = await supabase.from("churches" as any).insert(payload);
        if (error) throw error;
        toast.success("Igreja cadastrada.");
      }
      setIsDialogOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar igreja.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const instagramUrl = (handle: string) => {
    const clean = handle.replace(/^@/, "").trim();
    if (!clean) return null;
    if (clean.startsWith("http")) return clean;
    return `https://instagram.com/${clean}`;
  };

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Gestão</p>
          <h1 className="font-serif text-4xl">Igrejas Renascer</h1>
          <p className="mt-2 text-sm text-muted-foreground">Total: {churches.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <ChurchesImportDialog onImported={load} />
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-gold hover:bg-gold/90 text-white gap-2">
                <Plus className="h-4 w-4" />
                Nova Igreja
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Igreja" : "Cadastrar Igreja"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Igreja Renascer ..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço completo</Label>
                <Textarea
                  id="address"
                  placeholder="Rua, número, bairro, CEP"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    placeholder="Brasil"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    placeholder="SP"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="São Paulo"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  maxLength={150}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estadual">Estadual</Label>
                <Select
                  value={formData.estadual || "__none__"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, estadual: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger id="estadual">
                    <SelectValue placeholder="Selecione a estadual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhuma —</SelectItem>
                    {ESTADUAIS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  placeholder="@igrejarenascer"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  maxLength={255}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gold hover:bg-gold/90 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    "Salvar"
                  ) : (
                    "Cadastrar"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {churches.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma igreja cadastrada ainda.</p>
        )}
        {churches.map((c) => {
          const igUrl = c.instagram ? instagramUrl(c.instagram) : null;
          return (
            <div key={c.id} className="flex items-start gap-4 p-4">
              <div className="grid size-10 place-items-center rounded-full bg-gold-soft text-gold shrink-0">
                <ChurchIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{c.name}</p>
                  {c.estadual && (
                    <Badge variant="outline" className="text-[10px] border-gold text-gold">
                      {c.estadual}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{c.address}</p>
                {(c.city || c.state || c.country) && (
                  <p className="text-xs text-muted-foreground">
                    {[c.city, c.state, c.country].filter(Boolean).join(" · ")}
                  </p>
                )}
                {c.instagram && (
                  <a
                    href={igUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gold mt-1 hover:underline"
                  >
                    <Instagram className="h-3 w-3" /> {c.instagram}
                  </a>
                )}
              </div>
              <button
                onClick={() => handleEdit(c)}
                className="p-2 text-muted-foreground hover:text-gold transition-colors"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
