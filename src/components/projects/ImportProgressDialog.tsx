import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

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

export function ImportProgressDialog({ 
  open, 
  onOpenChange, 
  projectId,
  projectName 
}: ImportProgressDialogProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Iniciando importação...');

  useEffect(() => {
    if (!projectId || !open) return;

    // Fetch initial logs
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

    // Subscribe to realtime updates
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

    // Poll for updates every 5 seconds as backup
    const interval = setInterval(fetchLogs, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [projectId, open]);

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
      // If message is not JSON, use status
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

  // Simulate progress while waiting for real updates
  useEffect(() => {
    if (!open || isComplete) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 2;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [open, isComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              hasError ? (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            Importando dados: {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={progress} className="h-2" />
          
          <p className="text-sm text-muted-foreground text-center">
            {statusMessage}
          </p>

          {!isComplete && (
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
