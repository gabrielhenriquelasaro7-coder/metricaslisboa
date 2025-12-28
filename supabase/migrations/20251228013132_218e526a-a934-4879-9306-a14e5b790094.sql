-- Add archived column to projects table
ALTER TABLE public.projects 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add archived_at timestamp
ALTER TABLE public.projects 
ADD COLUMN archived_at timestamp with time zone DEFAULT NULL;