import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AccountBalance {
  balance: number;
  currency: string;
  lastUpdated: string | null;
  daysOfSpendRemaining: number | null;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  fundingType?: string | null;
  autoReloadEnabled?: boolean;
  autoReloadThreshold?: number | null;
}

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

export interface CampaignGoalProgress {
  campaignId: string;
  campaignName: string;
  spend: number;
  conversions: number;
  conversion_value: number;
  clicks: number;
  impressions: number;
  cpl: number | null;
  roas: number | null;
  ctr: number | null;
  targetRoas: number | null;
  targetCpl: number | null;
  targetLeads: number | null;
  roasProgress: number | null;
  cplProgress: number | null;
  leadsProgress: number | null;
  roasStatus: 'success' | 'warning' | 'critical' | 'unknown';
  cplStatus: 'success' | 'warning' | 'critical' | 'unknown';
  leadsStatus: 'success' | 'warning' | 'critical' | 'unknown';
  hasCustomGoal: boolean;
}

export interface ScenarioData {
  spend: number;
  conversions: number;
  revenue: number;
}

export interface Scenarios {
  pessimistic: ScenarioData;
  realistic: ScenarioData;
  optimistic: ScenarioData;
}

export interface Predictions {
  next7Days: {
    estimatedSpend: number;
    estimatedConversions: number;
    estimatedRevenue: number;
    scenarios: Scenarios;
  };
  next30Days: {
    estimatedSpend: number;
    estimatedConversions: number;
    estimatedRevenue: number;
    scenarios: Scenarios;
  };
  endOfYear: {
    daysRemaining: number;
    estimatedSpend: number;
    estimatedConversions: number;
    estimatedRevenue: number;
    scenarios: Scenarios;
  };
  trends: {
    spendTrend: number;
    avgDailySpend: number;
    avgDailyConversions: number;
    avgDailyRevenue: number;
    avgDailyCpl: number | null;
    avgDailyRoas: number | null;
    avgCtr: number | null;
    stdDevSpend: number;
    stdDevConversions: number;
    stdDevRevenue: number;
    confidenceLevel: 'alta' | 'média' | 'baixa';
    trendDirection: 'crescente' | 'decrescente' | 'estável';
  };
}

export interface Totals {
  spend30Days: number;
  conversions30Days: number;
  revenue30Days: number;
  clicks30Days: number;
  impressions30Days: number;
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

export interface OptimizationSuggestion {
  title: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PredictiveAnalysisData {
  project: {
    id: string;
    name: string;
    businessModel: string;
    currency: string;
  };
  accountBalance: AccountBalance;
  predictions: Predictions;
  totals: Totals;
  budgetAlerts: BudgetAlert[];
  campaignGoalsProgress: CampaignGoalProgress[];
  dailyTrend: DailyTrendPoint[];
  suggestions: OptimizationSuggestion[];
  generatedAt: string;
}

export interface CampaignGoal {
  campaignId: string;
  targetRoas?: number;
  targetCpl?: number;
  targetLeads?: number;
}

export interface AccountGoal {
  targetLeadsMonthly?: number | null;
  targetCpl?: number | null;
  targetRoas?: number | null;
  targetCtr?: number | null;
  targetSpendDaily?: number | null;
  targetSpendMonthly?: number | null;
}

export function usePredictiveAnalysis(projectId: string | null) {
  const [data, setData] = useState<PredictiveAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async (accountGoal?: AccountGoal) => {
    if (!projectId) {
      setError('Projeto não selecionado');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('predictive-analysis', {
        body: { projectId, accountGoal },
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
