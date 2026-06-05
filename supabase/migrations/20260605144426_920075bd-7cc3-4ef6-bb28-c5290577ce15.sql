
CREATE TABLE public.vocal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocal_categories TO authenticated;
GRANT ALL ON public.vocal_categories TO service_role;
ALTER TABLE public.vocal_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view vocal categories" ON public.vocal_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage vocal categories" ON public.vocal_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.vocals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.vocal_categories(id) ON DELETE CASCADE,
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocals TO authenticated;
GRANT ALL ON public.vocals TO service_role;
ALTER TABLE public.vocals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view vocals" ON public.vocals FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage vocals" ON public.vocals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER vocal_categories_updated BEFORE UPDATE ON public.vocal_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER vocals_updated BEFORE UPDATE ON public.vocals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

WITH cats AS (
  INSERT INTO public.vocal_categories(name, sort_order) VALUES
    ('Voz feminina', 10),
    ('Voz masculina', 20)
  RETURNING id, name
)
INSERT INTO public.vocals(category_id, value, label, sort_order)
SELECT c.id, v.value, v.label, v.sort_order FROM cats c JOIN (VALUES
  ('Voz feminina','soprano','Soprano (mais aguda)',10),
  ('Voz feminina','mezzosoprano','Mezzosoprano (intermediária)',20),
  ('Voz feminina','contralto','Contralto (mais grave)',30),
  ('Voz masculina','tenor','Tenor (mais aguda)',10),
  ('Voz masculina','baritono','Barítono (intermediária)',20),
  ('Voz masculina','baixo_vocal','Baixo (mais grave)',30)
) v(cat,value,label,sort_order) ON c.name = v.cat;
