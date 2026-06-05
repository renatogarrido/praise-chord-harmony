
CREATE TABLE public.instrument_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instrument_categories TO authenticated;
GRANT ALL ON public.instrument_categories TO service_role;
ALTER TABLE public.instrument_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view categories" ON public.instrument_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage categories" ON public.instrument_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.instrument_categories(id) ON DELETE CASCADE,
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instruments TO authenticated;
GRANT ALL ON public.instruments TO service_role;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view instruments" ON public.instruments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage instruments" ON public.instruments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER instrument_categories_updated BEFORE UPDATE ON public.instrument_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER instruments_updated BEFORE UPDATE ON public.instruments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed
WITH cats AS (
  INSERT INTO public.instrument_categories(name, sort_order) VALUES
    ('Cordas dedilhadas / graves', 10),
    ('Teclas', 20),
    ('Percussão', 30),
    ('Sopros', 40),
    ('Cordas orquestrais', 50)
  RETURNING id, name
)
INSERT INTO public.instruments(category_id, value, label, sort_order)
SELECT c.id, v.value, v.label, v.sort_order FROM cats c JOIN (VALUES
  ('Cordas dedilhadas / graves','baixista_baixo_eletrico','Baixista — baixo elétrico',10),
  ('Cordas dedilhadas / graves','baixista_contrabaixo_acustico','Baixista — contrabaixo acústico',20),
  ('Cordas dedilhadas / graves','guitarrista_eletrica','Guitarrista — guitarra elétrica',30),
  ('Cordas dedilhadas / graves','guitarrista_semiacustica','Guitarrista — guitarra semiacústica',40),
  ('Cordas dedilhadas / graves','violonista_aco','Violonista — violão aço',50),
  ('Cordas dedilhadas / graves','violonista_nylon','Violonista — violão nylon',60),
  ('Cordas dedilhadas / graves','violonista_7_cordas','Violonista — violão 7 cordas',70),
  ('Cordas dedilhadas / graves','harpista','Harpista',80),
  ('Teclas','tecladista_teclado','Tecladista — teclado',10),
  ('Teclas','tecladista_piano','Tecladista — piano',20),
  ('Teclas','tecladista_synth','Tecladista — synth',30),
  ('Teclas','pianista','Pianista',40),
  ('Teclas','acordeonista','Acordeonista / Sanfoneiro',50),
  ('Percussão','baterista','Baterista',10),
  ('Percussão','percussionista','Percussionista (congas, bongô, pandeiro, cajón…)',20),
  ('Sopros','saxofonista_alto','Saxofonista — alto',10),
  ('Sopros','saxofonista_tenor','Saxofonista — tenor',20),
  ('Sopros','saxofonista_baritono','Saxofonista — barítono',30),
  ('Sopros','trompetista','Trompetista',40),
  ('Sopros','trombonista','Trombonista',50),
  ('Sopros','flautista_doce','Flautista — flauta doce',60),
  ('Sopros','flautista_transversal','Flautista — transversal',70),
  ('Sopros','clarinetista','Clarinetista',80),
  ('Sopros','gaitista','Gaitista (harmônica)',90),
  ('Cordas orquestrais','violinista','Violinista',10),
  ('Cordas orquestrais','violista','Violista (viola de orquestra)',20),
  ('Cordas orquestrais','violoncelista','Violoncelista',30)
) v(cat,value,label,sort_order) ON c.name = v.cat;
