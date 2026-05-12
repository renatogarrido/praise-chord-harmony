
-- ===== ROLES =====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view profiles" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Auto profile + first-user-as-admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles(id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== ALBUMS =====
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  year INT,
  description TEXT,
  cover_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view albums" ON public.albums FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write albums" ON public.albums FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== SONGS =====
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  original_key TEXT NOT NULL DEFAULT 'C',
  lyrics TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view songs" ON public.songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write songs" ON public.songs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX songs_album_idx ON public.songs(album_id);
CREATE INDEX songs_title_idx ON public.songs USING gin (to_tsvector('portuguese', title));

-- ===== FAVORITES =====
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, song_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ===== ACCESS HISTORY =====
CREATE TABLE public.access_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.access_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history" ON public.access_history FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own history" ON public.access_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=user_id);
CREATE INDEX history_user_idx ON public.access_history(user_id, accessed_at DESC);
CREATE INDEX history_song_idx ON public.access_history(song_id);

-- ===== SETLISTS =====
CREATE TABLE public.setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  share_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX setlists_share_token_idx ON public.setlists(share_token);
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own setlists" ON public.setlists FOR ALL TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "public read by token" ON public.setlists FOR SELECT TO anon USING (true);

CREATE TABLE public.setlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  custom_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own setlist songs" ON public.setlist_songs FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.setlists s WHERE s.id=setlist_id AND s.user_id=auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.setlists s WHERE s.id=setlist_id AND s.user_id=auth.uid()));
CREATE POLICY "public read setlist songs" ON public.setlist_songs FOR SELECT TO anon USING (true);
CREATE INDEX setlist_songs_idx ON public.setlist_songs(setlist_id, position);

-- ===== APP SETTINGS =====
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  primary_color TEXT NOT NULL DEFAULT '#C5A059',
  logo_url TEXT,
  bg_url TEXT,
  default_theme TEXT NOT NULL DEFAULT 'dark',
  app_name TEXT NOT NULL DEFAULT 'Cifras Praise',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings(id) VALUES (1);
CREATE POLICY "anyone read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "admin update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== STORAGE BUCKETS =====
INSERT INTO storage.buckets (id, name, public) VALUES
  ('album-covers','album-covers', true),
  ('app-assets','app-assets', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "public read covers" ON storage.objects FOR SELECT USING (bucket_id IN ('album-covers','app-assets'));
CREATE POLICY "admin write covers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('album-covers','app-assets') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update covers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('album-covers','app-assets') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete covers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('album-covers','app-assets') AND public.has_role(auth.uid(),'admin'));
