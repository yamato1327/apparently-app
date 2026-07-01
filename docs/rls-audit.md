# RLS Audit — Apparently

_Audited: 2026-07-01. Covers all 31 migrations up to and including `20260630120000_calendar_integration.sql`._

---

## Summary

The app is **close to safe for real users but not quite there yet**. Every public table has RLS enabled and every user-facing table correctly scopes SELECT/INSERT to `auth.uid() = user_id`. The four issues identified require a fix migration before onboarding users beyond the developer. The most important: the `event-attachments` storage bucket has no UPDATE policy (users can upload and delete files but cannot replace them), and `user_integrations` was granted `ALL` privileges to authenticated users — which includes TRUNCATE, bypassing RLS. These are fixed by `20260701000000_rls_fixes.sql`. There are also several lower-priority data-integrity gaps (missing FK constraints, missing `WITH CHECK` on some UPDATE policies) that don't affect security but should be addressed before production.

---

## Tables Audited

### `public.profiles`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id` (own)
  - SELECT — `has_role(auth.uid(), 'admin')` (admin override)
  - INSERT — `WITH CHECK (auth.uid() = user_id)`
  - UPDATE — `USING (auth.uid() = user_id)` _(no explicit WITH CHECK — defaults to USING, safe)_
  - DELETE — **none** _(intentional: profile deletion cascades from `auth.users` ON DELETE CASCADE; a user shouldn't be able to delete their own profile row independently)_
- **Verdict:** ✅ Secure
- **Notes:** The missing `WITH CHECK` on UPDATE is a style gap — PostgreSQL defaults to the USING clause, so the effective behaviour is identical. Explicitly adding it would be cleaner.

---

### `public.children`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id`
  - INSERT — `WITH CHECK (auth.uid() = user_id)`
  - UPDATE — `USING (auth.uid() = user_id)` _(no explicit WITH CHECK)_
  - DELETE — `auth.uid() = user_id`
- **Verdict:** ✅ Secure
- **Notes:** Same implicit WITH CHECK observation as profiles.

---

### `public.events`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id`
  - INSERT — `WITH CHECK (auth.uid() = user_id)`
  - UPDATE — `USING (auth.uid() = user_id)` _(no explicit WITH CHECK)_
  - DELETE — `auth.uid() = user_id`
- **Verdict:** ✅ Secure

---

### `public.development_scores`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id` (TO authenticated)
  - INSERT — `WITH CHECK (auth.uid() = user_id)` (TO authenticated)
  - UPDATE — `USING (auth.uid() = user_id)` (TO authenticated) _(no explicit WITH CHECK)_
  - DELETE — `auth.uid() = user_id` (TO authenticated)
- **Verdict:** ✅ Secure
- **Notes:** `user_id UUID NOT NULL` has no FK to `auth.users`. Deletion of a user cascades through `children → development_scores` (child_id FK ON DELETE CASCADE), so cleanup works — but it depends on the child existing. Any score created without a valid child_id would be orphaned on user deletion (not currently possible via the UI, but worth noting).

---

### `public.meeting_records`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id` (TO authenticated)
  - INSERT — `WITH CHECK (auth.uid() = user_id)` (TO authenticated)
  - UPDATE — `USING (auth.uid() = user_id)` (TO authenticated) _(no explicit WITH CHECK)_
  - DELETE — `auth.uid() = user_id` (TO authenticated)
- **Verdict:** ✅ Secure
- **Notes:** Same FK observation as development_scores.

---

### `public.reading_books`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id` (TO authenticated)
  - INSERT — `WITH CHECK (auth.uid() = user_id)` (TO authenticated)
  - UPDATE — `USING (auth.uid() = user_id)` (TO authenticated) _(no explicit WITH CHECK)_
  - DELETE — `auth.uid() = user_id` (TO authenticated)
- **Verdict:** ✅ Secure
- **Notes:** Same FK observation. `user_id UUID NOT NULL` has no FK to `auth.users`, but cascade via `child_id → children → auth.users` covers deletion cleanup.

---

### `public.email_preferences`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id`
  - INSERT — `WITH CHECK (auth.uid() = user_id)`
  - UPDATE — `USING (auth.uid() = user_id)` _(no explicit WITH CHECK)_
  - DELETE — `auth.uid() = user_id`
- **Verdict:** ✅ Secure
- **Notes:** `user_id UUID NOT NULL UNIQUE` has **no FK to `auth.users`** — this table is the only user-scoped table with no cascade path. If an `auth.users` row is deleted directly (e.g., from the Supabase dashboard), the `email_preferences` row is orphaned. Low risk for current usage but worth a future FK migration.

---

### `public.user_roles`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id` (own)
  - SELECT — `has_role(auth.uid(), 'admin')` (admin sees all)
  - INSERT — `WITH CHECK (has_role(auth.uid(), 'admin'))` (admin only)
  - DELETE — `has_role(auth.uid(), 'admin')` (admin only)
  - UPDATE — **none** _(intentional: roles are managed via INSERT/DELETE, not UPDATE)_
- **Verdict:** ✅ Secure
- **Notes:** The INSERT `WITH CHECK` only verifies the caller is an admin — it doesn't restrict which `user_id` the admin inserts. This is correct design (admins must be able to grant roles to other users). The `has_role()` function is `SECURITY DEFINER` so it bypasses RLS on the `user_roles` table itself.

---

### `public.email_send_log`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.role() = 'service_role'`
  - INSERT — `WITH CHECK (auth.role() = 'service_role')`
  - UPDATE — `USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`
  - DELETE — **none** _(intentional: append-only audit log)_
- **Verdict:** ✅ Secure
- **Notes:** Correctly locked to service_role only. Authenticated users (via PostgREST) cannot read, write, or modify email log entries.

---

### `public.email_send_state`
- **RLS enabled:** yes
- **Policies:**
  - ALL — `USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`
- **Verdict:** ✅ Secure
- **Notes:** Single-row config table for rate limiting. Correctly locked to service_role.

---

### `public.suppressed_emails`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.role() = 'service_role'`
  - INSERT — `WITH CHECK (auth.role() = 'service_role')`
  - UPDATE — **none** _(intentional: append-only)_
  - DELETE — **none** _(intentional: suppression should be permanent)_
- **Verdict:** ✅ Secure

---

### `public.email_unsubscribe_tokens`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.role() = 'service_role'`
  - INSERT — `WITH CHECK (auth.role() = 'service_role')`
  - UPDATE — `USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`
  - DELETE — **none** _(intentional: tokens should persist after use)_
- **Verdict:** ✅ Secure

---

### `public.reminders`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id`
  - INSERT — `WITH CHECK (auth.uid() = user_id)`
  - UPDATE — `USING (auth.uid() = user_id)` _(no explicit WITH CHECK — the earlier migration `20260428020905` created the policy without it; the corrected version in `20260428040029` was skipped because the policy already existed)_
  - DELETE — `auth.uid() = user_id`
- **Verdict:** ⚠️ Minor issue
- **Issues:**
  1. `child_id uuid NULL` has **no FK constraint** to `public.children(id)`. If a child is deleted, any reminder referencing that child will retain a dangling `child_id` pointing at a non-existent row. (Confirmed Issue 4 — fixed in the migration below.)
  2. `user_id uuid NOT NULL` has no FK to `auth.users` — orphaned rows if user is deleted directly.
  3. UPDATE policy missing explicit `WITH CHECK` (safe, defaults to USING).

---

### `public.event_attachments`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id`
  - INSERT — `WITH CHECK (auth.uid() = user_id)`
  - UPDATE — `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` (added in migration `20260428121904`) ✅
  - DELETE — `auth.uid() = user_id`
- **Verdict:** ✅ Secure (table policies are complete)
- **Notes:**
  - `event_id UUID NOT NULL` has **no FK to `public.events(id)`** — attachment records are not cascade-deleted when an event is deleted. The storage object remains and the DB row becomes orphaned. Data integrity issue, not a security issue.
  - `user_id UUID NOT NULL` has no FK to `auth.users`. No cascade path.
  - The corresponding **storage bucket** for this table has a gap — see Storage Buckets below.

---

### `public.user_integrations`
- **RLS enabled:** yes
- **Policies:**
  - SELECT — `auth.uid() = user_id`
  - INSERT — `WITH CHECK (auth.uid() = user_id)`
  - UPDATE — `USING (auth.uid() = user_id)` _(no explicit WITH CHECK)_
  - DELETE — **none** ⚠️ Missing
- **Verdict:** ⚠️ Two issues
- **Issues:**
  1. `GRANT ALL ON public.user_integrations TO authenticated` — grants SELECT, INSERT, UPDATE, DELETE, **TRUNCATE**, REFERENCES, and TRIGGER to authenticated users. TRUNCATE bypasses RLS entirely; an authenticated user with this grant could in principle truncate the entire table. In Supabase's PostgREST stack TRUNCATE is not exposed via the API, but the privilege is still overly broad and should be revoked. (Issue 2 — fixed below.)
  2. No DELETE policy — users cannot delete their own integration row. Needed for a future "disconnect Google account" button. (Issue 3 — fixed below.)

---

## Storage Buckets Audited

### `meeting-docs`
- **Public:** no
- **Policies:**
  - SELECT — `bucket_id = 'meeting-docs' AND (storage.foldername(name))[1] = auth.uid()::text`
  - INSERT — `WITH CHECK (bucket_id = 'meeting-docs' AND (storage.foldername(name))[1] = auth.uid()::text)`
  - DELETE — same USING
  - UPDATE — added in `20260506005108` ✅ (both USING and WITH CHECK)
- **Verdict:** ✅ Secure

---

### `reading-photos`
- **Public:** no
- **Policies:**
  - SELECT — `bucket_id = 'reading-photos' AND (storage.foldername(name))[1] = auth.uid()::text`
  - INSERT — same WITH CHECK
  - DELETE — same USING
  - UPDATE — added in `20260506005108` ✅
- **Verdict:** ✅ Secure

---

### `event-attachments`
- **Public:** no
- **Policies:**
  - SELECT — `bucket_id = 'event-attachments' AND auth.uid()::text = (storage.foldername(name))[1]`
  - INSERT — same WITH CHECK
  - DELETE — same USING
  - UPDATE — **MISSING** ❌
- **Verdict:** ❌ Critical gap
- **Notes:** The `meeting-docs` and `reading-photos` buckets received UPDATE policies in migration `20260506005108`, but `event-attachments` was not included. The `event_attachments` table (row-level) got an UPDATE policy in `20260428121904`, but the corresponding storage object UPDATE policy was never added. Without it, file replacement (re-uploading a file to the same path) is blocked. Fixed in the migration below.

---

## Issues Found

1. ❌ **CRITICAL — `event-attachments` storage bucket missing UPDATE policy.**  
   The bucket has SELECT, INSERT, DELETE but no UPDATE. File replacement is silently blocked. The `meeting-docs` and `reading-photos` buckets were correctly patched in `20260506005108` but `event-attachments` was overlooked.

2. ⚠️ **HIGH — `user_integrations` granted `GRANT ALL` to `authenticated`.**  
   `GRANT ALL` includes TRUNCATE, REFERENCES, and TRIGGER in addition to SELECT/INSERT/UPDATE/DELETE. TRUNCATE bypasses RLS — any authenticated user with direct DB access (not via PostgREST) could truncate the entire `user_integrations` table. Via the Supabase JS client / PostgREST this isn't exposed, but the privilege is unnecessarily broad.

3. ⚠️ **MEDIUM — `user_integrations` missing DELETE policy.**  
   Users cannot delete their own integration row. The "disconnect Google" button can only null-out fields; it cannot fully remove the row. The policy needs to be added before implementing a proper disconnect feature.

4. ⚠️ **MEDIUM — `reminders.child_id` missing FK constraint.**  
   `child_id uuid NULL` has no `REFERENCES public.children(id) ON DELETE SET NULL`. If a child is deleted, any reminder referencing that child retains a dangling UUID that points at nothing. The app UI may silently fail or show incorrect data when filtering reminders by child.

5. ℹ️ **LOW — `email_preferences.user_id` has no FK to `auth.users`.**  
   No cascade path. If an `auth.users` row is hard-deleted, the corresponding `email_preferences` row is orphaned. No security impact (RLS is correct), but the orphaned rows accumulate and could confuse future admin tooling.

6. ℹ️ **LOW — `reminders.user_id` has no FK to `auth.users`.**  
   Same orphan risk as above. No cascade path from user deletion.

7. ℹ️ **LOW — `event_attachments.event_id` has no FK to `public.events(id)`.**  
   Deleting an event does not cascade-delete attachment metadata rows. Storage objects are also not cleaned up (this is a known limitation of Supabase Storage — you have to delete storage objects explicitly before or after deleting the DB row).

8. ℹ️ **LOW — Several UPDATE policies are missing explicit `WITH CHECK`.**  
   Affected tables: `profiles`, `events`, `children`, `development_scores`, `meeting_records`, `reading_books`, `reminders`, `user_integrations`. PostgreSQL defaults to the USING clause when WITH CHECK is absent, so the effective security is identical. Explicit WITH CHECK is a clearer statement of intent and prevents future confusion. This is a style gap, not a security gap.

---

## Fixes Applied

The following are addressed by `supabase/migrations/20260701000000_rls_fixes.sql`:

1. **`event-attachments` storage UPDATE policy added** — mirrors the USING+WITH CHECK pattern from `meeting-docs` and `reading-photos`.
2. **`user_integrations` GRANT ALL revoked and replaced with explicit grants** — `REVOKE ALL`, then `GRANT SELECT, INSERT, UPDATE, DELETE` (after the DELETE policy is added below).
3. **`user_integrations` DELETE policy added** — `USING (auth.uid() = user_id)`.
4. **`reminders.child_id` FK constraint added** — with a preceding `UPDATE … SET child_id = NULL` to clean up any dangling references before the constraint is enforced.

Issues 5–8 are data integrity / style gaps noted for awareness but not patched in this migration (they require more careful data migration or are safe as-is).

---

## Verification Queries

Run these in the Supabase SQL Editor for project `oldioruajgcebdbepzwf` after applying the fix migration:

```sql
-- 1. List all tables with RLS status (all should show rowsecurity = true)
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. List all RLS policies on public tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 3. Confirm user_integrations grants are now explicit (not ALL)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_integrations'
ORDER BY grantee, privilege_type;

-- 4. Confirm reminders FK constraint exists
SELECT conname, contype, confupdtype, confdeltype
FROM pg_constraint
WHERE conrelid = 'public.reminders'::regclass
  AND contype = 'f';

-- 5. Check for reminders with dangling child_id (should return 0 rows after fix)
SELECT COUNT(*) FROM public.reminders r
WHERE r.child_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = r.child_id);

-- 6. List all storage policies (confirm event-attachments now has UPDATE)
SELECT name, definition
FROM storage.policies
ORDER BY name;

-- 7. Confirm user_integrations has a DELETE policy
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_integrations'
ORDER BY cmd;
```
