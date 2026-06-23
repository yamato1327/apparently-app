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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND policyname = 'Users can view their own reminders'
  ) THEN
    CREATE POLICY "Users can view their own reminders"
      ON public.reminders FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND policyname = 'Users can create their own reminders'
  ) THEN
    CREATE POLICY "Users can create their own reminders"
      ON public.reminders FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND policyname = 'Users can update their own reminders'
  ) THEN
    CREATE POLICY "Users can update their own reminders"
      ON public.reminders FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND policyname = 'Users can delete their own reminders'
  ) THEN
    CREATE POLICY "Users can delete their own reminders"
      ON public.reminders FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'reminders_updated_at'
  ) THEN
    CREATE TRIGGER reminders_updated_at
      BEFORE UPDATE ON public.reminders
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;