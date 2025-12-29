-- Create table for chart preferences (customization)
CREATE TABLE public.chart_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chart_key TEXT NOT NULL,
  custom_name TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  chart_type TEXT DEFAULT 'composed',
  primary_metric TEXT DEFAULT 'spend',
  secondary_metric TEXT DEFAULT 'conversions',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, chart_key)
);

-- Enable RLS
ALTER TABLE public.chart_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own chart preferences" 
ON public.chart_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chart preferences" 
ON public.chart_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chart preferences" 
ON public.chart_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chart preferences" 
ON public.chart_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create table for demographic insights
CREATE TABLE public.demographic_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  breakdown_type TEXT NOT NULL, -- 'age', 'gender', 'device_platform', 'publisher_platform'
  breakdown_value TEXT NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, date, breakdown_type, breakdown_value)
);

-- Enable RLS
ALTER TABLE public.demographic_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for demographic_insights
CREATE POLICY "Service role can manage demographic_insights" 
ON public.demographic_insights 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Users can view demographic_insights for their projects" 
ON public.demographic_insights 
FOR SELECT 
USING (project_id IN (SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_demographic_insights_project_date ON public.demographic_insights(project_id, date);
CREATE INDEX idx_demographic_insights_breakdown ON public.demographic_insights(project_id, breakdown_type);

-- Trigger for updated_at on chart_preferences
CREATE TRIGGER update_chart_preferences_updated_at
BEFORE UPDATE ON public.chart_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();