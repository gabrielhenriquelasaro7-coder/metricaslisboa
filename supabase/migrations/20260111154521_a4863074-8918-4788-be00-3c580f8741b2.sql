-- ============================================
-- CRM Integration Tables for Financial Module
-- ============================================

-- Enum for supported CRM providers
CREATE TYPE public.crm_provider AS ENUM (
  'kommo',
  'hubspot',
  'gohighlevel',
  'bitrix24',
  'rdstation',
  'outros'
);

-- Enum for connection status
CREATE TYPE public.crm_connection_status AS ENUM (
  'pending',
  'connected',
  'error',
  'expired',
  'disconnected'
);

-- Enum for sync status
CREATE TYPE public.crm_sync_status AS ENUM (
  'idle',
  'syncing',
  'completed',
  'failed'
);

-- Enum for deal status
CREATE TYPE public.crm_deal_status AS ENUM (
  'open',
  'won',
  'lost'
);

-- ============================================
-- CRM Connections Table
-- Stores OAuth tokens and API keys securely
-- ============================================
CREATE TABLE public.crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider crm_provider NOT NULL,
  
  -- Connection details
  status crm_connection_status DEFAULT 'pending',
  display_name TEXT,
  
  -- OAuth tokens (encrypted via application layer)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- API Key (for non-OAuth CRMs)
  api_key TEXT,
  api_url TEXT,
  
  -- Additional config
  config JSONB DEFAULT '{}',
  
  -- Metadata
  connected_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- One connection per project/provider
  UNIQUE(project_id, provider)
);

-- Enable RLS
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own CRM connections"
ON public.crm_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CRM connections"
ON public.crm_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CRM connections"
ON public.crm_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CRM connections"
ON public.crm_connections FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- CRM Pipelines Table
-- Stores pipeline/funnel information from CRM
-- ============================================
CREATE TABLE public.crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.crm_connections(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- External IDs
  external_id TEXT NOT NULL,
  external_name TEXT NOT NULL,
  
  -- Pipeline info
  is_default BOOLEAN DEFAULT false,
  stages JSONB DEFAULT '[]', -- Array of stage objects
  
  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(connection_id, external_id)
);

-- Enable RLS
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

-- RLS Policies (via connection ownership)
CREATE POLICY "Users can view pipelines via connection"
ON public.crm_pipelines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_connections
    WHERE id = crm_pipelines.connection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage pipelines via connection"
ON public.crm_pipelines FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.crm_connections
    WHERE id = crm_pipelines.connection_id
    AND user_id = auth.uid()
  )
);

-- ============================================
-- CRM Deals Table
-- Stores deal/opportunity data from CRM
-- ============================================
CREATE TABLE public.crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.crm_connections(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  
  -- External IDs
  external_id TEXT NOT NULL,
  external_pipeline_id TEXT,
  external_stage_id TEXT,
  
  -- Deal info
  title TEXT NOT NULL,
  value DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  status crm_deal_status DEFAULT 'open',
  stage_name TEXT,
  
  -- Dates
  created_date TIMESTAMPTZ,
  closed_date TIMESTAMPTZ,
  expected_close_date TIMESTAMPTZ,
  
  -- Attribution
  owner_name TEXT,
  owner_email TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Lead source tracking
  lead_source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  
  -- Additional data
  custom_fields JSONB DEFAULT '{}',
  
  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(connection_id, external_id)
);

-- Enable RLS
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

-- RLS Policies (via connection ownership)
CREATE POLICY "Users can view deals via connection"
ON public.crm_deals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_connections
    WHERE id = crm_deals.connection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage deals via connection"
ON public.crm_deals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.crm_connections
    WHERE id = crm_deals.connection_id
    AND user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_crm_deals_project_id ON public.crm_deals(project_id);
CREATE INDEX idx_crm_deals_status ON public.crm_deals(status);
CREATE INDEX idx_crm_deals_created_date ON public.crm_deals(created_date);
CREATE INDEX idx_crm_deals_closed_date ON public.crm_deals(closed_date);

-- ============================================
-- CRM Sync Logs Table
-- Tracks synchronization history
-- ============================================
CREATE TABLE public.crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.crm_connections(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Sync info
  sync_type TEXT NOT NULL, -- 'full', 'incremental'
  status crm_sync_status DEFAULT 'syncing',
  
  -- Progress
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Results
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sync logs via connection"
ON public.crm_sync_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_connections
    WHERE id = crm_sync_logs.connection_id
    AND user_id = auth.uid()
  )
);

CREATE INDEX idx_crm_sync_logs_connection_id ON public.crm_sync_logs(connection_id);
CREATE INDEX idx_crm_sync_logs_created_at ON public.crm_sync_logs(created_at DESC);

-- ============================================
-- Updated At Triggers
-- ============================================
CREATE TRIGGER update_crm_connections_updated_at
BEFORE UPDATE ON public.crm_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_deals_updated_at
BEFORE UPDATE ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();