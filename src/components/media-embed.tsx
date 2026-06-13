import { useState } from "react";
import { Music2, Youtube, Pencil, Check, X } from "lucide-react";

function parseSpotifyEmbed(url: string): string | null {
  if (!url) return null;
  try {
    // Accept spotify:track:ID or open.spotify.com/{type}/{id}
    const m = url.match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|playlist|album|episode|show|artist)\/([a-zA-Z0-9]+))/);
    if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
    const uri = url.match(/^spotify:(track|playlist|album|episode|show|artist):([a-zA-Z0-9]+)$/);
    if (uri) return `https://open.spotify.com/embed/${uri[1]}/${uri[2]}`;
    return null;
  } catch {
    return null;
  }
}

function parseYouTubeEmbed(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const playlist = u.searchParams.get("list");
      if (u.pathname === "/playlist" && playlist) {
        return `https://www.youtube.com/embed/videoseries?list=${playlist}`;
      }
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function SpotifyEmbed({ url, compact = false }: { url?: string | null; compact?: boolean }) {
  const src = parseSpotifyEmbed(url || "");
  if (!src) return null;
  return (
    <iframe
      src={src}
      width="100%"
      height={compact ? 80 : 152}
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      className="rounded-xl"
      title="Spotify player"
    />
  );
}

export function YouTubeEmbed({ url, compact = false }: { url?: string | null; compact?: boolean }) {
  const src = parseYouTubeEmbed(url || "");
  if (!src) return null;
  return (
    <div className={compact ? "aspect-video max-w-md" : "aspect-video"}>
      <iframe
        src={src}
        width="100%"
        height="100%"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="rounded-xl w-full h-full"
        title="YouTube player"
      />
    </div>
  );
}

interface MediaLinksEditorProps {
  spotifyUrl?: string | null;
  youtubeUrl?: string | null;
  onSave: (v: { spotify_url: string | null; youtube_url: string | null }) => Promise<void> | void;
  compact?: boolean;
  label?: string;
}

export function MediaLinksEditor({ spotifyUrl, youtubeUrl, onSave, compact, label }: MediaLinksEditorProps) {
  const [editing, setEditing] = useState(false);
  const [sp, setSp] = useState(spotifyUrl ?? "");
  const [yt, setYt] = useState(youtubeUrl ?? "");
  const [saving, setSaving] = useState(false);

  const hasMedia = !!(spotifyUrl || youtubeUrl);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        spotify_url: sp.trim() || null,
        youtube_url: yt.trim() || null,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="space-y-3">
        {hasMedia && (
          <div className={`grid gap-3 ${spotifyUrl && youtubeUrl ? "md:grid-cols-2" : "grid-cols-1"}`}>
            {spotifyUrl && <SpotifyEmbed url={spotifyUrl} compact={compact} />}
            {youtubeUrl && <YouTubeEmbed url={youtubeUrl} compact={compact} />}
          </div>
        )}
        <button
          type="button"
          onClick={() => { setSp(spotifyUrl ?? ""); setYt(youtubeUrl ?? ""); setEditing(true); }}
          className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-gold transition-colors"
        >
          <Pencil className="h-3 w-3" />
          {hasMedia ? `Editar trilha${label ? " " + label : ""}` : `Adicionar trilha${label ? " " + label : ""} (Spotify / YouTube)`}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Music2 className="h-3.5 w-3.5 text-[#1DB954]" /> Spotify (faixa ou playlist)
        </label>
        <input
          value={sp}
          onChange={(e) => setSp(e.target.value)}
          placeholder="https://open.spotify.com/track/... ou /playlist/..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube (vídeo ou playlist)
        </label>
        <input
          value={yt}
          onChange={(e) => setYt(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... ou youtu.be/..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest"
        >
          <X className="h-3 w-3" /> Cancelar
        </button>
      </div>
    </div>
  );
}
