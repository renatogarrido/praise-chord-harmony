import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Music2 } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/app/albums/")({ component: AlbumsPage });

type Album = { id: string; title: string; year: number | null; description: string | null; cover_url: string | null; song_count?: number };

async function fetchAlbums(): Promise<Album[]> {
  const [{ data: alb }, { data: counts }] = await Promise.all([
    supabase.from("albums").select("*").order("sort_order").order("year", { ascending: false }),
    supabase.from("songs").select("album_id"),
  ]);
  const countMap = new Map<string, number>();
  counts?.forEach((s) => { if (s.album_id) countMap.set(s.album_id, (countMap.get(s.album_id) || 0) + 1); });
  return (alb ?? []).map((a) => ({ ...a, song_count: countMap.get(a.id) || 0 }));
}

function AlbumsPage() {
  const [search, setSearch] = useState("");
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["albums-with-counts"],
    queryFn: fetchAlbums,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const filtered = albums.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Biblioteca</p>
          <h1 className="font-serif text-4xl md:text-5xl">Álbuns</h1>
          <p className="mt-2 text-sm text-muted-foreground">Toda a coleção do Renascer Praise.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar álbum..."
            className="w-full rounded-full border border-border bg-card pl-11 pr-4 py-3 text-sm focus:border-gold/50 focus:outline-none"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {filtered.map((album, i) => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link to="/app/albums/$albumId" params={{ albumId: album.id }} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card transition-all duration-500 group-hover:border-gold/40 group-hover:shadow-2xl group-hover:shadow-gold/10">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt={album.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card to-background">
                      <Music2 className="h-12 w-12 text-gold/30" />
                    </div>
                  )}
                </div>
                <h3 className="mt-4 font-medium text-foreground truncate">{album.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {album.year ?? "—"} · {album.song_count} {album.song_count === 1 ? "música" : "músicas"}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-16 text-center">
      <Music2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <h3 className="mt-4 font-serif text-xl">Nenhum álbum cadastrado ainda</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        O administrador precisa cadastrar álbuns na área de gestão.
      </p>
    </div>
  );
}
