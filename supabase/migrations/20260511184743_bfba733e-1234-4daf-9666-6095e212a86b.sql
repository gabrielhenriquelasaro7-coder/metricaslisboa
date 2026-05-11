
-- ============================================================
-- 1) STORAGE: tighten SELECT policies (anti-enumeration)
-- Public CDN reads bypass RLS for public buckets, so we keep
-- file URLs working while restricting SDK list/select to
-- authenticated users that can view the project (prefix).
-- ============================================================

-- creative-images
DROP POLICY IF EXISTS "Creative images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for creative images" ON storage.objects;
CREATE POLICY "creative-images: project members can list"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'creative-images'
  AND public.can_view_project(
    auth.uid(),
    NULLIF((storage.foldername(name))[1], '')::uuid
  )
);

-- creative-cache
DROP POLICY IF EXISTS "Public read access for creative cache" ON storage.objects;
CREATE POLICY "creative-cache: project members can list"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'creative-cache'
  AND public.can_view_project(
    auth.uid(),
    NULLIF((storage.foldername(name))[1], '')::uuid
  )
);

-- project-avatars
DROP POLICY IF EXISTS "Project avatars are publicly accessible" ON storage.objects;
CREATE POLICY "project-avatars: project members can list"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-avatars'
  AND public.can_view_project(
    auth.uid(),
    NULLIF((storage.foldername(name))[1], '')::uuid
  )
);

-- project-logos
DROP POLICY IF EXISTS "Project logos are publicly accessible" ON storage.objects;
CREATE POLICY "project-logos: project members can list"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-logos'
  AND public.can_view_project(
    auth.uid(),
    NULLIF((storage.foldername(name))[1], '')::uuid
  )
);

-- instagram-media
DROP POLICY IF EXISTS "Instagram media is publicly accessible" ON storage.objects;
CREATE POLICY "instagram-media: project members can list"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'instagram-media'
  AND public.can_view_project(
    auth.uid(),
    NULLIF((storage.foldername(name))[1], '')::uuid
  )
);

-- ============================================================
-- 2) CRM CONNECTIONS: add encrypted columns + auto-clear plaintext
-- ============================================================
ALTER TABLE public.crm_connections
  ADD COLUMN IF NOT EXISTS access_token_enc  text,
  ADD COLUMN IF NOT EXISTS refresh_token_enc text,
  ADD COLUMN IF NOT EXISTS api_key_enc       text;

COMMENT ON COLUMN public.crm_connections.access_token_enc  IS 'AES-GCM ciphertext (base64) produced by edge functions using CRM_ENCRYPTION_KEY';
COMMENT ON COLUMN public.crm_connections.refresh_token_enc IS 'AES-GCM ciphertext (base64) produced by edge functions using CRM_ENCRYPTION_KEY';
COMMENT ON COLUMN public.crm_connections.api_key_enc       IS 'AES-GCM ciphertext (base64) produced by edge functions using CRM_ENCRYPTION_KEY';

CREATE OR REPLACE FUNCTION public._crm_clear_plaintext_on_enc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_token_enc IS NOT NULL
     AND NEW.access_token_enc IS DISTINCT FROM OLD.access_token_enc THEN
    NEW.access_token := NULL;
  END IF;
  IF NEW.refresh_token_enc IS NOT NULL
     AND NEW.refresh_token_enc IS DISTINCT FROM OLD.refresh_token_enc THEN
    NEW.refresh_token := NULL;
  END IF;
  IF NEW.api_key_enc IS NOT NULL
     AND NEW.api_key_enc IS DISTINCT FROM OLD.api_key_enc THEN
    NEW.api_key := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._crm_clear_plaintext_on_enc() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_clear_plaintext_on_enc ON public.crm_connections;
CREATE TRIGGER crm_clear_plaintext_on_enc
BEFORE UPDATE ON public.crm_connections
FOR EACH ROW
EXECUTE FUNCTION public._crm_clear_plaintext_on_enc();
