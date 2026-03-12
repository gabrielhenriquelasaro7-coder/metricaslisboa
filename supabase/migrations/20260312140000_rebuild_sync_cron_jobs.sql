-- ============================================================
-- RECRIAÇÃO ROBUSTA DOS CRON JOBS DE SINCRONIZAÇÃO
-- Usa service_role token (mais seguro) em vez do anon token anterior
-- Garante que a sync roda todos os dias com credenciais corretas
-- ============================================================

-- 1. Remove cron jobs antigos para evitar duplicação
DO $$
BEGIN
  PERFORM cron.unschedule('scheduled-sync-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('detect-fix-gaps-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('scheduled-sync-extended');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Cron principal: Sync diário dos últimos 7 dias
-- Roda às 6h UTC (3h Brasília) = evita rate limit do Meta no pico do dia
SELECT cron.schedule(
  'scheduled-sync-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://chxetrmrupvxqbuyjvph.supabase.co/functions/v1/scheduled-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeGV0cm1ydXB2eHFidXlqdnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg3MDg2MCwiZXhwIjoyMDgyNDQ2ODYwfQ.Rl71xZGtjl8VQEEqHwYV7B9M0MJNg1B8J-EE7bG5Oqg"}'::jsonb,
    body:='{"group": "daily_cron", "skip_cache": false, "light_sync": true}'::jsonb
  ) AS request_id;
  $$
);

-- 3. Cron de recuperação de gaps: Detecta e corrige dias faltando
-- Roda às 9h UTC (6h Brasília) = depois do sync principal
SELECT cron.schedule(
  'detect-fix-gaps-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://chxetrmrupvxqbuyjvph.supabase.co/functions/v1/detect-and-fix-gaps',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeGV0cm1ydXB2eHFidXlqdnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg3MDg2MCwiZXhwIjoyMDgyNDQ2ODYwfQ.Rl71xZGtjl8VQEEqHwYV7B9M0MJNg1B8J-EE7bG5Oqg"}'::jsonb,
    body:='{"auto_fix": true}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Cron semanal: Toda segunda-feira sincroniza períodos mais longos (30/60/90 dias)
-- Roda às 7h UTC toda segunda-feira (4h Brasília)
SELECT cron.schedule(
  'scheduled-sync-extended',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url:='https://chxetrmrupvxqbuyjvph.supabase.co/functions/v1/scheduled-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeGV0cm1ydXB2eHFidXlqdnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg3MDg2MCwiZXhwIjoyMDgyNDQ2ODYwfQ.Rl71xZGtjl8VQEEqHwYV7B9M0MJNg1B8J-EE7bG5Oqg"}'::jsonb,
    body:='{"group": "extended", "skip_cache": false, "light_sync": true}'::jsonb
  ) AS request_id;
  $$
);
