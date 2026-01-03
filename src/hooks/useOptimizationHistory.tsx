import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OptimizationRecord {
  id: string;
  project_id: string;
  entity_type: 'campaign' | 'ad_set' | 'ad';
  entity_id: string;
  entity_name: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  change_percentage: number | null;
  detected_at: string;
  created_at: string;
}

export function useOptimizationHistory(projectId: string | null) {
  const [history, setHistory] = useState<OptimizationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('optimization_history')
        .select('*')
        .eq('project_id', projectId)
        .order('detected_at', { ascending: false })
        .limit(500);
      
      if (fetchError) throw fetchError;
      setHistory((data || []) as OptimizationRecord[]);
    } catch (err) {
      console.error('Error fetching optimization history:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
}
