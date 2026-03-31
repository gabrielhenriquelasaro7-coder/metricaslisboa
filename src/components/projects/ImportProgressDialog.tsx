import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMonthImportStatus } from '@/hooks/useMonthImportStatus';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const statusIcon = (status: string) => {
  switch (status) {
    case 'success': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    case 'error': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case 'importing': return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    case 'skipped': return <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />;
    default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

const statusColor = (status: string) => {
  switch (status) {
    case 'success': return 'bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-400';
    case 'error': return 'bg-red-500/20 border-red-500/30 text-red-600 dark:text-red-400';
    case 'importing': return 'bg-primary/20 border-primary/30 text-primary animate-pulse';
    case 'skipped': return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-600 dark:text-yellow-400';
    default: return 'bg-muted border-border text-muted-foreground';
  }
};

export function ImportProgressDialog({ 
  open, 
  onOpenChange, 
  projectId,
  projectName 
}: ImportProgressDialogProps) {
  const { months, stats, progress: monthProgress } = useMonthImportStatus(projectId);
  const [statusMessage, setStatusMessage] = useState('Iniciando importação...');

  const isComplete = stats.total > 0 && stats.pending === 0 && stats.importing === 0;
  const hasError = stats.error > 0;
  const progress = stats.total > 0 ? monthProgress : 0;
  const isImporting = stats.importing > 0;

  useEffect(() => {
    if (!projectId || !open) return;

    if (isComplete && hasError) {
      setStatusMessage(`Importação concluída com ${stats.error} mês(es) com erro. ${stats.totalRecords} registros importados.`);
    } else if (isComplete) {
      setStatusMessage(`Importação completa! ${stats.totalRecords} registros importados.`);
    } else if (isImporting) {
      const importingMonth = months.find(m => m.status === 'importing');
      if (importingMonth) {
        setStatusMessage(`Importando ${MONTH_NAMES[importingMonth.month - 1]} ${importingMonth.year}...`);
      } else {
        setStatusMessage('Sincronizando dados...');
      }
    } else if (stats.total === 0) {
      setStatusMessage('Preparando meses para importação...');
    } else {
      setStatusMessage('Aguardando início da importação...');
    }
  }, [projectId, open, isComplete, hasError, isImporting, months, stats]);

  useEffect(() => {
    if (!open || !isComplete || hasError) return;

    const timer = window.setTimeout(() => {
      onOpenChange(false);
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [open, isComplete, hasError, onOpenChange]);

  // Group months by year
  const monthsByYear: Record<number, typeof months> = {};
  months.forEach(m => {
    if (!monthsByYear[m.year]) monthsByYear[m.year] = [];
    monthsByYear[m.year].push(m);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{statusMessage}</span>
            <span className="text-xs font-mono text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Month-by-month grid */}
          {stats.total > 0 && (
            <ScrollArea className="max-h-[300px]">
              <TooltipProvider>
                <div className="space-y-3">
                  {Object.entries(monthsByYear).sort(([a], [b]) => Number(a) - Number(b)).map(([year, yearMonths]) => (
                    <div key={year}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{year}</p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {yearMonths.map(m => (
                          <Tooltip key={m.id}>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-xs cursor-default transition-colors",
                                statusColor(m.status)
                              )}>
                                {statusIcon(m.status)}
                                <span className="font-medium text-[10px]">{MONTH_NAMES[m.month - 1]}</span>
                                {m.records_count > 0 && (
                                  <span className="text-[9px] opacity-70">{m.records_count}</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-semibold">{MONTH_NAMES[m.month - 1]} {m.year}</p>
                              <p>Status: {m.status}</p>
                              {m.records_count > 0 && <p>{m.records_count} registros</p>}
                              {m.error_message && <p className="text-red-400 max-w-[200px]">{m.error_message}</p>}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            </ScrollArea>
          )}

          {/* Stats summary */}
          {stats.total > 0 && (
            <div className="flex gap-2 flex-wrap">
              {stats.success > 0 && <Badge variant="outline" className="text-green-500 border-green-500/30">✓ {stats.success}</Badge>}
              {stats.importing > 0 && <Badge variant="outline" className="text-primary border-primary/30">⟳ {stats.importing}</Badge>}
              {stats.pending > 0 && <Badge variant="outline" className="text-muted-foreground">⏳ {stats.pending}</Badge>}
              {stats.error > 0 && <Badge variant="outline" className="text-red-500 border-red-500/30">✗ {stats.error}</Badge>}
              {stats.totalRecords > 0 && <Badge variant="outline">{stats.totalRecords.toLocaleString()} registros</Badge>}
            </div>
          )}

          {!isComplete && (
            <p className="text-xs text-muted-foreground text-center">
              Importando dados mês a mês... Isso pode levar alguns minutos.
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
