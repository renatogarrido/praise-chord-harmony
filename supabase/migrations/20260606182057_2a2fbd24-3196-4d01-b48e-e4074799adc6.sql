
-- Badge definitions
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'award',
  threshold integer NOT NULL,
  tier integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view badges" ON public.badges FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admin manage badges" ON public.badges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Awarded badges
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own or admin" ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage user_badges" ON public.user_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX user_badges_user_idx ON public.user_badges(user_id);

-- Seed default badges based on access_history count
INSERT INTO public.badges (code, name, description, icon, threshold, tier) VALUES
  ('explorer',   'Explorador',     'Acessou 10 cifras',       'sparkles',  10,   1),
  ('devoted',    'Dedicado',       'Acessou 50 cifras',       'music',     50,   2),
  ('worshiper',  'Adorador',       'Acessou 100 cifras',      'heart',     100,  3),
  ('maestro',    'Maestro',        'Acessou 500 cifras',      'crown',     500,  4),
  ('legend',     'Lenda do Louvor','Acessou 1000 cifras',     'trophy',    1000, 5);

-- Function to award badges for a user based on access count
CREATE OR REPLACE FUNCTION public.award_user_badges(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_awarded integer := 0;
BEGIN
  SELECT count(*) INTO v_count FROM public.access_history WHERE user_id = _user_id;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT _user_id, b.id
  FROM public.badges b
  WHERE b.threshold <= v_count
    AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = _user_id AND ub.badge_id = b.id
    );
  GET DIAGNOSTICS v_awarded = ROW_COUNT;
  RETURN v_awarded;
END;
$$;
GRANT EXECUTE ON FUNCTION public.award_user_badges(uuid) TO authenticated, service_role;
