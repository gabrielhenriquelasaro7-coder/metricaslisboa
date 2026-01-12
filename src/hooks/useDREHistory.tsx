import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DREHistoryEntry {
  id: string;
  project_id: string;
  user_id: string;
  year: number;
  month: number;
  period_start: string;
  period_end: string;
  status: 'open' | 'closed' | 'locked';
  closed_at: string | null;
  
  // Revenue
  gross_revenue: number;
  deductions: number;
  net_revenue: number;
  
  // Ad spend
  ad_spend_meta: number;
  ad_spend_google: number;
  ad_spend_other: number;
  total_ad_spend: number;
  
  // CRM
  total_leads: number;
  total_mql: number;
  total_sql: number;
  total_sales: number;
  
  // Metrics
  cpl: number;
  cac: number;
  average_ticket: number;
  conversion_rate: number;
  roas: number;
  
  // Financial
  contribution_margin: number;
  operational_expenses: number;
  ebitda: number;
  
  // Custom
  notes: string | null;
  custom_deductions: any[];
  custom_expenses: any[];
  
  created_at: string;
  updated_at: string;
}

export interface DREHistoryInput {
  gross_revenue?: number;
  deductions?: number;
  net_revenue?: number;
  ad_spend_meta?: number;
  ad_spend_google?: number;
  ad_spend_other?: number;
  total_ad_spend?: number;
  total_leads?: number;
  total_mql?: number;
  total_sql?: number;
  total_sales?: number;
  cpl?: number;
  cac?: number;
  average_ticket?: number;
  conversion_rate?: number;
  roas?: number;
  contribution_margin?: number;
  operational_expenses?: number;
  ebitda?: number;
  notes?: string;
  custom_deductions?: any[];
  custom_expenses?: any[];
}

export function useDREHistory(projectId: string | undefined) {
  const [history, setHistory] = useState<DREHistoryEntry[]>([]);
  const [currentDRE, setCurrentDRE] = useState<DREHistoryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('dre_history')
        .select('*')
        .eq('project_id', projectId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      
      // Type cast the data
      const typedData = (data || []).map(item => ({
        ...item,
        status: item.status as 'open' | 'closed' | 'locked',
        gross_revenue: Number(item.gross_revenue) || 0,
        deductions: Number(item.deductions) || 0,
        net_revenue: Number(item.net_revenue) || 0,
        ad_spend_meta: Number(item.ad_spend_meta) || 0,
        ad_spend_google: Number(item.ad_spend_google) || 0,
        ad_spend_other: Number(item.ad_spend_other) || 0,
        total_ad_spend: Number(item.total_ad_spend) || 0,
        total_leads: Number(item.total_leads) || 0,
        total_mql: Number(item.total_mql) || 0,
        total_sql: Number(item.total_sql) || 0,
        total_sales: Number(item.total_sales) || 0,
        cpl: Number(item.cpl) || 0,
        cac: Number(item.cac) || 0,
        average_ticket: Number(item.average_ticket) || 0,
        conversion_rate: Number(item.conversion_rate) || 0,
        roas: Number(item.roas) || 0,
        contribution_margin: Number(item.contribution_margin) || 0,
        operational_expenses: Number(item.operational_expenses) || 0,
        ebitda: Number(item.ebitda) || 0,
        custom_deductions: Array.isArray(item.custom_deductions) ? item.custom_deductions : [],
        custom_expenses: Array.isArray(item.custom_expenses) ? item.custom_expenses : [],
      })) as DREHistoryEntry[];
      
      setHistory(typedData);
      
      // Find current month's DRE
      const now = new Date();
      const currentMonthDRE = typedData.find(
        d => d.year === now.getFullYear() && d.month === now.getMonth() + 1
      );
      setCurrentDRE(currentMonthDRE || null);
    } catch (error) {
      console.error('Error fetching DRE history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const createOrUpdateDRE = useCallback(async (
    year: number,
    month: number,
    data: DREHistoryInput
  ) => {
    if (!projectId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const periodStart = startOfMonth(new Date(year, month - 1));
      const periodEnd = endOfMonth(new Date(year, month - 1));

      const dreData = {
        project_id: projectId,
        user_id: user.id,
        year,
        month,
        period_start: format(periodStart, 'yyyy-MM-dd'),
        period_end: format(periodEnd, 'yyyy-MM-dd'),
        ...data,
      };

      const { data: result, error } = await supabase
        .from('dre_history')
        .upsert(dreData, {
          onConflict: 'project_id,year,month',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('DRE salva com sucesso!');
      await fetchHistory();
      return result;
    } catch (error) {
      console.error('Error saving DRE:', error);
      toast.error('Erro ao salvar DRE');
      return null;
    }
  }, [projectId, fetchHistory]);

  const closeDRE = useCallback(async (dreId: string) => {
    try {
      const { error } = await supabase
        .from('dre_history')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', dreId);

      if (error) throw error;

      toast.success('DRE fechada com sucesso!');
      await fetchHistory();
    } catch (error) {
      console.error('Error closing DRE:', error);
      toast.error('Erro ao fechar DRE');
    }
  }, [fetchHistory]);

  const reopenDRE = useCallback(async (dreId: string) => {
    try {
      const { error } = await supabase
        .from('dre_history')
        .update({
          status: 'open',
          closed_at: null,
        })
        .eq('id', dreId);

      if (error) throw error;

      toast.success('DRE reaberta com sucesso!');
      await fetchHistory();
    } catch (error) {
      console.error('Error reopening DRE:', error);
      toast.error('Erro ao reabrir DRE');
    }
  }, [fetchHistory]);

  const getMonthLabel = (year: number, month: number) => {
    const date = new Date(year, month - 1);
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  };

  return {
    history,
    currentDRE,
    isLoading,
    fetchHistory,
    createOrUpdateDRE,
    closeDRE,
    reopenDRE,
    getMonthLabel,
  };
}
