import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MonthStatus = 'pending' | 'importing' | 'success' | 'error' | 'skipped';

export interface MonthImportRecord {
  id: string;
  project_id: string;
  year: number;
  month: number;
  status: MonthStatus;
  records_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  created_at: string;
}

export interface MonthsByYear {
  [year: number]: MonthImportRecord[];
}

export function useMonthImportStatus(projectId: string | null) {
  const [months, setMonths] = useState<MonthImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  const fetchMonths = useCallback(async () => {
    if (!projectId) {
      setMonths([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('project_import_months')
        .select('*')
        .eq('project_id', projectId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error) throw error;
      setMonths((data || []) as MonthImportRecord[]);
    } catch (error) {
      console.error('Error fetching month import status:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`month-imports-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_import_months',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMonths(prev => [...prev, payload.new as MonthImportRecord].sort((a, b) => 
              a.year === b.year ? a.month - b.month : a.year - b.year
            ));
          } else if (payload.eventType === 'UPDATE') {
            setMonths(prev => prev.map(m => 
              m.id === (payload.new as MonthImportRecord).id 
                ? payload.new as MonthImportRecord 
                : m
            ));
          } else if (payload.eventType === 'DELETE') {
            setMonths(prev => prev.filter(m => m.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Get months organized by year
  const monthsByYear: MonthsByYear = months.reduce((acc, month) => {
    if (!acc[month.year]) {
      acc[month.year] = [];
    }
    acc[month.year].push(month);
    return acc;
  }, {} as MonthsByYear);

  // Stats
  const stats = {
    total: months.length,
    pending: months.filter(m => m.status === 'pending').length,
    importing: months.filter(m => m.status === 'importing').length,
    success: months.filter(m => m.status === 'success').length,
    error: months.filter(m => m.status === 'error').length,
    skipped: months.filter(m => m.status === 'skipped').length,
    totalRecords: months.reduce((sum, m) => sum + (m.records_count || 0), 0),
  };

  const progress = stats.total > 0 
    ? ((stats.success + stats.skipped) / stats.total) * 100 
    : 0;

  // Retry a single month
  const retryMonth = async (year: number, month: number) => {
    if (!projectId) return;
    
    const monthKey = `${year}-${month}`;
    setIsRetrying(monthKey);

    try {
      const { error } = await supabase.functions.invoke('import-month-by-month', {
        body: {
          project_id: projectId,
          year,
          month,
          continue_chain: false,
          safe_mode: true,
        },
      });

      if (error) throw error;
      
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      toast.success(`Reimportação iniciada para ${monthNames[month - 1]} ${year}`);
    } catch (error) {
      toast.error('Erro ao iniciar reimportação');
      console.error('Retry error:', error);
    } finally {
      setIsRetrying(null);
    }
  };

  // Retry all failed months
  const retryAllFailed = async () => {
    if (!projectId) return;
    
    const failedMonths = months.filter(m => m.status === 'error');
    if (failedMonths.length === 0) {
      toast.info('Nenhum mês com erro para reimportar');
      return;
    }

    // Start with the first failed month and enable chain
    const firstFailed = failedMonths[0];
    
    try {
      const { error } = await supabase.functions.invoke('import-month-by-month', {
        body: {
          project_id: projectId,
          year: firstFailed.year,
          month: firstFailed.month,
          continue_chain: true,
          safe_mode: true,
        },
      });

      if (error) throw error;
      
      toast.success(`Reimportação encadeada iniciada (${failedMonths.length} meses com erro)`);
    } catch (error) {
      toast.error('Erro ao iniciar reimportação');
      console.error('Retry all error:', error);
    }
  };

  // Start import from a specific month with chain
  const startChainedImport = async (year: number, month: number) => {
    if (!projectId) return;

    try {
      const { error } = await supabase.functions.invoke('import-month-by-month', {
        body: {
          project_id: projectId,
          year,
          month,
          continue_chain: true,
          safe_mode: true,
        },
      });

      if (error) throw error;
      
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      toast.success(`Importação encadeada iniciada a partir de ${monthNames[month - 1]} ${year}`);
    } catch (error) {
      toast.error('Erro ao iniciar importação');
      console.error('Start chain error:', error);
    }
  };

  return {
    months,
    monthsByYear,
    loading,
    stats,
    progress,
    isRetrying,
    refetch: fetchMonths,
    retryMonth,
    retryAllFailed,
    startChainedImport,
  };
}
