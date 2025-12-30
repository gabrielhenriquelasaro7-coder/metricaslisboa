import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WhatsAppSubscription {
  id: string;
  user_id: string;
  project_id: string | null;
  phone_number: string;
  weekly_report_enabled: boolean;
  report_day_of_week: number;
  report_time: string;
  last_report_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessageLog {
  id: string;
  subscription_id: string;
  message_type: string;
  content: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useWhatsAppSubscription(projectId?: string) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<WhatsAppSubscription | null>(null);
  const [messageLogs, setMessageLogs] = useState<WhatsAppMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user || !projectId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('whatsapp_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching WhatsApp subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user, projectId]);

  const fetchMessageLogs = useCallback(async () => {
    if (!subscription) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_messages_log')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setMessageLogs(data || []);
    } catch (error) {
      console.error('Error fetching message logs:', error);
    }
  }, [subscription]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    if (subscription) {
      fetchMessageLogs();
    }
  }, [subscription, fetchMessageLogs]);

  const saveSubscription = async (data: Partial<WhatsAppSubscription>) => {
    if (!user || !projectId) return;

    setSaving(true);
    try {
      if (subscription) {
        // Update existing
        const { error } = await supabase
          .from('whatsapp_subscriptions')
          .update({
            phone_number: data.phone_number,
            weekly_report_enabled: data.weekly_report_enabled,
            report_day_of_week: data.report_day_of_week,
            report_time: data.report_time,
          })
          .eq('id', subscription.id);

        if (error) throw error;
        toast.success('Configurações salvas com sucesso!');
      } else {
        // Create new
        const { data: newSub, error } = await supabase
          .from('whatsapp_subscriptions')
          .insert({
            user_id: user.id,
            project_id: projectId,
            phone_number: data.phone_number || '',
            weekly_report_enabled: data.weekly_report_enabled ?? true,
            report_day_of_week: data.report_day_of_week ?? 1,
            report_time: data.report_time ?? '08:00',
          })
          .select()
          .single();

        if (error) throw error;
        setSubscription(newSub);
        toast.success('Configurações salvas com sucesso!');
      }

      await fetchSubscription();
    } catch (error: any) {
      console.error('Error saving subscription:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const deleteSubscription = async () => {
    if (!subscription) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_subscriptions')
        .delete()
        .eq('id', subscription.id);

      if (error) throw error;
      
      setSubscription(null);
      setMessageLogs([]);
      toast.success('Configurações removidas');
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast.error('Erro ao remover configurações');
    } finally {
      setSaving(false);
    }
  };

  const sendTestReport = async () => {
    if (!subscription) {
      toast.error('Configure seu número primeiro');
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-weekly-report', {
        body: { subscriptionId: subscription.id },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Relatório de teste enviado!');
        await fetchMessageLogs();
      } else {
        toast.error('Erro ao enviar relatório de teste');
      }
    } catch (error: any) {
      console.error('Error sending test report:', error);
      toast.error(error.message || 'Erro ao enviar relatório de teste');
    } finally {
      setSendingTest(false);
    }
  };

  return {
    subscription,
    messageLogs,
    loading,
    saving,
    sendingTest,
    saveSubscription,
    deleteSubscription,
    sendTestReport,
    refetch: fetchSubscription,
  };
}
