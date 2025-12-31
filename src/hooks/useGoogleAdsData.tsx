import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjects, Project } from './useProjects';
import { toast } from 'sonner';

export interface GoogleCampaign {
  id: string;
  project_id: string;
  name: string;
  status: string;
  campaign_type: string | null;
  bidding_strategy: string | null;
  budget_amount: number;
  budget_type: string | null;
  start_date: string | null;
  end_date: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cost_per_conversion: number;
  roas: number;
  created_at: string;
  synced_at: string;
}

export interface GoogleAdGroup {
  id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  cpc_bid: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cost_per_conversion: number;
  roas: number;
  created_at: string;
  synced_at: string;
}

export interface GoogleAd {
  id: string;
  ad_group_id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  ad_type: string | null;
  final_urls: string[] | null;
  headlines: string[] | null;
  descriptions: string[] | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cost_per_conversion: number;
  roas: number;
  created_at: string;
  synced_at: string;
}

export interface GoogleDailyMetric {
  id: string;
  project_id: string;
  date: string;
  customer_id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string | null;
  campaign_type: string | null;
  ad_group_id: string;
  ad_group_name: string;
  ad_group_status: string | null;
  ad_id: string;
  ad_name: string;
  ad_status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cost_per_conversion: number;
  roas: number;
  search_impression_share: number | null;
  created_at: string;
  synced_at: string;
}

export function useGoogleAdsData() {
  const { projects } = useProjects();
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([]);
  const [adGroups, setAdGroups] = useState<GoogleAdGroup[]>([]);
  const [ads, setAds] = useState<GoogleAd[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<GoogleDailyMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Get selected project from localStorage
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const fetchCampaigns = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from('google_campaigns')
      .select('*')
      .eq('project_id', projectId)
      .order('spend', { ascending: false });

    if (error) {
      console.error('Error fetching Google campaigns:', error);
      return [];
    }

    return data as GoogleCampaign[];
  }, []);

  const fetchAdGroups = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from('google_ad_groups')
      .select('*')
      .eq('project_id', projectId)
      .order('spend', { ascending: false });

    if (error) {
      console.error('Error fetching Google ad groups:', error);
      return [];
    }

    return data as GoogleAdGroup[];
  }, []);

  const fetchAds = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from('google_ads')
      .select('*')
      .eq('project_id', projectId)
      .order('spend', { ascending: false });

    if (error) {
      console.error('Error fetching Google ads:', error);
      return [];
    }

    return data as GoogleAd[];
  }, []);

  const fetchDailyMetrics = useCallback(async (projectId: string, startDate?: string, endDate?: string) => {
    let query = supabase
      .from('google_ads_daily_metrics')
      .select('*')
      .eq('project_id', projectId)
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching Google daily metrics:', error);
      return [];
    }

    return data as GoogleDailyMetric[];
  }, []);

  const loadAllData = useCallback(async (projectId?: string) => {
    const pid = projectId || selectedProject?.id;
    if (!pid) return;

    setLoading(true);
    try {
      const [campaignsData, adGroupsData, adsData] = await Promise.all([
        fetchCampaigns(pid),
        fetchAdGroups(pid),
        fetchAds(pid),
      ]);

      setCampaigns(campaignsData);
      setAdGroups(adGroupsData);
      setAds(adsData);
    } catch (error) {
      console.error('Error loading Google Ads data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject?.id, fetchCampaigns, fetchAdGroups, fetchAds]);

  const loadDailyMetrics = useCallback(async (projectId?: string, startDate?: string, endDate?: string) => {
    const pid = projectId || selectedProject?.id;
    if (!pid) return;

    setLoading(true);
    try {
      const data = await fetchDailyMetrics(pid, startDate, endDate);
      setDailyMetrics(data);
    } finally {
      setLoading(false);
    }
  }, [selectedProject?.id, fetchDailyMetrics]);

  const syncData = useCallback(async (options?: { days?: number }) => {
    if (!selectedProject?.id) {
      toast.error('Nenhum projeto selecionado');
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-sync', {
        body: {
          projectId: selectedProject.id,
          syncType: 'full',
          days: options?.days || 30,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Google Ads sincronizado! ${data.recordsCount} registros processados.`);
        await loadAllData();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Error syncing Google Ads:', error);
      toast.error(`Erro ao sincronizar Google Ads: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSyncing(false);
    }
  }, [selectedProject?.id, loadAllData]);

  // Aggregate daily metrics by date
  const aggregateDailyMetrics = useCallback((metrics: GoogleDailyMetric[]) => {
    const aggregated = new Map<string, {
      date: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      conversion_value: number;
    }>();

    for (const m of metrics) {
      const existing = aggregated.get(m.date);
      if (existing) {
        existing.spend += m.spend;
        existing.impressions += m.impressions;
        existing.clicks += m.clicks;
        existing.conversions += m.conversions;
        existing.conversion_value += m.conversion_value;
      } else {
        aggregated.set(m.date, {
          date: m.date,
          spend: m.spend,
          impressions: m.impressions,
          clicks: m.clicks,
          conversions: m.conversions,
          conversion_value: m.conversion_value,
        });
      }
    }

    return Array.from(aggregated.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
        cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
        cpa: d.conversions > 0 ? d.spend / d.conversions : 0,
        roas: d.spend > 0 ? d.conversion_value / d.spend : 0,
      }));
  }, []);

  return {
    campaigns,
    adGroups,
    ads,
    dailyMetrics,
    loading,
    syncing,
    selectedProject,
    loadAllData,
    loadDailyMetrics,
    syncData,
    aggregateDailyMetrics,
  };
}
