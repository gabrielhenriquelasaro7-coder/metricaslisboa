import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/hooks/useProjects';

export type HealthStatus = 'safe' | 'care' | 'danger';

export interface ProjectHealth {
  projectId: string;
  status: HealthStatus;
  spend: number;
  conversions: number;
  roas: number;
  cpl: number;
  trend: number[]; // Last 7 days spend
  trendDirection: 'up' | 'down' | 'stable';
  lastSync: string | null;
}

// Thresholds for health status
const ECOMMERCE_THRESHOLDS = {
  roas: { safe: 2.5, care: 1.5 }, // ROAS >= 2.5 = safe, >= 1.5 = care, < 1.5 = danger
};

const INSIDE_SALES_THRESHOLDS = {
  cpl: { safe: 30, care: 60 }, // CPL <= 30 = safe, <= 60 = care, > 60 = danger
};

function calculateHealthStatus(
  businessModel: string,
  roas: number,
  cpl: number
): HealthStatus {
  if (businessModel === 'ecommerce') {
    if (roas >= ECOMMERCE_THRESHOLDS.roas.safe) return 'safe';
    if (roas >= ECOMMERCE_THRESHOLDS.roas.care) return 'care';
    return 'danger';
  }
  
  // Inside Sales / PDV - based on CPL
  if (cpl <= INSIDE_SALES_THRESHOLDS.cpl.safe) return 'safe';
  if (cpl <= INSIDE_SALES_THRESHOLDS.cpl.care) return 'care';
  return 'danger';
}

function calculateTrendDirection(trend: number[]): 'up' | 'down' | 'stable' {
  if (trend.length < 2) return 'stable';
  
  const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
  const secondHalf = trend.slice(Math.floor(trend.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length || 0;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length || 0;
  
  const change = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  
  if (change > 10) return 'up';
  if (change < -10) return 'down';
  return 'stable';
}

export function useProjectHealth(projects: Project[]) {
  const [healthData, setHealthData] = useState<Map<string, ProjectHealth>>(new Map());
  const [loading, setLoading] = useState(false);

  const loadHealthData = useCallback(async () => {
    if (projects.length === 0) return;
    
    setLoading(true);
    const healthMap = new Map<string, ProjectHealth>();
    
    try {
      // Get last 30 days for metrics, last 7 for trend
      const now = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      
      for (const project of projects) {
        // Fetch last 30 days metrics
        const { data: metricsData } = await supabase
          .from('ads_daily_metrics')
          .select('date, spend, conversions, conversion_value')
          .eq('project_id', project.id)
          .gte('date', thirtyDaysAgo)
          .lte('date', today)
          .order('date', { ascending: true });
        
        if (!metricsData || metricsData.length === 0) {
          healthMap.set(project.id, {
            projectId: project.id,
            status: 'care',
            spend: 0,
            conversions: 0,
            roas: 0,
            cpl: 0,
            trend: [],
            trendDirection: 'stable',
            lastSync: project.last_sync_at,
          });
          continue;
        }
        
        // Aggregate totals
        const totals = metricsData.reduce(
          (acc, row) => ({
            spend: acc.spend + Number(row.spend) || 0,
            conversions: acc.conversions + Number(row.conversions) || 0,
            revenue: acc.revenue + Number(row.conversion_value) || 0,
          }),
          { spend: 0, conversions: 0, revenue: 0 }
        );
        
        const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
        const cpl = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
        
        // Calculate 7-day trend (daily spend)
        const trendData = metricsData.filter(d => d.date >= sevenDaysAgo);
        const dailySpend = new Map<string, number>();
        trendData.forEach(row => {
          const current = dailySpend.get(row.date) || 0;
          dailySpend.set(row.date, current + Number(row.spend) || 0);
        });
        const trend = Array.from(dailySpend.values());
        
        healthMap.set(project.id, {
          projectId: project.id,
          status: calculateHealthStatus(project.business_model, roas, cpl),
          spend: totals.spend,
          conversions: totals.conversions,
          roas,
          cpl,
          trend,
          trendDirection: calculateTrendDirection(trend),
          lastSync: project.last_sync_at,
        });
      }
      
      setHealthData(healthMap);
    } catch (error) {
      console.error('Error loading project health:', error);
    } finally {
      setLoading(false);
    }
  }, [projects]);

  useEffect(() => {
    loadHealthData();
  }, [loadHealthData]);

  return { healthData, loading, refetch: loadHealthData };
}
