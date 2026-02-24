-- Drop the FK constraint that requires instance_id to reference whatsapp_manager_instances
-- The code already handles lookups from both whatsapp_instances and whatsapp_manager_instances tables
ALTER TABLE public.whatsapp_report_configs 
DROP CONSTRAINT IF EXISTS whatsapp_report_configs_instance_id_fkey;

-- Also drop the balance_alert_instance_id FK if it has the same issue
ALTER TABLE public.whatsapp_report_configs 
DROP CONSTRAINT IF EXISTS whatsapp_report_configs_balance_alert_instance_id_fkey;