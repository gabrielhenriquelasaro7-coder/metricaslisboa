-- Create function to trigger WhatsApp weekly reports using pg_net
CREATE OR REPLACE FUNCTION public.trigger_whatsapp_weekly_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Make HTTP request to edge function
  PERFORM net.http_post(
    url := 'https://chxetrmrupvxqbuyjvph.supabase.co/functions/v1/whatsapp-weekly-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeGV0cm1ydXB2eHFidXlqdnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg3MDg2MCwiZXhwIjoyMDgyNDQ2ODYwfQ.Rl71xZGtjl8VQEEqHwYV7B9M0MJNg1B8J-EE7bG5Oqg"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule cron job to run every minute to check for scheduled reports
SELECT cron.schedule(
  'whatsapp-weekly-reports',
  '* * * * *',
  $$SELECT public.trigger_whatsapp_weekly_reports()$$
);