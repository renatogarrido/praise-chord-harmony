import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ListMusic, Plus, Share2, Trash2, Globe, MapPin, Building2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/setlists/")({ component: SetlistsPage });

type Visibility = "personal" | "local" | "estadual" | "nacional";

const VIS_META: Record<Visibility, { label: string; Icon: any }> = {
  personal: { label: "Pessoal", Icon: UserIcon },
  local: { label: "Igreja Local", Icon: Building2 },
  estadual: { label: "Estadual", Icon: MapPin },
  nacional: { label: "Nacional", Icon: Globe },
};

function SetlistsPage() {
  const { user, roles, isAdmin } = useAuth();
  const [lists, setLists] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("personal");

  const isNacional = isAdmin || roles.includes("lider_nacional");
  const isEstadual = isNacional || roles.includes("lider_estadual");
  const isLocal = isEstadual || roles.includes("lider_local");

  const allowed: Visibility[] = ["personal"];
  if (isLocal) allowed.push("local");
  if (isEstadual) allowed.push("estadual");
  if (isNacional) allowed.push("nacional");

  const load = () => {
    if (!user) return;
    supabase
      .from("setlists")
      .select("*, setlist_songs(count)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setLists(data ?? []));
  };
  useEffect(load, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    let church_name: string | null = null;
    let estadual: string | null = null;

    if (visibility === "local" || visibility === "estadual") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("church_name")
        .eq("id", user.id)
        .single();
      church_name = profile?.church_name ?? null;
      if (visibility === "local" && !church_name) {
        return toast.error("Você precisa ter uma igreja cadastrada no perfil para criar repertório local.");
      }
      if (visibility === "estadual") {
        const { data: ch } = await supabase
          .from("churches")
          .select("estadual")
          .eq("name", church_name ?? "")
          .maybeSingle();
        estadual = (ch as any)?.estadual ?? null;
        if (!estadual) {
          return toast.error("Não foi possível identificar o estado da sua igreja para o escopo estadual.");
        }
      }
    }

    const { error } = await supabase.from("setlists").insert({
      user_id: user.id,
      name: name.trim(),
      visibility,
      church_name,
      estadual,
    } as any);
    if (error) return toast.error(error.message);
    setName("");
    setVisibility("personal");
    load();
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

      <form onSubmit={create} className="mb-8 space-y-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do repertório (ex: Culto Domingo)"
            className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm focus:border-gold/50 focus:outline-none"
          />
          <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
            <Plus className="h-4 w-4" /> Criar
          </button>
        </div>
        {allowed.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {allowed.map((v) => {
              const { label, Icon } = VIS_META[v];
              const active = visibility === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${active ? "bg-gold text-primary-foreground border-gold" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3 w-3" /> {label}
                </button>
              );
            })}
          </div>
        )}
      </form>

      {lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <ListMusic className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum repertório disponível ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {lists.map((l) => {
            const v = (l.visibility ?? "personal") as Visibility;
            const meta = VIS_META[v] ?? VIS_META.personal;
            const Icon = meta.Icon;
            const isOwner = l.user_id === user?.id;
            return (
              <div key={l.id} className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-3">
                <Link to="/app/setlists/$setlistId" params={{ setlistId: l.id }} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-serif text-xl group-hover:text-gold">{l.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft text-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                      <Icon className="h-2.5 w-2.5" /> {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{l.setlist_songs?.[0]?.count ?? 0} músicas{!isOwner ? " · compartilhado" : ""}</p>
                </Link>
                <button onClick={() => share(l.share_token)} className="rounded-lg p-2 hover:bg-accent text-muted-foreground hover:text-gold" title="Compartilhar"><Share2 className="h-4 w-4" /></button>
                {isOwner && (
                  <button onClick={() => del(l.id)} className="rounded-lg p-2 hover:bg-accent text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
