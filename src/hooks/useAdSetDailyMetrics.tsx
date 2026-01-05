import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';

export interface AdSetDailyMetric {
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

export interface AdSetAggregatedMetrics {
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

interface UseAdSetDailyMetricsResult {
  dailyData: AdSetDailyMetric[];
  aggregated: AdSetAggregatedMetrics;
  loading: boolean;
  error: Error | null;
}

export function useAdSetDailyMetrics(
  adSetId: string | undefined,
  projectId: string | undefined,
  dateRange?: DateRange
): UseAdSetDailyMetricsResult {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Format date range for query
  const since = dateRange?.from ? dateRange.from.toISOString().split('T')[0] : undefined;
  const until = dateRange?.to ? dateRange.to.toISOString().split('T')[0] : undefined;

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
        let query = supabase
          .from('ads_daily_metrics')
          .select('*')
          .eq('project_id', projectId)
          .eq('adset_id', adSetId)
          .order('date', { ascending: true });

        // Apply date filters if provided
        if (since) {
          query = query.gte('date', since);
        }
        if (until) {
          query = query.lte('date', until);
        }

        const { data, error: fetchError } = await query;

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
  }, [adSetId, projectId, since, until]);

  // Aggregate by date (sum all ads in the ad set for each day)
  const { dailyData, aggregated } = useMemo(() => {
    if (!rawData.length) {
      return {
        dailyData: [],
        aggregated: {
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          conversions: 0, conversion_value: 0, profile_visits: 0,
          ctr: 0, cpm: 0, cpc: 0, roas: 0, cpa: 0,
        }
      };
    }

    const byDate: Record<string, AdSetDailyMetric> = {};
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0;
    let totalReach = 0, totalConversions = 0, totalConversionValue = 0;
    let totalProfileVisits = 0;

    rawData.forEach((row) => {
      const date = row.date;
      if (!byDate[date]) {
        byDate[date] = {
          date,
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          conversions: 0, conversion_value: 0, profile_visits: 0,
          ctr: 0, cpm: 0, cpc: 0, roas: 0, cpa: 0,
        };
      }
      byDate[date].spend += row.spend || 0;
      byDate[date].impressions += row.impressions || 0;
      byDate[date].clicks += row.clicks || 0;
      byDate[date].reach += row.reach || 0;
      byDate[date].conversions += row.conversions || 0;
      byDate[date].conversion_value += row.conversion_value || 0;
      byDate[date].profile_visits += row.profile_visits || 0;

      // Accumulate totals
      totalSpend += row.spend || 0;
      totalImpressions += row.impressions || 0;
      totalClicks += row.clicks || 0;
      totalReach += row.reach || 0;
      totalConversions += row.conversions || 0;
      totalConversionValue += row.conversion_value || 0;
      totalProfileVisits += row.profile_visits || 0;
    });

    // Calculate derived metrics for each day
    const dailyData = Object.values(byDate).map((day) => ({
      ...day,
      ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
      cpm: day.impressions > 0 ? (day.spend / day.impressions) * 1000 : 0,
      cpc: day.clicks > 0 ? day.spend / day.clicks : 0,
      roas: day.spend > 0 ? day.conversion_value / day.spend : 0,
      cpa: day.conversions > 0 ? day.spend / day.conversions : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate aggregated metrics for the period
    const aggregated: AdSetAggregatedMetrics = {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      reach: totalReach,
      conversions: totalConversions,
      conversion_value: totalConversionValue,
      profile_visits: totalProfileVisits,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
      cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
    };

    return { dailyData, aggregated };
  }, [rawData]);

  return { dailyData, aggregated, loading, error };
}
