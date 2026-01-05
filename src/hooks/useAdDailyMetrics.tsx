import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export interface AdDailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversion_value: number;
  profile_visits: number;
  ctr: number;
  cpm: number;
  cpc: number;
  roas: number;
  cpa: number;
}

interface UseAdDailyMetricsResult {
  dailyData: AdDailyMetric[];
  totals: AdDailyMetric | null;
  loading: boolean;
  error: Error | null;
}

export function useAdDailyMetrics(
  adId: string | undefined,
  projectId: string | undefined,
  dateRange?: DateRange
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
        // Determine date range
        let since: string;
        let until: string;
        
        if (dateRange?.from && dateRange?.to) {
          // Use custom date range
          since = format(dateRange.from, 'yyyy-MM-dd');
          until = format(dateRange.to, 'yyyy-MM-dd');
          console.log(`[useAdDailyMetrics] Using custom range: ${since} to ${until}`);
        } else {
          // Default: last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          since = thirtyDaysAgo.toISOString().split('T')[0];
          until = new Date().toISOString().split('T')[0];
          console.log(`[useAdDailyMetrics] Using default 30 days: ${since} to ${until}`);
        }

        const { data, error: fetchError } = await supabase
          .from('ads_daily_metrics')
          .select('*')
          .eq('project_id', projectId)
          .eq('ad_id', adId)
          .gte('date', since)
          .lte('date', until)
          .order('date', { ascending: true });

        if (fetchError) throw fetchError;
        setRawData(data || []);
        console.log(`[useAdDailyMetrics] Loaded ${data?.length || 0} records for ad ${adId}`);
      } catch (err) {
        console.error('[useAdDailyMetrics] Error:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [adId, projectId, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

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
      profile_visits: row.profile_visits || 0,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
      cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
      cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
      roas: row.spend > 0 ? row.conversion_value / row.spend : 0,
      cpa: row.conversions > 0 ? row.spend / row.conversions : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [rawData]);

  // Calculate totals from daily data
  const totals = useMemo(() => {
    if (!dailyData.length) return null;
    
    const sum = dailyData.reduce((acc, d) => ({
      date: '',
      spend: acc.spend + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      reach: acc.reach + d.reach,
      conversions: acc.conversions + d.conversions,
      conversion_value: acc.conversion_value + d.conversion_value,
      profile_visits: acc.profile_visits + d.profile_visits,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      roas: 0,
      cpa: 0,
    }), { date: '', spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, profile_visits: 0, ctr: 0, cpm: 0, cpc: 0, roas: 0, cpa: 0 });
    
    // Calculate derived metrics
    sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
    sum.cpm = sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : 0;
    sum.cpc = sum.clicks > 0 ? sum.spend / sum.clicks : 0;
    sum.roas = sum.spend > 0 ? sum.conversion_value / sum.spend : 0;
    sum.cpa = sum.conversions > 0 ? sum.spend / sum.conversions : 0;
    
    return sum;
  }, [dailyData]);

  return { dailyData, totals, loading, error };
}