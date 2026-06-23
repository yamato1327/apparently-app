-- Reminders: lightweight one-off teacher notices (uniform, bring x, dress-up day...)
-- Distinct from events: no time, no recurrence, optional child link, auto-expiring.

CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id uuid NULL,
  title text NOT NULL,
  notice_date date NOT NULL,
  expires_after date NOT NULL,
  category text NOT NULL DEFAULT 'general',
  emoji text NULL,
  source text NOT NULL DEFAULT 'manual',
  is_dismissed boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_user_date_idx
  ON public.reminders (user_id, notice_date);

CREATE INDEX IF NOT EXISTS reminders_user_expires_idx
  ON public.reminders (user_id, expires_after);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
  ON public.reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
  ON public.reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON public.reminders FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
