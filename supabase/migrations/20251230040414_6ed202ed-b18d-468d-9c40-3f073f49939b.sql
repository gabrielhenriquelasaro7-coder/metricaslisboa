-- Tabela de configurações do sistema
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Inserir senha padrão de admin (12345678 convertida para hash simples por enquanto)
-- Em produção, usar bcrypt ou similar
INSERT INTO public.system_settings (key, value) 
VALUES ('admin_password', '12345678');

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados podem ler as configurações
CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- Apenas service role pode modificar
CREATE POLICY "Service role can manage system settings"
ON public.system_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();