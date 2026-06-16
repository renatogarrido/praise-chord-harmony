
-- 1) profiles INSERT policy
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 2) setlists: re-create policies scoped to authenticated only
DROP POLICY IF EXISTS "view setlists by hierarchy" ON public.setlists;
CREATE POLICY "view setlists by hierarchy"
ON public.setlists
FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id)
  OR (visibility = 'nacional')
  OR (visibility = 'estadual' AND estadual IS NOT NULL AND NOT (estadual IS DISTINCT FROM public.user_estadual(auth.uid())))
  OR (visibility = 'local' AND church_name IS NOT NULL AND NOT (church_name IS DISTINCT FROM public.user_church_name(auth.uid())))
);

DROP POLICY IF EXISTS "insert own setlists" ON public.setlists;
CREATE POLICY "insert own setlists"
ON public.setlists
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    visibility = 'personal'
    OR (visibility = 'nacional' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'lider_nacional'::public.app_role)))
    OR (visibility = 'estadual' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'lider_nacional'::public.app_role) OR public.has_role(auth.uid(), 'lider_estadual'::public.app_role)))
    OR (visibility = 'local' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'lider_nacional'::public.app_role) OR public.has_role(auth.uid(), 'lider_estadual'::public.app_role) OR public.has_role(auth.uid(), 'lider_local'::public.app_role)))
  )
);

DROP POLICY IF EXISTS "update own setlists" ON public.setlists;
CREATE POLICY "update own setlists"
ON public.setlists
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND (
    visibility = 'personal'
    OR (visibility = 'nacional' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'lider_nacional'::public.app_role)))
    OR (visibility = 'estadual' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'lider_nacional'::public.app_role) OR public.has_role(auth.uid(), 'lider_estadual'::public.app_role)))
    OR (visibility = 'local' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'lider_nacional'::public.app_role) OR public.has_role(auth.uid(), 'lider_estadual'::public.app_role) OR public.has_role(auth.uid(), 'lider_local'::public.app_role)))
  )
);

DROP POLICY IF EXISTS "delete own setlists" ON public.setlists;
CREATE POLICY "delete own setlists"
ON public.setlists
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 3) setlist_songs: restrict SELECT to authenticated
DROP POLICY IF EXISTS "view songs of viewable setlists" ON public.setlist_songs;
CREATE POLICY "view songs of viewable setlists"
ON public.setlist_songs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id
      AND (
        s.user_id = auth.uid()
        OR s.visibility = 'nacional'
        OR (s.visibility = 'estadual' AND s.estadual IS NOT NULL AND NOT (s.estadual IS DISTINCT FROM public.user_estadual(auth.uid())))
        OR (s.visibility = 'local' AND s.church_name IS NOT NULL AND NOT (s.church_name IS DISTINCT FROM public.user_church_name(auth.uid())))
      )
  )
);
