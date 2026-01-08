import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

export type SyncStep = 'idle' | 'campaigns' | 'adsets' | 'ads' | 'insights' | 'saving' | 'complete' | 'error';

export interface CacheStats {
  cached_creatives: number;
  new_creatives: number;
  cache_hit_rate: number;
}

export interface SyncProgress {
  step: SyncStep;
  message: string;
  detail?: {
    current: number;
    total: number;
    entity: string;
  };
  cacheStats?: CacheStats;
}

export interface AllPeriodsProgress {
  currentPeriod: number;
  totalPeriods: number;
  periodKey: string;
}

const stepMessages: Record<SyncStep, string> = {
  idle: '',
  campaigns: 'Buscando campanhas...',
  adsets: 'Buscando conjuntos de anúncios...',
  ads: 'Buscando anúncios...',
  insights: 'Carregando métricas...',
  saving: 'Salvando dados...',
  complete: 'Sincronização concluída!',
  error: 'Erro na sincronização',
};

interface UseSyncWithProgressOptions {
  projectId: string;
  adAccountId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  lightSync?: boolean; // Se true, pula fetch de criativos/imagens HD (mais rápido, mas sem HD)
}

const THROTTLE_MS = 10000; // 10 seconds minimum between syncs
const AUTO_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Period configurations
const ALL_PERIODS = [
  { key: 'last_7d', days: 7 },
  { key: 'last_14d', days: 14 },
  { key: 'last_30d', days: 30 },
  { key: 'last_60d', days: 60 },
  { key: 'last_90d', days: 90 },
];

