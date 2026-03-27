-- Allow authenticated users to insert into project_import_months for their own projects
CREATE POLICY "Users can insert import months for their projects"
ON public.project_import_months
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_import_months.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow authenticated users to update import months for their own projects
CREATE POLICY "Users can update import months for their projects"
ON public.project_import_months
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_import_months.project_id
    AND projects.user_id = auth.uid()
  )
);