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
        // Fetch only essential fields for sidebar
        const [campaignsRes, adSetsRes] = await Promise.all([
          supabase
            .from('campaigns')
            .select('id, name, status, spend')
            .eq('project_id', projectId)
            .order('spend', { ascending: false })
            .limit(15),
          supabase
            .from('ad_sets')
            .select('id, name, status, campaign_id, spend')
            .eq('project_id', projectId)
            .order('spend', { ascending: false })
            .limit(50),
        ]);

        if (isMounted) {
          setCampaigns((campaignsRes.data as SidebarCampaign[]) || []);
          setAdSets((adSetsRes.data as SidebarAdSet[]) || []);
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
