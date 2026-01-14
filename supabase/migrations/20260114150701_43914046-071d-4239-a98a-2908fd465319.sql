-- Create table for tab visibility per user
CREATE TABLE public.user_tab_visibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hidden_tabs TEXT[] NOT NULL DEFAULT '{}',
  hidden_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create table for user management (to store additional user info)
CREATE TABLE public.user_management (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  cargo TEXT NOT NULL DEFAULT 'membro',
  squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add STRIKE FORCE squad if not exists
INSERT INTO public.squads (name, description, color)
SELECT 'STRIKE FORCE', 'Squad Strike Force', '#9b59b6'
WHERE NOT EXISTS (SELECT 1 FROM public.squads WHERE name = 'STRIKE FORCE');

-- Add S/SQUAD for users without squad
INSERT INTO public.squads (name, description, color)
SELECT 'S/SQUAD', 'Sem Squad', '#95a5a6'
WHERE NOT EXISTS (SELECT 1 FROM public.squads WHERE name = 'S/SQUAD');

-- Add TECH squad
INSERT INTO public.squads (name, description, color)
SELECT 'TECH', 'Squad Tecnologia', '#3498db'
WHERE NOT EXISTS (SELECT 1 FROM public.squads WHERE name = 'TECH');

-- Add GERENTE squad
INSERT INTO public.squads (name, description, color)
SELECT 'GERENTE', 'Gerentes', '#e74c3c'
WHERE NOT EXISTS (SELECT 1 FROM public.squads WHERE name = 'GERENTE');

-- Enable RLS
ALTER TABLE public.user_tab_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_management ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_tab_visibility
-- Tech can manage all tab visibility
CREATE POLICY "Tech can manage all tab visibility"
ON public.user_tab_visibility
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.cargo = 'tech'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.cargo = 'tech'
  )
);

-- Users can view their own tab visibility
CREATE POLICY "Users can view own tab visibility"
ON public.user_tab_visibility
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS policies for user_management
-- Tech and Gerente can manage users
CREATE POLICY "Tech and Gerente can manage users"
ON public.user_management
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.cargo IN ('tech', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.cargo IN ('tech', 'gerente')
  )
);

-- Coordenadores can view all users in their squad
CREATE POLICY "Coordenadores can view squad users"
ON public.user_management
FOR SELECT
TO authenticated
USING (
  -- User is a coordenador
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.cargo = 'coordenador'
  )
  AND
  -- And the user being viewed is in the same squad
  (
    squad_id IN (
      SELECT sm.squad_id FROM public.squad_members sm
      WHERE sm.user_id = auth.uid()
    )
  )
);

-- Users can view their own record
CREATE POLICY "Users can view own management record"
ON public.user_management
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_user_management()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for user_tab_visibility
CREATE TRIGGER update_user_tab_visibility_updated_at
BEFORE UPDATE ON public.user_tab_visibility
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_user_management();

-- Create trigger for user_management
CREATE TRIGGER update_user_management_updated_at
BEFORE UPDATE ON public.user_management
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_user_management();