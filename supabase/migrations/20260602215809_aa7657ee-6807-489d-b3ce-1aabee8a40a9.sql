DROP POLICY IF EXISTS "Admins can do everything on user_roles" ON public.user_roles;

CREATE POLICY "Admins can do everything on user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));