-- 1. Avatars bucket: SELECT only for authenticated users
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Authenticated Read Avatars" ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 2. Avatars: INSERT/UPDATE/DELETE only by owner or admin
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 3. Profiles: allow leaders / church peers to read profiles within their scope
DROP POLICY IF EXISTS "view profiles" ON public.profiles;
CREATE POLICY "view profiles" ON public.profiles FOR SELECT USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'lider_nacional'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'lider_estadual'::public.app_role)
    AND profiles.church_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.name = profiles.church_name
        AND c.estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid())
    )
  )
  OR (
    profiles.church_name IS NOT NULL
    AND profiles.church_name IS NOT DISTINCT FROM public.user_church_name(auth.uid())
  )
);

-- 4. setlist_songs: allow SELECT for any user that can view the parent setlist
CREATE POLICY "view songs of viewable setlists" ON public.setlist_songs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id
      AND (
        s.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.church_name = s.church_name
        )
      )
  )
);