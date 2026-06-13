import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, ArrowUp, ArrowDown, X, Maximize2, Share2, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { MediaLinksEditor } from "@/components/media-embed";

export const Route = createFileRoute("/_authenticated/app/setlists/$setlistId")({ component: SetlistDetail });

function SetlistDetail() {
  const { setlistId } = Route.useParams();
  const [setlist, setSetlist] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [songFilter, setSongFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const { data: sl } = await supabase.from("setlists").select("*").eq("id", setlistId).maybeSingle();
    setSetlist(sl);
    const { data: songs } = await supabase.from("setlist_songs").select("*, songs(id,title,original_key)").eq("setlist_id", setlistId).order("position");
    setItems(songs ?? []);
  }, [setlistId]);

  const saveSetlistMedia = async (v: { spotify_url: string | null; youtube_url: string | null }) => {
    const { error } = await supabase.from("setlists").update(v).eq("id", setlistId);
    if (error) { toast.error("Erro ao salvar links"); return; }
    toast.success("Trilha do repertório atualizada");
    load();
  };

  const saveSongMedia = async (id: string, v: { spotify_url: string | null; youtube_url: string | null }) => {
    const { error } = await supabase.from("setlist_songs").update(v).eq("id", id);
    if (error) { toast.error("Erro ao salvar links"); return; }
    toast.success("Trilha da música atualizada");
    load();
  };

  useEffect(() => {
    load();
    supabase.from("songs").select("id,title").order("title").then(({ data }) => setAllSongs(data ?? []));
  }, [load]);


  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    await supabase.from("setlist_songs").update({ position: j }).eq("id", a.id);
    await supabase.from("setlist_songs").update({ position: idx }).eq("id", b.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("setlist_songs").delete().eq("id", id);
    load();
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/public/setlist/${setlist.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link de compartilhamento copiado!");
  };

  if (!setlist) return <div className="p-12"><div className="h-32 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-3xl mx-auto">
      <Link to="/app/setlists" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-gold mb-6"><ChevronLeft className="h-4 w-4" /> Repertórios</Link>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Repertório</p>
          <div className="flex items-center gap-4">
            <h1 className="font-serif text-4xl">{setlist.name}</h1>
            <button onClick={copyShareLink} className="p-2 rounded-full border border-border hover:bg-accent text-muted-foreground hover:text-gold transition-colors" title="Copiar link público">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {items.length > 0 && (
          <Link to="/app/songs/$songId" 
            params={{ songId: items[0].songs.id }}
            search={{ setlist: setlistId }}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground"><Maximize2 className="h-3.5 w-3.5" /> Apresentar</Link>
        )}
      </div>

      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            value={songFilter} 
            onChange={(e) => setSongFilter(e.target.value)} 
            placeholder="Pesquisar música para adicionar..."
            className="w-full rounded-full border border-border bg-card pl-11 pr-4 py-3 text-sm focus:border-gold/50 focus:outline-none" 
          />
        </div>
        
        {songFilter && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden max-h-60 overflow-y-auto shadow-xl">
            {allSongs.filter(s => s.title.toLowerCase().includes(songFilter.toLowerCase())).length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma música encontrada</div>
            ) : (
              allSongs
                .filter(s => s.title.toLowerCase().includes(songFilter.toLowerCase()))
                .filter(s => !items.find(it => it.song_id === s.id))
                .map((s) => (
                  <button 
                    key={s.id} 
                    onClick={async () => {
                      const pos = items.length;
                      await supabase.from("setlist_songs").insert({ setlist_id: setlistId, song_id: s.id, position: pos });
                      setSongFilter("");
                      load();
                      toast.success(`${s.title} adicionada!`);
                    }}
                    className="w-full text-left px-5 py-3 text-sm hover:bg-accent flex justify-between items-center transition-colors"
                  >
                    <span>{s.title}</span>
                    <Plus className="h-4 w-4 text-gold" />
                  </button>
                ))
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Trilha do repertório</p>
        <MediaLinksEditor
          spotifyUrl={setlist.spotify_url}
          youtubeUrl={setlist.youtube_url}
          onSave={saveSetlistMedia}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Adicione músicas a este repertório.</div>
        ) : items.map((it, i) => {
          const isOpen = !!expanded[it.id];
          const hasMedia = !!(it.spotify_url || it.youtube_url);
          return (
            <div key={it.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground/60 w-6 text-right">{i + 1}</span>
                <Link to="/app/songs/$songId" params={{ songId: it.songs.id }} search={{ setlist: setlistId }} className="flex-1 min-w-0 hover:text-gold truncate">{it.songs.title}</Link>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-gold-soft text-gold">{it.songs.original_key}</span>
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [it.id]: !e[it.id] }))}
                  className={`p-1.5 hover:bg-accent rounded transition-colors ${hasMedia ? "text-gold" : "text-muted-foreground"}`}
                  title="Trilha (Spotify / YouTube)"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <button onClick={() => move(i, -1)} className="p-1.5 hover:bg-accent rounded text-muted-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(i, +1)} className="p-1.5 hover:bg-accent rounded text-muted-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(it.id)} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 bg-background/40">
                  <MediaLinksEditor
                    spotifyUrl={it.spotify_url}
                    youtubeUrl={it.youtube_url}
                    onSave={(v) => saveSongMedia(it.id, v)}
                    compact
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
