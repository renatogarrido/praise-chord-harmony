ALTER TABLE public.technical_team_assignments 
DROP CONSTRAINT IF EXISTS technical_team_assignments_category_id_fkey;

ALTER TABLE public.technical_team_assignments 
ADD CONSTRAINT technical_team_assignments_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.technical_categories(id) ON DELETE CASCADE;

GRANT ALL ON public.technical_team_assignments TO authenticated;
GRANT ALL ON public.technical_team_assignments TO service_role;
GRANT ALL ON public.technical_categories TO authenticated;
GRANT ALL ON public.technical_categories TO service_role;