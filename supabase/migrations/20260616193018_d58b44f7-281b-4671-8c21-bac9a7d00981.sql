
ALTER TABLE public.knowledge_pages
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS department text;

CREATE INDEX IF NOT EXISTS knowledge_pages_category_idx ON public.knowledge_pages(category);
CREATE INDEX IF NOT EXISTS knowledge_pages_department_idx ON public.knowledge_pages(department);

-- Storage policies for knowledge-images bucket
CREATE POLICY "knowledge_images_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'knowledge-images');

CREATE POLICY "knowledge_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "knowledge_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'knowledge-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'knowledge-images' AND owner = auth.uid());

CREATE POLICY "knowledge_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'knowledge-images' AND owner = auth.uid());
