import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setS(data));
  }, []);

  if (!s) return <div className="p-12"><div className="h-32 bg-card rounded-xl animate-pulse" /></div>;

  const upload = async (file: File, field: "logo_url" | "bg_url") => {
    const path = `${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("app-assets").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const url = supabase.storage.from("app-assets").getPublicUrl(path).data.publicUrl;
    setS({ ...s, [field]: url });
  };

  const save = async () => {
    const { error } = await supabase.from("app_settings").update({
      app_name: s.app_name,
      primary_color: s.primary_color,
      logo_url: s.logo_url,
      bg_url: s.bg_url,
      default_theme: s.default_theme,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas! Recarregue para ver."); 
  };

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Personalização</p>
        <h1 className="font-serif text-4xl">Aparência</h1>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 grid gap-5">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Nome do app</label>
          <input value={s.app_name} onChange={(e) => setS({ ...s, app_name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Cor principal</label>
          <input type="color" value={s.primary_color} onChange={(e) => setS({ ...s, primary_color: e.target.value })}
            className="mt-1 h-12 w-24 rounded-lg border border-border bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tema padrão</label>
          <select value={s.default_theme} onChange={(e) => setS({ ...s, default_theme: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-sm">
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Logo</label>
          <div className="mt-2 flex items-center gap-4">
            {s.logo_url && <img src={s.logo_url} className="h-12 object-contain" />}
            <label className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs cursor-pointer hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Enviar
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "logo_url")} />
            </label>
            {s.logo_url && <button onClick={() => setS({ ...s, logo_url: null })} className="text-xs text-muted-foreground hover:text-destructive">Remover</button>}
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Imagem de fundo</label>
          <div className="mt-2 flex items-center gap-4">
            {s.bg_url && <img src={s.bg_url} className="h-16 w-24 object-cover rounded" />}
            <label className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs cursor-pointer hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Enviar
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "bg_url")} />
            </label>
            {s.bg_url && <button onClick={() => setS({ ...s, bg_url: null })} className="text-xs text-muted-foreground hover:text-destructive">Remover</button>}
          </div>
        </div>
        <button onClick={save} className="mt-2 rounded-full bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground">Salvar</button>
      </div>
    </div>
  );
}
