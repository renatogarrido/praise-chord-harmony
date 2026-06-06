import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Headphones, Upload, Trash2, Music2, Disc3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/vocal-practice")({
  component: VocalPracticePage,
});

const VOICE_PARTS = ["Soprano", "Contralto", "Tenor", "Baixo", "Guia"] as const;
type VoicePart = typeof VOICE_PARTS[number];

type Track = {
  id: string;
  title: string;
  voice_part: string;
  audio_url: string;
  song_id: string | null;
  created_at: string;
};

type Song = { id: string; title: string; album_id: string | null };
type Album = { id: string; title: string; cover_url: string | null; sort_order: number; year: number | null };

const UNASSIGNED = "__unassigned__";

function VocalPracticePage() {
  const { isAdmin, user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [voicePart, setVoicePart] = useState<VoicePart>("Soprano");
  const [songId, setSongId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tRes, sRes, aRes] = await Promise.all([
      supabase.from("vocal_tracks").select("id, title, voice_part, audio_url, song_id, created_at").order("created_at", { ascending: false }),
      supabase.from("songs").select("id, title, album_id").order("title"),
      supabase.from("albums").select("id, title, cover_url, sort_order, year").order("sort_order"),
    ]);
    if (tRes.error) toast.error(tRes.error.message);
    else setTracks(tRes.data as any);
    if (!sRes.error) setSongs(sRes.data as any);
    if (!aRes.error) setAlbums(aRes.data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const songById = useMemo(() => {
    const m = new Map<string, Song>();
    songs.forEach((s) => m.set(s.id, s));
    return m;
  }, [songs]);

  // group tracks by album, then by voice_part
  const byAlbum = useMemo(() => {
    const map: Record<string, Record<string, Track[]>> = {};
    for (const t of tracks) {
      const song = t.song_id ? songById.get(t.song_id) : null;
      const albumKey = song?.album_id ?? UNASSIGNED;
      (map[albumKey] ||= {});
      (map[albumKey][t.voice_part] ||= []).push(t);
    }
    return map;
  }, [tracks, songById]);

  const orderedAlbumKeys = useMemo(() => {
    const keys = Object.keys(byAlbum);
    const known = albums.filter((a) => keys.includes(a.id)).map((a) => a.id);
    const extras = keys.filter((k) => k !== UNASSIGNED && !known.includes(k));
    const tail = keys.includes(UNASSIGNED) ? [UNASSIGNED] : [];
    return [...known, ...extras, ...tail];
  }, [byAlbum, albums]);

  const albumById = useMemo(() => {
    const m = new Map<string, Album>();
    albums.forEach((a) => m.set(a.id, a));
    return m;
  }, [albums]);

  const songTitle = (id: string | null) => id ? songById.get(id)?.title ?? null : null;

  const doUpload = async () => {
    if (!file || !title.trim()) return toast.error("Informe título e arquivo de áudio.");
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `vocal-tracks/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, { contentType: file.type || "audio/mpeg" });
      if (up.error) throw up.error;
      const url = supabase.storage.from("app-assets").getPublicUrl(path).data.publicUrl;
      const ins = await supabase.from("vocal_tracks").insert({
        title: title.trim(),
        voice_part: voicePart,
        audio_url: url,
        song_id: songId || null,
        created_by: user.id,
      } as any);
      if (ins.error) throw ins.error;
      toast.success("Faixa adicionada.");
      setTitle(""); setFile(null); setSongId("");
      const fi = document.getElementById("vocal-file-input") as HTMLInputElement | null;
      if (fi) fi.value = "";
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar.");
    } finally {
      setUploading(false);
    }
  };

  const doDelete = async (t: Track) => {
    if (!confirm(`Excluir "${t.title}"?`)) return;
    const { error } = await supabase.from("vocal_tracks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Removida.");
    load();
  };

  const songsForSelect = useMemo(() => {
    return songs.map((s) => ({
      ...s,
      albumTitle: s.album_id ? albumById.get(s.album_id)?.title ?? null : null,
    }));
  }, [songs, albumById]);

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2 flex items-center gap-2">
          <Headphones className="h-3 w-3" /> Estudo Vocal
        </p>
        <h1 className="font-serif text-4xl md:text-5xl">Vozes por Naipe</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ouça as gravações de cada naipe, organizadas por álbum.</p>
      </header>

      {isAdmin && (
        <section className="rounded-2xl border border-border bg-card p-6 mb-10">
          <h2 className="font-serif text-xl mb-4 flex items-center gap-2"><Upload className="h-4 w-4 text-gold" /> Adicionar faixa</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Santo Espírito — Soprano"
                className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Naipe</label>
              <select value={voicePart} onChange={(e) => setVoicePart(e.target.value as VoicePart)}
                className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none">
                {VOICE_PARTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Música (opcional)</label>
              <select value={songId} onChange={(e) => setSongId(e.target.value)}
                className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-gold/50 focus:outline-none">
                <option value="">— Nenhuma —</option>
                {songsForSelect.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}{s.albumTitle ? ` — ${s.albumTitle}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">A faixa é agrupada pelo álbum da música selecionada.</p>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Arquivo de áudio</label>
              <input id="vocal-file-input" type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-gold-soft file:px-3 file:py-1 file:text-xs file:text-gold" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={doUpload} disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : tracks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não há faixas. {isAdmin ? "Use o formulário acima para adicionar." : ""}</p>
      ) : (
        <div className="space-y-10">
          {orderedAlbumKeys.map((albumKey) => {
            const album = albumKey === UNASSIGNED ? null : albumById.get(albumKey);
            const albumTracksByPart = byAlbum[albumKey];
            const partKeys = [
              ...VOICE_PARTS.filter((vp) => (albumTracksByPart[vp]?.length ?? 0) > 0),
              ...Object.keys(albumTracksByPart).filter((k) => !VOICE_PARTS.includes(k as VoicePart)),
            ];
            return (
              <section key={albumKey} className="rounded-2xl border border-border bg-card/40 p-5">
                <header className="mb-4 flex items-center gap-4">
                  {album?.cover_url ? (
                    <img src={album.cover_url} alt={album.title} className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gold-soft/30 grid place-items-center">
                      <Disc3 className="h-7 w-7 text-gold" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-gold">Álbum</p>
                    <h2 className="font-serif text-2xl truncate">
                      {album?.title ?? "Sem álbum"}
                    </h2>
                    {album?.year && <p className="text-xs text-muted-foreground">{album.year}</p>}
                  </div>
                </header>

                <div className="space-y-6">
                  {partKeys.map((vp) => (
                    <div key={vp}>
                      <h3 className="font-serif text-lg mb-2">{vp}</h3>
                      <div className="space-y-2">
                        {albumTracksByPart[vp].map((t) => (
                          <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{t.title}</p>
                                {songTitle(t.song_id) && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Music2 className="h-3 w-3" /> {songTitle(t.song_id)}
                                  </p>
                                )}
                              </div>
                              {isAdmin && (
                                <button onClick={() => doDelete(t)} className="p-1 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <audio controls preload="none" src={t.audio_url} className="w-full" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
