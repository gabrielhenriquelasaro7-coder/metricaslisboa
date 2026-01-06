import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Tipos de métricas disponíveis
export interface MetricOption {
  key: string;
  label: string;
  description: string;
  category: 'result' | 'cost' | 'efficiency' | 'base';
}

// Configuração de métricas do projeto
export interface ProjectMetricConfig {
  id: string;
  project_id: string;
  primary_metrics: string[];
  result_metric: string;
  result_metric_label: string;
  // Novas colunas para múltiplas métricas de resultado
  result_metrics: string[];
  result_metrics_labels: Record<string, string>;
  cost_metrics: string[];
  efficiency_metrics: string[];
  show_comparison: boolean;
  chart_primary_metric: string;
  chart_secondary_metric: string;
  created_at: string;
  updated_at: string;
}

// Opções de métricas de resultado
export const RESULT_METRIC_OPTIONS: MetricOption[] = [
  { key: 'leads', label: 'Leads', description: 'Formulários e cadastros', category: 'result' },
  { key: 'purchases', label: 'Compras', description: 'Vendas online', category: 'result' },
  { key: 'registrations', label: 'Cadastros', description: 'Cadastros completos', category: 'result' },
  { key: 'store_visits', label: 'Visitas à Loja', description: 'Tráfego para loja física', category: 'result' },
  { key: 'appointments', label: 'Agendamentos', description: 'Consultas e reuniões', category: 'result' },
  { key: 'messages', label: 'Mensagens', description: 'Conversas iniciadas', category: 'result' },
];

// Opções de métricas de custo
export const COST_METRIC_OPTIONS: MetricOption[] = [
  { key: 'cpl', label: 'CPL', description: 'Custo por Lead', category: 'cost' },
  { key: 'cpa', label: 'CPA', description: 'Custo por Aquisição', category: 'cost' },
  { key: 'cac', label: 'CAC', description: 'Custo de Aquisição de Cliente', category: 'cost' },
  { key: 'cpp', label: 'CPP', description: 'Custo por Compra', category: 'cost' },
];

// Opções de métricas de eficiência
export const EFFICIENCY_METRIC_OPTIONS: MetricOption[] = [
  { key: 'roas', label: 'ROAS', description: 'Retorno sobre Gasto em Ads', category: 'efficiency' },
  { key: 'roi', label: 'ROI', description: 'Retorno sobre Investimento', category: 'efficiency' },
  { key: 'ctr', label: 'CTR', description: 'Taxa de Clique', category: 'efficiency' },
  { key: 'conversion_rate', label: 'Taxa de Conversão', description: '% de cliques que convertem', category: 'efficiency' },
];

// Métricas base (sempre mostradas)
export const BASE_METRIC_OPTIONS: MetricOption[] = [
  { key: 'spend', label: 'Gasto', description: 'Valor investido', category: 'base' },
  { key: 'impressions', label: 'Impressões', description: 'Vezes que o anúncio foi exibido', category: 'base' },
  { key: 'reach', label: 'Alcance', description: 'Pessoas únicas alcançadas', category: 'base' },
  { key: 'clicks', label: 'Cliques', description: 'Cliques no anúncio', category: 'base' },
  { key: 'cpm', label: 'CPM', description: 'Custo por mil impressões', category: 'base' },
  { key: 'cpc', label: 'CPC', description: 'Custo por clique', category: 'base' },
  { key: 'frequency', label: 'Frequência', description: 'Média de vezes que cada pessoa viu', category: 'base' },
];

