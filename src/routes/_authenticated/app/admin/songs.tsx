import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, FileText, Upload } from "lucide-react";
import { ALL_KEYS, convertToChordPro } from "@/lib/chords";

export const Route = createFileRoute("/_authenticated/app/admin/songs")({ component: AdminSongs });

function AdminSongs() {
  const [items, setItems] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("*, albums(title)")
        .order("title");
        
      if (error) {
        console.error("Error loading songs:", error);
        toast.error("Erro ao carregar cifras");
        return;
      }
      setItems(data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    supabase
      .from("albums")
      .select("id,title")
      .order("title")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading albums:", error);
          return;
        }
        setAlbums(data ?? []);
      });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    toast.info("Processando PDF... Note que o texto extraído pode precisar de ajustes finos.");
    
    // In a real production app, we would use a library like pdfjs-dist or a backend service.
    // Since we are in a browser environment without a dedicated PDF worker setup here,
    // we'll simulate the "Import" by encouraging the user to use the "Format" tool
    // or provide a helpful message. 
    // To actually parse PDF in the browser:
    toast.error("O suporte direto a importação de PDF requer um serviço de extração. Por enquanto, copie o texto do PDF e use o botão 'Formatar PDF/Texto'.");
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        title: String(fd.get("title")).trim(),
        album_id: String(fd.get("album_id") || "") || null,
        original_key: String(fd.get("original_key") || "C"),
        lyrics: String(fd.get("lyrics") || ""),
        notes: String(fd.get("notes") || "") || null,
      };

      if (!payload.title) {
        toast.error("Título é obrigatório");
        return;
      }

      const { error } = editing?.id
        ? await supabase.from("songs").update(payload).eq("id", editing.id)
        : await supabase.from("songs").insert(payload);

      if (error) {
        console.error("Error saving song:", error);
        return toast.error("Erro ao salvar: " + error.message);
      }

      toast.success("Cifra salva com sucesso!");
      setEditing(null);
      load();
    } catch (err: any) {
      console.error("Critical error saving:", err);
      toast.error("Ocorreu um erro inesperado ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Excluir cifra?")) return;
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir cifra");
    } else {
      toast.success("Cifra excluída");
      load();
    }
  };

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Gestão</p>
          <h1 className="font-serif text-4xl">Cifras</h1>
        </div>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground"><Plus className="h-4 w-4" /> Nova</button>
      </header>

      {editing && (
        <form onSubmit={save} className="mb-8 rounded-2xl border border-border bg-card p-6 grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl">{editing.id ? "Editar" : "Nova"} cifra</h2>
            <div className="relative">
              <input 
                type="file" 
                id="pdf-upload" 
                className="hidden" 
                accept=".pdf" 
                onChange={handleFileUpload}
              />
              <label 
                htmlFor="pdf-upload"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-accent transition-colors"
              >
                <FileText className="h-3.5 w-3.5" /> Importar PDF
              </label>
            </div>
          </div>
          <input name="title" required defaultValue={editing.title || ""} placeholder="Título" className="rounded-lg border border-border bg-background px-4 py-3 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select name="album_id" defaultValue={editing.album_id || ""} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
              <option value="">Sem álbum</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <select name="original_key" defaultValue={editing.original_key || "C"} className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-mono">
              {ALL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Letra & cifra (use [Acorde]texto)</label>
              <button 
                type="button"
                onClick={() => {
                  const textarea = document.querySelector('textarea[name="lyrics"]') as HTMLTextAreaElement;
                  if (textarea) {
                    const converted = convertToChordPro(textarea.value);
                    textarea.value = converted;
                    toast.success("Formatado para o padrão do sistema!");
                  }
                }}
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gold hover:text-gold/80 transition-colors"
                title="Converte cifras que estão em cima do texto para o formato do sistema"
              >
                <Wand2 className="h-3 w-3" /> Formatar PDF/Texto
              </button>
            </div>
            <textarea name="lyrics" rows={14} defaultValue={editing.lyrics || ""} placeholder={`{Intro}\n[G] [C9] [Em7] [D]\n\n{Verse}\n[G]Não há impossível para o Teu [C9]agir\n[Em7]A tempestade acalma com o Teu fa[D]lar`} className="w-full font-mono rounded-lg border border-border bg-background px-4 py-3 text-sm" />
          </div>
          <textarea name="notes" rows={2} defaultValue={editing.notes || ""} placeholder="Observações musicais (opcional)" className="rounded-lg border border-border bg-background px-4 py-3 text-sm" />
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
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.albums?.title ?? "Sem álbum"}</p>
            </div>
            <span className="font-mono text-xs px-2 py-1 rounded bg-gold-soft text-gold">{s.original_key}</span>
            <button onClick={() => setEditing(s)} className="text-xs text-gold hover:underline">Editar</button>
            <button onClick={() => del(s.id)} className="rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
