ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS excluded_dates DATE[] NOT NULL DEFAULT '{}'::date[];