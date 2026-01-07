import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from './useProjects';
import { toast } from 'sonner';
import { DatePresetKey, getDateRangeFromPreset } from '@/utils/dateUtils';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

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
  cached_image_url: string | null; // Permanent cached URL in Supabase Storage
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
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [dataDateRange, setDataDateRange] = useState<{ from: string; to: string } | null>(null);
  const { projects, loading: projectsLoading } = useProjects();
  
  // Use ref to track loaded period without causing re-renders/recreations
  const lastLoadedPeriodRef = useRef<string | null>(null);

  // Get selected project from localStorage - with validation for guests
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = useMemo(() => {
    if (projectsLoading) return undefined;
    
    // If no projects available, return null
    if (!projects.length) return null;
    
    // Try to find the stored project
    if (selectedProjectId) {
      const found = projects.find(p => p.id === selectedProjectId);
      if (found) return found;
      
      // Project not found (guest without access) - clear and use first available
      console.log('[META] Stored project not accessible, clearing localStorage');
      localStorage.removeItem('selectedProjectId');
    }
    
    // Default to first available project and save it
    const defaultProject = projects[0] || null;
    if (defaultProject && !selectedProjectId) {
      // Auto-save the first project for guests who only have one project
      localStorage.setItem('selectedProjectId', defaultProject.id);
      console.log('[META] Auto-selected project:', defaultProject.id);
    }
    return defaultProject;
  }, [projects, projectsLoading, selectedProjectId]);

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

  // Load metrics by period - CALCULATES from ads_daily_metrics via SQL
  const loadMetricsByPeriod = useCallback(async (periodKey: string, forceReload: boolean = false, customDateRange?: DateRange) => {
    if (!selectedProject) {
      setLoading(false);
      return { found: false };
    }

    // Create a unique key that includes custom dates if present
    const cacheKey = periodKey === 'custom' && customDateRange?.from && customDateRange?.to
      ? `custom_${format(customDateRange.from, 'yyyy-MM-dd')}_${format(customDateRange.to, 'yyyy-MM-dd')}`
      : periodKey;

    // Skip if already loaded this period (unless forced)
    if (!forceReload && lastLoadedPeriodRef.current === cacheKey) {
      console.log(`[PERIOD] Already loaded period ${cacheKey}, skipping`);
      return { found: true };
    }

    console.log(`[PERIOD] Loading metrics for period: ${periodKey} from ads_daily_metrics`);
    setLoading(true);

    try {
      let since: string, until: string;
      
      // Check if custom period with date range
      if (periodKey === 'custom' && customDateRange?.from && customDateRange?.to) {
        since = format(customDateRange.from, 'yyyy-MM-dd');
        until = format(customDateRange.to, 'yyyy-MM-dd');
        console.log(`[PERIOD] Using custom date range: ${since} to ${until}`);
      } else {
        // Use centralized date utility for consistent date ranges
        const period = getDateRangeFromPreset(periodKey as DatePresetKey, 'America/Sao_Paulo');
        
        if (period) {
          since = period.since;
          until = period.until;
        } else {
          // Fallback for custom - last 30 days
          const now = new Date();
          since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          until = now.toISOString().split('T')[0];
        }
      }

      console.log(`[PERIOD] Date range: ${since} to ${until}`);

      // First, check what dates we have data for (for display purposes)
      const { data: firstDateData } = await supabase
        .from('ads_daily_metrics')
        .select('date')
        .eq('project_id', selectedProject.id)
        .order('date', { ascending: true })
        .limit(1);
      
      const { data: lastDateData } = await supabase
        .from('ads_daily_metrics')
        .select('date')
        .eq('project_id', selectedProject.id)
        .order('date', { ascending: false })
        .limit(1);
      
      if (firstDateData?.length && lastDateData?.length) {
        setDataDateRange({
          from: new Date(firstDateData[0].date + 'T00:00:00').toLocaleDateString('pt-BR'),
          to: new Date(lastDateData[0].date + 'T00:00:00').toLocaleDateString('pt-BR'),
        });
      } else {
        setDataDateRange(null);
      }

      // Query ads_daily_metrics and aggregate - fetch ALL records (no 1000 limit)
      // We need to paginate to get all records since Supabase defaults to 1000
      let allDailyMetrics: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: dailyMetrics, error } = await supabase
          .from('ads_daily_metrics')
          .select('*')
          .eq('project_id', selectedProject.id)
          .gte('date', since)
          .lte('date', until)
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('date', { ascending: true });

        if (error) {
          console.error('Error loading daily metrics:', error);
          throw error;
        }

        if (dailyMetrics && dailyMetrics.length > 0) {
          allDailyMetrics = [...allDailyMetrics, ...dailyMetrics];
          page++;
          hasMore = dailyMetrics.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const dailyMetrics = allDailyMetrics;
      console.log(`[PERIOD] Fetched ${dailyMetrics.length} total records (${page} pages)`);

      if (!dailyMetrics || dailyMetrics.length === 0) {
        console.log(`[PERIOD] No daily data found for period ${since} to ${until}`);
        setUsingFallbackData(true);
        // Don't load fallback data - show empty state instead
        setCampaigns([]);
        setAdSets([]);
        setAds([]);
        lastLoadedPeriodRef.current = cacheKey;
        setLoading(false);
        return { found: false, noData: true };
      }

      setUsingFallbackData(false);
      console.log(`[PERIOD] Found ${dailyMetrics.length} daily records`);

      // Aggregate by campaign
      const campaignAgg = new Map<string, any>();
      const adsetAgg = new Map<string, any>();
      const adAgg = new Map<string, any>();

      for (const row of dailyMetrics) {
        // Campaign aggregation
        if (!campaignAgg.has(row.campaign_id)) {
          campaignAgg.set(row.campaign_id, {
            id: row.campaign_id, project_id: selectedProject.id, name: row.campaign_name,
            status: row.campaign_status, objective: row.campaign_objective,
            spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0,
          });
        }
        const ca = campaignAgg.get(row.campaign_id);
        ca.spend += Number(row.spend) || 0;
        ca.impressions += Number(row.impressions) || 0;
        ca.clicks += Number(row.clicks) || 0;
        ca.reach += Number(row.reach) || 0;
        ca.conversions += Number(row.conversions) || 0;
        ca.conversion_value += Number(row.conversion_value) || 0;

        // Adset aggregation
        if (!adsetAgg.has(row.adset_id)) {
          adsetAgg.set(row.adset_id, {
            id: row.adset_id, project_id: selectedProject.id, campaign_id: row.campaign_id,
            name: row.adset_name, status: row.adset_status,
            spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0,
          });
        }
        const asa = adsetAgg.get(row.adset_id);
        asa.spend += Number(row.spend) || 0;
        asa.impressions += Number(row.impressions) || 0;
        asa.clicks += Number(row.clicks) || 0;
        asa.reach += Number(row.reach) || 0;
        asa.conversions += Number(row.conversions) || 0;
        asa.conversion_value += Number(row.conversion_value) || 0;

        // Ad aggregation
        if (!adAgg.has(row.ad_id)) {
          const thumbnail = row.cached_creative_thumbnail || row.creative_thumbnail;
          adAgg.set(row.ad_id, {
            id: row.ad_id, project_id: selectedProject.id, campaign_id: row.campaign_id,
            ad_set_id: row.adset_id, name: row.ad_name, status: row.ad_status,
            creative_id: row.creative_id, 
            creative_thumbnail: thumbnail,
            creative_image_url: thumbnail, // Use same URL for image
            cached_image_url: row.cached_creative_thumbnail || null,
            spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0,
          });
        }
        const ada = adAgg.get(row.ad_id);
        ada.spend += Number(row.spend) || 0;
        ada.impressions += Number(row.impressions) || 0;
        ada.clicks += Number(row.clicks) || 0;
        ada.reach += Number(row.reach) || 0;
        ada.conversions += Number(row.conversions) || 0;
        ada.conversion_value += Number(row.conversion_value) || 0;
      }

      // Fetch creative data from ads table to enrich aggregated ads
      const adIds = Array.from(adAgg.keys());
      const creativeMap = new Map<string, any>();
      
      if (adIds.length > 0) {
        console.log(`[PERIOD] Fetching creative data for ${adIds.length} ads from ads table`);
        
        // Paginate to handle large number of ads
        const chunkSize = 100;
        for (let i = 0; i < adIds.length; i += chunkSize) {
          const chunk = adIds.slice(i, i + chunkSize);
          const { data: adCreativeData, error: creativeError } = await supabase
            .from('ads')
            .select('id, creative_id, creative_thumbnail, creative_image_url, creative_video_url, cached_image_url, headline, primary_text, cta')
            .in('id', chunk);
          
          if (!creativeError && adCreativeData) {
            for (const ad of adCreativeData) {
              creativeMap.set(ad.id, ad);
            }
          }
        }
        console.log(`[PERIOD] Found creative data for ${creativeMap.size} ads`);
      }

      // Calculate derived metrics - for campaigns and adsets
      const calcMetrics = (agg: any) => ({
        ...agg,
        ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
        cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
        roas: agg.spend > 0 ? agg.conversion_value / agg.spend : 0,
        cpa: agg.conversions > 0 ? agg.spend / agg.conversions : 0,
        frequency: agg.reach > 0 ? agg.impressions / agg.reach : 0,
        synced_at: new Date().toISOString(),
        daily_budget: null, lifetime_budget: null, targeting: null,
        created_time: null, updated_time: null,
      });
      
      // Calculate derived metrics for ads - enriching with creative data from ads table
      const calcAdMetrics = (agg: any) => {
        const creative = creativeMap.get(agg.id);
        return {
          ...agg,
          ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
          cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
          cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
          roas: agg.spend > 0 ? agg.conversion_value / agg.spend : 0,
          cpa: agg.conversions > 0 ? agg.spend / agg.conversions : 0,
          frequency: agg.reach > 0 ? agg.impressions / agg.reach : 0,
          synced_at: new Date().toISOString(),
          daily_budget: null, lifetime_budget: null, targeting: null,
          created_time: null, updated_time: null,
          // Enrich with creative data from ads table
          creative_image_url: creative?.creative_image_url || creative?.cached_image_url || agg.creative_thumbnail || null,
          creative_video_url: creative?.creative_video_url || null,
          cached_image_url: creative?.cached_image_url || null,
          creative_thumbnail: agg.creative_thumbnail || creative?.creative_thumbnail || null,
          headline: creative?.headline || null,
          primary_text: creative?.primary_text || null,
          cta: creative?.cta || null,
        };
      };

      const campaignsResult = Array.from(campaignAgg.values()).map(calcMetrics);
      const adsetsResult = Array.from(adsetAgg.values()).map(calcMetrics);
      const adsResult = Array.from(adAgg.values()).map(calcAdMetrics);

      // Sort by spend
      campaignsResult.sort((a, b) => b.spend - a.spend);
      adsetsResult.sort((a, b) => b.spend - a.spend);
      adsResult.sort((a, b) => b.spend - a.spend);

      setCampaigns(campaignsResult as Campaign[]);
      setAdSets(adsetsResult as AdSet[]);
      setAds(adsResult as Ad[]);
      lastLoadedPeriodRef.current = cacheKey;

      console.log(`[PERIOD] Loaded: ${campaignsResult.length} campaigns, ${adsetsResult.length} adsets, ${adsResult.length} ads`);
      return { found: true };
    } catch (error) {
      console.error('Error loading period metrics:', error);
      await loadDataFromDatabase();
      return { found: false };
    } finally {
      setLoading(false);
    }
  }, [selectedProject, loadDataFromDatabase]);

  // Load metrics by date range - calculates period key and loads from period_metrics
  const loadByDateRange = useCallback(async (dateRange: { from: Date; to: Date }) => {
    // For custom date ranges, load from main tables
    return loadDataFromDatabase();
  }, [loadDataFromDatabase]);

  // Sync with Meta API - ONLY for manual/emergency use
  const syncData = useCallback(async (timeRange?: { since: string; until: string }, periodKey?: string) => {
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
      
      if (timeRange) {
        body.time_range = timeRange;
        body.period_key = periodKey || 'custom';
        console.log('Manual sync with time range:', timeRange, 'period:', periodKey);
      } else {
        body.date_preset = 'last_30d';
        body.period_key = 'this_month';
        console.log('Manual sync with default: this_month');
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
        lastLoadedPeriodRef.current = null;
        
        // Reload data from database
        if (periodKey) {
          await loadMetricsByPeriod(periodKey);
        } else {
          await loadDataFromDatabase();
        }
        
        return { success: true, data: data.data };
      } else {
        console.error('Sync failed:', data.error);
        
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
  }, [selectedProject, loadDataFromDatabase, loadMetricsByPeriod]);

  // Sync demographic data from Meta API
  const syncDemographics = useCallback(async (timeRange?: { since: string; until: string }) => {
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
      
      if (timeRange) {
        body.time_range = timeRange;
      }
      
      console.log('[DEMOGRAPHICS] Starting sync...');
      
      const { data, error } = await supabase.functions.invoke('sync-demographics', {
        body,
      });

      if (error) {
        console.error('Demographics sync error:', error);
        throw error;
      }

      console.log('Demographics sync response:', data);

      if (data.success) {
        toast.success(`Dados demográficos sincronizados! ${data.records_count || 0} registros.`);
        return { success: true, data };
      } else {
        toast.error(data.error || 'Erro ao sincronizar dados demográficos');
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Demographics sync error:', error);
      toast.error('Erro ao sincronizar dados demográficos');
      return { success: false, error };
    } finally {
      setSyncing(false);
    }
  }, [selectedProject]);

  // Reset lastLoadedPeriod when project changes
  useEffect(() => {
    if (!selectedProject?.id) return;
    
    lastLoadedPeriodRef.current = null;
    loadDataFromDatabase();
  }, [selectedProject?.id, loadDataFromDatabase]);

  return {
    campaigns,
    adSets,
    ads,
    loading: loading || projectsLoading,
    syncing,
    selectedProject,
    projectsLoading,
    usingFallbackData,
    dataDateRange,
    syncData,
    syncDemographics,
    loadDataFromDatabase,
    loadMetricsByPeriod,
    loadByDateRange,
    fetchCampaigns,
    fetchAdSets,
    fetchAds,
  };
}
