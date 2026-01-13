import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SidebarCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  lastDate: string | null;
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
          .limit(100);

        // Fetch unique ad sets from ads_daily_metrics (all periods)
        // Using a larger limit to ensure we get all ad sets
        const { data: dailyMetrics } = await supabase
          .from('ads_daily_metrics')
          .select('adset_id, adset_name, adset_status, campaign_id, spend, date')
          .eq('project_id', projectId)
          .order('date', { ascending: false })
          .limit(10000);

        // Build campaign last date map and aggregate ad sets
        const campaignLastDateMap = new Map<string, string>();
        const adSetMap = new Map<string, SidebarAdSet>();
        
        if (dailyMetrics) {
          for (const row of dailyMetrics) {
            // Track last date per campaign
            if (!campaignLastDateMap.has(row.campaign_id) || row.date > campaignLastDateMap.get(row.campaign_id)!) {
              campaignLastDateMap.set(row.campaign_id, row.date);
            }
            
            // Aggregate ad sets
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

        // Enrich campaigns with last date
        const enrichedCampaigns: SidebarCampaign[] = (campaignsRes.data || []).map((c: any) => ({
          ...c,
          lastDate: campaignLastDateMap.get(c.id) || null,
        }));

        if (isMounted) {
          setCampaigns(enrichedCampaigns);
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

  // Sort campaigns: active first, then by most recent data, then by spend
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      // 1. Active campaigns first
      const statusOrder: Record<string, number> = { 'ACTIVE': 0, 'PAUSED': 1, 'ARCHIVED': 2 };
      const orderA = statusOrder[a.status] ?? 3;
      const orderB = statusOrder[b.status] ?? 3;
      if (orderA !== orderB) return orderA - orderB;
      
      // 2. Then by most recent data date
      if (a.lastDate && b.lastDate) {
        if (a.lastDate !== b.lastDate) return b.lastDate.localeCompare(a.lastDate);
      } else if (a.lastDate && !b.lastDate) {
        return -1; // a has data, b doesn't
      } else if (!a.lastDate && b.lastDate) {
        return 1; // b has data, a doesn't
      }
      
      // 3. Finally by spend
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
