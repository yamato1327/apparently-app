
-- has_role: needed by authenticated users via RLS, but not by anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- admin_get_user_activity: only admins (authenticated) should call this
REVOKE EXECUTE ON FUNCTION public.admin_get_user_activity() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_get_user_activity() TO authenticated;

-- handle_new_user: trigger function, no direct execution needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;

-- update_updated_at_column: trigger function, no direct execution needed
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public;
