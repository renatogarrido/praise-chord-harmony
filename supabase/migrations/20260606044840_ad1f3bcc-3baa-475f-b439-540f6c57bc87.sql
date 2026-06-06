
CREATE TABLE public.vocal_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  voice_part TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocal_tracks TO authenticated;
GRANT ALL ON public.vocal_tracks TO service_role;

ALTER TABLE public.vocal_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view vocal tracks" ON public.vocal_tracks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage vocal tracks" ON public.vocal_tracks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER vocal_tracks_set_updated_at
  BEFORE UPDATE ON public.vocal_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX vocal_tracks_voice_part_idx ON public.vocal_tracks(voice_part);
CREATE INDEX vocal_tracks_song_id_idx ON public.vocal_tracks(song_id);
