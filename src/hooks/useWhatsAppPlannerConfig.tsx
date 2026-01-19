import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubMeta {
  id: string;
  text: string;
  completed: boolean;
}

export interface PlannerConfig {
  id: string;
  user_id: string;
  project_id: string;
  instance_id: string | null;
  target_type: 'phone' | 'group';
  phone_number: string | null;
  group_id: string | null;
  group_name: string | null;
  planner_enabled: boolean;
  report_day_of_week: number;
  report_time: string;
  current_step: string;
  target_step: string;
  metric_type: 'roi' | 'roas';
  roi_atual: number | null;
  roas_atual: number | null;
  cac_atual: number | null;
  investimento_mensal: number | null;
  faturamento_marketing: number | null;
  meta_principal_quarter: string | null;
  sub_metas: SubMeta[];
  criterios_mudanca_step: SubMeta[];
  meta_semana: string | null;
  meta_semana_porque: string | null;
  link_forecasting: string | null;
  link_plano_midia: string | null;
  link_planejamento_quarter: string | null;
  message_template: string | null;
  custom_message: string | null;
  hidden_fields: string[];
  last_report_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppPlannerConfig() {
  const [configs, setConfigs] = useState<PlannerConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_planner_configs')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      
      setConfigs((data || []).map(config => ({
        ...config,
        target_type: config.target_type as 'phone' | 'group',
        metric_type: (config.metric_type as 'roi' | 'roas') || 'roi',
        sub_metas: (config.sub_metas as unknown as SubMeta[]) || [],
        criterios_mudanca_step: (config.criterios_mudanca_step as unknown as SubMeta[]) || [],
        hidden_fields: (config.hidden_fields as unknown as string[]) || [],
      })));
    } catch (error) {
      console.error('Error fetching planner configs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getConfigForProject = useCallback((projectId: string): PlannerConfig | undefined => {
    return configs.find(c => c.project_id === projectId);
  }, [configs]);

  const saveConfig = useCallback(async (config: Partial<PlannerConfig> & { project_id: string }): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return false;
      }

      const existingConfig = configs.find(c => c.project_id === config.project_id);

      const configData = {
        user_id: user.id,
        project_id: config.project_id,
        instance_id: config.instance_id,
        target_type: config.target_type || 'phone',
        phone_number: config.phone_number,
        group_id: config.group_id,
        group_name: config.group_name,
        planner_enabled: config.planner_enabled ?? true,
        report_day_of_week: config.report_day_of_week ?? 1,
        report_time: config.report_time || '09:00',
        current_step: config.current_step || 'V1',
        target_step: config.target_step || 'V2',
        metric_type: config.metric_type || 'roi',
        roi_atual: config.roi_atual,
        roas_atual: config.roas_atual,
        cac_atual: config.cac_atual,
        investimento_mensal: config.investimento_mensal,
        faturamento_marketing: config.faturamento_marketing,
        meta_principal_quarter: config.meta_principal_quarter,
        sub_metas: config.sub_metas || [],
        criterios_mudanca_step: config.criterios_mudanca_step || [],
        meta_semana: config.meta_semana,
        meta_semana_porque: config.meta_semana_porque,
        link_forecasting: config.link_forecasting,
        link_plano_midia: config.link_plano_midia,
        link_planejamento_quarter: config.link_planejamento_quarter,
        message_template: config.message_template,
        custom_message: config.custom_message,
        hidden_fields: config.hidden_fields || [],
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;

      if (existingConfig) {
        const { error } = await supabase
          .from('whatsapp_planner_configs')
          .update(configData as any)
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_planner_configs')
          .insert(configData as any);

        if (error) throw error;
      }

      toast.success('Configuração do Planner salva com sucesso!');
      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('Error saving planner config:', error);
      toast.error('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
      return false;
    }
  }, [configs, fetchConfigs]);

  const deleteConfig = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('whatsapp_planner_configs')
        .delete()
        .eq('project_id', projectId);

      if (error) throw error;

      toast.success('Configuração do Planner removida');
      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('Error deleting planner config:', error);
      toast.error('Erro ao remover: ' + (error.message || 'Erro desconhecido'));
      return false;
    }
  }, [fetchConfigs]);

  return {
    configs,
    loading,
    fetchConfigs,
    getConfigForProject,
    saveConfig,
    deleteConfig,
  };
}
