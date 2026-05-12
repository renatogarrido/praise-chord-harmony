import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Music2, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/albums/$albumId")({ component: AlbumDetail });

function AlbumDetail() {
  const { albumId } = Route.useParams();
  const [album, setAlbum] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.from("albums").select("*").eq("id", albumId).maybeSingle();
      setAlbum(a);
      const { data: s } = await supabase.from("songs").select("id, title, original_key").eq("album_id", albumId).order("title");
      setSongs(s ?? []);
    })();
  }, [albumId]);

  if (!album) return <div className="px-6 py-12 max-w-5xl mx-auto"><div className="h-64 rounded-xl bg-card animate-pulse" /></div>;

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <Link to="/app/albums" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-gold transition-colors mb-8">
        <ChevronLeft className="h-4 w-4" /> Voltar para álbuns
      </Link>

      <div className="grid md:grid-cols-[280px_1fr] gap-8 md:gap-12 mb-12">
        <div className="aspect-square rounded-2xl border border-border bg-card overflow-hidden">
          {album.cover_url ? (
            <img src={album.cover_url} alt={album.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center"><Music2 className="h-16 w-16 text-gold/30" /></div>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-3">Álbum</p>
          <h1 className="font-serif text-5xl md:text-6xl leading-tight">{album.title}</h1>
          {album.year && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> {album.year}
            </p>
          )}
          {album.description && <p className="mt-6 text-sm text-muted-foreground leading-relaxed max-w-prose">{album.description}</p>}
          <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground/60">{songs.length} faixas</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {songs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma cifra cadastrada neste álbum.</div>
        ) : (
          <div className="divide-y divide-border">
            {songs.map((s, i) => (
              <Link
                key={s.id}
                to="/app/songs/$songId" params={{ songId: s.id }}
                className="flex items-center justify-between px-5 md:px-6 py-4 hover:bg-accent transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground/60 w-6 text-right">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium truncate group-hover:text-gold transition-colors">{s.title}</span>
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
