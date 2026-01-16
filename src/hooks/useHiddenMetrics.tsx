import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export type PageContext = 'all' | 'dashboard' | 'campaigns' | 'adsets' | 'ads';
export type BusinessModel = 'ecommerce' | 'inside_sales' | 'pdv' | 'infoproduto' | 'custom' | null;

// Base metrics available for all business models
// Labels must match EXACTLY what appears on the dashboard cards
const BASE_METRICS = {
  spend: { label: 'Gasto Total', category: 'Investimento' },
  impressions: { label: 'Impressões', category: 'Alcance' },
  reach: { label: 'Alcance', category: 'Alcance' },
  clicks: { label: 'Cliques', category: 'Engajamento' },
  ctr: { label: 'CTR', category: 'Eficiência' },
  cpc: { label: 'CPC', category: 'Custo' },
  cpm: { label: 'CPM', category: 'Custo' },
  frequency: { label: 'Frequência', category: 'Alcance' },
} as const;

// E-commerce specific metrics
const ECOMMERCE_METRICS = {
  ...BASE_METRICS,
  conversions: { label: 'Compras', category: 'Resultados' },
  conversion_value: { label: 'Receita', category: 'Resultados' },
  roas: { label: 'ROAS', category: 'Eficiência' },
  purchases: { label: 'Compras (Pixel)', category: 'Resultados' },
  initiate_checkout: { label: 'Checkout Iniciado', category: 'Resultados' },
} as const;

// Inside Sales specific metrics
const INSIDE_SALES_METRICS = {
  ...BASE_METRICS,
  conversions: { label: 'Leads', category: 'Resultados' },
  cpa: { label: 'CPL', category: 'Custo' },
  leads: { label: 'Leads (Formulário)', category: 'Resultados' },
  messages: { label: 'Mensagens', category: 'Engajamento' },
  profile_visits: { label: 'Visitas Perfil', category: 'Engajamento' },
} as const;

// PDV specific metrics
const PDV_METRICS = {
  ...BASE_METRICS,
  conversions: { label: 'Visitas à Loja', category: 'Resultados' },
  cpa: { label: 'Custo/Visita', category: 'Custo' },
} as const;

// Infoproduto specific metrics
const INFOPRODUTO_METRICS = {
  ...BASE_METRICS,
  conversions: { label: 'Vendas', category: 'Resultados' },
  conversion_value: { label: 'Receita', category: 'Resultados' },
  roas: { label: 'ROAS', category: 'Eficiência' },
  cpa: { label: 'CPA', category: 'Custo' },
  purchases: { label: 'Compras (Pixel)', category: 'Resultados' },
} as const;

// All metrics union for typing - labels must match dashboard cards
export const AVAILABLE_METRICS = {
  spend: { label: 'Gasto Total', category: 'Investimento' },
  impressions: { label: 'Impressões', category: 'Alcance' },
  reach: { label: 'Alcance', category: 'Alcance' },
  clicks: { label: 'Cliques', category: 'Engajamento' },
  ctr: { label: 'CTR', category: 'Eficiência' },
  cpc: { label: 'CPC', category: 'Custo' },
  cpm: { label: 'CPM', category: 'Custo' },
  cpa: { label: 'CPA / CPL', category: 'Custo' },
  conversions: { label: 'Conversões', category: 'Resultados' },
  conversion_value: { label: 'Receita', category: 'Resultados' },
  roas: { label: 'ROAS', category: 'Eficiência' },
  frequency: { label: 'Frequência', category: 'Alcance' },
  messages: { label: 'Mensagens', category: 'Engajamento' },
  profile_visits: { label: 'Visitas Perfil', category: 'Engajamento' },
  leads: { label: 'Leads', category: 'Resultados' },
  purchases: { label: 'Compras', category: 'Resultados' },
  initiate_checkout: { label: 'Checkout Iniciado', category: 'Resultados' },
} as const;

export type MetricKey = keyof typeof AVAILABLE_METRICS;

// Get metrics by business model
export function getMetricsByBusinessModel(businessModel: BusinessModel): Record<string, { label: string; category: string }> {
  switch (businessModel) {
    case 'ecommerce':
      return ECOMMERCE_METRICS;
    case 'inside_sales':
      return INSIDE_SALES_METRICS;
    case 'pdv':
      return PDV_METRICS;
    case 'infoproduto':
      return INFOPRODUTO_METRICS;
    case 'custom':
      return AVAILABLE_METRICS; // Show all for custom
    default:
      return BASE_METRICS; // Default to base metrics
  }
}

interface UseHiddenMetricsReturn {
  hiddenMetrics: MetricKey[];
  loading: boolean;
  isMetricHidden: (metric: MetricKey) => boolean;
  toggleMetric: (metric: MetricKey) => Promise<void>;
  setHiddenMetrics: (metrics: MetricKey[]) => Promise<void>;
  canCustomize: boolean;
  availableMetricsForModel: Record<string, { label: string; category: string }>;
}

export function useHiddenMetrics(pageContext: PageContext = 'all', businessModel?: BusinessModel): UseHiddenMetricsReturn {
  const { user } = useAuth();
  const { isGuest, loading: roleLoading } = useUserRole();
  const [hiddenMetrics, setHiddenMetricsState] = useState<MetricKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Get available metrics based on business model
  const availableMetricsForModel = useMemo(() => {
    return getMetricsByBusinessModel(businessModel || null);
  }, [businessModel]);

  // Fetch hidden metrics from database
  useEffect(() => {
    const fetchHiddenMetrics = async () => {
      if (!user || roleLoading) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_hidden_metrics')
          .select('hidden_metrics')
          .eq('user_id', user.id)
          .eq('page_context', pageContext)
          .maybeSingle();

        if (error) {
          console.error('Error fetching hidden metrics:', error);
        } else if (data?.hidden_metrics) {
          setHiddenMetricsState(data.hidden_metrics as MetricKey[]);
        } else {
          setHiddenMetricsState([]);
        }
      } catch (err) {
        console.error('Error in useHiddenMetrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHiddenMetrics();
  }, [user, pageContext, roleLoading]);

  const isMetricHidden = useCallback((metric: MetricKey) => {
    return hiddenMetrics.includes(metric);
  }, [hiddenMetrics]);

  const setHiddenMetrics = useCallback(async (metrics: MetricKey[]) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_hidden_metrics')
        .upsert({
          user_id: user.id,
          page_context: pageContext,
          hidden_metrics: metrics,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,page_context'
        });

      if (error) {
        console.error('Error saving hidden metrics:', error);
        return;
      }

      setHiddenMetricsState(metrics);
    } catch (err) {
      console.error('Error in setHiddenMetrics:', err);
    }
  }, [user, pageContext]);

  const toggleMetric = useCallback(async (metric: MetricKey) => {
    const newMetrics = hiddenMetrics.includes(metric)
      ? hiddenMetrics.filter(m => m !== metric)
      : [...hiddenMetrics, metric];
    
    await setHiddenMetrics(newMetrics);
  }, [hiddenMetrics, setHiddenMetrics]);

  return {
    hiddenMetrics,
    loading: loading || roleLoading,
    isMetricHidden,
    toggleMetric,
    setHiddenMetrics,
    canCustomize: isGuest,
    availableMetricsForModel,
  };
}
