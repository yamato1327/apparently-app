-- Schema-wide fix superseding 20260727000000_grant_email_preferences_service_role.sql.
--
-- A diagnostic (docs/service-role-grant-check.sql) found service_role missing
-- table-level SELECT on 14 tables across the public schema, not just
-- email_preferences — including tables in 20260331232710_email_infra.sql
-- whose RLS policies for service_role were never effective because the base
-- table grant was missing the whole time (BYPASSRLS/RLS policy targeting
-- service_role does not imply the table-level GRANT exists — separate
-- Postgres permission layers).
--
-- oldioruajgcebdbepzwf (Eric's manually-created dev project) never received
-- the default service_role table grants that Lovable-provisioned projects
-- get automatically. Rather than patch table-by-table, this grants
-- service_role standard CRUD across all existing public tables and sets a
-- default-privileges rule so any table created by a future migration
-- inherits the same grant automatically.
--
-- Deliberately scoped to SELECT/INSERT/UPDATE/DELETE, not GRANT ALL, to
-- avoid handing out TRUNCATE/REFERENCES/TRIGGER unnecessarily (same
-- reasoning as the user_integrations fix in 20260701000000_rls_fixes.sql).
--
-- NOTE: This SQL was already run live against oldioruajgcebdbepzwf via the
-- SQL Editor on 2026-07-27 as an immediate unblock. The diagnostic query
-- returned zero rows afterward — confirmed clean. This file exists for
-- migration tracking only; it does NOT need to be re-run.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
