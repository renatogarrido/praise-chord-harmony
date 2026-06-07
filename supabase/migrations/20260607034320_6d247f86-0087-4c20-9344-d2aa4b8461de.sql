
-- Restrict EXECUTE on SECURITY DEFINER functions to only the roles that need them

-- Trigger-only functions (no caller should invoke directly)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_support_tickets_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Service-role-only email queue helpers
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- RLS helper functions: needed by authenticated only (called from policies/server fns)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_estadual(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_church_name(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_schedule(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_schedule(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_schedule_church(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.award_user_badges(uuid) FROM PUBLIC, anon;

-- get_public_setlist is intentionally callable by anon (public share token)
-- Keep default EXECUTE for anon/authenticated; no change.
