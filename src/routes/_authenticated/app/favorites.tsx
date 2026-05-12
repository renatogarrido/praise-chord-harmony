import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/favorites")({ component: FavoritesPage });

function FavoritesPage() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("favorites").select("song_id, songs(id,title,original_key,albums(title))").eq("user_id", user.id)
      .then(({ data }) => setSongs((data ?? []).map((f: any) => f.songs).filter(Boolean)));
  }, [user]);

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Suas favoritas</p>
        <h1 className="font-serif text-4xl md:text-5xl">Favoritos</h1>
      </header>
      {songs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">Você ainda não favoritou nenhuma cifra.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {songs.map((s) => (
            <Link key={s.id} to="/app/songs/$songId" params={{ songId: s.id }} className="flex items-center justify-between px-6 py-4 hover:bg-accent group">
              <div><p className="font-medium group-hover:text-gold">{s.title}</p><p className="text-xs text-muted-foreground">{s.albums?.title}</p></div>
              <span className="font-mono text-xs px-2 py-1 rounded bg-gold-soft text-gold">{s.original_key}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
