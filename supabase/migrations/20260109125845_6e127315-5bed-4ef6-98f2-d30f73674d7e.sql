-- Create table to track suggestion actions
CREATE TABLE public.suggestion_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  suggestion_title TEXT NOT NULL,
  suggestion_hash TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('applied', 'ignored')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suggestion_actions ENABLE ROW LEVEL SECURITY;

-- Users can view actions for projects they have access to
CREATE POLICY "Users can view suggestion actions for their projects"
ON public.suggestion_actions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = suggestion_actions.project_id 
    AND projects.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.guest_project_access
    WHERE guest_project_access.project_id = suggestion_actions.project_id
    AND guest_project_access.user_id = auth.uid()
  )
);

-- Users can insert actions for projects they own
CREATE POLICY "Users can insert suggestion actions for their projects"
ON public.suggestion_actions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = suggestion_actions.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete their own actions
CREATE POLICY "Users can delete their own suggestion actions"
ON public.suggestion_actions
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_suggestion_actions_project ON public.suggestion_actions(project_id);
CREATE INDEX idx_suggestion_actions_hash ON public.suggestion_actions(suggestion_hash);