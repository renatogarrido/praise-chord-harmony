REVOKE ALL ON FUNCTION public.get_public_setlist(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_setlist(text) TO service_role;