-- Create storage bucket for project logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-logos', 'project-logos', true);

-- Allow authenticated users to upload project logos
CREATE POLICY "Users can upload project logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'project-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access to project logos
CREATE POLICY "Project logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'project-logos');

-- Allow users to update/delete their own project logos
CREATE POLICY "Users can update project logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'project-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete project logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'project-logos' AND auth.role() = 'authenticated');