
GRANT SELECT ON public.instrument_categories TO anon;
GRANT SELECT ON public.instruments TO anon;
GRANT SELECT ON public.vocal_categories TO anon;
GRANT SELECT ON public.vocals TO anon;

DROP POLICY IF EXISTS "view categories" ON public.instrument_categories;
CREATE POLICY "view categories" ON public.instrument_categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "view instruments" ON public.instruments;
CREATE POLICY "view instruments" ON public.instruments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "view vocal categories" ON public.vocal_categories;
CREATE POLICY "view vocal categories" ON public.vocal_categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "view vocals" ON public.vocals;
CREATE POLICY "view vocals" ON public.vocals FOR SELECT TO anon, authenticated USING (true);
