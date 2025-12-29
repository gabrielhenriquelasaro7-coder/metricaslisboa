import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdSetDailyMetric {
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

interface UseAdSetDailyMetricsResult {
  dailyData: AdSetDailyMetric[];
  loading: boolean;
  error: Error | null;
}

export function useAdSetDailyMetrics(
  adSetId: string | undefined,
  projectId: string | undefined
): UseAdSetDailyMetricsResult {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!adSetId || !projectId) {
      setRawData([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get last 30 days of data for this ad set
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const since = thirtyDaysAgo.toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('ads_daily_metrics')
          .select('*')
          .eq('project_id', projectId)
          .eq('adset_id', adSetId)
          .gte('date', since)
          .order('date', { ascending: true });

        if (fetchError) throw fetchError;
        setRawData(data || []);
      } catch (err) {
        console.error('[useAdSetDailyMetrics] Error:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [adSetId, projectId]);

  // Aggregate by date (sum all ads in the ad set for each day)
  const dailyData = useMemo(() => {
    if (!rawData.length) return [];

    const byDate: Record<string, AdSetDailyMetric> = {};

    rawData.forEach((row) => {
      const date = row.date;
      if (!byDate[date]) {
        byDate[date] = {
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
        };
      }
      byDate[date].spend += row.spend || 0;
      byDate[date].impressions += row.impressions || 0;
      byDate[date].clicks += row.clicks || 0;
      byDate[date].reach += row.reach || 0;
      byDate[date].conversions += row.conversions || 0;
      byDate[date].conversion_value += row.conversion_value || 0;
    });

    // Calculate derived metrics for each day
    return Object.values(byDate).map((day) => ({
      ...day,
      ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
      cpm: day.impressions > 0 ? (day.spend / day.impressions) * 1000 : 0,
      cpc: day.clicks > 0 ? day.spend / day.clicks : 0,
      roas: day.spend > 0 ? day.conversion_value / day.spend : 0,
      cpa: day.conversions > 0 ? day.spend / day.conversions : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [rawData]);

  return { dailyData, loading, error };
}