-- Add separate columns for leads and purchases in ads_daily_metrics
ALTER TABLE ads_daily_metrics 
ADD COLUMN IF NOT EXISTS leads_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchases_count integer DEFAULT 0;