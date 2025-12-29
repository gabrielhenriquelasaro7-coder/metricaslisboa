
-- Create enum for user roles/cargos
CREATE TYPE public.user_cargo AS ENUM ('gestor_trafego', 'account_manager', 'coordenador', 'gerente');

-- Add cargo column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo public.user_cargo DEFAULT NULL;
