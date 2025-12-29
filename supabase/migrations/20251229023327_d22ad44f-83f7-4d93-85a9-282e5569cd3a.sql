
-- Enable pg_net extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Delete existing scheduled-sync job if exists
DO $$
BEGIN
  PERFORM cron.unschedule('scheduled-sync-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule sync to run at 2AM Brasília (5AM UTC) every day
SELECT cron.schedule(
  'scheduled-sync-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url:='https://chxetrmrupvxqbuyjvph.supabase.co/functions/v1/scheduled-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeGV0cm1ydXB2eHFidXlqdnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzA4NjAsImV4cCI6MjA4MjQ0Njg2MH0.JnW_Y9XLff1W74p1MQyxa0ExoPquNDQTkxI9UyE9qNU"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
