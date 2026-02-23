-- Create storage bucket for Instagram media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('instagram-media', 'instagram-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Users can upload instagram media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'instagram-media' AND auth.uid() IS NOT NULL);

-- Allow public read
CREATE POLICY "Instagram media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'instagram-media');

-- Allow users to delete their uploads
CREATE POLICY "Users can delete own instagram media"
ON storage.objects FOR DELETE
USING (bucket_id = 'instagram-media' AND auth.uid() IS NOT NULL);
