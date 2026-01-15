-- Adicionar campo para controlar primeiro acesso (troca de senha obrigatória)
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS password_changed boolean DEFAULT false;

-- Marcar usuários existentes que JÁ fizeram login antes como já tendo alterado senha
-- (assumindo que quem já está no sistema há mais de 1 dia já fez primeiro acesso)
UPDATE public.user_roles 
SET password_changed = true 
WHERE created_at < NOW() - INTERVAL '1 day';

-- Criar função para verificar se usuário precisa trocar senha
CREATE OR REPLACE FUNCTION public.needs_password_change(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NOT password_changed FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    false
  )
$$;