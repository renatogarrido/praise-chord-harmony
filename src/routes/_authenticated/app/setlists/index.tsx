import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ListMusic, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/setlists")({ component: SetlistsPage });

function SetlistsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<any[]>([]);
  const [name, setName] = useState("");

  const load = () => {
    if (!user) return;
    supabase.from("setlists").select("*, setlist_songs(count)").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setLists(data ?? []));
  };
  useEffect(load, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("setlists").insert({ user_id: user.id, name: name.trim() });
    if (error) return toast.error(error.message);
    setName(""); load();
  };

  const share = (token: string) => {
    const url = `${window.location.origin}/setlist/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const del = async (id: string) => {
    if (!confirm("Excluir repertório?")) return;
    await supabase.from("setlists").delete().eq("id", id);
    load();
  };

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Setlists</p>
        <h1 className="font-serif text-4xl md:text-5xl">Repertórios</h1>
      </header>

      <form onSubmit={create} className="mb-8 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do repertório (ex: Culto Domingo)"
          className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm focus:border-gold/50 focus:outline-none" />
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground"><Plus className="h-4 w-4" /> Criar</button>
      </form>

      {lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <ListMusic className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">Crie seu primeiro repertório.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {lists.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-3">
              <Link to="/app/setlists/$setlistId" params={{ setlistId: l.id }} className="flex-1 min-w-0">
                <p className="font-serif text-xl group-hover:text-gold">{l.name}</p>
                <p className="text-xs text-muted-foreground">{l.setlist_songs?.[0]?.count ?? 0} músicas</p>
              </Link>
              <button onClick={() => share(l.share_token)} className="rounded-lg p-2 hover:bg-accent text-muted-foreground hover:text-gold" title="Compartilhar"><Share2 className="h-4 w-4" /></button>
              <button onClick={() => del(l.id)} className="rounded-lg p-2 hover:bg-accent text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
