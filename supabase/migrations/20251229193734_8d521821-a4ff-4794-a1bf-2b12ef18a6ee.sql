-- Add health_score column to projects table
ALTER TABLE public.projects 
ADD COLUMN health_score text DEFAULT NULL;

-- Add comment explaining the possible values
COMMENT ON COLUMN public.projects.health_score IS 'Manual health score: safe, care, danger, or NULL for auto-calculated';

-- Add sync_progress column to track import progress
ALTER TABLE public.projects 
ADD COLUMN sync_progress jsonb DEFAULT NULL;

COMMENT ON COLUMN public.projects.sync_progress IS 'Current sync/import progress: {status, progress, message, started_at}';