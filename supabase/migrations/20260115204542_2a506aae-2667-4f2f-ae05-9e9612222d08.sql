-- Remove the trigger that references non-existent updated_at column
DROP TRIGGER IF EXISTS update_admin_access_grants_updated_at ON public.admin_access_grants;