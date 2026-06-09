-- Create a policy to allow public read access to the avatars bucket
-- This works even if the bucket is "private" as long as the policy allows SELECT for everyone
CREATE POLICY "Public Read Access to Avatars" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
