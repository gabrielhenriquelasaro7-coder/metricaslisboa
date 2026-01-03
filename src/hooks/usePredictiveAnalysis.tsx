import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BudgetAlert {
  campaignId: string;
  campaignName: string;
  dailyBudget: number;
  lifetimeBudget: number;
  currentSpend: number;
  daysRemaining: number | null;
  budgetStatus: 'healthy' | 'warning' | 'critical';
  percentUsed: number | null;
}

export interface Predictions {
  next7Days: {
    estimatedSpend: number;
    estimatedConversions: number;
    estimatedRevenue: number;
  };
  next30Days: {
    estimatedSpend: number;
    estimatedConversions: number;
    estimatedRevenue: number;
  };
  trends: {
    spendTrend: number;
    avgDailySpend: number;
    avgDailyConversions: number;
    avgDailyRevenue: number;
  };
}

export interface DailyTrendPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  reach: number;
}

export interface PredictiveAnalysisData {
  project: {
    id: string;
    name: string;
    businessModel: string;
    currency: string;
  };
  predictions: Predictions;
  budgetAlerts: BudgetAlert[];
  dailyTrend: DailyTrendPoint[];
  suggestions: string[];
  generatedAt: string;
}

export function usePredictiveAnalysis(projectId: string | null) {
  const [data, setData] = useState<PredictiveAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (!projectId) {
      setError('Projeto não selecionado');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('predictive-analysis', {
        body: { projectId },
      });

      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);

      setData(result);
    } catch (err: any) {
      console.error('Predictive analysis error:', err);
      setError(err.message || 'Erro ao carregar análise preditiva');
      toast.error('Erro ao carregar análise preditiva');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return {
    data,
    loading,
    error,
    fetchAnalysis,
    refetch: fetchAnalysis,
  };
}
