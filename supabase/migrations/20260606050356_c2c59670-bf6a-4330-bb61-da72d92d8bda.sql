GRANT SELECT ON public.churches TO anon;

CREATE POLICY "public can view church signup options"
ON public.churches
FOR SELECT
TO anon
USING (true);