-- Create table for DRE history (monthly snapshots)
CREATE TABLE public.dre_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Period identification
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Revenue data
  gross_revenue NUMERIC(15,2) DEFAULT 0,
  deductions NUMERIC(15,2) DEFAULT 0,
  net_revenue NUMERIC(15,2) DEFAULT 0,
  
  -- Cost data (from ads)
  ad_spend_meta NUMERIC(15,2) DEFAULT 0,
  ad_spend_google NUMERIC(15,2) DEFAULT 0,
  ad_spend_other NUMERIC(15,2) DEFAULT 0,
  total_ad_spend NUMERIC(15,2) DEFAULT 0,
  
  -- CRM data
  total_leads INTEGER DEFAULT 0,
  total_mql INTEGER DEFAULT 0,
  total_sql INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  
  -- Calculated metrics
  cpl NUMERIC(15,4) DEFAULT 0,
  cac NUMERIC(15,4) DEFAULT 0,
  average_ticket NUMERIC(15,2) DEFAULT 0,
  conversion_rate NUMERIC(8,4) DEFAULT 0,
  roas NUMERIC(8,4) DEFAULT 0,
  
  -- Financial margins
  contribution_margin NUMERIC(15,2) DEFAULT 0,
  operational_expenses NUMERIC(15,2) DEFAULT 0,
  ebitda NUMERIC(15,2) DEFAULT 0,
  
  -- Editable fields (user can override)
  notes TEXT,
  custom_deductions JSONB DEFAULT '[]',
  custom_expenses JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one record per project per month
  UNIQUE(project_id, year, month)
);

-- Enable RLS
ALTER TABLE public.dre_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own DRE history"
ON public.dre_history
FOR SELECT
USING (public.user_has_project_access(auth.uid(), project_id));

CREATE POLICY "Users can create DRE history for their projects"
ON public.dre_history
FOR INSERT
WITH CHECK (public.user_has_project_access(auth.uid(), project_id));

CREATE POLICY "Users can update their own DRE history"
ON public.dre_history
FOR UPDATE
USING (public.user_has_project_access(auth.uid(), project_id));

CREATE POLICY "Users can delete their own DRE history"
ON public.dre_history
FOR DELETE
USING (public.user_has_project_access(auth.uid(), project_id));

-- Index for fast lookups
CREATE INDEX idx_dre_history_project_period ON public.dre_history(project_id, year, month);

-- Trigger for updated_at
CREATE TRIGGER update_dre_history_updated_at
BEFORE UPDATE ON public.dre_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();