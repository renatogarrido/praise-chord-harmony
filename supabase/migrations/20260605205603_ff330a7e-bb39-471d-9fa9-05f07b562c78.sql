
-- Helper: can manage worship schedules (admin or any leader)
CREATE OR REPLACE FUNCTION public.can_manage_schedule(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','lider_nacional','lider_estadual','lider_local')
  )
$$;

-- Schedules
CREATE TABLE public.worship_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  service_date timestamptz NOT NULL,
  notes text,
  church_name text,
  setlist_id uuid,
  setlist_name text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worship_schedules TO authenticated;
GRANT ALL ON public.worship_schedules TO service_role;
ALTER TABLE public.worship_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view schedules" ON public.worship_schedules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage schedules" ON public.worship_schedules
  FOR ALL TO authenticated
  USING (public.can_manage_schedule(auth.uid()))
  WITH CHECK (public.can_manage_schedule(auth.uid()));

CREATE TRIGGER trg_worship_schedules_updated_at BEFORE UPDATE ON public.worship_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Assignments
CREATE TABLE public.worship_schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.worship_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, user_id, role_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worship_schedule_assignments TO authenticated;
GRANT ALL ON public.worship_schedule_assignments TO service_role;
ALTER TABLE public.worship_schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view assignments" ON public.worship_schedule_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage assignments" ON public.worship_schedule_assignments
  FOR ALL TO authenticated
  USING (public.can_manage_schedule(auth.uid()))
  WITH CHECK (public.can_manage_schedule(auth.uid()));

CREATE INDEX idx_schedule_assignments_schedule ON public.worship_schedule_assignments(schedule_id);
CREATE INDEX idx_schedule_assignments_user ON public.worship_schedule_assignments(user_id);
CREATE INDEX idx_worship_schedules_date ON public.worship_schedules(service_date DESC);
