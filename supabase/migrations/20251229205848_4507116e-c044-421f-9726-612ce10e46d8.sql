
-- Add avatar_url column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create storage bucket for project avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-avatars', 'project-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their project avatars
CREATE POLICY "Users can upload project avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-avatars' 
  AND auth.role() = 'authenticated'
);

-- Allow public access to view avatars
CREATE POLICY "Project avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-avatars');

-- Allow users to update their own project avatars
CREATE POLICY "Users can update project avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-avatars' AND auth.role() = 'authenticated');

-- Allow users to delete their own project avatars
CREATE POLICY "Users can delete project avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-avatars' AND auth.role() = 'authenticated');
