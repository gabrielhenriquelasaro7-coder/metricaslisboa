import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from './useProjects';
import { toast } from 'sonner';

export interface Campaign {
  id: string;
  project_id: string;
  name: string;
  objective: string | null;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  reach: number;
  frequency: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
  created_time: string | null;
  updated_time: string | null;
  synced_at: string;
}

export interface AdSet {
  id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  targeting: Record<string, unknown> | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  reach: number;
  frequency: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
  synced_at: string;
}

export interface Ad {
  id: string;
  ad_set_id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  creative_id: string | null;
  creative_thumbnail: string | null;
  creative_image_url: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  reach: number;
  frequency: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
  synced_at: string;
}

// Helper to get period key from date range
function getPeriodKeyFromDays(days: number): string {
  if (days <= 7) return 'last_7d';
  if (days <= 14) return 'last_14d';
  if (days <= 30) return 'last_30d';
  if (days <= 60) return 'last_60d';
  if (days <= 90) return 'last_90d';
  return `custom_${days}d`;
}

// Clear all cached data (kept for compatibility)
export function clearAllCache(): void {
  console.log('[CACHE] Cache clearing is now handled by period_metrics table');
}

export function useMetaAdsData() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastLoadedPeriod, setLastLoadedPeriod] = useState<string | null>(null);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const { projects, loading: projectsLoading } = useProjects();

  // Get selected project from localStorage
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = selectedProjectId 
    ? projects.find(p => p.id === selectedProjectId) 
    : projects[0];

  const fetchCampaigns = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('spend', { ascending: false });

      if (error) throw error;
      setCampaigns(data as Campaign[] || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  }, [selectedProject]);

  const fetchAdSets = useCallback(async (campaignId?: string) => {
    if (!selectedProject) return;
    
    try {
      let query = supabase
        .from('ad_sets')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('spend', { ascending: false });

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAdSets(data as AdSet[] || []);
    } catch (error) {
      console.error('Error fetching ad sets:', error);
    }
  }, [selectedProject]);

  const fetchAds = useCallback(async (adSetId?: string, campaignId?: string) => {
    if (!selectedProject) return;
    
    try {
      let query = supabase
        .from('ads')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('spend', { ascending: false });

      if (adSetId) {
        query = query.eq('ad_set_id', adSetId);
      } else if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAds(data as Ad[] || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
    }
  }, [selectedProject]);

  // Load data from local database - NO API calls, instant loading
  const loadDataFromDatabase = useCallback(async () => {
    if (!selectedProject) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [campaignsResult, adSetsResult, adsResult] = await Promise.all([
        supabase.from('campaigns').select('*')
          .eq('project_id', selectedProject.id)
          .order('spend', { ascending: false }),
        supabase.from('ad_sets').select('*')
          .eq('project_id', selectedProject.id)
          .order('spend', { ascending: false }),
        supabase.from('ads').select('*')
          .eq('project_id', selectedProject.id)
          .order('spend', { ascending: false }),
      ]);
      
      setCampaigns((campaignsResult.data as Campaign[]) || []);
      setAdSets((adSetsResult.data as AdSet[]) || []);
      setAds((adsResult.data as Ad[]) || []);
    } catch (error) {
      console.error('Error loading from database:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  // Load metrics by period from period_metrics table - INSTANT loading
  const loadMetricsByPeriod = useCallback(async (periodKey: string) => {
    if (!selectedProject) {
      setLoading(false);
      return { found: false };
    }

    // Skip if already loaded this period
    if (lastLoadedPeriod === periodKey) {
      console.log(`[PERIOD] Already loaded period ${periodKey}, skipping`);
      return { found: true };
    }

    console.log(`[PERIOD] Loading metrics for period: ${periodKey}`);
    setLoading(true);

    try {
      // Fetch all metrics for this period in one query
      const { data: periodMetrics, error } = await supabase
        .from('period_metrics')
        .select('*')
        .eq('project_id', selectedProject.id)
        .eq('period_key', periodKey);

      if (error) {
        console.error('Error loading period metrics:', error);
        throw error;
      }

      if (!periodMetrics || periodMetrics.length === 0) {
        console.log(`[PERIOD] No data found for period ${periodKey}, loading from main tables (fallback)`);
        setUsingFallbackData(true);
        await loadDataFromDatabase();
        setLastLoadedPeriod(periodKey);
        return { found: false, fallback: true };
      }

      setUsingFallbackData(false);

      console.log(`[PERIOD] Found ${periodMetrics.length} records for period ${periodKey}`);

      // Parse and set campaigns
      const campaignMetrics = periodMetrics.filter(m => m.entity_type === 'campaign');
      const campaignsFromPeriod: Campaign[] = campaignMetrics.map(m => {
        const metrics = m.metrics as Record<string, unknown>;
        return {
          id: m.entity_id,
          project_id: selectedProject.id,
          name: m.entity_name,
          status: m.status || 'UNKNOWN',
          objective: (metrics.objective as string) || null,
          daily_budget: (metrics.daily_budget as number) || null,
          lifetime_budget: (metrics.lifetime_budget as number) || null,
          spend: (metrics.spend as number) || 0,
          impressions: (metrics.impressions as number) || 0,
          clicks: (metrics.clicks as number) || 0,
          ctr: (metrics.ctr as number) || 0,
          cpm: (metrics.cpm as number) || 0,
          cpc: (metrics.cpc as number) || 0,
          reach: (metrics.reach as number) || 0,
          frequency: (metrics.frequency as number) || 0,
          conversions: (metrics.conversions as number) || 0,
          conversion_value: (metrics.conversion_value as number) || 0,
          roas: (metrics.roas as number) || 0,
          cpa: (metrics.cpa as number) || 0,
          created_time: null,
          updated_time: null,
          synced_at: m.synced_at || '',
        };
      });

      // Parse and set ad sets
      const adSetMetrics = periodMetrics.filter(m => m.entity_type === 'ad_set');
      const adSetsFromPeriod: AdSet[] = adSetMetrics.map(m => {
        const metrics = m.metrics as Record<string, unknown>;
        return {
          id: m.entity_id,
          campaign_id: (metrics.campaign_id as string) || '',
          project_id: selectedProject.id,
          name: m.entity_name,
          status: m.status || 'UNKNOWN',
          daily_budget: (metrics.daily_budget as number) || null,
          lifetime_budget: (metrics.lifetime_budget as number) || null,
          targeting: null,
          spend: (metrics.spend as number) || 0,
          impressions: (metrics.impressions as number) || 0,
          clicks: (metrics.clicks as number) || 0,
          ctr: (metrics.ctr as number) || 0,
          cpm: (metrics.cpm as number) || 0,
          cpc: (metrics.cpc as number) || 0,
          reach: (metrics.reach as number) || 0,
          frequency: (metrics.frequency as number) || 0,
          conversions: (metrics.conversions as number) || 0,
          conversion_value: (metrics.conversion_value as number) || 0,
          roas: (metrics.roas as number) || 0,
          cpa: (metrics.cpa as number) || 0,
          synced_at: m.synced_at || '',
        };
      });

      // Parse and set ads
      const adMetrics = periodMetrics.filter(m => m.entity_type === 'ad');
      const adsFromPeriod: Ad[] = adMetrics.map(m => {
        const metrics = m.metrics as Record<string, unknown>;
        return {
          id: m.entity_id,
          ad_set_id: (metrics.ad_set_id as string) || '',
          campaign_id: (metrics.campaign_id as string) || '',
          project_id: selectedProject.id,
          name: m.entity_name,
          status: m.status || 'UNKNOWN',
          creative_id: (metrics.creative_id as string) || null,
          creative_thumbnail: (metrics.creative_thumbnail as string) || null,
          creative_image_url: (metrics.creative_image_url as string) || null,
          headline: (metrics.headline as string) || null,
          primary_text: null,
          cta: (metrics.cta as string) || null,
          spend: (metrics.spend as number) || 0,
          impressions: (metrics.impressions as number) || 0,
          clicks: (metrics.clicks as number) || 0,
          ctr: (metrics.ctr as number) || 0,
          cpm: (metrics.cpm as number) || 0,
          cpc: (metrics.cpc as number) || 0,
          reach: (metrics.reach as number) || 0,
          frequency: (metrics.frequency as number) || 0,
          conversions: (metrics.conversions as number) || 0,
          conversion_value: (metrics.conversion_value as number) || 0,
          roas: (metrics.roas as number) || 0,
          cpa: (metrics.cpa as number) || 0,
          synced_at: m.synced_at || '',
        };
      });

      // Sort by spend descending
      campaignsFromPeriod.sort((a, b) => b.spend - a.spend);
      adSetsFromPeriod.sort((a, b) => b.spend - a.spend);
      adsFromPeriod.sort((a, b) => b.spend - a.spend);

      setCampaigns(campaignsFromPeriod);
      setAdSets(adSetsFromPeriod);
      setAds(adsFromPeriod);
      setLastLoadedPeriod(periodKey);

      console.log(`[PERIOD] Loaded: ${campaignsFromPeriod.length} campaigns, ${adSetsFromPeriod.length} ad sets, ${adsFromPeriod.length} ads`);
      return { found: true };
    } catch (error) {
      console.error('Error loading period metrics:', error);
      await loadDataFromDatabase();
      return { found: false };
    } finally {
      setLoading(false);
    }
  }, [selectedProject, lastLoadedPeriod, loadDataFromDatabase]);

  // Load metrics by date range - calculates period key and loads from period_metrics
  const loadByDateRange = useCallback(async (dateRange: { from: Date; to: Date }) => {
    const diffDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    const periodKey = getPeriodKeyFromDays(diffDays);
    return loadMetricsByPeriod(periodKey);
  }, [loadMetricsByPeriod]);

  // Sync with Meta API - ONLY for manual/emergency use
  const syncData = useCallback(async (timeRange?: { since: string; until: string }, forceSync: boolean = false) => {
    if (!selectedProject) {
      toast.error('Nenhum projeto selecionado');
      return { success: false };
    }

    setSyncing(true);
    try {
      const body: Record<string, unknown> = {
        project_id: selectedProject.id,
        ad_account_id: selectedProject.ad_account_id,
      };
      
      // Add time_range if provided for dynamic date filtering
      if (timeRange) {
        body.time_range = {
          since: timeRange.since,
          until: timeRange.until,
        };
        console.log('Manual sync with time range:', timeRange);
      } else {
        // Default to last 30 days if no time range provided
        body.date_preset = 'last_30d';
        console.log('Manual sync with default preset: last_30d');
      }
      
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body,
      });

      if (error) {
        console.error('Sync invoke error:', error);
        throw error;
      }

      console.log('Sync response:', data);

      if (data.success) {
        toast.success(`Sincronização concluída! ${data.data?.campaigns_count || 0} campanhas, ${data.data?.ad_sets_count || 0} conjuntos, ${data.data?.ads_count || 0} anúncios.`);
        
        // Reset loaded period to force reload
        setLastLoadedPeriod(null);
        
        // Reload data from database
        await loadDataFromDatabase();
        
        return { success: true, data: data.data };
      } else {
        console.error('Sync failed:', data.error);
        
        // Check for rate limit error
        if (data.rate_limited) {
          toast.error('Limite de requisições da API do Meta atingido. Aguarde alguns minutos e tente novamente.');
        } else {
          toast.error(data.error || 'Erro na sincronização');
        }
        
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar dados');
      return { success: false, error };
    } finally {
      setSyncing(false);
    }
  }, [selectedProject, loadDataFromDatabase]);

  // Initial load from database when project changes
  useEffect(() => {
    loadDataFromDatabase();
  }, [loadDataFromDatabase]);

  return {
    campaigns,
    adSets,
    ads,
    loading: loading || projectsLoading,
    syncing,
    selectedProject,
    projectsLoading,
    usingFallbackData,
    syncData,
    loadDataFromDatabase,
    loadMetricsByPeriod,
    loadByDateRange,
    fetchCampaigns,
    fetchAdSets,
    fetchAds,
    getPeriodKeyFromDays,
  };
}