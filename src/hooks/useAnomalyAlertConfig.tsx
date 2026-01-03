import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AnomalyAlertConfig {
  id: string;
  user_id: string;
  project_id: string;
  instance_id: string | null;
  enabled: boolean;
  ctr_drop_threshold: number;
  cpl_increase_threshold: number;
  campaign_paused_alert: boolean;
  ad_set_paused_alert: boolean;
  ad_paused_alert: boolean;
  budget_change_alert: boolean;
  target_type: 'phone' | 'group';
  phone_number: string | null;
  group_id: string | null;
  group_name: string | null;
  created_at: string;
  updated_at: string;
  last_alert_at: string | null;
}

export function useAnomalyAlertConfig(projectId: string | null) {
  const { user } = useAuth();
  const [config, setConfig] = useState<AnomalyAlertConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!projectId || !user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('anomaly_alert_config')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      setConfig(data as AnomalyAlertConfig | null);
    } catch (err) {
      console.error('Error fetching anomaly alert config:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async (configData: Partial<AnomalyAlertConfig>) => {
    if (!projectId || !user?.id) return false;
    
    setSaving(true);
    setError(null);
    
    try {
      if (config?.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('anomaly_alert_config')
          .update({
            ...configData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);
        
        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('anomaly_alert_config')
          .insert({
            user_id: user.id,
            project_id: projectId,
            ...configData,
          });
        
        if (insertError) throw insertError;
      }
      
      await fetchConfig();
      return true;
    } catch (err) {
      console.error('Error saving anomaly alert config:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async () => {
    if (!config?.id) return false;
    
    try {
      const { error: deleteError } = await supabase
        .from('anomaly_alert_config')
        .delete()
        .eq('id', config.id);
      
      if (deleteError) throw deleteError;
      setConfig(null);
      return true;
    } catch (err) {
      console.error('Error deleting anomaly alert config:', err);
      return false;
    }
  };

  return { config, loading, saving, error, saveConfig, deleteConfig, refetch: fetchConfig };
}
