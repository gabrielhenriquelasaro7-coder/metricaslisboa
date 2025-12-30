-- Drop the projects_to_report column and add project_id instead
ALTER TABLE public.whatsapp_subscriptions 
DROP COLUMN IF EXISTS projects_to_report;

-- Add project_id column (one subscription per project per user)
ALTER TABLE public.whatsapp_subscriptions 
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add unique constraint (one subscription per user per project)
ALTER TABLE public.whatsapp_subscriptions 
ADD CONSTRAINT unique_user_project_subscription UNIQUE (user_id, project_id);

-- Update RLS policies to include project ownership check
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.whatsapp_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.whatsapp_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.whatsapp_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.whatsapp_subscriptions;

CREATE POLICY "Users can view own subscriptions" ON public.whatsapp_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.whatsapp_subscriptions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own subscriptions" ON public.whatsapp_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" ON public.whatsapp_subscriptions
  FOR DELETE USING (auth.uid() = user_id);