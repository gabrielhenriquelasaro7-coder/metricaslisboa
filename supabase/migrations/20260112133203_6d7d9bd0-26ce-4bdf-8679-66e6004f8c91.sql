-- Add MQL/SQL stage mapping configuration to crm_connections
ALTER TABLE public.crm_connections 
ADD COLUMN IF NOT EXISTS mql_stage_ids text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sql_stage_ids text[] DEFAULT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN public.crm_connections.mql_stage_ids IS 'Array of stage IDs that should be considered as MQL (Marketing Qualified Lead)';
COMMENT ON COLUMN public.crm_connections.sql_stage_ids IS 'Array of stage IDs that should be considered as SQL (Sales Qualified Lead)';