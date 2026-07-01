-- Google Calendar columns added to user_integrations
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS calendar_connected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_last_synced_at TIMESTAMPTZ;
