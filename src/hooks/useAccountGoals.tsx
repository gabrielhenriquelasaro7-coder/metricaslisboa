import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AccountGoalData {
  id: string;
  project_id: string;
  target_leads_monthly: number | null;
  target_cpl: number | null;
  target_roas: number | null;
  target_ctr: number | null;
  target_cpc: number | null;
  target_spend_daily: number | null;
  target_spend_monthly: number | null;
  created_at: string;
  updated_at: string;
}

export function useAccountGoals(projectId: string | null) {
  const [goal, setGoal] = useState<AccountGoalData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchGoal = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('account_goals')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (error) throw error;
      setGoal(data);
    } catch (error) {
      console.error('Error fetching account goal:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  const saveGoal = async (goalData: {
    target_leads_monthly?: number | null;
    target_cpl?: number | null;
    target_roas?: number | null;
    target_ctr?: number | null;
    target_cpc?: number | null;
    target_spend_daily?: number | null;
    target_spend_monthly?: number | null;
  }) => {
    if (!projectId) return;

    try {
      const { error } = await supabase
        .from('account_goals')
        .upsert({
          project_id: projectId,
          ...goalData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id'
        });
      
      if (error) throw error;
      
      toast.success('Metas gerais salvas com sucesso!');
      await fetchGoal();
    } catch (error) {
      console.error('Error saving account goal:', error);
      toast.error('Erro ao salvar metas');
    }
  };

  const deleteGoal = async () => {
    if (!projectId || !goal) return;

    try {
      const { error } = await supabase
        .from('account_goals')
        .delete()
        .eq('project_id', projectId);
      
      if (error) throw error;
      
      toast.success('Metas removidas');
      setGoal(null);
    } catch (error) {
      console.error('Error deleting account goal:', error);
      toast.error('Erro ao remover metas');
    }
  };

  return {
    goal,
    loading,
    saveGoal,
    deleteGoal,
    refetch: fetchGoal,
  };
}
