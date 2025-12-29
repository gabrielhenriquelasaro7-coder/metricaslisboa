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

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) {
        console.log('[DEMOGRAPHICS] No projectId');
        setData(null);
        return;
      }

      if (!startDate || !endDate) {
        console.log('[DEMOGRAPHICS] No date range');
        setData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const since = startDate.toISOString().split('T')[0];
        const until = endDate.toISOString().split('T')[0];

        console.log('[DEMOGRAPHICS] Fetching data for project:', projectId, 'range:', since, 'to', until);

        const { data: rawData, error: fetchError } = await supabase
          .from('demographic_insights')
          .select('*')
          .eq('project_id', projectId)
          .gte('date', since)
          .lte('date', until);

        console.log('[DEMOGRAPHICS] Raw data:', rawData?.length || 0, 'rows, error:', fetchError);

        if (fetchError) throw fetchError;

        // Aggregate by breakdown type and value
        const aggregated: DemographicInsights = {
          gender: [],
          age: [],
          device_platform: [],
          publisher_platform: [],
        };

        const tempMap: Record<string, Record<string, DemographicData>> = {
          gender: {},
          age: {},
          device_platform: {},
          publisher_platform: {},
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
  }, [projectId, startDate, endDate]);

  return { data, isLoading, error };
}
