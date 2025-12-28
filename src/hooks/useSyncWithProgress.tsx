import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SyncStep = 'idle' | 'campaigns' | 'adsets' | 'ads' | 'insights' | 'saving' | 'complete' | 'error';

interface SyncProgress {
  step: SyncStep;
  message: string;
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
}

const THROTTLE_MS = 10000; // 10 seconds minimum between syncs
const AUTO_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

export function useSyncWithProgress({ projectId, adAccountId, onSuccess, onError }: UseSyncWithProgressOptions) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({ step: 'idle', message: '' });
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
    
    // Throttle check
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime.current;
    if (timeSinceLastSync < THROTTLE_MS && lastSyncTime.current > 0) {
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

      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: projectId,
          ad_account_id: adAccountId,
          time_range: timeRange,
        },
      });

      // Clear step timers
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      // Handle rate limit
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

      // Success
      lastSyncTime.current = Date.now();
      setProgress({ step: 'complete', message: stepMessages.complete });
      
      const count = data?.data;
      if (count) {
        toast.success(`Sincronizado: ${count.campaigns_count} campanhas, ${count.ad_sets_count} conjuntos, ${count.ads_count} anúncios`);
      } else {
        toast.success('Dados sincronizados com sucesso!');
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
      }, 2000);
    }
  }, [projectId, adAccountId, onSuccess, onError]);

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
    progress,
    syncData,
    syncWithDebounce,
    startAutoSync,
    stopAutoSync,
    canSync,
    getTimeUntilCanSync,
  };
}
