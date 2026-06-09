DROP POLICY IF EXISTS "view profiles" ON public.profiles;
CREATE POLICY "view profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider_nacional'::app_role)
  OR (has_role(auth.uid(), 'lider_estadual'::app_role) AND church_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM churches c WHERE c.name = profiles.church_name AND NOT (c.estadual IS DISTINCT FROM user_estadual(auth.uid()))
  ))
  OR (church_name IS NOT NULL AND NOT (church_name IS DISTINCT FROM user_church_name(auth.uid())))
);

DROP POLICY IF EXISTS "Users can view their own or church setlists" ON public.setlists;
CREATE POLICY "Users can view their own or church setlists" ON public.setlists
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id)
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.church_name = setlists.church_name
  )
);

DROP POLICY IF EXISTS "view songs of viewable setlists" ON public.setlist_songs;
CREATE POLICY "view songs of viewable setlists" ON public.setlist_songs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM setlists s
    WHERE s.id = setlist_songs.setlist_id
      AND (
        s.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.church_name = s.church_name
        )
      )
  )
);
