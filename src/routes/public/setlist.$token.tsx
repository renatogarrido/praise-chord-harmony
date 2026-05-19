import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseLine, transposeChord, ALL_KEYS, semitonesBetween } from "@/lib/chords";
import { ChevronLeft, ChevronRight, Minus, Plus, Type, Play, Pause, X } from "lucide-react";

export const Route = createFileRoute("/public/setlist/$token")({ component: PublicSetlistView });

function PublicSetlistView() {
  const { token } = Route.useParams();
  const [setlist, setSetlist] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentKey, setCurrentKey] = useState("");
  const [fontSize, setFontSize] = useState(18);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scrolling, setScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: sl, error: slErr } = await supabase
        .from("setlists")
        .select("*")
        .eq("share_token", token)
        .maybeSingle();

      if (slErr || !sl) {
        setError("Repertório não encontrado ou link expirado.");
        setLoading(false);
        return;
      }

      const { data: ss, error: ssErr } = await supabase
        .from("setlist_songs")
        .select("*, songs(*)")
        .eq("setlist_id", sl.id)
        .order("position");

      if (ssErr || !ss || ss.length === 0) {
        setError("Este repertório ainda não possui músicas.");
        setLoading(false);
        return;
      }

      setSetlist(sl);
      setSongs(ss);
      setCurrentKey(ss[0].custom_key || ss[0].songs.original_key);
      setLoading(false);
    })();
  }, [token]);

  // Autoscroll logic
  useEffect(() => {
    if (!scrolling) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const el = document.documentElement;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 16.67;
      last = now;
      window.scrollBy(0, scrollSpeed * dt * 0.6);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [scrolling, scrollSpeed, currentIndex]);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-12 w-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>;
  if (error) return <div className="flex h-screen items-center justify-center px-6 text-center"><p className="text-muted-foreground">{error}</p></div>;

  const currentSongItem = songs[currentIndex];
  const song = currentSongItem.songs;
  const steps = semitonesBetween(song.original_key, currentKey);

  const nextSong = () => {
    if (currentIndex < songs.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentKey(songs[nextIdx].custom_key || songs[nextIdx].songs.original_key);
      window.scrollTo(0, 0);
      setScrolling(false);
    }
  };

  const prevSong = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setCurrentKey(songs[prevIdx].custom_key || songs[prevIdx].songs.original_key);
      window.scrollTo(0, 0);
      setScrolling(false);
    }
  };

  const renderedLines = song.lyrics.split("\n").map((line: string, idx: number) => {
    const tokens = parseLine(line);
    if (tokens[0]?.type === "break") return <div key={idx} className="h-4" />;
    if (tokens[0]?.type === "section") return <div key={idx} className="section">{(tokens[0] as any).label}</div>;
    if (tokens[0]?.type === "comment") return <div key={idx} className="text-muted-foreground italic text-sm">{(tokens[0] as any).text}</div>;
    return (
      <div key={idx} className="flex flex-wrap items-end" style={{ minHeight: `${fontSize * 2.2}px` }}>
        {tokens.map((t: any, i: number) => t.type === "lyric" ? (
          <span key={i} className="relative inline-block whitespace-pre" style={{ paddingTop: t.chord ? `${fontSize * 1.1}px` : 0 }}>
            {t.chord && <span className="chord absolute top-0 left-0">{transposeChord(t.chord, steps)}</span>}
            <span>{t.text || "\u00A0"}</span>
          </span>
        ) : null)}
      </div>
    );
  });

  const shiftKey = (d: number) => {
    const i = ALL_KEYS.indexOf(currentKey);
    setCurrentKey(ALL_KEYS[((i + d) % 12 + 12) % 12]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex flex-col">
            <h1 className="font-serif text-lg leading-tight truncate max-w-[150px] sm:max-w-none">{song.title}</h1>
            <p className="text-[10px] uppercase tracking-widest text-gold">{currentIndex + 1} de {songs.length} • {setlist.name}</p>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:flex items-center rounded-full border border-border overflow-hidden bg-card">
              <button onClick={() => shiftKey(-1)} className="px-3 py-1 hover:bg-accent text-sm">−</button>
              <span className="font-mono text-[10px] px-2 text-gold">{currentKey}</span>
              <button onClick={() => shiftKey(1)} className="px-3 py-1 hover:bg-accent text-sm">+</button>
            </div>
            
            <div className="flex items-center rounded-full border border-border overflow-hidden bg-card">
              <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="px-3 py-1.5 hover:bg-accent"><Minus className="h-3.5 w-3.5" /></button>
              <button onClick={() => setFontSize(Math.min(40, fontSize + 2))} className="px-3 py-1.5 hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
            </div>

            <button onClick={() => setScrolling(!scrolling)} className={`p-2 rounded-full border border-border hover:bg-accent ${scrolling ? "bg-gold-soft text-gold border-gold/30" : "bg-card"}`}>
              {scrolling ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-16 py-12 max-w-4xl mx-auto chord-sheet" style={{ fontSize: `${fontSize}px` }}>
        {renderedLines}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 p-6 bg-gradient-to-t from-background via-background/80 to-transparent">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button 
            disabled={currentIndex === 0}
            onClick={prevSong}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card border border-border disabled:opacity-30 disabled:pointer-events-none hover:border-gold/50 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="hidden sm:inline text-sm font-medium">Anterior</span>
          </button>

          {scrolling && (
            <div className="flex items-center gap-3 bg-card/90 backdrop-blur px-4 py-2 rounded-full border border-gold/20">
              <span className="text-[10px] font-mono text-gold uppercase tracking-tighter">Velocidade</span>
              <input 
                type="range" min={0.3} max={4} step={0.1} value={scrollSpeed} 
                onChange={(e) => setScrollSpeed(+e.target.value)} 
                className="w-20 sm:w-32 accent-gold"
              />
            </div>
          )}

          <button 
            disabled={currentIndex === songs.length - 1}
            onClick={nextSong}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gold text-primary-foreground disabled:opacity-30 disabled:pointer-events-none hover:scale-105 transition-transform"
          >
            <span className="hidden sm:inline text-sm font-bold uppercase tracking-widest">Próxima</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
