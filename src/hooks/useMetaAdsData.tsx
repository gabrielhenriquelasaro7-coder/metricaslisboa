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

// Cache utilities
const CACHE_KEY_PREFIX = 'meta_ads_cache_';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  timestamp: number;
  projectId: string;
  timeRange: { since: string; until: string };
}

function getCacheKey(projectId: string, since: string, until: string): string {
  return `${CACHE_KEY_PREFIX}${projectId}_${since}_${until}`;
}

function getSyncedPeriods(): CacheEntry[] {
  try {
    const stored = localStorage.getItem('synced_periods');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addSyncedPeriod(projectId: string, timeRange: { since: string; until: string }): void {
  const periods = getSyncedPeriods();
  const key = getCacheKey(projectId, timeRange.since, timeRange.until);
  
  // Remove old entry if exists
  const filtered = periods.filter(p => 
    getCacheKey(p.projectId, p.timeRange.since, p.timeRange.until) !== key
  );
  
  // Add new entry
  filtered.push({
    timestamp: Date.now(),
    projectId,
    timeRange,
  });
  
  // Keep only last 20 entries
  const trimmed = filtered.slice(-20);
  
  localStorage.setItem('synced_periods', JSON.stringify(trimmed));
}

function isPeriodSynced(projectId: string, timeRange: { since: string; until: string }): boolean {
  const periods = getSyncedPeriods();
  const now = Date.now();
  
  return periods.some(p => 
    p.projectId === projectId &&
    p.timeRange.since === timeRange.since &&
    p.timeRange.until === timeRange.until &&
    (now - p.timestamp) < CACHE_EXPIRY_MS
  );
}

export function useMetaAdsData() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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

  const syncData = useCallback(async (timeRange?: { since: string; until: string }, forceSync: boolean = false) => {
    if (!selectedProject) {
      toast.error('Nenhum projeto selecionado');
      return;
    }

    // Check cache first (unless force sync)
    if (!forceSync && timeRange && isPeriodSynced(selectedProject.id, timeRange)) {
      console.log('Period already synced, loading from database:', timeRange);
      toast.info('Dados já sincronizados, carregando do cache...');
      await Promise.all([fetchCampaigns(), fetchAdSets(), fetchAds()]);
      return;
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
        console.log('Syncing with time range:', timeRange);
      } else {
        // Default to last 30 days if no time range provided
        body.date_preset = 'last_30d';
        console.log('Syncing with default preset: last_30d');
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
        // Save to cache
        if (timeRange) {
          addSyncedPeriod(selectedProject.id, timeRange);
        }
        
        toast.success(`Sincronização concluída! ${data.data?.campaigns_count || 0} campanhas sincronizadas.`);
        // Refetch all data after sync
        await Promise.all([fetchCampaigns(), fetchAdSets(), fetchAds()]);
      } else {
        console.error('Sync failed:', data.error);
        toast.error(data.error || 'Erro na sincronização');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar dados');
    } finally {
      setSyncing(false);
    }
  }, [selectedProject, fetchCampaigns, fetchAdSets, fetchAds]);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedProject) {
        setLoading(false);
        return;
      }
      setLoading(true);
      await Promise.all([fetchCampaigns(), fetchAdSets(), fetchAds()]);
      setLoading(false);
    };
    loadData();
  }, [selectedProject, fetchCampaigns, fetchAdSets, fetchAds]);

  return {
    campaigns,
    adSets,
    ads,
    loading: loading || projectsLoading,
    syncing,
    selectedProject,
    projectsLoading,
    syncData,
    fetchCampaigns,
    fetchAdSets,
    fetchAds,
    isPeriodSynced: (timeRange: { since: string; until: string }) => 
      selectedProject ? isPeriodSynced(selectedProject.id, timeRange) : false,
  };
}
