import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PDFMetric {
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
  frequency: number;
}

export interface PDFMetricsTotals {
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
  frequency: number;
}

function aggregateDaily(rows: any[]): PDFMetric[] {
  const dailyMap = new Map<string, PDFMetric>();
  
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
        frequency: 0,
      });
    }
    
    const agg = dailyMap.get(date)!;
    agg.spend += Number(row.spend) || 0;
    agg.impressions += Number(row.impressions) || 0;
    agg.clicks += Number(row.clicks) || 0;
    agg.reach += Number(row.reach) || 0;
    agg.conversions += Number(row.conversions) || 0;
    agg.conversion_value += Number(row.conversion_value) || 0;
    agg.frequency += Number(row.frequency) || 0;
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

function calculateTotals(data: PDFMetric[]): PDFMetricsTotals {
  const totals = data.reduce(
    (acc, d) => ({
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
      frequency: acc.frequency + d.frequency,
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, ctr: 0, cpm: 0, cpc: 0, roas: 0, cpa: 0, frequency: 0 }
  );
  
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  totals.roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0;
  totals.cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  totals.frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;
  
  return totals;
}

export function usePDFMetrics(projectId: string | undefined) {
  const [dailyData, setDailyData] = useState<PDFMetric[]>([]);
  const [totals, setTotals] = useState<PDFMetricsTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<{ since: string; until: string } | null>(null);

  const loadMetrics = useCallback(async (since: string, until: string) => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      console.log(`[PDFMetrics] Loading: ${since} to ${until}`);
      
      const { data, error } = await supabase
        .from('ads_daily_metrics')
        .select('date, spend, impressions, clicks, reach, conversions, conversion_value, frequency')
        .eq('project_id', projectId)
        .gte('date', since)
        .lte('date', until)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      const aggregated = aggregateDaily(data || []);
      const calculatedTotals = calculateTotals(aggregated);
      
      setDailyData(aggregated);
      setTotals(calculatedTotals);
      setDateRange({ since, until });
      
      console.log(`[PDFMetrics] Loaded ${aggregated.length} days`);
    } catch (error) {
      console.error('Error loading PDF metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const getAvailableDateRange = useCallback(async () => {
    if (!projectId) return null;
    
    const { data, error } = await supabase
      .from('ads_daily_metrics')
      .select('date')
      .eq('project_id', projectId)
      .order('date', { ascending: true })
      .limit(1);
    
    const { data: lastData } = await supabase
      .from('ads_daily_metrics')
      .select('date')
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .limit(1);
    
    if (error || !data?.length || !lastData?.length) return null;
    
    return {
      minDate: data[0].date,
      maxDate: lastData[0].date,
    };
  }, [projectId]);

  return { 
    dailyData, 
    totals, 
    loading, 
    dateRange,
    loadMetrics, 
    getAvailableDateRange 
  };
}
