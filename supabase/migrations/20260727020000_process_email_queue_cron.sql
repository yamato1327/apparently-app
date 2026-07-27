-- Schedules a pg_cron job that calls process-email-queue every minute.
--
-- IMPORTANT: This migration is for tracking purposes only. The vault secret
-- and cron job already exist live on oldioruajgcebdbepzwf as of 2026-07-27
-- and DO NOT need to be re-run there. If ever recreating from scratch:
--   1. The vault secret must be created first (NOT done in this file — never
--      commit secret values to git, even as placeholders). Create it manually
--      via the SQL Editor:
--        SELECT vault.create_secret(
--          '<service_role_key>',
--          'email_queue_service_role_key'
--        );
--      The service role key is available in Supabase Dashboard →
--      Project Settings → API → Project API keys → service_role.
--   2. Then run the cron.schedule() call below.
--
-- NOTE: vault.create_secret is not idempotent — re-running when the secret
-- already exists will create a duplicate. Check
--   SELECT * FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';
-- before running step 1 if you're unsure whether it already exists.

SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://oldioruajgcebdbepzwf.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
      ),
      body := '{}'::jsonb
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.email_send_state WHERE retry_after_until > now()
  );
  $$
);
