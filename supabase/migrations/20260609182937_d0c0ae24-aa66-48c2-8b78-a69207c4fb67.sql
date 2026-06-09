-- Conceder permissões para technical_categories
GRANT SELECT ON public.technical_categories TO authenticated;
GRANT ALL ON public.technical_categories TO service_role;

-- Conceder permissões para technical_team_assignments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_team_assignments TO authenticated;
GRANT ALL ON public.technical_team_assignments TO service_role;
