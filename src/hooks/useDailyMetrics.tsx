import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DatePresetKey, getDateRangeFromPreset } from '@/utils/dateUtils';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export interface DailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversion_value: number;
  messaging_replies: number;
  profile_visits: number;
  // Conversions by campaign objective
  leads_conversions: number; // OUTCOME_LEADS
  sales_conversions: number; // OUTCOME_SALES
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
    impressions: number;
    clicks: number;
    reach: number;
    conversions: number;
    roas: number;
    cpa: number;
    ctr: number;
    cpm: number;
    cpc: number;
    revenue: number;
  };
}

// Calculate date range based on preset - use centralized dateUtils
function getDateRangeFromPeriod(preset: DatePresetKey, customRange?: DateRange) {
  // If custom preset and we have a custom range, use it
  if (preset === 'custom' && customRange?.from && customRange?.to) {
    const since = format(customRange.from, 'yyyy-MM-dd');
    const until = format(customRange.to, 'yyyy-MM-dd');
    const days = Math.ceil((customRange.to.getTime() - customRange.from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    console.log(`[DailyMetrics] Custom range: ${since} to ${until} (${days} days)`);
    
    return { 
      since, 
      until, 
      days, 
      previousType: 'same_length' as const 
    };
  }
  
  console.log(`[DailyMetrics] Getting date range for preset: ${preset}`);
  const period = getDateRangeFromPreset(preset, 'America/Sao_Paulo');
  
  if (!period) {
    console.log(`[DailyMetrics] No period found for preset ${preset}, using fallback`);
    // Fallback for custom - last 30 days
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    return { 
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
      until: today, 
      days: 30, 
      previousType: 'same_length' as const 
    };
  }
  
  const since = period.since;
  const until = period.until;
  const days = Math.ceil((new Date(until).getTime() - new Date(since).getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  console.log(`[DailyMetrics] Preset ${preset} -> since: ${since}, until: ${until}, days: ${days}`);
  
  // Determine previous type based on preset
  let previousType: 'same_length' | 'previous_month' | 'previous_year' | 'two_months_ago' | 'none' = 'same_length';
  if (preset === 'this_month') {
    previousType = 'previous_month';
  } else if (preset === 'this_year') {
    previousType = 'previous_year';
  } else if (preset === 'last_month') {
    // last_month should compare with 2 months ago
    previousType = 'two_months_ago';
  } else if (preset === 'last_year') {
    // For last_year, skip comparison as previous year data likely doesn't exist
    previousType = 'none';
  }
  
  return { since, until, days, previousType };
}

// Get previous period dates based on the type of comparison
function getPreviousPeriodDates(since: string, until: string, days: number, previousType: 'same_length' | 'previous_month' | 'previous_year' | 'two_months_ago' | 'none'): { since: string; until: string } | null {
  // For 'none', don't calculate previous period
  if (previousType === 'none') {
    return null;
  }
  
  // For 'two_months_ago' (used by last_month), get the month directly before the current period
  // Since current period is "last month" (e.g., December), we want "month before last" (e.g., November)
  if (previousType === 'two_months_ago') {
    const currentSince = new Date(since);
    // Get month before current period's month (e.g., if since is Dec 1, we want Nov)
    const prevMonth = currentSince.getMonth() === 0 ? 11 : currentSince.getMonth() - 1;
    const prevYear = currentSince.getMonth() === 0 ? currentSince.getFullYear() - 1 : currentSince.getFullYear();
    
    const prevMonthFirstDay = new Date(prevYear, prevMonth, 1);
    const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0);
    
    console.log(`[DailyMetrics] two_months_ago: since=${since}, prevMonth=${prevMonth}, prevYear=${prevYear}, result=${prevMonthFirstDay.toISOString().split('T')[0]} to ${prevMonthLastDay.toISOString().split('T')[0]}`);
    
    return {
      since: prevMonthFirstDay.toISOString().split('T')[0],
      until: prevMonthLastDay.toISOString().split('T')[0],
    };
  }
  
  const now = new Date();
  
  if (previousType === 'previous_month') {
    // For "this month", compare with "last month" - same date range but previous month
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Previous month
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    // First and last day of previous month
    const prevMonthFirstDay = new Date(prevYear, prevMonth, 1);
    const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0); // Last day of prev month
    
    // Calculate which day we are in current month
    const currentDayOfMonth = now.getDate();
    
    // Previous month until = min(same day as today, last day of prev month)
    const prevUntilDay = Math.min(currentDayOfMonth, prevMonthLastDay.getDate());
    const prevUntil = new Date(prevYear, prevMonth, prevUntilDay);
    
    return {
      since: prevMonthFirstDay.toISOString().split('T')[0],
      until: prevUntil.toISOString().split('T')[0],
    };
  }
  
  if (previousType === 'previous_year') {
    // For "this year", compare with same period last year
    const currentSince = new Date(since);
    const currentUntil = new Date(until);
    
    const prevYearSince = new Date(currentSince);
    prevYearSince.setFullYear(prevYearSince.getFullYear() - 1);
    
    const prevYearUntil = new Date(currentUntil);
    prevYearUntil.setFullYear(prevYearUntil.getFullYear() - 1);
    
    return {
      since: prevYearSince.toISOString().split('T')[0],
      until: prevYearUntil.toISOString().split('T')[0],
    };
  }
  
  // Default: same_length - Previous period of equal length before current starts
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

// Aggregate daily rows - ESPELHO DO GERENCIADOR
// Usamos diretamente o campo "conversions" que já vem calculado pela API
// O campo conversions já inclui todos os tipos de conversão configurados (leads, messaging, etc.)
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
        messaging_replies: 0,
        profile_visits: 0,
        leads_conversions: 0,
        sales_conversions: 0,
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
    
    // CONVERSÕES: Usar diretamente o valor da API (já atribuído pelo Meta)
    // O campo conversions já contém o total correto de todas as conversões
    agg.conversions += Number(row.conversions) || 0;
    
    agg.conversion_value += Number(row.conversion_value) || 0;
    agg.messaging_replies += Number(row.messaging_replies) || 0;
    agg.profile_visits += Number(row.profile_visits) || 0;
    
    // Manter compatibilidade com campos legados
    agg.leads_conversions += Number(row.conversions) || 0;
    agg.sales_conversions += 0;
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
      messaging_replies: acc.messaging_replies + d.messaging_replies,
      profile_visits: acc.profile_visits + d.profile_visits,
      leads_conversions: acc.leads_conversions + d.leads_conversions,
      sales_conversions: acc.sales_conversions + d.sales_conversions,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      roas: 0,
      cpa: 0,
    }),
    { date: '', spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, messaging_replies: 0, profile_visits: 0, leads_conversions: 0, sales_conversions: 0, ctr: 0, cpm: 0, cpc: 0, roas: 0, cpa: 0 }
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

export function useDailyMetrics(
  projectId: string | undefined, 
  preset: DatePresetKey,
  customDateRange?: DateRange
) {
  const [dailyData, setDailyData] = useState<DailyMetric[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDailyMetrics = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { since, until, days, previousType } = getDateRangeFromPeriod(preset, customDateRange);
      const previousDates = getPreviousPeriodDates(since, until, days, previousType);
      
      console.log(`[DailyMetrics] Loading: ${since} to ${until} (${days} days)`);
      console.log(`[DailyMetrics] Previous dates: ${previousDates ? `${previousDates.since} to ${previousDates.until}` : 'none (skipped)'}`);
      
      // Always fetch current period - use pagination to get ALL records
      // Supabase max is 1000 per request regardless of range
      let allCurrentRows: any[] = [];
      let currentPage = 0;
      const pageSize = 1000; // Supabase hard limit
      
      while (true) {
        const { data, error } = await supabase
          .from('ads_daily_metrics')
          .select('date, spend, impressions, clicks, reach, conversions, conversion_value, messaging_replies, profile_visits, campaign_objective')
          .eq('project_id', projectId)
          .gte('date', since)
          .lte('date', until)
          .order('date', { ascending: true })
          .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
        
        if (error) {
          console.error('[DailyMetrics] Current period error:', error);
          break;
        }
        
        if (!data || data.length === 0) break;
        allCurrentRows = [...allCurrentRows, ...data];
        
        // If we got exactly 1000, there might be more
        if (data.length < pageSize) break;
        currentPage++;
      }
      
      console.log(`[DailyMetrics] Raw current rows: ${allCurrentRows.length} (${currentPage + 1} pages)`);
      
      const currentData = aggregateDaily(allCurrentRows);
      const currentTotals = calculateTotals(currentData);
      
      // Only fetch previous period if we have dates
      let previousData: DailyMetric[] = [];
      let previousTotals = calculateTotals([]);
      
      if (previousDates) {
        let allPreviousRows: any[] = [];
        let prevPage = 0;
        
        while (true) {
          const { data, error } = await supabase
            .from('ads_daily_metrics')
            .select('date, spend, impressions, clicks, reach, conversions, conversion_value, messaging_replies, profile_visits, campaign_objective')
            .eq('project_id', projectId)
            .gte('date', previousDates.since)
            .lte('date', previousDates.until)
            .order('date', { ascending: true })
            .range(prevPage * pageSize, (prevPage + 1) * pageSize - 1);
          
          if (error) {
            console.error('[DailyMetrics] Previous period error:', error);
            break;
          }
          
          if (!data || data.length === 0) break;
          allPreviousRows = [...allPreviousRows, ...data];
          
          if (data.length < pageSize) break;
          prevPage++;
        }
        
        console.log(`[DailyMetrics] Raw previous rows: ${allPreviousRows.length} (${prevPage + 1} pages)`);
        
        previousData = aggregateDaily(allPreviousRows);
        previousTotals = calculateTotals(previousData);
      }
      
      setDailyData(currentData);
      setComparison({
        current: currentData,
        previous: previousData,
        currentTotals,
        previousTotals,
        changes: {
          spend: calculateChange(currentTotals.spend, previousTotals.spend),
          impressions: calculateChange(currentTotals.impressions, previousTotals.impressions),
          clicks: calculateChange(currentTotals.clicks, previousTotals.clicks),
          reach: calculateChange(currentTotals.reach, previousTotals.reach),
          conversions: calculateChange(currentTotals.conversions, previousTotals.conversions),
          roas: calculateChange(currentTotals.roas, previousTotals.roas),
          cpa: calculateChange(currentTotals.cpa, previousTotals.cpa),
          ctr: calculateChange(currentTotals.ctr, previousTotals.ctr),
          cpm: calculateChange(currentTotals.cpm, previousTotals.cpm),
          cpc: calculateChange(currentTotals.cpc, previousTotals.cpc),
          revenue: calculateChange(currentTotals.conversion_value, previousTotals.conversion_value),
        },
      });
      
      console.log(`[DailyMetrics] Loaded ${currentData.length} days current, ${previousData.length} days previous`);
      console.log(`[DailyMetrics] Current totals: spend=${currentTotals.spend}, conversions=${currentTotals.conversions}`);
    } catch (error) {
      console.error('Error loading daily metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, preset, customDateRange]);

  useEffect(() => {
    loadDailyMetrics();
  }, [loadDailyMetrics]);

  return { dailyData, comparison, loading, refetch: loadDailyMetrics };
}