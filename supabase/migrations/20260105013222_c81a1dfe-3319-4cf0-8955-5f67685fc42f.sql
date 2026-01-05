-- Create storage bucket for creative images cache
INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-images', 'creative-images', true)
ON CONFLICT (id) DO NOTHING;

-- Add column to store cached image URL
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS cached_image_url TEXT;

-- Add column to ads_daily_metrics to store cached thumbnail
ALTER TABLE public.ads_daily_metrics ADD COLUMN IF NOT EXISTS cached_creative_thumbnail TEXT;

-- Create RLS policy for public read access to creative-images bucket
CREATE POLICY "Public read access for creative images"
ON storage.objects FOR SELECT
USING (bucket_id = 'creative-images');

-- Create RLS policy for authenticated users to upload creative images
CREATE POLICY "Authenticated users can upload creative images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creative-images');

-- Create RLS policy for authenticated users to update creative images
CREATE POLICY "Authenticated users can update creative images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'creative-images');

-- Create RLS policy for authenticated users to delete creative images
CREATE POLICY "Authenticated users can delete creative images"
ON storage.objects FOR DELETE
USING (bucket_id = 'creative-images');