// Templates de configuração por modelo de negócio
export const METRIC_TEMPLATES = {
  inside_sales: {
    result_metric: 'leads',
    result_metric_label: 'Leads',
    result_metrics: ['leads'],
    result_metrics_labels: { leads: 'Leads' },
    cost_metrics: ['cpl', 'cpa'],
    efficiency_metrics: ['ctr', 'conversion_rate'],
    primary_metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc'],
    chart_primary_metric: 'spend',
    chart_secondary_metric: 'leads',
  },
  ecommerce: {
    result_metric: 'purchases',
    result_metric_label: 'Compras',
    result_metrics: ['purchases'],
    result_metrics_labels: { purchases: 'Compras' },
    cost_metrics: ['cpa', 'cpp'],
    efficiency_metrics: ['roas', 'conversion_rate'],
    primary_metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc'],
    chart_primary_metric: 'spend',
    chart_secondary_metric: 'purchases',
  },
  pdv: {
    result_metric: 'store_visits',
    result_metric_label: 'Visitas à Loja',
    result_metrics: ['store_visits'],
    result_metrics_labels: { store_visits: 'Visitas à Loja' },
    cost_metrics: ['cpa'],
    efficiency_metrics: ['ctr'],
    primary_metrics: ['spend', 'impressions', 'reach', 'clicks', 'cpm', 'frequency'],
    chart_primary_metric: 'spend',
    chart_secondary_metric: 'reach',
  },
  custom: {
    result_metric: 'leads',
    result_metric_label: 'Conversões',
    result_metrics: ['leads'],
    result_metrics_labels: { leads: 'Leads' },
    cost_metrics: ['cpa'],
    efficiency_metrics: ['roas', 'ctr'],
    primary_metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc'],
    chart_primary_metric: 'spend',
    chart_secondary_metric: 'conversions',
  },
};

export function useProjectMetricConfig(projectId: string | null) {
  const [config, setConfig] = useState<ProjectMetricConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchConfig = useCallback(async () => {
    if (!projectId || !user) {
      setConfig(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('project_metric_config')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfig({
          ...data,
          primary_metrics: data.primary_metrics as string[],
          cost_metrics: data.cost_metrics as string[],
          efficiency_metrics: data.efficiency_metrics as string[],
          result_metrics: (data.result_metrics as string[]) || [],
          result_metrics_labels: (data.result_metrics_labels as Record<string, string>) || {},
        });
      } else {
        setConfig(null);
      }
    } catch (error) {
      console.error('Error fetching metric config:', error);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const createConfig = useCallback(async (
    projectId: string,
    configData: Partial<Omit<ProjectMetricConfig, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
  ) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const { data, error } = await supabase
        .from('project_metric_config')
        .insert({
          project_id: projectId,
          ...configData,
        })
        .select()
        .single();

      if (error) throw error;

      const newConfig = {
        ...data,
        primary_metrics: data.primary_metrics as string[],
        cost_metrics: data.cost_metrics as string[],
        efficiency_metrics: data.efficiency_metrics as string[],
        result_metrics: (data.result_metrics as string[]) || [],
        result_metrics_labels: (data.result_metrics_labels as Record<string, string>) || {},
      };
      
      setConfig(newConfig);
      return newConfig;
    } catch (error) {
      console.error('Error creating metric config:', error);
      throw error;
    }
  }, [user]);

  const updateConfig = useCallback(async (
    updates: Partial<Omit<ProjectMetricConfig, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
  ) => {
    if (!config || !user) return;

    try {
      const { error } = await supabase
        .from('project_metric_config')
        .update(updates)
        .eq('id', config.id);

      if (error) throw error;

      setConfig(prev => prev ? { ...prev, ...updates } as ProjectMetricConfig : null);
      toast.success('Configuração atualizada!');
    } catch (error) {
      console.error('Error updating metric config:', error);
      toast.error('Erro ao atualizar configuração');
      throw error;
    }
  }, [config, user]);

  const deleteConfig = useCallback(async () => {
    if (!config || !user) return;

    try {
      const { error } = await supabase
        .from('project_metric_config')
        .delete()
        .eq('id', config.id);

      if (error) throw error;

      setConfig(null);
    } catch (error) {
      console.error('Error deleting metric config:', error);
      throw error;
    }
  }, [config, user]);

  return {
    config,
    loading,
    createConfig,
    updateConfig,
    deleteConfig,
    refetch: fetchConfig,
  };
}
