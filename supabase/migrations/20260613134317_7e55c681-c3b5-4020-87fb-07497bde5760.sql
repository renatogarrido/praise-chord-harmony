ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS spotify_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text;

ALTER TABLE public.setlist_songs
  ADD COLUMN IF NOT EXISTS spotify_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text;