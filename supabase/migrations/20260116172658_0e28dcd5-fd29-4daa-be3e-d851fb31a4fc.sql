-- Table to store user hidden metrics preferences
CREATE TABLE public.user_hidden_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hidden_metrics TEXT[] NOT NULL DEFAULT '{}',
  page_context TEXT NOT NULL DEFAULT 'all', -- 'all', 'dashboard', 'campaigns', 'adsets', 'ads'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_context)
);

-- Enable RLS
ALTER TABLE public.user_hidden_metrics ENABLE ROW LEVEL SECURITY;

-- Users can view their own hidden metrics
CREATE POLICY "Users can view their own hidden metrics"
ON public.user_hidden_metrics
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own hidden metrics
CREATE POLICY "Users can insert their own hidden metrics"
ON public.user_hidden_metrics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own hidden metrics
CREATE POLICY "Users can update their own hidden metrics"
ON public.user_hidden_metrics
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own hidden metrics
CREATE POLICY "Users can delete their own hidden metrics"
ON public.user_hidden_metrics
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_hidden_metrics_updated_at
BEFORE UPDATE ON public.user_hidden_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();