-- Add funnel cards configuration to crm_connections
ALTER TABLE public.crm_connections 
ADD COLUMN IF NOT EXISTS funnel_cards_config JSONB DEFAULT NULL;

-- The funnel_cards_config will store an array of configured funnel cards like:
-- [
--   { "id": "leads", "label": "Leads Recebidos", "stage_ids": [], "icon": "Users", "enabled": true },
--   { "id": "contacted", "label": "Leads Contatados", "stage_ids": ["stage_1"], "icon": "Phone", "enabled": true },
--   { "id": "meeting", "label": "Reunião Agendada", "stage_ids": ["stage_2"], "icon": "Calendar", "enabled": false },
--   { "id": "proposal", "label": "Proposta Enviada", "stage_ids": ["stage_3"], "icon": "FileText", "enabled": true },
--   { "id": "sales", "label": "Vendas", "stage_ids": [], "icon": "CheckCircle2", "enabled": true }
-- ]

COMMENT ON COLUMN public.crm_connections.funnel_cards_config IS 'Configuration for funnel cards - which stages map to which funnel steps and if enabled';