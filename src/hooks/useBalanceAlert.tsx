import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface BalanceAlertConfig {
  projectId: string;
  projectName: string;
  enabled: boolean;
  threshold: number; // days
}

interface BalanceData {
  balance: number;
  avgDailySpend: number;
  daysRemaining: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

export function useBalanceAlert(projectId: string | null, projectName?: string) {
  const { user } = useAuth();
  const hasShownAlert = useRef<string | null>(null);

  // Check if alert was already shown today using localStorage (persists across page reloads)
  const getAlertKey = useCallback((pid: string) => {
    return `balance_alert_${pid}_${new Date().toDateString()}`;
  }, []);

  const wasAlertShownToday = useCallback((pid: string) => {
    const key = getAlertKey(pid);
    return localStorage.getItem(key) === 'true';
  }, [getAlertKey]);

  const markAlertAsShown = useCallback((pid: string) => {
    const key = getAlertKey(pid);
    localStorage.setItem(key, 'true');
    hasShownAlert.current = key;
  }, [getAlertKey]);

  const calculateBalanceStatus = useCallback(async (): Promise<BalanceData | null> => {
    if (!projectId) return null;

    try {
      // Get project balance
      const { data: project } = await supabase
        .from('projects')
        .select('account_balance, account_balance_updated_at')
        .eq('id', projectId)
        .single();

      if (!project?.account_balance) return null;

      // Get last 7 days spend to calculate average
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const { data: metricsData } = await supabase
        .from('ads_daily_metrics')
        .select('spend, date')
        .eq('project_id', projectId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (!metricsData || metricsData.length === 0) return null;

      // Calculate average daily spend
      const totalSpend = metricsData.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
      const uniqueDays = new Set(metricsData.map(row => row.date)).size;
      const avgDailySpend = uniqueDays > 0 ? totalSpend / uniqueDays : 0;

      // If balance is extremely low (less than R$ 1.00), it's critical regardless of spend
      const CRITICAL_BALANCE_THRESHOLD = 1.00; // R$ 1.00
      
      if (project.account_balance < CRITICAL_BALANCE_THRESHOLD) {
        return {
          balance: project.account_balance,
          avgDailySpend: avgDailySpend || 0,
          daysRemaining: 0,
          status: 'critical' as const,
        };
      }

      if (avgDailySpend === 0) return null;

      const daysRemaining = Math.floor(project.account_balance / avgDailySpend);

      let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
      if (daysRemaining <= 3) {
        status = 'critical';
      } else if (daysRemaining <= 7) {
        status = 'warning';
      }

      return {
        balance: project.account_balance,
        avgDailySpend,
        daysRemaining,
        status,
      };
    } catch (error) {
      console.error('Error calculating balance status:', error);
      return null;
    }
  }, [projectId]);

  const checkAndShowAlert = useCallback(async () => {
    if (!projectId || !user?.id) return;

    // Check if alert was already shown today (localStorage persists across page reloads/navigation)
    if (wasAlertShownToday(projectId)) {
      console.log('[BalanceAlert] Already shown today for project', projectId);
      return;
    }

    // Also check the ref for same-session duplicates
    const alertKey = getAlertKey(projectId);
    if (hasShownAlert.current === alertKey) return;

    try {
      // Check if user has balance alert enabled
      const { data: subscription } = await supabase
        .from('whatsapp_subscriptions')
        .select('balance_alert_enabled, balance_alert_threshold')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      // Get balance data
      const balanceData = await calculateBalanceStatus();
      if (!balanceData) return;

      // Get threshold from subscription or use default (3 days)
      const threshold = subscription?.balance_alert_threshold || 3;

      const formatCurrency = (value: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

      // Critical alert: balance below R$ 1.00 OR days remaining below threshold
      const isCriticalBalance = balanceData.balance < 1.00;
      const isCriticalDays = balanceData.daysRemaining <= threshold;
      
      if (isCriticalBalance || isCriticalDays) {
        // Mark as shown in localStorage and ref to prevent duplicates
        markAlertAsShown(projectId);
        
        const description = isCriticalBalance 
          ? `Saldo praticamente zerado: ${formatCurrency(balanceData.balance)}. Adicione créditos AGORA!`
          : `Apenas ${balanceData.daysRemaining} ${balanceData.daysRemaining === 1 ? 'dia' : 'dias'} de saldo restante (${formatCurrency(balanceData.balance)}). Gasto médio: ${formatCurrency(balanceData.avgDailySpend)}/dia`;

        toast.error(
          `🚨 Saldo Crítico${projectName ? ` - ${projectName}` : ''}`,
          {
            description,
            duration: 15000,
            action: {
              label: 'Ver detalhes',
              onClick: () => window.location.href = '/predictive-analysis',
            },
          }
        );
      } else if (balanceData.daysRemaining <= 7) {
        // Mark as shown in localStorage and ref to prevent duplicates
        markAlertAsShown(projectId);

        toast.warning(
          `⚠️ Saldo Baixo${projectName ? ` - ${projectName}` : ''}`,
          {
            description: `${balanceData.daysRemaining} dias de saldo restante (${formatCurrency(balanceData.balance)})`,
            duration: 8000,
            action: {
              label: 'Ver detalhes',
              onClick: () => window.location.href = '/predictive-analysis',
            },
          }
        );
      }
    } catch (error) {
      console.error('Error checking balance alert:', error);
    }
  }, [projectId, user?.id, projectName, calculateBalanceStatus, wasAlertShownToday, getAlertKey, markAlertAsShown]);

  useEffect(() => {
    // Check balance after a short delay to avoid blocking initial render
    const timer = setTimeout(() => {
      checkAndShowAlert();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkAndShowAlert]);

  return { checkAndShowAlert, calculateBalanceStatus };
}

// Generate the WhatsApp message for balance alert
export function generateBalanceAlertMessage(
  projectName: string,
  balance: number,
  daysRemaining: number,
  avgDailySpend: number
): string {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Balance below R$ 1.00 is emergency level
  const isEmergency = balance < 1.00;
  const emoji = isEmergency ? '🚨🚨🚨' : daysRemaining <= 2 ? '🚨🚨' : daysRemaining <= 3 ? '🚨' : '⚠️';
  const urgency = isEmergency ? 'ZERADO' : daysRemaining <= 2 ? 'URGENTE' : daysRemaining <= 3 ? 'CRÍTICO' : 'ATENÇÃO';

  const urgencyMessage = isEmergency 
    ? '‼️ *SALDO ZERADO! Adicione créditos IMEDIATAMENTE ou as campanhas serão pausadas!*'
    : daysRemaining <= 2 
      ? '‼️ *Adicione créditos IMEDIATAMENTE para evitar pausar campanhas!*'
      : daysRemaining <= 3 
        ? '⚠️ *Recomendamos adicionar créditos hoje!*'
        : '💡 *Programe uma recarga nos próximos dias.*';

  return `${emoji} *ALERTA DE SALDO ${urgency}*

📊 *Projeto:* ${projectName}

💰 *Saldo Atual:* ${formatCurrency(balance)}
📉 *Gasto Médio Diário:* ${formatCurrency(avgDailySpend)}
⏰ *Dias Restantes:* ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}

${urgencyMessage}

_Alerta automático do V4 Dashboard_`;
}
