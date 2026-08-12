REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_moderator(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_community_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;