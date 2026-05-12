import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/history")({ component: HistoryPage });

function HistoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("access_history").select("song_id, accessed_at, songs(id,title,original_key,albums(title))")
      .eq("user_id", user.id).order("accessed_at", { ascending: false }).limit(50)
      .then(({ data }) => {
        const seen = new Set<string>();
        setItems((data ?? []).filter((h: any) => {
          if (!h.songs || seen.has(h.song_id)) return false;
          seen.add(h.song_id); return true;
        }));
      });
  }, [user]);

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Acessadas recentemente</p>
        <h1 className="font-serif text-4xl md:text-5xl">Recentes</h1>
      </header>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">Seu histórico aparecerá aqui.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {items.map((h: any) => (
            <Link key={h.song_id} to="/app/songs/$songId" params={{ songId: h.song_id }} className="flex items-center justify-between px-6 py-4 hover:bg-accent group">
              <div><p className="font-medium group-hover:text-gold">{h.songs.title}</p><p className="text-xs text-muted-foreground">{h.songs.albums?.title}</p></div>
              <span className="text-[10px] text-muted-foreground/70">{new Date(h.accessed_at).toLocaleDateString("pt-BR")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
