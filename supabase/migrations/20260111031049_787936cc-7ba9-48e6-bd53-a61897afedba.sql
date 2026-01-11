-- Remove guest access to leads table - only project owners should see PII
DROP POLICY IF EXISTS "Guests can view leads for accessible projects" ON public.leads;