import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { parseLine, transposeChord, ALL_KEYS, semitonesBetween } from "@/lib/chords";
import { ChevronLeft, Minus, Plus, Type, Maximize2, Play, Pause, Heart, StickyNote } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/songs/$songId")({ component: SongView });

function SongView() {
  const { songId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [song, setSong] = useState<any>(null);
  const [currentKey, setCurrentKey] = useState("C");
  const [fontSize, setFontSize] = useState(18);
  const [fav, setFav] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("songs").select("*, albums(id,title)").eq("id", songId).maybeSingle();
      if (data) {
        setSong(data);
        setCurrentKey(data.original_key);
        if (user) {
          supabase.from("access_history").insert({ user_id: user.id, song_id: songId });
          const { data: f } = await supabase.from("favorites").select("id").eq("user_id", user.id).eq("song_id", songId).maybeSingle();
          setFav(!!f);
        }
      }
    })();
  }, [songId, user]);

  // Autoscroll
  useEffect(() => {
    if (!scrolling) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    const el = presenting ? document.documentElement : scrollRef.current;
    if (!el) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 16.67;
      last = now;
      if (presenting) window.scrollBy(0, scrollSpeed * dt * 0.6);
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

  const steps = semitonesBetween(song.original_key, currentKey);

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

  const Body = (
    <div className="chord-sheet" style={{ fontSize: `${fontSize}px` }}>
      {renderedLines}
    </div>
  );

  if (presenting) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-xl px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-xl">{song.title}</h1>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-gold-soft text-gold">{currentKey}</span>
          </div>
          <div className="flex items-center gap-2">
            <Toolbar
              currentKey={currentKey} setCurrentKey={setCurrentKey}
              fontSize={fontSize} setFontSize={setFontSize}
              scrolling={scrolling} setScrolling={setScrolling}
              scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed}
            />
            <button onClick={() => setPresenting(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">Sair</button>
          </div>
        </div>
        <div className="px-6 md:px-16 py-12 max-w-4xl mx-auto">{Body}</div>
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

      <div className="sticky top-14 md:top-3 z-20 mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/90 backdrop-blur-xl p-3">
        <Toolbar
          currentKey={currentKey} setCurrentKey={setCurrentKey}
          fontSize={fontSize} setFontSize={setFontSize}
          scrolling={scrolling} setScrolling={setScrolling}
          scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed}
        />
        <button onClick={() => setPresenting(true)} className="ml-auto inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
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
    const i = ALL_KEYS.indexOf(currentKey);
    setCurrentKey(ALL_KEYS[((i + d) % 12 + 12) % 12]);
  };
  return (
    <>
      <div className="flex items-center rounded-full border border-border overflow-hidden">
        <button onClick={() => shift(-1)} className="px-3 py-1.5 hover:bg-accent text-sm">−</button>
        <span className="font-mono text-xs px-3 py-1.5 bg-gold-soft text-gold min-w-[3rem] text-center">{currentKey}</span>
        <button onClick={() => shift(+1)} className="px-3 py-1.5 hover:bg-accent text-sm">+</button>
      </div>
      <div className="flex items-center rounded-full border border-border overflow-hidden">
        <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="px-3 py-1.5 hover:bg-accent"><Minus className="h-3.5 w-3.5" /></button>
        <Type className="h-3.5 w-3.5 mx-2 text-muted-foreground" />
        <button onClick={() => setFontSize(Math.min(40, fontSize + 2))} className="px-3 py-1.5 hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <button onClick={() => setScrolling(!scrolling)} className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-accent ${scrolling ? "bg-gold-soft text-gold border-gold/30" : ""}`}>
        {scrolling ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />} Auto {scrollSpeed.toFixed(1)}x
      </button>
      {scrolling && (
        <input type="range" min={0.3} max={4} step={0.1} value={scrollSpeed} onChange={(e) => setScrollSpeed(+e.target.value)} className="w-24 accent-[var(--gold)]" />
      )}
    </>
  );
}
