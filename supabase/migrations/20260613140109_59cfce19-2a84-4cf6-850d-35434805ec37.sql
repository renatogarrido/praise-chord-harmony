
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'personal';
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS estadual text;
ALTER TABLE public.setlists ADD CONSTRAINT setlists_visibility_check CHECK (visibility IN ('personal','local','estadual','nacional'));

DROP POLICY IF EXISTS "Users can view their own or church setlists" ON public.setlists;
DROP POLICY IF EXISTS "own setlists" ON public.setlists;

CREATE POLICY "view setlists by hierarchy"
ON public.setlists FOR SELECT
USING (
  auth.uid() = user_id
  OR visibility = 'nacional'
  OR (visibility = 'estadual' AND estadual IS NOT NULL AND estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid()))
  OR (visibility = 'local' AND church_name IS NOT NULL AND church_name IS NOT DISTINCT FROM public.user_church_name(auth.uid()))
);

CREATE POLICY "insert own setlists"
ON public.setlists FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    visibility = 'personal'
    OR (visibility = 'nacional' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)))
    OR (visibility = 'estadual' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role) OR public.has_role(auth.uid(),'lider_estadual'::public.app_role)))
    OR (visibility = 'local' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role) OR public.has_role(auth.uid(),'lider_estadual'::public.app_role) OR public.has_role(auth.uid(),'lider_local'::public.app_role)))
  )
);

CREATE POLICY "update own setlists"
ON public.setlists FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    visibility = 'personal'
    OR (visibility = 'nacional' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)))
    OR (visibility = 'estadual' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role) OR public.has_role(auth.uid(),'lider_estadual'::public.app_role)))
    OR (visibility = 'local' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role) OR public.has_role(auth.uid(),'lider_estadual'::public.app_role) OR public.has_role(auth.uid(),'lider_local'::public.app_role)))
  )
);

CREATE POLICY "delete own setlists"
ON public.setlists FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "view songs of viewable setlists" ON public.setlist_songs;
CREATE POLICY "view songs of viewable setlists"
ON public.setlist_songs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id
      AND (
        s.user_id = auth.uid()
        OR s.visibility = 'nacional'
        OR (s.visibility = 'estadual' AND s.estadual IS NOT NULL AND s.estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid()))
        OR (s.visibility = 'local' AND s.church_name IS NOT NULL AND s.church_name IS NOT DISTINCT FROM public.user_church_name(auth.uid()))
      )
  )
);
