-- Add project_id to admin_access_requests (optional - some requests may be global)
ALTER TABLE public.admin_access_requests 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_project_id ON public.admin_access_requests(project_id);