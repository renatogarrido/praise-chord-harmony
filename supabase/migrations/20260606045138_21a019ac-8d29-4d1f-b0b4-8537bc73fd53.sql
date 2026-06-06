
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_church_name(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_estadual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_schedule(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_schedule_church(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_setlist(text) TO anon, authenticated;
