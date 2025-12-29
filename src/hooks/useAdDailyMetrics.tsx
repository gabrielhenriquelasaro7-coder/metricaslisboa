import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdDailyMetric {
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

interface UseAdDailyMetricsResult {
  dailyData: AdDailyMetric[];
  loading: boolean;
  error: Error | null;
}

export function useAdDailyMetrics(
  adId: string | undefined,
  projectId: string | undefined
): UseAdDailyMetricsResult {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!adId || !projectId) {
      setRawData([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get last 30 days of data for this ad
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const since = thirtyDaysAgo.toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('ads_daily_metrics')
          .select('*')
          .eq('project_id', projectId)
          .eq('ad_id', adId)
          .gte('date', since)
          .order('date', { ascending: true });

        if (fetchError) throw fetchError;
        setRawData(data || []);
      } catch (err) {
        console.error('[useAdDailyMetrics] Error:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [adId, projectId]);

  // Transform data (each row is already a single day for a single ad)
  const dailyData = useMemo(() => {
    if (!rawData.length) return [];

    return rawData.map((row) => ({
      date: row.date,
      spend: row.spend || 0,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      reach: row.reach || 0,
      conversions: row.conversions || 0,
      conversion_value: row.conversion_value || 0,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
      cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
      cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
      roas: row.spend > 0 ? row.conversion_value / row.spend : 0,
      cpa: row.conversions > 0 ? row.spend / row.conversions : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [rawData]);

  return { dailyData, loading, error };
}
