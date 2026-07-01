-- ===========================================================
-- RLS Audit Fixes — 2026-07-01
-- See docs/rls-audit.md for full audit findings.
-- Safe to re-run: all DDL uses DO/EXCEPTION or IF NOT EXISTS guards.
-- ===========================================================


-- -------------------------------------------------------
-- Fix 1: event-attachments storage bucket — add UPDATE policy
--
-- The meeting-docs and reading-photos buckets received UPDATE
-- policies in migration 20260506005108, but event-attachments
-- was not included. Without this, users cannot replace a file
-- at an existing path (e.g. re-uploading a corrected attachment).
-- -------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Users can update own event attachment files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'event-attachments'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'event-attachments'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- -------------------------------------------------------
-- Fix 2: user_integrations — replace GRANT ALL with explicit grants
--
-- GRANT ALL includes TRUNCATE, REFERENCES, and TRIGGER in addition
-- to SELECT/INSERT/UPDATE/DELETE. TRUNCATE bypasses RLS entirely.
-- We revoke everything first, then re-grant only what is needed.
-- Note: DELETE is granted after the DELETE policy is added below.
-- -------------------------------------------------------
REVOKE ALL ON public.user_integrations FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_integrations TO authenticated;


-- -------------------------------------------------------
-- Fix 3: user_integrations — add DELETE policy
--
-- Without a DELETE policy, users cannot remove their own integration
-- row. This is required for a "disconnect Google" feature. The RLS
-- policy scopes deletion to the owner's own row only.
-- -------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Users can delete their own integrations"
    ON public.user_integrations FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grant DELETE explicitly now that the RLS policy is in place.
GRANT DELETE ON public.user_integrations TO authenticated;


-- -------------------------------------------------------
-- Fix 4: reminders.child_id — add FK constraint
--
-- child_id is nullable but had no FOREIGN KEY to public.children.
-- Deleting a child would leave dangling child_id UUIDs in reminders.
--
-- Step 1: null out any existing dangling references (safe data cleanup).
-- Step 2: add the FK with ON DELETE SET NULL so future child deletions
--         automatically clear the reference.
-- -------------------------------------------------------
UPDATE public.reminders r
SET child_id = NULL
WHERE child_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.children c WHERE c.id = r.child_id
  );

DO $$ BEGIN
  ALTER TABLE public.reminders
    ADD CONSTRAINT reminders_child_id_fkey
    FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
