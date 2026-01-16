import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export type PageContext = 'all' | 'dashboard' | 'campaigns' | 'adsets' | 'ads';

// All available metrics that can be hidden
export const AVAILABLE_METRICS = {
  // Primary metrics
  spend: { label: 'Investimento', category: 'Investimento' },
  impressions: { label: 'Impressões', category: 'Alcance' },
  reach: { label: 'Alcance', category: 'Alcance' },
  clicks: { label: 'Cliques', category: 'Engajamento' },
  ctr: { label: 'CTR', category: 'Eficiência' },
  cpc: { label: 'CPC', category: 'Custo' },
  cpm: { label: 'CPM', category: 'Custo' },
  cpa: { label: 'CPA / CPL', category: 'Custo' },
  conversions: { label: 'Conversões', category: 'Resultados' },
  conversion_value: { label: 'Valor Conversão', category: 'Resultados' },
  roas: { label: 'ROAS', category: 'Eficiência' },
  frequency: { label: 'Frequência', category: 'Alcance' },
  messages: { label: 'Mensagens', category: 'Engajamento' },
  profile_visits: { label: 'Visitas Perfil', category: 'Engajamento' },
  leads: { label: 'Leads', category: 'Resultados' },
  purchases: { label: 'Compras', category: 'Resultados' },
  initiate_checkout: { label: 'Checkout Iniciado', category: 'Resultados' },
} as const;

export type MetricKey = keyof typeof AVAILABLE_METRICS;

interface UseHiddenMetricsReturn {
  hiddenMetrics: MetricKey[];
  loading: boolean;
  isMetricHidden: (metric: MetricKey) => boolean;
  toggleMetric: (metric: MetricKey) => Promise<void>;
  setHiddenMetrics: (metrics: MetricKey[]) => Promise<void>;
  canCustomize: boolean; // Only guests can customize
}

export function useHiddenMetrics(pageContext: PageContext = 'all'): UseHiddenMetricsReturn {
  const { user } = useAuth();
  const { isGuest, loading: roleLoading } = useUserRole();
  const [hiddenMetrics, setHiddenMetricsState] = useState<MetricKey[]>([]);
  const [loading, setLoading] = useState(true);

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
    canCustomize: isGuest, // Only guests can customize their view
  };
}
