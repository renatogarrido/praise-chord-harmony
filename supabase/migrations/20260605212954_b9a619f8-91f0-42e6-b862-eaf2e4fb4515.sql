
CREATE TABLE public.monthly_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  weekdays jsonb NOT NULL DEFAULT '{}'::jsonb,
  sunday_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_availability TO authenticated;
GRANT ALL ON public.monthly_availability TO service_role;

ALTER TABLE public.monthly_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own availability"
  ON public.monthly_availability FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "managers read availability"
  ON public.monthly_availability FOR SELECT
  TO authenticated
  USING (public.can_manage_schedule(auth.uid()));

CREATE TRIGGER monthly_availability_set_updated_at
  BEFORE UPDATE ON public.monthly_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX monthly_availability_year_month_idx
  ON public.monthly_availability(year, month);
