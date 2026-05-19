
-- 1. Profiles: remove permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 2. Setlists / setlist_songs: remove broad anon SELECT
DROP POLICY IF EXISTS "public read by token" ON public.setlists;
DROP POLICY IF EXISTS "public read setlist songs" ON public.setlist_songs;

-- 3. Secure RPC for public share-token lookup
CREATE OR REPLACE FUNCTION public.get_public_setlist(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setlist public.setlists;
  v_songs jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_setlist FROM public.setlists WHERE share_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.position), '[]'::jsonb)
  INTO v_songs
  FROM (
    SELECT ss.id, ss.position, ss.custom_key, ss.setlist_id, ss.song_id,
           row_to_json(s.*) AS songs
    FROM public.setlist_songs ss
    JOIN public.songs s ON s.id = ss.song_id
    WHERE ss.setlist_id = v_setlist.id
    ORDER BY ss.position
  ) t;

  RETURN jsonb_build_object(
    'setlist', jsonb_build_object(
      'id', v_setlist.id,
      'name', v_setlist.name,
      'share_token', v_setlist.share_token
    ),
    'songs', v_songs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_setlist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_setlist(text) TO anon, authenticated;

-- 4. Remove hardcoded admin emails from new-user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user'::public.app_role
  );

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'user'::public.app_role);

  RETURN NEW;
END;
$$;

-- 5. Set search_path on handle_new_user_role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- 6. Restrict has_role execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
