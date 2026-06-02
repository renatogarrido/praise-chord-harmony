import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Music2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/songs/")({ component: SongsPage });

const STALE = 5 * 60 * 1000;

function SongsPage() {
  const [search, setSearch] = useState("");
  const [albumId, setAlbumId] = useState<string>("");

  const { data: albums = [] } = useQuery({
    queryKey: ["albums-min"],
    queryFn: async () => {
      const { data } = await supabase.from("albums").select("id,title").order("title");
      return data ?? [];
    },
    staleTime: STALE,
    gcTime: 30 * 60 * 1000,
  });

  const { data: songs = [] } = useQuery({
    queryKey: ["songs-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("id,title,original_key,album_id, albums(title)")
        .order("title");
      return data ?? [];
    },
    staleTime: STALE,
    gcTime: 30 * 60 * 1000,
  });

  const filtered = songs.filter((s: any) => {
    if (albumId && s.album_id !== albumId) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Biblioteca</p>
        <h1 className="font-serif text-4xl md:text-5xl">Cifras</h1>
      </header>

      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome..."
            className="w-full rounded-full border border-border bg-card pl-11 pr-4 py-3 text-sm focus:border-gold/50 focus:outline-none" />
        </div>
        <select value={albumId} onChange={(e) => setAlbumId(e.target.value)}
          className="rounded-full border border-border bg-card px-5 py-3 text-sm focus:border-gold/50 focus:outline-none">
          <option value="">Todos os álbuns</option>
          {albums.map((a: any) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center"><Music2 className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-4 text-sm text-muted-foreground">Nenhuma cifra encontrada.</p></div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((s: any) => (
              <Link key={s.id} to="/app/songs/$songId" params={{ songId: s.id }}
                className="flex items-center justify-between px-5 md:px-6 py-4 hover:bg-accent transition-colors group">
                <div className="min-w-0">
                  <p className="font-medium truncate group-hover:text-gold transition-colors">{s.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.albums?.title ?? "Sem álbum"}</p>
                </div>
                <span className="font-mono text-xs px-2 py-1 rounded bg-gold-soft text-gold">{s.original_key}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
