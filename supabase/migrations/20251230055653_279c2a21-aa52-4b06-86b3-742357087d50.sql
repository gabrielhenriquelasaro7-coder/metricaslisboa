-- Criar tabela de subscriptions para WhatsApp
CREATE TABLE public.whatsapp_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  weekly_report_enabled BOOLEAN DEFAULT TRUE,
  report_day_of_week INTEGER DEFAULT 1, -- 0=Domingo, 1=Segunda, 2=Terça...
  report_time TIME DEFAULT '08:00',
  projects_to_report UUID[] DEFAULT '{}',
  last_report_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar por user_id
CREATE INDEX idx_whatsapp_subscriptions_user_id ON public.whatsapp_subscriptions(user_id);

-- Índice para buscar subscriptions ativas para envio
CREATE INDEX idx_whatsapp_subscriptions_active ON public.whatsapp_subscriptions(weekly_report_enabled, report_day_of_week);

-- Enable RLS
ALTER TABLE public.whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem gerenciar suas próprias subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.whatsapp_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.whatsapp_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.whatsapp_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.whatsapp_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_subscriptions_updated_at
  BEFORE UPDATE ON public.whatsapp_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para log de mensagens enviadas
CREATE TABLE public.whatsapp_messages_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.whatsapp_subscriptions(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL, -- 'weekly_report', 'test'
  content TEXT,
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar por subscription
CREATE INDEX idx_whatsapp_messages_log_subscription ON public.whatsapp_messages_log(subscription_id);

-- Enable RLS
ALTER TABLE public.whatsapp_messages_log ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem ver logs das suas subscriptions
CREATE POLICY "Users can view own message logs"
  ON public.whatsapp_messages_log
  FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM public.whatsapp_subscriptions WHERE user_id = auth.uid()
    )
  );

-- Service role pode inserir logs
CREATE POLICY "Service role can insert logs"
  ON public.whatsapp_messages_log
  FOR INSERT
  WITH CHECK (true);