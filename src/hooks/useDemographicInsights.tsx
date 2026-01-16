import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DemographicData {
  breakdown_value: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversion_value: number;
}

export interface DemographicInsights {
  gender: DemographicData[];
  age: DemographicData[];
  device_platform: DemographicData[];
  publisher_platform: DemographicData[];
  country: DemographicData[];
  region: DemographicData[];
}

interface UseDemographicInsightsProps {
  projectId: string | null;
  startDate: Date;
  endDate: Date;
}

export function useDemographicInsights({ projectId, startDate, endDate }: UseDemographicInsightsProps) {
  const [data, setData] = useState<DemographicInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Serialize dates to strings to avoid unnecessary re-renders
  const sinceStr = startDate instanceof Date 
    ? startDate.toISOString().split('T')[0] 
    : startDate ? new Date(startDate).toISOString().split('T')[0] : null;
  const untilStr = endDate instanceof Date 
    ? endDate.toISOString().split('T')[0] 
    : endDate ? new Date(endDate).toISOString().split('T')[0] : null;

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId || !sinceStr || !untilStr) {
        setData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: rawData, error: fetchError } = await supabase
          .from('demographic_insights')
          .select('*')
          .eq('project_id', projectId)
          .gte('date', sinceStr)
          .lte('date', untilStr);

        if (fetchError) throw fetchError;

        // Aggregate by breakdown type and value
        const aggregated: DemographicInsights = {
          gender: [],
          age: [],
          device_platform: [],
          publisher_platform: [],
          country: [],
          region: [],
        };

        const tempMap: Record<string, Record<string, DemographicData>> = {
          gender: {},
          age: {},
          device_platform: {},
          publisher_platform: {},
          country: {},
          region: {},
        };

        rawData?.forEach((row: any) => {
          const type = row.breakdown_type as keyof DemographicInsights;
          const value = row.breakdown_value;

          if (!tempMap[type]) return;

          if (!tempMap[type][value]) {
            tempMap[type][value] = {
              breakdown_value: value,
              spend: 0,
              impressions: 0,
              clicks: 0,
              reach: 0,
              conversions: 0,
              conversion_value: 0,
            };
          }

          tempMap[type][value].spend += Number(row.spend) || 0;
          tempMap[type][value].impressions += Number(row.impressions) || 0;
          tempMap[type][value].clicks += Number(row.clicks) || 0;
          tempMap[type][value].reach += Number(row.reach) || 0;
          tempMap[type][value].conversions += Number(row.conversions) || 0;
          tempMap[type][value].conversion_value += Number(row.conversion_value) || 0;
        });

        // Convert to arrays sorted by spend
        Object.keys(aggregated).forEach((type) => {
          aggregated[type as keyof DemographicInsights] = Object.values(tempMap[type])
            .sort((a, b) => b.spend - a.spend);
        });

        setData(aggregated);
      } catch (err) {
        console.error('Error fetching demographic insights:', err);
        setError('Erro ao carregar dados demográficos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId, sinceStr, untilStr]);

  return { data, isLoading, error };
}
