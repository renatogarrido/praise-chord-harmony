import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { parseLine, transposeChord, ALL_KEYS, semitonesBetween, noteIndex, isChordLine, transposeChordLine } from "@/lib/chords";

import { ChevronLeft, Minus, Plus, Type, Maximize2, Play, Pause, Heart, StickyNote, ChevronRight, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { useSwipeable } from "react-swipeable";

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
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
      const { data } = await supabase.from("songs").select("*, albums(id,title)").eq("id", songId).maybeSingle();
      if (data) {
        setSong(data);
        setTransposeDelta(0); // Reset transpose when changing song
        if (user) {
          // Track access history using upsert to avoid duplicate rows for the same song/user
          supabase.from("access_history").upsert(
            { user_id: user.id, song_id: songId, accessed_at: new Date().toISOString() },
            { onConflict: 'user_id, song_id' }
          ).then(({ error }) => {
            if (error) console.error("Error updating access history:", error);
          });
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
      setLoading(false);
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


  const renderedLines = useMemo(() => {
    if (!song?.lyrics) return [];
    return song.lyrics.split(/\r?\n/).map((line: string, idx: number) => {
      // Handle empty lines
      if (!line.trim()) return <div key={idx} className="h-6" />;

      // Handle Section Markers [Intro], {Chorus}
      const section = line.trim().match(/^\[([^\]]+)\]\s*$/) || line.trim().match(/^\{([^}]+)\}$/);
      if (section) {
        return (
          <div key={idx} className="section bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-md mb-3 mt-4 inline-block text-xs font-bold uppercase tracking-widest">
            {section[1]}
          </div>
        );
      }

      // Handle Comments # some comment
      if (line.trim().startsWith('#')) {
        return <div key={idx} className="text-muted-foreground italic text-sm mb-1 opacity-70">{line.trim().slice(1).trim()}</div>;
      }

      // Handle Chord Lines (lines that only contain chords)
      if (isChordLine(line)) {
        const transposed = transposeChordLine(line, transposeDelta);
        return (
          <div key={idx} className="font-bold text-[#F97316] whitespace-pre mb-0 leading-none py-1" style={{ minHeight: '1.2em' }}>
            {transposed}
          </div>
        );
      }

      // Handle Lyric lines
      return (
        <div key={idx} className="flex flex-wrap items-end leading-none mb-2 text-foreground font-medium whitespace-pre" style={{ minHeight: '1.2em' }}>
          {line}
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

  // Swiping and Keyboard navigation
  const handlers = useSwipeable({
    onSwipedLeft: () => nextSong(),
    onSwipedRight: () => prevSong(),
    trackMouse: false,
    preventScrollOnSwipe: true
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presenting) {
        if (e.code === "ArrowRight") nextSong();
        if (e.code === "ArrowLeft") prevSong();
        return;
      }

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


  if (loading) return <div className="px-6 py-12"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;
  if (!song) return <div className="px-6 py-12 text-center text-muted-foreground">Cifra não encontrada</div>;

  if (presenting) {
    return (
      <div {...handlers} ref={presentationRef} className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-xl px-6 py-3">

          <div className="flex items-center gap-3">
            <h1 className="font-serif text-xl font-bold">{song.title}</h1>
            {currentKey && <span className="font-mono text-xs px-2 py-0.5 rounded bg-orange-500 text-white font-bold">{currentKey}</span>}
            {setlistId && setlistSongs.length > 0 && (
              <span className="text-[10px] bg-accent px-2 py-0.5 rounded-full uppercase tracking-widest text-muted-foreground ml-2 font-medium">
                {currentIndex + 1} / {setlistSongs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Toolbar
              currentKey={currentKey} setTransposeDelta={setTransposeDelta}
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
          {ChordSheet}
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
    <div className="px-4 md:px-12 py-6 md:py-10 max-w-5xl mx-auto space-y-8">
      {/* Header Section with Glassmorphism */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-card to-secondary/30 border border-border/50 p-6 md:p-12 shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-64 w-64 rounded-full bg-gold/10 blur-[100px]" />
        
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-6">
            <button 
              onClick={() => navigate({ to: ".." as any })} 
              className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar para lista
            </button>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-gold/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  {song.albums?.title ?? "Cifra"}
                </span>
                {fav && <Heart className="h-4 w-4 text-gold fill-gold" />}
              </div>
              <h1 className="font-serif text-4xl md:text-6xl leading-tight tracking-tight text-balance">
                {song.title}
              </h1>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-gold" />
                Tom original: <span className="font-mono font-bold text-foreground bg-accent/50 px-2 py-0.5 rounded">{song.original_key}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleFav} 
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${
                fav 
                  ? "border-gold/50 bg-gold/10 text-gold shadow-lg shadow-gold/20" 
                  : "border-border bg-accent/30 text-muted-foreground hover:border-gold/50 hover:text-gold"
              }`}
            >
              <Heart className="h-5 w-5" fill={fav ? "currentColor" : "none"} />
            </button>
            
            <button 
              onClick={() => {
                setPresenting(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }} 
              className="flex h-12 items-center gap-3 rounded-2xl bg-orange-500 px-8 text-xs font-bold uppercase tracking-widest text-white shadow-xl shadow-orange-500/25 active:scale-95 transition-all hover:bg-orange-600 hover:shadow-orange-600/30"
            >
              <Maximize2 className="h-4 w-4" /> 
              <span className="hidden sm:inline">Modo Apresentação</span>
              <span className="sm:hidden">Apresentar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar - Floating Stickied */}
      <div className="sticky top-4 z-30 flex flex-wrap items-center gap-4 rounded-2xl border border-white/5 bg-card/80 backdrop-blur-2xl p-3 shadow-2xl shadow-black/40">
        <Toolbar
          currentKey={currentKey} setTransposeDelta={setTransposeDelta}
          fontSize={fontSize} setFontSize={setFontSize}
          scrolling={scrolling} setScrolling={setScrolling}
          scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed}
        />
        
        {setlistId && setlistSongs.length > 0 && (
          <div className="ml-auto hidden md:flex items-center gap-1 bg-accent/50 rounded-xl p-1 px-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Repertório:</span>
            <span className="text-xs font-mono font-bold text-gold">{currentIndex + 1} / {setlistSongs.length}</span>
          </div>
        )}
      </div>

      {/* Main Song Content */}
      <div className="relative group">
        <div 
          {...handlers} 
          ref={scrollRef} 
          className="rounded-[2.5rem] border border-border/50 bg-card/50 p-6 md:p-14 shadow-inner min-h-[60vh] relative overflow-hidden"
        >
          {/* Paper texture overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
          
          <div className="relative">
            {ChordSheet}
          </div>
          
          {/* Navigation Arrows for Setlist */}
          {setlistId && setlistSongs.length > 0 && (
            <>
              <button 
                onClick={prevSong}
                disabled={currentIndex <= 0}
                className="fixed left-8 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-card/90 border border-border text-muted-foreground shadow-2xl opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-all hover:scale-110 hover:text-gold hidden xl:flex items-center justify-center z-20"
                title="Cifra Anterior"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button 
                onClick={nextSong}
                disabled={currentIndex >= setlistSongs.length - 1}
                className="fixed right-8 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-card/90 border border-border text-muted-foreground shadow-2xl opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-all hover:scale-110 hover:text-gold hidden xl:flex items-center justify-center z-20"
                title="Próxima Cifra"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Setlist Navigation */}
      {setlistId && setlistSongs.length > 0 && (
        <div className="flex items-center justify-between md:hidden bg-accent/30 rounded-2xl p-4 border border-border/50">
          <button 
            onClick={prevSong} 
            disabled={currentIndex <= 0}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-card border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground disabled:opacity-30 active:scale-95 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Música</span>
            <span className="text-sm font-mono font-bold text-gold">
              {currentIndex + 1} de {setlistSongs.length}
            </span>
          </div>
          <button 
            onClick={nextSong} 
            disabled={currentIndex >= setlistSongs.length - 1}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-gold text-primary-foreground text-xs font-bold uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all shadow-lg shadow-gold/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Notes/Observations Section */}
      {song.notes && (
        <div className="rounded-3xl border border-border/50 bg-accent/20 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <StickyNote className="h-12 w-12 text-gold" />
          </div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold mb-4">
            <StickyNote className="h-3.5 w-3.5" /> Observações da Música
          </p>
          <div className="prose prose-invert max-w-none">
            <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{song.notes}</p>
          </div>
        </div>
      )}
      
      {/* Footer Info */}
      <div className="pt-8 pb-12 text-center">
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent mx-auto mb-6" />
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">
          Sistema de Cifras • Profissional
        </p>
      </div>
    </div>
  );
}


function Toolbar({ currentKey, setTransposeDelta, fontSize, setFontSize, scrolling, setScrolling, scrollSpeed, setScrollSpeed }: { 
  currentKey: string; 
  setTransposeDelta: React.Dispatch<React.SetStateAction<number>>; 
  fontSize: number; 
  setFontSize: React.Dispatch<React.SetStateAction<number>>; 
  scrolling: boolean; 
  setScrolling: React.Dispatch<React.SetStateAction<boolean>>; 
  scrollSpeed: number; 
  setScrollSpeed: React.Dispatch<React.SetStateAction<number>>; 
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-full border border-orange-200 dark:border-orange-500/30 overflow-hidden bg-orange-50/50 dark:bg-orange-900/10 p-0.5">
        <button onClick={() => setTransposeDelta((d: number) => d - 1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 transition-colors" title="Diminuir Tom">−</button>
        <div className="flex flex-col items-center justify-center px-2 min-w-[3rem]">
          <span className="text-[9px] uppercase tracking-tighter text-orange-400 dark:text-orange-600 font-bold leading-none mb-0.5">Tom</span>
          <span className="font-mono text-xs text-orange-600 dark:text-orange-400 font-bold leading-none">{currentKey}</span>
        </div>
        <button onClick={() => setTransposeDelta((d: number) => d + 1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 transition-colors" title="Aumentar Tom">+</button>
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
