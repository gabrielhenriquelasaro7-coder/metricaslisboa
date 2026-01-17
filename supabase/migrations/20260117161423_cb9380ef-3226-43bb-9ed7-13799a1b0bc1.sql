-- Adicionar campos separados para alerta de saldo (para investidor/gestor, não para o cliente)
ALTER TABLE public.whatsapp_report_configs 
ADD COLUMN IF NOT EXISTS balance_alert_phone_number TEXT,
ADD COLUMN IF NOT EXISTS balance_alert_instance_id UUID REFERENCES public.whatsapp_manager_instances(id),
ADD COLUMN IF NOT EXISTS balance_alert_use_separate_config BOOLEAN DEFAULT true;

-- Comentários explicativos
COMMENT ON COLUMN public.whatsapp_report_configs.balance_alert_phone_number IS 'Número do investidor/gestor para receber alertas de saldo (separado do grupo do cliente)';
COMMENT ON COLUMN public.whatsapp_report_configs.balance_alert_instance_id IS 'Instância WhatsApp para alertas de saldo (pode ser diferente da usada para relatórios)';
COMMENT ON COLUMN public.whatsapp_report_configs.balance_alert_use_separate_config IS 'Se true, usa configuração separada para alertas. Se false, usa a mesma do relatório';