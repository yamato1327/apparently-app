-- Diagnostic: tables in public schema that service_role cannot SELECT
--
-- Run this in the Supabase SQL Editor AFTER applying migration
-- 20260727000000_grant_email_preferences_service_role.sql.
--
-- send-insight-emails queries these tables via the service-role admin client:
--   email_preferences, reminders, children, profiles, events
--
-- If any of those appear in the results below, add a matching
-- GRANT SELECT ON public.<table> TO service_role; to a new migration.
-- An empty result means all public tables are accessible and the digest
-- should no longer hit "permission denied" (42501) errors.
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT has_table_privilege('service_role', c.oid, 'SELECT')
ORDER BY c.relname;
