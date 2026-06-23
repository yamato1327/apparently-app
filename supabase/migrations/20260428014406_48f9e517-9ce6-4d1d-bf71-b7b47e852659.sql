ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_milestone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS milestone_remind_days_before integer;