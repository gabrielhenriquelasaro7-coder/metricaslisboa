-- Criar bucket para cache de imagens de criativos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('creative-cache', 'creative-cache', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Política para leitura pública das imagens
CREATE POLICY "Public read access for creative cache"
ON storage.objects FOR SELECT
USING (bucket_id = 'creative-cache');

-- Política para upload via service role (edge functions)
CREATE POLICY "Service role can upload to creative cache"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creative-cache');