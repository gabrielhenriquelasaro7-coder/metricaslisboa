-- Create storage bucket for creative images (HD quality, cached permanently)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('creative-images', 'creative-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to creative images
CREATE POLICY "Creative images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'creative-images');

-- Allow service role to upload creative images
CREATE POLICY "Service role can upload creative images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'creative-images');

-- Allow service role to update creative images
CREATE POLICY "Service role can update creative images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'creative-images');