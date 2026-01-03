import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CampaignGoalData {
  id: string;
  project_id: string;
  campaign_id: string;
  campaign_name: string;
  target_cpl: number | null;
  target_roas: number | null;
}

export function useCampaignGoals(projectId: string | null) {
  const [goals, setGoals] = useState<CampaignGoalData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_goals')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      setGoals((data || []) as CampaignGoalData[]);
    } catch (err) {
      console.error('Error fetching campaign goals:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const saveGoal = useCallback(async (
    campaignId: string,
    campaignName: string,
    targetCpl: number | null,
    targetRoas: number | null
  ) => {
    if (!projectId) return;

    try {
      const { error } = await supabase
        .from('campaign_goals')
        .upsert({
          project_id: projectId,
          campaign_id: campaignId,
          campaign_name: campaignName,
          target_cpl: targetCpl,
          target_roas: targetRoas,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,campaign_id'
        });

      if (error) throw error;
      
      toast.success('Meta salva com sucesso!');
      fetchGoals();
    } catch (err) {
      console.error('Error saving campaign goal:', err);
      toast.error('Erro ao salvar meta');
    }
  }, [projectId, fetchGoals]);

  const deleteGoal = useCallback(async (campaignId: string) => {
    if (!projectId) return;

    try {
      const { error } = await supabase
        .from('campaign_goals')
        .delete()
        .eq('project_id', projectId)
        .eq('campaign_id', campaignId);

      if (error) throw error;
      
      toast.success('Meta removida');
      fetchGoals();
    } catch (err) {
      console.error('Error deleting campaign goal:', err);
      toast.error('Erro ao remover meta');
    }
  }, [projectId, fetchGoals]);

  const getGoalForCampaign = useCallback((campaignId: string) => {
    return goals.find(g => g.campaign_id === campaignId);
  }, [goals]);

  return {
    goals,
    loading,
    fetchGoals,
    saveGoal,
    deleteGoal,
    getGoalForCampaign,
  };
}
