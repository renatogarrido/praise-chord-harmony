import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/albums")({ component: AdminAlbums });

function AdminAlbums() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("albums")
        .select("*")
        .order("sort_order")
        .order("year", { ascending: false });
        
      if (error) {
        console.error("Error loading albums:", error);
        toast.error("Erro ao carregar álbuns");
        return;
      }
      setItems(data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    try {
      const fd = new FormData(e.currentTarget);
      const file = fd.get("cover") as File | null;
      let cover_url = editing?.cover_url ?? null;
      
      if (file && file.size > 0) {
        const path = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { error: uploadError } = await supabase.storage.from("album-covers").upload(path, file, { upsert: true });
        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          toast.error("Erro ao enviar imagem");
          setIsSaving(false);
          return;
        }
        cover_url = supabase.storage.from("album-covers").getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        title: String(fd.get("title")).trim(),
        year: fd.get("year") ? Number(fd.get("year")) : null,
        description: String(fd.get("description") || "") || null,
        sort_order: Number(fd.get("sort_order") || 0),
        cover_url,
      };

      if (!payload.title) {
        toast.error("Título é obrigatório");
        setIsSaving(false);
        return;
      }

      const { error } = editing?.id
        ? await supabase.from("albums").update(payload).eq("id", editing.id)
        : await supabase.from("albums").insert(payload);

      if (error) {
        console.error("Error saving album:", error);
        return toast.error("Erro ao salvar: " + error.message);
      }

      toast.success("Álbum salvo com sucesso!");
      setEditing(null);
      load();
    } catch (err: any) {
      console.error("Critical error saving album:", err);
      toast.error("Erro inesperado ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Excluir álbum? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("albums").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir álbum (verifique se existem cifras vinculadas)");
    } else {
      toast.success("Álbum excluído");
      load();
    }
  };

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Gestão</p>
          <h1 className="font-serif text-4xl">Álbuns</h1>
        </div>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground"><Plus className="h-4 w-4" /> Novo</button>
      </header>

      {editing && (
        <form onSubmit={save} className="mb-8 rounded-2xl border border-border bg-card p-6 grid gap-4">
          <h2 className="font-serif text-xl">{editing.id ? "Editar" : "Novo"} álbum</h2>
          <input name="title" required defaultValue={editing.title || ""} placeholder="Título" className="rounded-lg border border-border bg-background px-4 py-3 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input name="year" type="number" defaultValue={editing.year || ""} placeholder="Ano" className="rounded-lg border border-border bg-background px-4 py-3 text-sm" />
            <input name="sort_order" type="number" defaultValue={editing.sort_order || 0} placeholder="Ordem" className="rounded-lg border border-border bg-background px-4 py-3 text-sm" />
          </div>
          <textarea name="description" rows={3} defaultValue={editing.description || ""} placeholder="Descrição" className="rounded-lg border border-border bg-background px-4 py-3 text-sm" />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Upload className="h-4 w-4 text-gold" />
            <span>Capa do álbum</span>
            <input type="file" name="cover" accept="image/*" className="text-xs" />
          </label>
          <div className="flex gap-2">
            <button 
              type="submit" 
              disabled={isSaving}
              className="rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditing(null)} disabled={isSaving} className="rounded-full border border-border px-5 py-2 text-xs">Cancelar</button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-card divide-y divide-border relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
          </div>
        )}
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-4 p-4">
            <div className="size-12 rounded-lg bg-background overflow-hidden flex-shrink-0">
              {a.cover_url && <img src={a.cover_url} className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.year ?? "—"}</p>
            </div>
            <button onClick={() => setEditing(a)} className="text-xs text-gold hover:underline">Editar</button>
            <button onClick={() => del(a.id)} className="rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
