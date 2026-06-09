-- Permitir leitura pública para o bucket 'avatars'
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Permitir que usuários autenticados façam upload de seus próprios avatares
-- O caminho esperado é 'avatars/{user_id}/filename'
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);

-- Permitir que usuários atualizem seus próprios avatares
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);

-- Permitir que usuários excluam seus próprios avatares
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);