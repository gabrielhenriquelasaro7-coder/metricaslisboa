-- Allow users to update their own needs_password_change field
CREATE POLICY "Users can update own password_change status"
ON public.user_management
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());