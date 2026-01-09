import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DatePresetKey, getDateRangeFromPreset } from '@/utils/dateUtils';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export interface ProfileVisitsData {
  totalProfileVisits: number;
  costPerVisit: number;
  totalSpend: number;
  hasProfileVisitCampaigns: boolean;
}

// Only campaigns with LINK_CLICKS objective are considered "profile visits" campaigns
const PROFILE_VISIT_OBJECTIVES = ['LINK_CLICKS'];

export function useProfileVisitsMetrics(
  projectId: string | undefined,
  preset: DatePresetKey,
  customDateRange?: DateRange
) {
  const [data, setData] = useState<ProfileVisitsData>({
    totalProfileVisits: 0,
    costPerVisit: 0,
    totalSpend: 0,
    hasProfileVisitCampaigns: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setData({
        totalProfileVisits: 0,
        costPerVisit: 0,
        totalSpend: 0,
        hasProfileVisitCampaigns: false,
      });
      return;
    }

    const fetchProfileVisits = async () => {
      setLoading(true);
      try {
        // Calculate date range
        let since: string;
        let until: string;
        
        if (preset === 'custom' && customDateRange?.from && customDateRange?.to) {
          since = format(customDateRange.from, 'yyyy-MM-dd');
          until = format(customDateRange.to, 'yyyy-MM-dd');
        } else {
          const period = getDateRangeFromPreset(preset, 'America/Sao_Paulo');
          if (period) {
            since = period.since;
            until = period.until;
          } else {
            // Fallback - last 30 days
            const now = new Date();
            until = now.toISOString().split('T')[0];
            since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          }
        }

        console.log(`[ProfileVisitsMetrics] Fetching for project ${projectId}, ${since} to ${until}`);

        // Fetch ONLY from campaigns with LINK_CLICKS objective (profile visits campaigns)
        const { data: metricsData, error } = await supabase
          .from('ads_daily_metrics')
          .select('profile_visits, spend')
          .eq('project_id', projectId)
          .gte('date', since)
          .lte('date', until)
          .in('campaign_objective', PROFILE_VISIT_OBJECTIVES)
          .gt('profile_visits', 0);

        if (error) {
          console.error('[ProfileVisitsMetrics] Error fetching:', error);
          setData({
            totalProfileVisits: 0,
            costPerVisit: 0,
            totalSpend: 0,
            hasProfileVisitCampaigns: false,
          });
          return;
        }

        // Sum profile visits and spend from profile visit campaigns only
        let totalProfileVisits = 0;
        let totalSpend = 0;

        for (const row of metricsData || []) {
          totalProfileVisits += Number(row.profile_visits) || 0;
          totalSpend += Number(row.spend) || 0;
        }

        // Only show if there are actual profile visits
        const hasProfileVisitCampaigns = totalProfileVisits > 0;
        const costPerVisit = totalProfileVisits > 0 ? totalSpend / totalProfileVisits : 0;

        console.log(`[ProfileVisitsMetrics] Found ${totalProfileVisits} profile visits from LINK_CLICKS campaigns, spend: ${formatNumber(totalSpend)}`);

        setData({
          totalProfileVisits,
          costPerVisit,
          totalSpend,
          hasProfileVisitCampaigns,
        });
      } catch (err) {
        console.error('[ProfileVisitsMetrics] Error:', err);
        setData({
          totalProfileVisits: 0,
          costPerVisit: 0,
          totalSpend: 0,
          hasProfileVisitCampaigns: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfileVisits();
  }, [projectId, preset, customDateRange]);

  return { data, loading };
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num);
}