export function useSyncWithProgress({ projectId, adAccountId, onSuccess, onError, lightSync = false }: UseSyncWithProgressOptions) {
  // IMPORTANTE: lightSync=false é o padrão para garantir extração HD de imagens e criativos
  const [syncing, setSyncing] = useState(false);
  const [syncingAllPeriods, setSyncingAllPeriods] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({ step: 'idle', message: '' });
  const [allPeriodsProgress, setAllPeriodsProgress] = useState<AllPeriodsProgress | null>(null);
  const lastSyncTime = useRef<number>(0);
  const autoSyncInterval = useRef<NodeJS.Timeout | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSyncInterval.current) clearInterval(autoSyncInterval.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const syncData = useCallback(async (timeRange?: { since: string; until: string }) => {
    if (!projectId || !adAccountId) return false;
    
    // Throttle check - skip if syncing all periods
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime.current;
    if (!syncingAllPeriods && timeSinceLastSync < THROTTLE_MS && lastSyncTime.current > 0) {
      const waitSeconds = Math.ceil((THROTTLE_MS - timeSinceLastSync) / 1000);
      toast.info(`Aguarde ${waitSeconds}s antes de sincronizar novamente`);
      return false;
    }

    setSyncing(true);
    setProgress({ step: 'campaigns', message: stepMessages.campaigns });

    try {
      // Simulate step progression while waiting for response
      const stepTimer = setTimeout(() => {
        setProgress({ step: 'adsets', message: stepMessages.adsets });
      }, 2000);

      const stepTimer2 = setTimeout(() => {
        setProgress({ step: 'ads', message: stepMessages.ads });
      }, 4000);

      const stepTimer3 = setTimeout(() => {
        setProgress({ step: 'insights', message: stepMessages.insights });
      }, 6000);

      console.log('Syncing with time range:', timeRange);
      
      const response = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: projectId,
          ad_account_id: adAccountId,
          time_range: timeRange,
          light_sync: lightSync, // false = extração HD completa (padrão), true = sync rápido sem HD
        },
      });

      // Clear step timers
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      const { data, error } = response;
      
      console.log('Sync response:', data);

      // Handle rate limit - now always comes in data since we return 200
      if (data?.keep_existing || data?.rate_limited) {
        setProgress({ step: 'error', message: 'Rate limit - usando dados existentes' });
        toast.warning('Limite de API da Meta atingido. Usando dados existentes. Aguarde 2 min.');
        onSuccess?.(); // Still call success to refetch existing data
        return false;
      }

      if (error) {
        setProgress({ step: 'error', message: stepMessages.error });
        console.error('Sync error:', error);
        toast.error('Erro na sincronização');
        onError?.(error.message);
        return false;
      }

      // Check if success is false (other errors)
      if (data?.success === false) {
        setProgress({ step: 'error', message: stepMessages.error });
        toast.error(data?.error || 'Erro na sincronização');
        onError?.(data?.error || 'Unknown error');
        return false;
      }

      // Success with detailed info
      lastSyncTime.current = Date.now();
      
      // Response comes directly as: { success, campaigns, adsets, ads, records, elapsed_seconds, cache_stats }
      const campaignsCount = data?.campaigns || 0;
      const adsetsCount = data?.adsets || 0;
      const adsCount = data?.ads || 0;
      const elapsedSeconds = data?.elapsed_seconds || '0';
      const cacheStats = data?.cache_stats;
      
      if (data?.success) {
        const cacheInfo = cacheStats 
          ? ` (${cacheStats.cached_creatives} em cache, ${cacheStats.new_creatives} novos)`
          : '';
        
        setProgress({ 
          step: 'complete', 
          message: `Sincronizado em ${elapsedSeconds}s`,
          detail: {
            current: campaignsCount + adsetsCount + adsCount,
            total: campaignsCount + adsetsCount + adsCount,
            entity: `${campaignsCount} campanhas, ${adsetsCount} conjuntos, ${adsCount} anúncios${cacheInfo}`
          },
          cacheStats
        });
        
        // Cache this data
        const cacheKey = timeRange ? `${timeRange.since}_${timeRange.until}` : 'default';
        console.log('Data cached for period:', timeRange || cacheKey);
        
        // Only show toast if not syncing all periods (to avoid spam)
        if (!syncingAllPeriods) {
          toast.success(`Sincronizado: ${campaignsCount} campanhas, ${adsetsCount} conjuntos, ${adsCount} anúncios`);
        }
      } else {
        setProgress({ step: 'complete', message: stepMessages.complete });
        if (!syncingAllPeriods) {
          toast.success('Dados sincronizados com sucesso!');
        }
      }
      
      onSuccess?.();
      return true;
    } catch (error) {
      setProgress({ step: 'error', message: stepMessages.error });
      console.error('Sync error:', error);
      toast.error('Erro na sincronização');
      onError?.(error instanceof Error ? error.message : 'Unknown error');
      return false;
    } finally {
      setSyncing(false);
      // Reset progress after a delay
      setTimeout(() => {
        setProgress({ step: 'idle', message: '' });
      }, 3000);
    }
  }, [projectId, adAccountId, onSuccess, onError, syncingAllPeriods, lightSync]);

  // Sync all periods (7, 14, 30, 60, 90 days)
  const syncAllPeriods = useCallback(async () => {
    if (!projectId || !adAccountId) return false;
    
    setSyncingAllPeriods(true);
    setAllPeriodsProgress({ currentPeriod: 0, totalPeriods: ALL_PERIODS.length, periodKey: '' });
    
    const today = new Date();
    let successCount = 0;
    const syncedPeriods: string[] = [];
    
    toast.info('Iniciando sincronização de todos os períodos...');
    
    for (let i = 0; i < ALL_PERIODS.length; i++) {
      const period = ALL_PERIODS[i];
      
      setAllPeriodsProgress({
        currentPeriod: i + 1,
        totalPeriods: ALL_PERIODS.length,
        periodKey: period.key,
      });
      
      setProgress({ 
        step: 'campaigns', 
        message: `Sincronizando período ${i + 1}/${ALL_PERIODS.length}: ${period.key}` 
      });
      
      const since = format(subDays(today, period.days), 'yyyy-MM-dd');
      const until = format(today, 'yyyy-MM-dd');
      
      console.log(`[SyncAllPeriods] Syncing period ${period.key}: ${since} to ${until}`);
      
      try {
        const response = await supabase.functions.invoke('meta-ads-sync', {
          body: {
            project_id: projectId,
            ad_account_id: adAccountId,
            time_range: { since, until },
            light_sync: false, // SEMPRE false para garantir extração HD de imagens e criativos
          },
        });
        
        if (response.data?.success !== false && !response.error) {
          successCount++;
          syncedPeriods.push(period.key);
          console.log(`[SyncAllPeriods] Period ${period.key} synced successfully`);
        } else {
          console.error(`[SyncAllPeriods] Period ${period.key} failed:`, response.error || response.data?.error);
        }
        
        // Small delay between syncs to avoid rate limiting
        if (i < ALL_PERIODS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`[SyncAllPeriods] Period ${period.key} error:`, error);
      }
    }
    
    setSyncingAllPeriods(false);
    setAllPeriodsProgress(null);
    
    if (successCount === ALL_PERIODS.length) {
      setProgress({ step: 'complete', message: 'Todos os períodos sincronizados!' });
      toast.success(`Sincronização completa! ${successCount}/${ALL_PERIODS.length} períodos sincronizados.`);
    } else if (successCount > 0) {
      setProgress({ step: 'complete', message: `${successCount}/${ALL_PERIODS.length} períodos sincronizados` });
      toast.warning(`Sincronização parcial: ${successCount}/${ALL_PERIODS.length} períodos.`);
    } else {
      setProgress({ step: 'error', message: 'Falha ao sincronizar períodos' });
      toast.error('Falha ao sincronizar os períodos.');
    }
    
    // Log the sync
    try {
      await supabase.from('sync_logs').insert({
        project_id: projectId,
        status: successCount === ALL_PERIODS.length ? 'success' : successCount > 0 ? 'partial' : 'error',
        message: JSON.stringify({
          summary: `Sincronizados ${successCount}/${ALL_PERIODS.length} períodos`,
          periods: syncedPeriods,
        }),
      });
    } catch (error) {
      console.error('Error logging sync:', error);
    }
    
    onSuccess?.();
    return successCount > 0;
  }, [projectId, adAccountId, onSuccess]);

  // Debounced sync for date range changes
  const syncWithDebounce = useCallback((timeRange?: { since: string; until: string }) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    debounceTimer.current = setTimeout(() => {
      syncData(timeRange);
    }, 1500); // 1.5 second debounce
  }, [syncData]);

  // Start auto-sync interval
  const startAutoSync = useCallback((timeRange?: { since: string; until: string }) => {
    if (autoSyncInterval.current) clearInterval(autoSyncInterval.current);
    
    autoSyncInterval.current = setInterval(() => {
      // Only sync if tab is visible and not already syncing
      if (!document.hidden && !syncing) {
        console.log('[AUTO-SYNC] Running 15-minute auto-sync');
        syncData(timeRange);
      }
    }, AUTO_SYNC_INTERVAL);
  }, [syncData, syncing]);

  // Stop auto-sync
  const stopAutoSync = useCallback(() => {
    if (autoSyncInterval.current) {
      clearInterval(autoSyncInterval.current);
      autoSyncInterval.current = null;
    }
  }, []);

  // Check if can sync (throttle)
  const canSync = useCallback(() => {
    const timeSinceLastSync = Date.now() - lastSyncTime.current;
    return timeSinceLastSync >= THROTTLE_MS || lastSyncTime.current === 0;
  }, []);

  // Get time until can sync again
  const getTimeUntilCanSync = useCallback(() => {
    const timeSinceLastSync = Date.now() - lastSyncTime.current;
    if (timeSinceLastSync >= THROTTLE_MS) return 0;
    return Math.ceil((THROTTLE_MS - timeSinceLastSync) / 1000);
  }, []);

  return {
    syncing,
    syncingAllPeriods,
    progress,
    allPeriodsProgress,
    syncData,
    syncAllPeriods,
    syncWithDebounce,
    startAutoSync,
    stopAutoSync,
    canSync,
    getTimeUntilCanSync,
  };
}
