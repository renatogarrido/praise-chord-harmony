import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { parseLine, transposeChord, ALL_KEYS, semitonesBetween, noteIndex } from "@/lib/chords";
import { ChevronLeft, Minus, Plus, Type, Maximize2, Play, Pause, Heart, StickyNote, ChevronRight, Minimize2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/songs/$songId")({ 
  component: SongView,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      setlist: (search.setlist as string) || undefined,
    };
  },
});

function SongView() {
  const { songId } = Route.useParams();
  const search = Route.useSearch();
  const setlistId = search?.setlist;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [song, setSong] = useState<any>(null);
  const [transposeDelta, setTransposeDelta] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [fav, setFav] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rafRef = useRef<number | null>(null);
  const presentationRef = useRef<HTMLDivElement>(null);

  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const currentIndex = setlistSongs.findIndex(s => s.song_id === songId);

  const currentKey = song?.original_key 
    ? transposeChord(song.original_key, transposeDelta) 
    : "C";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("songs").select("*, albums(id,title)").eq("id", songId).maybeSingle();
      if (data) {
        setSong(data);
        setTransposeDelta(0); // Reset transpose when changing song
        if (user) {
          supabase.from("access_history").insert({ user_id: user.id, song_id: songId });
          const { data: f } = await supabase.from("favorites").select("id").eq("user_id", user.id).eq("song_id", songId).maybeSingle();
          setFav(!!f);
        }
      }

      if (setlistId) {
        const { data: ss } = await supabase
          .from("setlist_songs")
          .select("song_id, position")
          .eq("setlist_id", setlistId)
          .order("position");
        setSetlistSongs(ss || []);
      }
    })();
  }, [songId, user, setlistId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Autoscroll
  useEffect(() => {
    if (!scrolling) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    const el = presenting ? presentationRef.current : scrollRef.current;
    if (!el) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 16.67;
      last = now;
      if (presenting) el.scrollTop += scrollSpeed * dt * 0.6;
      else el.scrollTop += scrollSpeed * dt * 0.6;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [scrolling, scrollSpeed, presenting]);

  const toggleFav = useCallback(async () => {
    if (!user) return;
    if (fav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("song_id", songId);
      setFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, song_id: songId });
      setFav(true);
      toast.success("Adicionada aos favoritos");
    }
  }, [fav, user, songId]);

  if (!song) return <div className="px-6 py-12"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  const renderedLines = useMemo(() => {
    if (!song?.lyrics) return [];
    return song.lyrics.split(/\r?\n/).map((line: string, idx: number) => {
      const tokens = parseLine(line);
      if (tokens[0]?.type === "break") return <div key={idx} className="h-6" />;
      if (tokens[0]?.type === "section") return (
        <div key={idx} className="section bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-md mb-2 inline-block text-xs font-bold uppercase tracking-widest">
          {(tokens[0] as any).label}
        </div>
      );
      if (tokens[0]?.type === "comment") return <div key={idx} className="text-muted-foreground italic text-sm mb-1 opacity-70">{(tokens[0] as any).text}</div>;
      return (
        <div key={idx} className="flex flex-wrap items-end leading-relaxed mb-1" style={{ minHeight: `${fontSize * 2.2}px` }}>
          {tokens.map((t: any, i: number) => t.type === "lyric" ? (
            <span key={i} className="relative inline-block whitespace-pre" style={{ paddingTop: t.chord ? `${fontSize * 1.3}px` : 0 }}>
              {t.chord && (
                <span className="chord absolute top-0 left-0 font-bold text-orange-600 bg-orange-500/15 px-2 py-0.5 rounded border border-orange-500/30 shadow-md transform -translate-y-[1.4em] scale-95 origin-left whitespace-nowrap z-10 transition-colors">
                  {transposeChord(t.chord, transposeDelta)}
                </span>
              )}
              <span className="text-foreground/90">{t.text || "\u00A0"}</span>
            </span>
          ) : null)}
        </div>
      );
    });
  }, [song?.lyrics, transposeDelta, fontSize]);

  const ChordSheet = (
    <div className="chord-sheet" style={{ fontSize: `${fontSize}px` }}>
      {renderedLines}
    </div>
  );

  const nextSong = useCallback(() => {
    if (setlistId && currentIndex < setlistSongs.length - 1) {
      setScrolling(false);
      navigate({ to: "/app/songs/$songId", params: { songId: setlistSongs[currentIndex + 1].song_id }, search: { setlist: setlistId } });
      window.scrollTo(0, 0);
    }
  }, [currentIndex, setlistSongs, setlistId, navigate]);

  const prevSong = useCallback(() => {
    if (setlistId && currentIndex > 0) {
      setScrolling(false);
      navigate({ to: "/app/songs/$songId", params: { songId: setlistSongs[currentIndex - 1].song_id }, search: { setlist: setlistId } });
      window.scrollTo(0, 0);
    }
  }, [currentIndex, setlistSongs, setlistId, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presenting) return;

      if (e.code === "ArrowRight") {
        e.preventDefault();
        nextSong();
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        prevSong();
      }
      if (e.code === "Space") {
        e.preventDefault();
        setScrolling(s => !s);
      }
      if (e.code === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        setPresenting(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [presenting, nextSong, prevSong, scrolling]);


  if (presenting) {
    return (
      <div ref={presentationRef} className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-xl px-6 py-3">

          <div className="flex items-center gap-3">
            <h1 className="font-serif text-xl font-bold">{song.title}</h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-orange-500 text-white font-bold">{currentKey}</span>
            {setlistId && setlistSongs.length > 0 && (
              <span className="text-[10px] bg-accent px-2 py-0.5 rounded-full uppercase tracking-widest text-muted-foreground ml-2 font-medium">
                {currentIndex + 1} / {setlistSongs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Toolbar
              currentKey={currentKey} setCurrentKey={setCurrentKey}
              fontSize={fontSize} setFontSize={setFontSize}
              scrolling={scrolling} setScrolling={setScrolling}
              scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed}
            />
            <button onClick={toggleFullscreen} className="rounded-lg border border-border p-1.5 hover:bg-accent text-muted-foreground" title="Tela Cheia">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); setPresenting(false); }} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">Sair</button>
          </div>
        </div>
        
        <div className="px-6 md:px-16 py-12 max-w-4xl mx-auto">
          {Body}
          <div className="mt-12 text-center text-[10px] text-muted-foreground/30 uppercase tracking-[0.2em]">
            Atalhos: Espaço (Scroll) | Setas (Navegação)
          </div>
        </div>

        {setlistId && (
          <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-between pointer-events-none">
            <button 
              onClick={prevSong} 
              disabled={currentIndex === 0}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-card/80 backdrop-blur border border-border px-6 py-3 text-xs font-semibold uppercase tracking-widest hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button 
              onClick={nextSong} 
              disabled={currentIndex === setlistSongs.length - 1}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:scale-105 transition-transform disabled:opacity-30"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-6 md:px-12 py-6 md:py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate({ to: ".." as any })} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-gold">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <button onClick={toggleFav} className={`rounded-full p-2 transition-colors ${fav ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
          <Heart className="h-5 w-5" fill={fav ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">{song.albums?.title ?? "Cifra"}</p>
        <h1 className="font-serif text-4xl md:text-5xl">{song.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tom original: <span className="font-mono text-foreground">{song.original_key}</span></p>
      </div>

      <div className="sticky top-14 md:top-3 z-20 mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/90 backdrop-blur-xl p-4 shadow-lg shadow-black/20">
        <Toolbar
          currentKey={currentKey} setCurrentKey={setCurrentKey}
          fontSize={fontSize} setFontSize={setFontSize}
          scrolling={scrolling} setScrolling={setScrolling}
          scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed}
        />
        <button 
          onClick={() => {
            setPresenting(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }} 
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all hover:bg-orange-600"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Apresentação
        </button>
      </div>

      <div ref={scrollRef} className="rounded-2xl border border-border bg-card p-6 md:p-10 max-h-[70vh] overflow-y-auto">
        {Body}
      </div>

      {song.notes && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-gold mb-2"><StickyNote className="h-3 w-3" /> Observações</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{song.notes}</p>
        </div>
      )}
    </div>
  );
}

function Toolbar({ currentKey, setCurrentKey, fontSize, setFontSize, scrolling, setScrolling, scrollSpeed, setScrollSpeed }: any) {
  const shift = (d: number) => {
    const i = noteIndex(currentKey);
    if (i === -1) {
      setCurrentKey(ALL_KEYS[0]);
      return;
    }
    const nextIdx = ((i + d) % 12 + 12) % 12;
    setCurrentKey(ALL_KEYS[nextIdx]);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-full border border-border overflow-hidden bg-background/50">
        <button onClick={() => shift(-1)} className="px-3 py-1.5 hover:bg-accent text-sm active:scale-95 transition-transform" title="Diminuir Tom">−</button>
        <span className="font-mono text-xs px-3 py-1.5 bg-gold-soft text-gold min-w-[3.5rem] text-center font-bold">{currentKey}</span>
        <button onClick={() => shift(+1)} className="px-3 py-1.5 hover:bg-accent text-sm active:scale-95 transition-transform" title="Aumentar Tom">+</button>
      </div>
      <div className="flex items-center rounded-full border border-border overflow-hidden bg-background/50">
        <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="px-3 py-1.5 hover:bg-accent active:scale-95 transition-transform"><Minus className="h-3.5 w-3.5" /></button>
        <div className="px-2 flex items-center justify-center border-x border-border/50">
          <Type className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <button onClick={() => setFontSize(Math.min(40, fontSize + 2))} className="px-3 py-1.5 hover:bg-accent active:scale-95 transition-transform"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <button onClick={() => setScrolling(!scrolling)} className={`inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all ${scrolling ? "bg-gold text-primary-foreground border-gold" : "bg-background/50"}`}>
        {scrolling ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />} 
        <span className="hidden sm:inline">Auto</span> {scrollSpeed.toFixed(1)}x
      </button>
      {scrolling && (
        <div className="flex items-center gap-2 px-2 bg-background/50 rounded-full border border-border py-1">
          <button onClick={() => setScrollSpeed(Math.max(0.1, scrollSpeed - 0.1))} className="text-muted-foreground hover:text-gold"><Minus className="h-3 w-3" /></button>
          <input type="range" min={0.1} max={5} step={0.1} value={scrollSpeed} onChange={(e) => setScrollSpeed(+e.target.value)} className="w-16 md:w-24 accent-[var(--gold)]" />
          <button onClick={() => setScrollSpeed(Math.min(5, scrollSpeed + 0.1))} className="text-muted-foreground hover:text-gold"><Plus className="h-3 w-3" /></button>
        </div>
      )}
    </div>
  );
}
