-- Criar tabela de formulários de leadgen
CREATE TABLE public.leadgen_forms (
  id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  leads_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, project_id)
);

CREATE INDEX idx_leadgen_forms_project ON leadgen_forms(project_id);
CREATE INDEX idx_leadgen_forms_page ON leadgen_forms(page_id);

ALTER TABLE leadgen_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leadgen_forms for their projects" ON leadgen_forms
  FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view leadgen_forms for accessible projects" ON leadgen_forms
  FOR SELECT USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage leadgen_forms" ON leadgen_forms
  FOR ALL USING (true) WITH CHECK (true);

-- Criar tabela de leads reais
CREATE TABLE public.leads (
  id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  form_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  adset_id TEXT,
  campaign_id TEXT,
  created_time TIMESTAMPTZ NOT NULL,
  field_data JSONB,
  lead_name TEXT,
  lead_email TEXT,
  lead_phone TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, project_id)
);

CREATE INDEX idx_leads_project_id ON leads(project_id);
CREATE INDEX idx_leads_created_time ON leads(created_time);
CREATE INDEX idx_leads_form_id ON leads(form_id);
CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX idx_leads_ad_id ON leads(ad_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leads for their projects" ON leads
  FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view leads for accessible projects" ON leads
  FOR SELECT USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage leads" ON leads
  FOR ALL USING (true) WITH CHECK (true);

-- Adicionar facebook_page_id na tabela projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;