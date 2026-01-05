import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImportProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string;
}

interface SyncLog {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface SyncProgressData {
  id: string;
  project_id: string;
  sync_type: string;
  total_chunks: number;
  completed_chunks: number;
  current_chunk: { since: string; until: string; index: number } | null;
  status: string;
  records_synced: number;
  error_message: string | null;
}

// Helper to get month name and part from date range
function getMonthPart(since: string, until: string): { monthName: string; part: number; totalParts: number } {
  const sinceDate = parseISO(since);
  const untilDate = parseISO(until);
  const monthName = format(sinceDate, 'MMMM', { locale: ptBR });
  
  const dayOfMonth = sinceDate.getDate();
  let part = 1;
  if (dayOfMonth > 20) part = 3;
  else if (dayOfMonth > 10) part = 2;
  
  return { monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1), part, totalParts: 3 };
}

export function ImportProgressDialog({ 
  open, 
  onOpenChange, 
  projectId,
  projectName 
}: ImportProgressDialogProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgressData | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Iniciando importação...');
  const [chunkInfo, setChunkInfo] = useState<{ monthName: string; part: number; totalParts: number } | null>(null);

  // Poll sync_progress table for chunk updates
  useEffect(() => {
    if (!projectId || !open) return;

    const fetchSyncProgress = async () => {
      const { data } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const progressData: SyncProgressData = {
          ...data,
          current_chunk: data.current_chunk as SyncProgressData['current_chunk']
        };
        setSyncProgress(progressData);
        
        // Calculate progress percentage
        const percentage = progressData.total_chunks > 0 
          ? Math.round((progressData.completed_chunks / progressData.total_chunks) * 100)
          : 0;
        
        if (progressData.status === 'completed') {
          setProgress(100);
          setIsComplete(true);
          setStatusMessage(`Importação completa: ${progressData.records_synced.toLocaleString()} registros!`);
          setChunkInfo(null);
        } else if (progressData.status === 'error') {
          setProgress(percentage);
          setIsComplete(true);
          setHasError(true);
          setStatusMessage(progressData.error_message || 'Erro na importação');
        } else if (progressData.status === 'in_progress' && progressData.current_chunk) {
          setProgress(percentage);
          const chunk = progressData.current_chunk;
          const monthPart = getMonthPart(chunk.since, chunk.until);
          setChunkInfo(monthPart);
          setStatusMessage(`Sincronizando ${monthPart.monthName} parte ${monthPart.part}/${monthPart.totalParts}...`);
        }
      }
    };

    fetchSyncProgress();
    const interval = setInterval(fetchSyncProgress, 2000);

    return () => clearInterval(interval);
  }, [projectId, open]);

  // Fallback: also check sync_logs for legacy behavior
  useEffect(() => {
    if (!projectId || !open || syncProgress) return;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        setLogs(data);
        analyzeProgress(data);
      }
    };

    fetchLogs();

    const channel = supabase
      .channel(`sync-logs-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sync_logs',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newLog = payload.new as SyncLog;
          setLogs(prev => [newLog, ...prev]);
          analyzeProgress([newLog, ...logs]);
        }
      )
      .subscribe();

    const interval = setInterval(fetchLogs, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [projectId, open, syncProgress]);

  const analyzeProgress = (logData: SyncLog[]) => {
    const latestLog = logData[0];
    if (!latestLog) return;

    try {
      const message = latestLog.message ? JSON.parse(latestLog.message) : null;
      
      if (message?.type === 'historical_import') {
        const totalBatches = message.total_batches || 13;
        const successBatches = message.success_batches || 0;
        const totalRecords = message.total_records || 0;
        
        setProgress(100);
        setIsComplete(true);
        
        if (successBatches === 0) {
          setHasError(true);
          setStatusMessage(`Importação concluída, mas nenhum dado foi encontrado. Verifique as permissões do token Meta.`);
        } else if (successBatches < totalBatches) {
          setStatusMessage(`Importação parcial: ${successBatches}/${totalBatches} batches, ${totalRecords} registros`);
        } else {
          setStatusMessage(`Importação completa: ${totalRecords} registros importados!`);
        }
      } else if (latestLog.status === 'started') {
        setProgress(10);
        setStatusMessage('Importação iniciada...');
      } else if (latestLog.status === 'syncing') {
        setProgress(prev => Math.min(prev + 5, 90));
        setStatusMessage('Sincronizando dados do Meta Ads...');
      }
    } catch {
      if (latestLog.status === 'success') {
        setProgress(100);
        setIsComplete(true);
        setStatusMessage('Importação concluída!');
      } else if (latestLog.status === 'error') {
        setProgress(100);
        setIsComplete(true);
        setHasError(true);
        setStatusMessage(latestLog.message || 'Erro na importação');
      }
    }
  };

  // Simulate progress while waiting for real updates (only if no sync_progress)
  useEffect(() => {
    if (!open || isComplete || syncProgress) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 2;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [open, isComplete, syncProgress]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              hasError ? (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-metric-positive" />
              )
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            Importando dados: {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={progress} className="h-2" />
          
          <p className="text-sm text-muted-foreground text-center font-medium">
            {statusMessage}
          </p>

          {/* Chunk info with month/part */}
          {chunkInfo && !isComplete && (
            <div className="flex items-center justify-center gap-2 text-sm text-primary">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">
                {chunkInfo.monthName} - Parte {chunkInfo.part} de {chunkInfo.totalParts}
              </span>
            </div>
          )}

          {/* Records synced */}
          {syncProgress && syncProgress.records_synced > 0 && !isComplete && (
            <p className="text-xs text-muted-foreground text-center">
              {syncProgress.records_synced.toLocaleString()} registros sincronizados
            </p>
          )}

          {/* Chunk progress */}
          {syncProgress && syncProgress.total_chunks > 1 && !isComplete && (
            <p className="text-xs text-muted-foreground text-center">
              Chunk {syncProgress.completed_chunks + 1} de {syncProgress.total_chunks}
            </p>
          )}

          {!isComplete && !syncProgress && (
            <p className="text-xs text-muted-foreground text-center">
              Importando dados desde 01/01/2025... Isso pode levar alguns minutos.
            </p>
          )}

          {isComplete && (
            <div className="flex justify-center">
              <Button onClick={() => onOpenChange(false)}>
                {hasError ? 'Fechar' : 'Continuar'}
              </Button>
            </div>
          )}

          {hasError && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                <strong>Dica:</strong> Verifique se o token META_ACCESS_TOKEN tem permissões 
                "ads_read" ou "ads_management" para esta conta de anúncios.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
