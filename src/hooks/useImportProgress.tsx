import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ImportSyncProgress {
  status: 'idle' | 'importing' | 'syncing' | 'success' | 'partial' | 'error';
  progress: number;
  message: string;
  started_at: string | null;
}

export interface ImportMonitor {
  projectId: string;
  projectName: string;
  progress: number;
  status: 'idle' | 'importing' | 'syncing' | 'success' | 'partial' | 'error';
  message: string;
  startedAt: string | null;
}

export function useImportProgress(projectId?: string) {
  const [monitor, setMonitor] = useState<ImportMonitor | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const startMonitoring = useCallback((id: string, name: string) => {
    setMonitor({
      projectId: id,
      projectName: name,
      progress: 0,
      status: 'idle',
      message: 'Aguardando início...',
      startedAt: null,
    });
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    setMonitor(null);
  }, []);

  // Real-time subscription to project updates
  useEffect(() => {
    if (!isMonitoring || !monitor?.projectId) return;

    const channel = supabase
      .channel(`import-progress-${monitor.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${monitor.projectId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          const syncProgress = updated.sync_progress as ImportSyncProgress | null;

          if (syncProgress && 'status' in syncProgress) {
            setMonitor(prev => prev ? {
              ...prev,
              progress: syncProgress.progress || 0,
              status: syncProgress.status || 'idle',
              message: syncProgress.message || '',
              startedAt: syncProgress.started_at,
            } : null);

            // Auto-stop on completion
            if (syncProgress.status === 'success' || syncProgress.status === 'error' || syncProgress.status === 'partial') {
              setTimeout(() => {
                setIsMonitoring(false);
              }, 2000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMonitoring, monitor?.projectId]);

  // Initial fetch of current state
  useEffect(() => {
    if (!isMonitoring || !monitor?.projectId) return;

    const fetchCurrentState = async () => {
      const { data } = await supabase
        .from('projects')
        .select('sync_progress, name')
        .eq('id', monitor.projectId)
        .single();

      if (data) {
        const rawProgress = data.sync_progress;
        const syncProgress = rawProgress && typeof rawProgress === 'object' && !Array.isArray(rawProgress)
          ? rawProgress as unknown as ImportSyncProgress
          : null;

        if (syncProgress && 'status' in syncProgress) {
          setMonitor(prev => prev ? {
            ...prev,
            projectName: data.name,
            progress: syncProgress.progress || 0,
            status: syncProgress.status || 'idle',
            message: syncProgress.message || '',
            startedAt: syncProgress.started_at,
          } : null);
        }
      }
    };

    fetchCurrentState();
  }, [isMonitoring, monitor?.projectId]);

  return {
    monitor,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  };
}
