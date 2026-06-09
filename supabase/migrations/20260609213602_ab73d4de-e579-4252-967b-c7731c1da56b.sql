DROP POLICY IF EXISTS "Anyone can read technical roles" ON public.technical_roles;
CREATE POLICY "Authenticated users can read technical roles"
ON public.technical_roles
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.technical_roles FROM anon;
GRANT SELECT ON public.technical_roles TO authenticated;