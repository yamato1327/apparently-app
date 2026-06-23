
-- Add phase tracking and pre-meeting notes to meeting_records
ALTER TABLE public.meeting_records
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'pre' CHECK (phase IN ('pre', 'meeting', 'post')),
  ADD COLUMN IF NOT EXISTS event_id UUID,
  ADD COLUMN IF NOT EXISTS pre_parent_notes TEXT,
  ADD COLUMN IF NOT EXISTS pre_child_notes TEXT,
  ADD COLUMN IF NOT EXISTS post_focus_1 TEXT,
  ADD COLUMN IF NOT EXISTS post_focus_2 TEXT,
  ADD COLUMN IF NOT EXISTS post_focus_3 TEXT,
  ADD COLUMN IF NOT EXISTS post_owner_1 TEXT,
  ADD COLUMN IF NOT EXISTS post_owner_2 TEXT,
  ADD COLUMN IF NOT EXISTS post_owner_3 TEXT;
