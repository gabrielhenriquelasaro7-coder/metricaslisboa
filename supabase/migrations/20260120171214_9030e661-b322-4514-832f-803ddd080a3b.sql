
-- Create service role policy for demographic_insights if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'demographic_insights' 
    AND policyname = 'Service role can manage demographic_insights'
  ) THEN
    CREATE POLICY "Service role can manage demographic_insights"
    ON public.demographic_insights
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END$$;
