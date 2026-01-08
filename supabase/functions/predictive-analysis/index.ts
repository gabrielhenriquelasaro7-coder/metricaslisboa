import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignGoal {
  campaignId: string;
  targetRoas?: number;
  targetCpl?: number;
}

interface PeriodStats {
  avgDailySpend: number;
  avgDailyConversions: number;
  avgDailyRevenue: number;
  avgDailyClicks: number;
  avgDailyImpressions: number;
  stdDevSpend: number;
  stdDevConversions: number;
  stdDevRevenue: number;
  totalSpend: number;
  totalConversions: number;
  totalRevenue: number;
  daysWithData: number;
  trend: number; // % change first half vs second half
  p25Spend: number;
  p50Spend: number;
  p75Spend: number;
  p25Conversions: number;
  p50Conversions: number;
  p75Conversions: number;
  p25Revenue: number;
  p50Revenue: number;
  p75Revenue: number;
  coefficientOfVariation: number;
}

// Calculate percentile from sorted array
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// Calculate standard deviation
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

// Calculate period statistics
function calculatePeriodStats(data: any[]): PeriodStats {
  if (data.length === 0) {
    return {
      avgDailySpend: 0, avgDailyConversions: 0, avgDailyRevenue: 0,
      avgDailyClicks: 0, avgDailyImpressions: 0,
      stdDevSpend: 0, stdDevConversions: 0, stdDevRevenue: 0,
      totalSpend: 0, totalConversions: 0, totalRevenue: 0,
      daysWithData: 0, trend: 0,
      p25Spend: 0, p50Spend: 0, p75Spend: 0,
      p25Conversions: 0, p50Conversions: 0, p75Conversions: 0,
      p25Revenue: 0, p50Revenue: 0, p75Revenue: 0,
      coefficientOfVariation: 100,
    };
  }

  const spendValues = data.map(d => d.spend);
  const conversionValues = data.map(d => d.conversions);
  const revenueValues = data.map(d => d.conversion_value);
  const clickValues = data.map(d => d.clicks);
  const impressionValues = data.map(d => d.impressions);

  const totalSpend = spendValues.reduce((a, b) => a + b, 0);
  const totalConversions = conversionValues.reduce((a, b) => a + b, 0);
  const totalRevenue = revenueValues.reduce((a, b) => a + b, 0);
  const daysWithData = data.length;

  const avgDailySpend = totalSpend / daysWithData;
  const avgDailyConversions = totalConversions / daysWithData;
  const avgDailyRevenue = totalRevenue / daysWithData;
  const avgDailyClicks = clickValues.reduce((a, b) => a + b, 0) / daysWithData;
  const avgDailyImpressions = impressionValues.reduce((a, b) => a + b, 0) / daysWithData;

  const stdDevSpend = calculateStdDev(spendValues);
  const stdDevConversions = calculateStdDev(conversionValues);
  const stdDevRevenue = calculateStdDev(revenueValues);

  // Calculate trend (first half vs second half)
  const midpoint = Math.floor(daysWithData / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);
  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, d) => sum + d.spend, 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, d) => sum + d.spend, 0) / secondHalf.length : 0;
  const trend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  // Calculate percentiles
  const p25Spend = percentile(spendValues, 25);
  const p50Spend = percentile(spendValues, 50);
  const p75Spend = percentile(spendValues, 75);
  const p25Conversions = percentile(conversionValues, 25);
  const p50Conversions = percentile(conversionValues, 50);
  const p75Conversions = percentile(conversionValues, 75);
  const p25Revenue = percentile(revenueValues, 25);
  const p50Revenue = percentile(revenueValues, 50);
  const p75Revenue = percentile(revenueValues, 75);

  // Coefficient of variation (lower = more stable)
  const coefficientOfVariation = avgDailySpend > 0 ? (stdDevSpend / avgDailySpend) * 100 : 100;

  return {
    avgDailySpend, avgDailyConversions, avgDailyRevenue,
    avgDailyClicks, avgDailyImpressions,
    stdDevSpend, stdDevConversions, stdDevRevenue,
    totalSpend, totalConversions, totalRevenue,
    daysWithData, trend,
    p25Spend, p50Spend, p75Spend,
    p25Conversions, p50Conversions, p75Conversions,
    p25Revenue, p50Revenue, p75Revenue,
    coefficientOfVariation,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, campaignGoals } = await req.json();
    
    if (!projectId) {
      throw new Error('projectId é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    // Fetch account balance from Meta API if token available
    let accountBalance = {
      balance: project.account_balance || 0,
      currency: project.currency || 'BRL',
      lastUpdated: project.account_balance_updated_at,
      daysOfSpendRemaining: null as number | null,
      status: 'unknown' as 'healthy' | 'warning' | 'critical' | 'unknown',
      fundingType: null as number | null,
      autoReloadEnabled: false,
      autoReloadThreshold: null as number | null,
      accountStatus: null as number | null,
    };

    if (metaAccessToken && project.ad_account_id) {
      try {
        const adAccountId = project.ad_account_id.startsWith('act_') 
          ? project.ad_account_id 
          : `act_${project.ad_account_id}`;
        
        const metaResponse = await fetch(
          `https://graph.facebook.com/v22.0/${adAccountId}?fields=balance,amount_spent,currency,funding_source_details,account_status,spend_cap&access_token=${metaAccessToken}`
        );
        
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          console.log('[PREDICTIVE] Meta account data:', JSON.stringify(metaData));
          
          let fundingType = null;
          let autoReloadEnabled = false;
          let autoReloadThreshold = null;
          let balanceValue = 0;
          
          const accountStatus = metaData.account_status;
          const isAccountBlocked = accountStatus === 3 || accountStatus === 2;
          
          if (metaData.funding_source_details) {
            const fsd = metaData.funding_source_details;
            fundingType = fsd.type || null;
            
            const isPrepaidLike = fundingType === 3 || fundingType === 5 || fundingType === 20 || fundingType === 2;
            
            if (isPrepaidLike && fsd.display_string) {
              if (fsd.display_string.toLowerCase().includes('saldo') || 
                  fsd.display_string.toLowerCase().includes('available') ||
                  fsd.display_string.toLowerCase().includes('crédito')) {
                const match = fsd.display_string.match(/R\$\s*([\d.,]+)/);
                if (match) {
                  let valueStr = match[1];
                  if (valueStr.includes('.') && valueStr.includes(',')) {
                    if (valueStr.lastIndexOf(',') > valueStr.lastIndexOf('.')) {
                      valueStr = valueStr.replace(/\./g, '').replace(',', '.');
                    } else {
                      valueStr = valueStr.replace(/,/g, '');
                    }
                  } else if (valueStr.includes(',') && !valueStr.includes('.')) {
                    valueStr = valueStr.replace(',', '.');
                  }
                  balanceValue = parseFloat(valueStr) || 0;
                }
              }
            }
            
            if (fundingType === 1) {
              if (isAccountBlocked) {
                balanceValue = 0;
              } else if (metaData.balance !== undefined && metaData.balance !== null) {
                const rawBalance = typeof metaData.balance === 'string' 
                  ? parseFloat(metaData.balance) 
                  : metaData.balance;
                balanceValue = rawBalance / 100;
              }
            }
            
            if (fundingType === 4 && balanceValue === 0 && metaData.balance) {
              const rawBalance = typeof metaData.balance === 'string' 
                ? parseFloat(metaData.balance) 
                : metaData.balance;
              balanceValue = rawBalance / 100;
            }
            
            if (fsd.coupon && fsd.coupon.auto_reload_enabled) {
              autoReloadEnabled = true;
              autoReloadThreshold = fsd.coupon.auto_reload_threshold_amount 
                ? parseFloat(fsd.coupon.auto_reload_threshold_amount) / 100 
                : null;
            }
          }
          
          let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'unknown';
          if (isAccountBlocked) {
            status = 'critical';
          } else if (accountStatus === 1) {
            if (balanceValue > 0) {
              status = 'healthy';
            } else {
              status = 'warning';
            }
          } else if (accountStatus === 7 || accountStatus === 9) {
            status = 'warning';
          }
          
          accountBalance = {
            balance: balanceValue,
            currency: metaData.currency || project.currency,
            lastUpdated: new Date().toISOString(),
            daysOfSpendRemaining: null,
            status,
            fundingType,
            autoReloadEnabled,
            autoReloadThreshold,
            accountStatus,
          };

          await supabase
            .from('projects')
            .update({ 
              account_balance: balanceValue,
              account_balance_updated_at: new Date().toISOString()
            })
            .eq('id', projectId);
        }
      } catch (metaError) {
        console.log('[PREDICTIVE] Could not fetch Meta account balance:', metaError);
      }
    }

    // ========== MULTI-PERIOD DATA FETCHING ==========
    // Fetch up to 365 days of data for comprehensive analysis
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    
    const { data: allMetrics, error: metricsError } = await supabase
      .from('ads_daily_metrics')
      .select('date, spend, impressions, clicks, conversions, conversion_value, reach, campaign_id, campaign_name')
      .eq('project_id', projectId)
      .gte('date', oneYearAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (metricsError) throw metricsError;

    // Fetch campaign budgets
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, daily_budget, lifetime_budget, spend, status, conversions, conversion_value')
      .eq('project_id', projectId)
      .eq('status', 'ACTIVE');

    if (campaignsError) throw campaignsError;

    // Aggregate metrics by date
    const aggregatedByDate = allMetrics?.reduce((acc: Record<string, any>, metric) => {
      if (!acc[metric.date]) {
        acc[metric.date] = { date: metric.date, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, reach: 0 };
      }
      acc[metric.date].spend += metric.spend || 0;
      acc[metric.date].impressions += metric.impressions || 0;
      acc[metric.date].clicks += metric.clicks || 0;
      acc[metric.date].conversions += metric.conversions || 0;
      acc[metric.date].conversion_value += metric.conversion_value || 0;
      acc[metric.date].reach += metric.reach || 0;
      return acc;
    }, {}) || {};

    // Aggregate metrics by campaign (last 30 days only for campaign-level analysis)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30DaysMetrics = allMetrics?.filter(m => new Date(m.date) >= thirtyDaysAgo) || [];
    
    const campaignMetrics = last30DaysMetrics.reduce((acc: Record<string, any>, metric) => {
      if (!acc[metric.campaign_id]) {
        acc[metric.campaign_id] = { 
          campaignId: metric.campaign_id,
          campaignName: metric.campaign_name,
          spend: 0, conversions: 0, conversion_value: 0, clicks: 0, impressions: 0
        };
      }
      acc[metric.campaign_id].spend += metric.spend || 0;
      acc[metric.campaign_id].conversions += metric.conversions || 0;
      acc[metric.campaign_id].conversion_value += metric.conversion_value || 0;
      acc[metric.campaign_id].clicks += metric.clicks || 0;
      acc[metric.campaign_id].impressions += metric.impressions || 0;
      return acc;
    }, {});

    const sortedDates = Object.values(aggregatedByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // ========== MULTI-PERIOD ANALYSIS ==========
    const today = new Date();
    
    // Filter data for each period
    const getDataForLastNDays = (n: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - n);
      return sortedDates.filter((d: any) => new Date(d.date) >= cutoff);
    };

    const data7d = getDataForLastNDays(7);
    const data14d = getDataForLastNDays(14);
    const data30d = getDataForLastNDays(30);
    const data90d = getDataForLastNDays(90);
    const data365d = sortedDates; // All available data up to 1 year

    // Calculate statistics for each period
    const stats7d = calculatePeriodStats(data7d);
    const stats14d = calculatePeriodStats(data14d);
    const stats30d = calculatePeriodStats(data30d);
    const stats90d = calculatePeriodStats(data90d);
    const stats365d = calculatePeriodStats(data365d);

    console.log('[PREDICTIVE] Multi-period stats:', {
      '7d': { days: stats7d.daysWithData, avg: stats7d.avgDailySpend, trend: stats7d.trend },
      '14d': { days: stats14d.daysWithData, avg: stats14d.avgDailySpend, trend: stats14d.trend },
      '30d': { days: stats30d.daysWithData, avg: stats30d.avgDailySpend, trend: stats30d.trend },
      '90d': { days: stats90d.daysWithData, avg: stats90d.avgDailySpend, trend: stats90d.trend },
      '365d': { days: stats365d.daysWithData, avg: stats365d.avgDailySpend },
    });

    // ========== DYNAMIC WEIGHT CALCULATION ==========
    // Base weights (prioritize recent data)
    let weights = {
      w7d: 0.40,
      w14d: 0.25,
      w30d: 0.20,
      w90d: 0.10,
      w365d: 0.05,
    };

    // Adjust weights based on data availability
    if (stats90d.daysWithData < 30) {
      // Not enough 90d data, redistribute
      weights.w30d += weights.w90d * 0.6;
      weights.w14d += weights.w90d * 0.4;
      weights.w90d = 0;
    }
    if (stats365d.daysWithData < 90) {
      // Not enough yearly data
      weights.w90d += weights.w365d;
      weights.w365d = 0;
    }

    // Adjust if 7d trend diverges significantly from 30d (more than 50%)
    const trendDivergence = Math.abs(stats7d.trend - stats30d.trend);
    if (trendDivergence > 50) {
      // Big change happening - weight recent data more
      weights.w7d = 0.55;
      weights.w14d = 0.25;
      weights.w30d = 0.15;
      weights.w90d = 0.05;
      weights.w365d = 0;
    }

    // Normalize weights to sum to 1
    const totalWeight = weights.w7d + weights.w14d + weights.w30d + weights.w90d + weights.w365d;
    if (totalWeight > 0) {
      weights.w7d /= totalWeight;
      weights.w14d /= totalWeight;
      weights.w30d /= totalWeight;
      weights.w90d /= totalWeight;
      weights.w365d /= totalWeight;
    }

    console.log('[PREDICTIVE] Applied weights:', weights);

    // ========== WEIGHTED PROJECTIONS ==========
    // Calculate weighted daily averages
    const weightedAvgDailySpend = 
      stats7d.avgDailySpend * weights.w7d +
      stats14d.avgDailySpend * weights.w14d +
      stats30d.avgDailySpend * weights.w30d +
      stats90d.avgDailySpend * weights.w90d +
      stats365d.avgDailySpend * weights.w365d;

    const weightedAvgDailyConversions = 
      stats7d.avgDailyConversions * weights.w7d +
      stats14d.avgDailyConversions * weights.w14d +
      stats30d.avgDailyConversions * weights.w30d +
      stats90d.avgDailyConversions * weights.w90d +
      stats365d.avgDailyConversions * weights.w365d;

    const weightedAvgDailyRevenue = 
      stats7d.avgDailyRevenue * weights.w7d +
      stats14d.avgDailyRevenue * weights.w14d +
      stats30d.avgDailyRevenue * weights.w30d +
      stats90d.avgDailyRevenue * weights.w90d +
      stats365d.avgDailyRevenue * weights.w365d;

    // Calculate combined trend (7d vs 30d comparison for recent momentum)
    const recentVsMonthly = stats30d.avgDailySpend > 0 
      ? ((stats7d.avgDailySpend - stats30d.avgDailySpend) / stats30d.avgDailySpend) * 100 
      : 0;

    // ========== SCENARIO CALCULATION WITH PERCENTILES ==========
    // Use percentiles from 30d data for realistic ranges, weighted with 90d for stability
    const buildMultiPeriodScenario = (projectionDays: number, label: string) => {
      // For short-term (7d): weight recent data heavily
      // For medium-term (30d): balance recent with monthly
      // For long-term (EOY): use quarterly/yearly patterns
      
      let trendFactor = 1;
      if (label === '7d') {
        // Apply 7d trend for short-term
        trendFactor = 1 + (stats7d.trend / 100) * 0.5;
      } else if (label === '30d') {
        // Apply blended trend for medium-term
        const blendedTrend = (stats7d.trend * 0.4 + stats14d.trend * 0.3 + stats30d.trend * 0.3);
        trendFactor = 1 + (blendedTrend / 100) * 0.3;
      } else {
        // For EOY, use 30d/90d trend with dampening (more conservative)
        const longTermTrend = stats90d.daysWithData > 30 
          ? (stats30d.trend * 0.6 + stats90d.trend * 0.4)
          : stats30d.trend;
        trendFactor = 1 + (longTermTrend / 100) * 0.15;
      }

      // Bound trend factor to reasonable limits
      trendFactor = Math.max(0.5, Math.min(1.5, trendFactor));

      // Calculate percentile-based scenarios
      // Pessimistic: P25 values (worst 25%)
      const pessimisticSpendDaily = stats30d.daysWithData > 7 ? stats30d.p25Spend : stats7d.avgDailySpend * 0.7;
      const pessimisticConversionsDaily = stats30d.daysWithData > 7 ? stats30d.p25Conversions : stats7d.avgDailyConversions * 0.6;
      const pessimisticRevenueDaily = stats30d.daysWithData > 7 ? stats30d.p25Revenue : stats7d.avgDailyRevenue * 0.6;

      // Realistic: Weighted average with trend applied
      const realisticSpendDaily = weightedAvgDailySpend * trendFactor;
      const realisticConversionsDaily = weightedAvgDailyConversions * trendFactor;
      const realisticRevenueDaily = weightedAvgDailyRevenue * trendFactor;

      // Optimistic: P75 values (best 25%) with positive trend boost
      const optimisticMultiplier = trendFactor > 1 ? trendFactor : 1;
      const optimisticSpendDaily = (stats30d.daysWithData > 7 ? stats30d.p75Spend : stats7d.avgDailySpend * 1.3) * optimisticMultiplier;
      const optimisticConversionsDaily = (stats30d.daysWithData > 7 ? stats30d.p75Conversions : stats7d.avgDailyConversions * 1.4) * optimisticMultiplier;
      const optimisticRevenueDaily = (stats30d.daysWithData > 7 ? stats30d.p75Revenue : stats7d.avgDailyRevenue * 1.4) * optimisticMultiplier;

      return {
        pessimistic: {
          spend: Math.max(0, pessimisticSpendDaily * projectionDays),
          conversions: Math.round(Math.max(0, pessimisticConversionsDaily * projectionDays)),
          revenue: Math.max(0, pessimisticRevenueDaily * projectionDays),
        },
        realistic: {
          spend: realisticSpendDaily * projectionDays,
          conversions: Math.round(realisticConversionsDaily * projectionDays),
          revenue: realisticRevenueDaily * projectionDays,
        },
        optimistic: {
          spend: optimisticSpendDaily * projectionDays,
          conversions: Math.round(optimisticConversionsDaily * projectionDays),
          revenue: optimisticRevenueDaily * projectionDays,
        },
      };
    };

    // Calculate days until end of year
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const daysUntilEndOfYear = Math.ceil((endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Build scenarios for each timeframe
    const scenario7Days = buildMultiPeriodScenario(7, '7d');
    const scenario30Days = buildMultiPeriodScenario(30, '30d');
    const scenarioEndOfYear = buildMultiPeriodScenario(daysUntilEndOfYear, 'eoy');

    // ========== CONFIDENCE LEVEL CALCULATION ==========
    // Score based on multiple factors
    let confidenceScore = 100;
    
    // Factor 1: Data availability (0-30 points)
    const dataAvailabilityScore = Math.min(30, (stats30d.daysWithData / 30) * 30);
    confidenceScore = dataAvailabilityScore;
    
    // Factor 2: Consistency across periods (0-30 points)
    // Check if 7d, 14d, 30d point in same direction
    const sameDirection = 
      (stats7d.trend >= 0 && stats14d.trend >= 0 && stats30d.trend >= 0) ||
      (stats7d.trend < 0 && stats14d.trend < 0 && stats30d.trend < 0);
    confidenceScore += sameDirection ? 30 : 15;
    
    // Factor 3: Low volatility (0-25 points)
    const avgCV = (stats7d.coefficientOfVariation + stats14d.coefficientOfVariation + stats30d.coefficientOfVariation) / 3;
    const volatilityScore = Math.max(0, 25 - (avgCV / 4));
    confidenceScore += volatilityScore;
    
    // Factor 4: Sufficient conversion volume (0-15 points)
    const conversionVolumeScore = Math.min(15, (stats30d.totalConversions / 50) * 15);
    confidenceScore += conversionVolumeScore;

    const confidenceLevel: 'alta' | 'média' | 'baixa' = 
      confidenceScore >= 70 ? 'alta' : 
      confidenceScore >= 45 ? 'média' : 'baixa';

    // Determine trend direction based on 7d vs 30d comparison
    const trendDirection: 'crescente' | 'decrescente' | 'estável' = 
      recentVsMonthly > 10 ? 'crescente' : 
      recentVsMonthly < -10 ? 'decrescente' : 'estável';

    // Account balance days remaining calculation
    if (accountBalance.balance > 0 && stats7d.avgDailySpend > 0) {
      accountBalance.daysOfSpendRemaining = Math.floor(accountBalance.balance / stats7d.avgDailySpend);
      if (accountBalance.daysOfSpendRemaining <= 3) accountBalance.status = 'critical';
      else if (accountBalance.daysOfSpendRemaining <= 7) accountBalance.status = 'warning';
      else accountBalance.status = 'healthy';
    }

    // ========== CAMPAIGN GOALS PROGRESS ==========
    const campaignGoalsProgress = Object.values(campaignMetrics).map((metrics: any) => {
      const cpl = metrics.conversions > 0 ? metrics.spend / metrics.conversions : null;
      const roas = metrics.spend > 0 ? metrics.conversion_value / metrics.spend : null;
      const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : null;
      
      const customGoal = campaignGoals?.find((g: CampaignGoal) => g.campaignId === metrics.campaignId);
      const defaultRoasTarget = project.business_model === 'ecommerce' ? 3 : 2;
      const defaultCplTarget = project.business_model === 'inside_sales' ? 30 : 50;
      
      const targetRoas = customGoal?.targetRoas || defaultRoasTarget;
      const targetCpl = customGoal?.targetCpl || defaultCplTarget;
      
      return {
        ...metrics,
        cpl, roas, ctr,
        targetRoas, targetCpl,
        roasProgress: roas !== null ? Math.min((roas / targetRoas) * 100, 150) : null,
        cplProgress: cpl !== null ? Math.min((targetCpl / cpl) * 100, 150) : null,
        roasStatus: roas !== null ? (roas >= targetRoas ? 'success' : roas >= targetRoas * 0.7 ? 'warning' : 'critical') : 'unknown',
        cplStatus: cpl !== null ? (cpl <= targetCpl ? 'success' : cpl <= targetCpl * 1.3 ? 'warning' : 'critical') : 'unknown',
      };
    });

    // ========== BUDGET ALERTS ==========
    const budgetAlerts = campaigns?.map(campaign => {
      const dailyBudget = campaign.daily_budget || 0;
      const lifetimeBudget = campaign.lifetime_budget || 0;
      const currentSpend = campaign.spend || 0;
      
      let daysRemaining = null;
      let budgetStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (lifetimeBudget > 0 && stats7d.avgDailySpend > 0) {
        const remainingBudget = lifetimeBudget - currentSpend;
        daysRemaining = Math.floor(remainingBudget / stats7d.avgDailySpend);
        
        if (daysRemaining <= 3) budgetStatus = 'critical';
        else if (daysRemaining <= 7) budgetStatus = 'warning';
      }

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        dailyBudget, lifetimeBudget, currentSpend,
        daysRemaining, budgetStatus,
        percentUsed: lifetimeBudget > 0 ? (currentSpend / lifetimeBudget) * 100 : null
      };
    }) || [];

    // ========== BUILD PREDICTIONS RESPONSE ==========
    const predictions = {
      next7Days: {
        estimatedSpend: scenario7Days.realistic.spend,
        estimatedConversions: scenario7Days.realistic.conversions,
        estimatedRevenue: scenario7Days.realistic.revenue,
        scenarios: scenario7Days,
      },
      next30Days: {
        estimatedSpend: scenario30Days.realistic.spend,
        estimatedConversions: scenario30Days.realistic.conversions,
        estimatedRevenue: scenario30Days.realistic.revenue,
        scenarios: scenario30Days,
      },
      endOfYear: {
        daysRemaining: daysUntilEndOfYear,
        estimatedSpend: scenarioEndOfYear.realistic.spend,
        estimatedConversions: scenarioEndOfYear.realistic.conversions,
        estimatedRevenue: scenarioEndOfYear.realistic.revenue,
        scenarios: scenarioEndOfYear,
      },
      trends: {
        spendTrend: recentVsMonthly,
        avgDailySpend: stats7d.avgDailySpend,
        avgDailyConversions: stats7d.avgDailyConversions,
        avgDailyRevenue: stats7d.avgDailyRevenue,
        avgDailyCpl: stats7d.avgDailyConversions > 0 ? stats7d.avgDailySpend / stats7d.avgDailyConversions : null,
        avgDailyRoas: stats7d.avgDailySpend > 0 ? stats7d.avgDailyRevenue / stats7d.avgDailySpend : null,
        avgCtr: stats7d.avgDailyImpressions > 0 ? (stats7d.avgDailyClicks / stats7d.avgDailyImpressions) * 100 : null,
        stdDevSpend: stats7d.stdDevSpend,
        stdDevConversions: stats7d.stdDevConversions,
        stdDevRevenue: stats7d.stdDevRevenue,
        confidenceLevel,
        confidenceScore: Math.round(confidenceScore),
        trendDirection,
      },
      // NEW: Multi-period analysis data
      periodAnalysis: {
        periods: {
          '7d': {
            label: '7 dias',
            daysWithData: stats7d.daysWithData,
            avgDailySpend: stats7d.avgDailySpend,
            avgDailyConversions: stats7d.avgDailyConversions,
            avgDailyRevenue: stats7d.avgDailyRevenue,
            trend: stats7d.trend,
            cpl: stats7d.avgDailyConversions > 0 ? stats7d.avgDailySpend / stats7d.avgDailyConversions : null,
            roas: stats7d.avgDailySpend > 0 ? stats7d.avgDailyRevenue / stats7d.avgDailySpend : null,
            cv: stats7d.coefficientOfVariation,
          },
          '14d': {
            label: '14 dias',
            daysWithData: stats14d.daysWithData,
            avgDailySpend: stats14d.avgDailySpend,
            avgDailyConversions: stats14d.avgDailyConversions,
            avgDailyRevenue: stats14d.avgDailyRevenue,
            trend: stats14d.trend,
            cpl: stats14d.avgDailyConversions > 0 ? stats14d.avgDailySpend / stats14d.avgDailyConversions : null,
            roas: stats14d.avgDailySpend > 0 ? stats14d.avgDailyRevenue / stats14d.avgDailySpend : null,
            cv: stats14d.coefficientOfVariation,
          },
          '30d': {
            label: '30 dias',
            daysWithData: stats30d.daysWithData,
            avgDailySpend: stats30d.avgDailySpend,
            avgDailyConversions: stats30d.avgDailyConversions,
            avgDailyRevenue: stats30d.avgDailyRevenue,
            trend: stats30d.trend,
            cpl: stats30d.avgDailyConversions > 0 ? stats30d.avgDailySpend / stats30d.avgDailyConversions : null,
            roas: stats30d.avgDailySpend > 0 ? stats30d.avgDailyRevenue / stats30d.avgDailySpend : null,
            cv: stats30d.coefficientOfVariation,
          },
          '90d': {
            label: '90 dias',
            daysWithData: stats90d.daysWithData,
            avgDailySpend: stats90d.avgDailySpend,
            avgDailyConversions: stats90d.avgDailyConversions,
            avgDailyRevenue: stats90d.avgDailyRevenue,
            trend: stats90d.trend,
            cpl: stats90d.avgDailyConversions > 0 ? stats90d.avgDailySpend / stats90d.avgDailyConversions : null,
            roas: stats90d.avgDailySpend > 0 ? stats90d.avgDailyRevenue / stats90d.avgDailySpend : null,
            cv: stats90d.coefficientOfVariation,
          },
        },
        appliedWeights: weights,
        weightedDailyAverage: {
          spend: weightedAvgDailySpend,
          conversions: weightedAvgDailyConversions,
          revenue: weightedAvgDailyRevenue,
        },
        dataQuality: {
          totalDaysAvailable: stats365d.daysWithData,
          hasEnoughData: stats30d.daysWithData >= 14,
          consistencyScore: sameDirection ? 'consistent' : 'divergent',
        },
      },
    };

    // Calculate totals for context (from 30d data)
    const totals = {
      spend30Days: stats30d.totalSpend,
      conversions30Days: stats30d.totalConversions,
      revenue30Days: stats30d.totalRevenue,
      clicks30Days: data30d.reduce((sum: number, d: any) => sum + d.clicks, 0),
      impressions30Days: data30d.reduce((sum: number, d: any) => sum + d.impressions, 0),
    };

    // ========== AI SUGGESTIONS ==========
    let aiSuggestions: { title: string; description: string; reason: string; priority: 'high' | 'medium' | 'low' }[] = [];
    
    if (lovableApiKey) {
      const contextData = {
        projectName: project.name,
        businessModel: project.business_model,
        currency: project.currency,
        accountBalance,
        periodAnalysis: predictions.periodAnalysis,
        trends: predictions.trends,
        totals,
        campaignPerformance: campaignGoalsProgress.slice(0, 10),
        budgetAlerts: budgetAlerts.filter(b => b.budgetStatus !== 'healthy'),
        activeCampaignsCount: campaigns?.length || 0,
      };

      const systemPrompt = `Você é um especialista em tráfego pago e análise de dados de marketing digital.
Analise os dados MULTI-PERÍODO fornecidos e gere exatamente 5 sugestões de otimização ESPECÍFICAS e ACIONÁVEIS.

DADOS DISPONÍVEIS:
- Análise de 7, 14, 30 e 90 dias com tendências e médias
- Pesos aplicados: quanto maior o peso de 7d, mais o cenário está mudando
- Score de confiança baseado em consistência dos dados
- Comparação de performance entre períodos

IMPORTANTE:
- Compare períodos! Ex: "Investimento dos últimos 7 dias está 20% acima da média de 30 dias"
- Identifique padrões: "Tendência crescente em 7d e 14d indica momentum positivo"
- Cite números específicos de cada período quando relevante
- Alerte sobre divergências: "Performance recente diverge do padrão trimestral"
- Use linguagem preditiva: "Projetamos", "Estimamos", "Tendência indica"

Formato de resposta (JSON array estrito):
[
  {
    "title": "Título curto da ação (máx 50 chars)",
    "description": "Descrição detalhada da ação a tomar (máx 150 chars)",
    "reason": "Por que esta sugestão? Compare períodos, cite dados específicos (máx 120 chars)",
    "priority": "high|medium|low"
  }
]

Responda APENAS com o JSON array, sem texto adicional.`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: JSON.stringify(contextData) }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '[]';
          try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            aiSuggestions = JSON.parse(cleanContent);
          } catch {
            console.log('Failed to parse AI suggestions, using fallback');
          }
        }
      } catch (aiError) {
        console.error('AI suggestion error:', aiError);
      }
    }

    if (aiSuggestions.length === 0) {
      aiSuggestions = generateDetailedFallbackSuggestions(predictions, budgetAlerts, accountBalance, campaignGoalsProgress, project.business_model, project.currency);
    }

    const result = {
      project: {
        id: project.id,
        name: project.name,
        businessModel: project.business_model,
        currency: project.currency,
      },
      accountBalance,
      predictions,
      totals,
      budgetAlerts,
      campaignGoalsProgress,
      dailyTrend: data30d, // Last 30 days for chart
      suggestions: aiSuggestions,
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Predictive analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateDetailedFallbackSuggestions(
  predictions: any, 
  budgetAlerts: any[], 
  accountBalance: any,
  campaignGoals: any[],
  businessModel: string,
  currency: string
): { title: string; description: string; reason: string; priority: 'high' | 'medium' | 'low' }[] {
  const suggestions: { title: string; description: string; reason: string; priority: 'high' | 'medium' | 'low' }[] = [];
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2)}`;
  
  // Account balance critical
  if (accountBalance.status === 'critical') {
    suggestions.push({
      title: '🚨 Recarregar saldo da conta URGENTE',
      description: `Saldo atual: ${formatCurrency(accountBalance.balance)}. Adicione créditos para não pausar campanhas.`,
      reason: `Apenas ${accountBalance.daysOfSpendRemaining} dias de saldo restante com gasto médio atual`,
      priority: 'high'
    });
  } else if (accountBalance.status === 'warning') {
    suggestions.push({
      title: '⚠️ Saldo da conta baixo',
      description: `Saldo: ${formatCurrency(accountBalance.balance)}. Programe uma recarga para os próximos dias.`,
      reason: `${accountBalance.daysOfSpendRemaining} dias de saldo restante`,
      priority: 'medium'
    });
  }

  // Period comparison alerts
  const periodAnalysis = predictions.periodAnalysis;
  if (periodAnalysis) {
    const p7d = periodAnalysis.periods['7d'];
    const p30d = periodAnalysis.periods['30d'];
    
    if (p7d && p30d && p30d.avgDailySpend > 0) {
      const spendChange = ((p7d.avgDailySpend - p30d.avgDailySpend) / p30d.avgDailySpend) * 100;
      
      if (spendChange > 30) {
        suggestions.push({
          title: '📈 Investimento aumentou significativamente',
          description: 'Monitore de perto o retorno para garantir que o investimento extra gera resultados proporcionais.',
          reason: `Gasto diário subiu ${spendChange.toFixed(0)}%: de ${formatCurrency(p30d.avgDailySpend)} para ${formatCurrency(p7d.avgDailySpend)}`,
          priority: 'medium'
        });
      } else if (spendChange < -30) {
        suggestions.push({
          title: '📉 Investimento caiu nos últimos 7 dias',
          description: 'Verifique se há campanhas pausadas ou problemas de entrega nos anúncios.',
          reason: `Gasto diário caiu ${Math.abs(spendChange).toFixed(0)}%: de ${formatCurrency(p30d.avgDailySpend)} para ${formatCurrency(p7d.avgDailySpend)}`,
          priority: 'high'
        });
      }
    }
  }

  // Budget alerts
  const criticalAlerts = budgetAlerts.filter(b => b.budgetStatus === 'critical');
  if (criticalAlerts.length > 0) {
    suggestions.push({
      title: '⚠️ Campanhas com orçamento crítico',
      description: `${criticalAlerts.length} campanha(s) vão ficar sem budget em breve. Revise ou aumente orçamentos.`,
      reason: `${criticalAlerts.map(a => a.campaignName.slice(0, 20)).join(', ')} com <3 dias`,
      priority: 'high'
    });
  }

  // Performance based on business model
  if (businessModel === 'ecommerce') {
    const roas = predictions.trends.avgDailyRoas;
    if (roas !== null) {
      if (roas < 2) {
        suggestions.push({
          title: '📉 ROAS abaixo do ideal',
          description: 'Revise públicos, criativos ou landing pages para melhorar retorno.',
          reason: `ROAS atual: ${roas.toFixed(2)}x - Meta recomendada: 3x ou superior`,
          priority: 'high'
        });
      } else if (roas > 4) {
        suggestions.push({
          title: '🚀 Oportunidade de escalar',
          description: `ROAS excelente! Considere aumentar budget em 20-30% gradualmente.`,
          reason: `ROAS de ${roas.toFixed(2)}x está muito acima da meta de 3x`,
          priority: 'medium'
        });
      }
    }
  } else {
    const cpl = predictions.trends.avgDailyCpl;
    if (cpl !== null) {
      if (cpl > 50) {
        suggestions.push({
          title: '💰 CPL acima do ideal',
          description: 'Teste novos públicos ou otimize suas landing pages para conversão.',
          reason: `CPL atual: ${formatCurrency(cpl)} - Meta recomendada: R$ 30`,
          priority: 'high'
        });
      } else if (cpl < 20) {
        suggestions.push({
          title: '🚀 CPL excelente - escale!',
          description: 'Oportunidade de aumentar investimento mantendo qualidade.',
          reason: `CPL de ${formatCurrency(cpl)} está bem abaixo da meta de R$ 30`,
          priority: 'medium'
        });
      }
    }
  }

  // CTR analysis
  if (predictions.trends.avgCtr !== null && predictions.trends.avgCtr < 1) {
    suggestions.push({
      title: '🎨 CTR abaixo da média',
      description: 'Renove criativos e teste novos formatos para aumentar engajamento.',
      reason: `CTR atual: ${predictions.trends.avgCtr.toFixed(2)}% - Média do mercado: 1-2%`,
      priority: 'low'
    });
  }

  // Generic if needed
  while (suggestions.length < 3) {
    const generics = [
      {
        title: '🔄 Teste A/B de criativos',
        description: 'Testes regulares podem melhorar performance em até 30%.',
        reason: 'Prática recomendada: renove criativos a cada 2-3 semanas',
        priority: 'low' as const
      },
      {
        title: '⏰ Otimize horários de veiculação',
        description: 'Analise quando seu público converte mais e concentre budget.',
        reason: 'Distribuição inteligente pode reduzir CPL em até 20%',
        priority: 'low' as const
      },
    ];
    suggestions.push(generics[suggestions.length % generics.length]);
  }

  return suggestions.slice(0, 5);
}
