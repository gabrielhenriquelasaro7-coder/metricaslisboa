-- Create investor_suggestions table for investidores to send suggestions to tech team
CREATE TABLE public.investor_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'implemented')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.investor_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own suggestions
CREATE POLICY "Users can view their own suggestions"
ON public.investor_suggestions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Tech/Gerente can view all suggestions
CREATE POLICY "Tech and Gerente can view all suggestions"
ON public.investor_suggestions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.cargo IN ('tech', 'gerente')
  )
);

-- Policy: Users can create their own suggestions
CREATE POLICY "Users can create their own suggestions"
ON public.investor_suggestions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Tech/Gerente can update any suggestion
CREATE POLICY "Tech and Gerente can update suggestions"
ON public.investor_suggestions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.cargo IN ('tech', 'gerente')
  )
);

-- Policy: Users can update their own pending suggestions
CREATE POLICY "Users can update their own pending suggestions"
ON public.investor_suggestions
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_investor_suggestions_updated_at
BEFORE UPDATE ON public.investor_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.investor_suggestions;