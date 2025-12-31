-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'convidado');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'gestor',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and gestors can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage roles"
ON public.user_roles FOR ALL
USING (true)
WITH CHECK (true);

-- Create guest_invitations table
CREATE TABLE public.guest_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  guest_email TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  temp_password TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  password_changed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- Enable RLS
ALTER TABLE public.guest_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_invitations
CREATE POLICY "Users can view invitations they created"
ON public.guest_invitations FOR SELECT
USING (auth.uid() = invited_by);

CREATE POLICY "Users can create invitations"
ON public.guest_invitations FOR INSERT
WITH CHECK (auth.uid() = invited_by AND public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their invitations"
ON public.guest_invitations FOR UPDATE
USING (auth.uid() = invited_by);

CREATE POLICY "Users can delete their invitations"
ON public.guest_invitations FOR DELETE
USING (auth.uid() = invited_by);

CREATE POLICY "Guests can view their own invitation"
ON public.guest_invitations FOR SELECT
USING (auth.uid() = guest_user_id);

CREATE POLICY "Guests can update password_changed"
ON public.guest_invitations FOR UPDATE
USING (auth.uid() = guest_user_id);

-- Create guest_project_access table
CREATE TABLE public.guest_project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  granted_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.guest_project_access ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_project_access
CREATE POLICY "Users can view access they granted"
ON public.guest_project_access FOR SELECT
USING (auth.uid() = granted_by);

CREATE POLICY "Guests can view their own access"
ON public.guest_project_access FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Gestors can manage access"
ON public.guest_project_access FOR ALL
USING (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin'));

-- Function to assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'gestor');
  RETURN NEW;
END;
$$;

-- Trigger to assign role on new user
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();