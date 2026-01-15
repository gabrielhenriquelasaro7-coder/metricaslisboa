-- Allow users to read their own entry in user_management table (to check needs_password_change)
CREATE POLICY "Users can read own user_management entry"
ON public.user_management
FOR SELECT
USING (user_id = auth.uid());