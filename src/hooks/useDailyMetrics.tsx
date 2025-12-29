import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DatePresetKey } from '@/utils/dateUtils';

export interface DailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpm: number;
  cpc: number;
  roas: number;
  cpa: number;
}

export interface PeriodComparison {
  current: DailyMetric[];
  previous: DailyMetric[];
  currentTotals: DailyMetric;
  previousTotals: DailyMetric;
  changes: {
    spend: number;
    conversions: number;
    roas: number;
    cpa: number;
    ctr: number;
    revenue: number;
  };
}

// Calculate date range based on preset
function getDateRangeFromPeriod(preset: DatePresetKey) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  
  switch (preset) {
    case 'yesterday':
      return { since: yesterday, until: yesterday, days: 1 };
    case 'last_7d':
      return { since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday, days: 7 };
    case 'last_14d':
      return { since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday, days: 14 };
    case 'last_30d':
      return { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday, days: 30 };
    case 'last_60d':
      return { since: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday, days: 60 };
    case 'last_90d':
      return { since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday, days: 90 };
    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: firstDay.toISOString().split('T')[0], until: today, days: Math.ceil((now.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000)) };
    }
    case 'this_year': {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      return { since: firstDay.toISOString().split('T')[0], until: today, days: Math.ceil((now.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000)) };
    }
    default:
      return { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: today, days: 30 };
  }
}

// Get previous period dates - equivalent period before the current one
function getPreviousPeriodDates(since: string, until: string, days: number) {
  // The previous period should have the same number of days
  // and end the day before the current period starts
  const currentSince = new Date(since);
  const currentUntil = new Date(until);
  
  // Calculate actual days in current period (inclusive)
  const actualDays = Math.round((currentUntil.getTime() - currentSince.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  // Previous period ends 1 day before current starts
  const previousUntil = new Date(currentSince);
  previousUntil.setDate(previousUntil.getDate() - 1);
  
  // Previous period starts (actualDays - 1) days before previousUntil
  const previousSince = new Date(previousUntil);
  previousSince.setDate(previousSince.getDate() - actualDays + 1);
  
  return {
    since: previousSince.toISOString().split('T')[0],
    until: previousUntil.toISOString().split('T')[0],
  };
}

// Aggregate daily rows
function aggregateDaily(rows: any[]): DailyMetric[] {
  const dailyMap = new Map<string, DailyMetric>();
  
  for (const row of rows) {
    const date = row.date;
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        conversions: 0,
        conversion_value: 0,
        ctr: 0,
        cpm: 0,
        cpc: 0,
        roas: 0,
        cpa: 0,
      });
    }
    
    const agg = dailyMap.get(date)!;
    agg.spend += Number(row.spend) || 0;
    agg.impressions += Number(row.impressions) || 0;
    agg.clicks += Number(row.clicks) || 0;
    agg.reach += Number(row.reach) || 0;
    agg.conversions += Number(row.conversions) || 0;
    agg.conversion_value += Number(row.conversion_value) || 0;
  }
  
  // Calculate derived metrics
  const result = Array.from(dailyMap.values()).map(d => ({
    ...d,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
    cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
    roas: d.spend > 0 ? d.conversion_value / d.spend : 0,
    cpa: d.conversions > 0 ? d.spend / d.conversions : 0,
  }));
  
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// Calculate totals
function calculateTotals(data: DailyMetric[]): DailyMetric {
  const totals = data.reduce(
    (acc, d) => ({
      date: '',
      spend: acc.spend + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      reach: acc.reach + d.reach,
      conversions: acc.conversions + d.conversions,
      conversion_value: acc.conversion_value + d.conversion_value,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      roas: 0,
      cpa: 0,
    }),
    { date: '', spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, ctr: 0, cpm: 0, cpc: 0, roas: 0, cpa: 0 }
  );
  
  // Calculate derived
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  totals.roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0;
  totals.cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  
  return totals;
}

// Calculate percentage change
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function useDailyMetrics(projectId: string | undefined, preset: DatePresetKey) {
  const [dailyData, setDailyData] = useState<DailyMetric[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDailyMetrics = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { since, until, days } = getDateRangeFromPeriod(preset);
      const previousDates = getPreviousPeriodDates(since, until, days);
      
      console.log(`[DailyMetrics] Loading: ${since} to ${until} (${days} days)`);
      console.log(`[DailyMetrics] Previous: ${previousDates.since} to ${previousDates.until}`);
      
      // Fetch current and previous period in parallel - no limit to get all data
      const [currentResult, previousResult] = await Promise.all([
        supabase
          .from('ads_daily_metrics')
          .select('date, spend, impressions, clicks, reach, conversions, conversion_value')
          .eq('project_id', projectId)
          .gte('date', since)
          .lte('date', until)
          .order('date', { ascending: true })
          .limit(10000),
        supabase
          .from('ads_daily_metrics')
          .select('date, spend, impressions, clicks, reach, conversions, conversion_value')
          .eq('project_id', projectId)
          .gte('date', previousDates.since)
          .lte('date', previousDates.until)
          .order('date', { ascending: true })
          .limit(10000),
      ]);
      
      if (currentResult.error) {
        console.error('[DailyMetrics] Current period error:', currentResult.error);
      }
      if (previousResult.error) {
        console.error('[DailyMetrics] Previous period error:', previousResult.error);
      }
      
      console.log(`[DailyMetrics] Raw current rows: ${currentResult.data?.length || 0}`);
      console.log(`[DailyMetrics] Raw previous rows: ${previousResult.data?.length || 0}`);
      
      const currentData = aggregateDaily(currentResult.data || []);
      const previousData = aggregateDaily(previousResult.data || []);
      
      const currentTotals = calculateTotals(currentData);
      const previousTotals = calculateTotals(previousData);
      
      setDailyData(currentData);
      setComparison({
        current: currentData,
        previous: previousData,
        currentTotals,
        previousTotals,
        changes: {
          spend: calculateChange(currentTotals.spend, previousTotals.spend),
          conversions: calculateChange(currentTotals.conversions, previousTotals.conversions),
          roas: calculateChange(currentTotals.roas, previousTotals.roas),
          cpa: calculateChange(currentTotals.cpa, previousTotals.cpa),
          ctr: calculateChange(currentTotals.ctr, previousTotals.ctr),
          revenue: calculateChange(currentTotals.conversion_value, previousTotals.conversion_value),
        },
      });
      
      console.log(`[DailyMetrics] Loaded ${currentData.length} days current, ${previousData.length} days previous`);
    } catch (error) {
      console.error('Error loading daily metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, preset]);

  useEffect(() => {
    loadDailyMetrics();
  }, [loadDailyMetrics]);

  return { dailyData, comparison, loading, refetch: loadDailyMetrics };
}
