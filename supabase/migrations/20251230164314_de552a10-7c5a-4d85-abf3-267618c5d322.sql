-- Create whatsapp_instances table
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Nova Conexão',
  instance_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (instance_status IN ('disconnected', 'connecting', 'connected')),
  phone_connected TEXT,
  qr_code TEXT,
  qr_code_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_instances
CREATE POLICY "Users can view own instances"
  ON public.whatsapp_instances
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instances"
  ON public.whatsapp_instances
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own instances"
  ON public.whatsapp_instances
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instances"
  ON public.whatsapp_instances
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add columns to whatsapp_subscriptions
ALTER TABLE public.whatsapp_subscriptions
  ADD COLUMN instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN target_type TEXT NOT NULL DEFAULT 'phone' CHECK (target_type IN ('phone', 'group')),
  ADD COLUMN group_id TEXT,
  ADD COLUMN group_name TEXT;

-- Create index for faster queries
CREATE INDEX idx_whatsapp_instances_project ON public.whatsapp_instances(project_id);
CREATE INDEX idx_whatsapp_instances_user ON public.whatsapp_instances(user_id);
CREATE INDEX idx_whatsapp_subscriptions_instance ON public.whatsapp_subscriptions(instance_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();