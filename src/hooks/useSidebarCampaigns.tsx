import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SidebarCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
}

interface SidebarAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  spend: number;
}

/**
 * Lightweight hook for sidebar campaign list.
 * Only fetches minimal data needed for navigation, avoiding heavy useMetaAdsData.
 */
export function useSidebarCampaigns(projectId: string | null) {
  const [campaigns, setCampaigns] = useState<SidebarCampaign[]>([]);
  const [adSets, setAdSets] = useState<SidebarAdSet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setCampaigns([]);
      setAdSets([]);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch campaigns from campaigns table
        const campaignsRes = await supabase
          .from('campaigns')
          .select('id, name, status, spend')
          .eq('project_id', projectId)
          .order('spend', { ascending: false })
          .limit(15);

        // Fetch unique ad sets from ads_daily_metrics (most reliable source)
        // Group by adset_id to get unique ad sets with aggregated spend
        const { data: dailyMetrics } = await supabase
          .from('ads_daily_metrics')
          .select('adset_id, adset_name, adset_status, campaign_id, spend')
          .eq('project_id', projectId)
          .order('date', { ascending: false })
          .limit(1000);

        // Aggregate ad sets from daily metrics
        const adSetMap = new Map<string, SidebarAdSet>();
        if (dailyMetrics) {
          for (const row of dailyMetrics) {
            if (!adSetMap.has(row.adset_id)) {
              adSetMap.set(row.adset_id, {
                id: row.adset_id,
                name: row.adset_name,
                status: row.adset_status || 'UNKNOWN',
                campaign_id: row.campaign_id,
                spend: 0,
              });
            }
            const adSet = adSetMap.get(row.adset_id)!;
            adSet.spend += Number(row.spend) || 0;
          }
        }

        const aggregatedAdSets = Array.from(adSetMap.values())
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 50);

        if (isMounted) {
          setCampaigns((campaignsRes.data as SidebarCampaign[]) || []);
          setAdSets(aggregatedAdSets);
        }
      } catch (error) {
        console.error('Error fetching sidebar campaigns:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Sort campaigns: active first, then by spend
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const statusOrder: Record<string, number> = { 'ACTIVE': 0, 'PAUSED': 1 };
      const orderA = statusOrder[a.status] ?? 2;
      const orderB = statusOrder[b.status] ?? 2;
      if (orderA !== orderB) return orderA - orderB;
      return (b.spend || 0) - (a.spend || 0);
    });
  }, [campaigns]);

  const getCampaignAdSets = (campaignId: string) => {
    return adSets
      .filter(a => a.campaign_id === campaignId)
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { 'ACTIVE': 0, 'PAUSED': 1 };
        const orderA = statusOrder[a.status] ?? 2;
        const orderB = statusOrder[b.status] ?? 2;
        if (orderA !== orderB) return orderA - orderB;
        return (b.spend || 0) - (a.spend || 0);
      });
  };

  return {
    campaigns: sortedCampaigns,
    adSets,
    loading,
    getCampaignAdSets,
  };
}
