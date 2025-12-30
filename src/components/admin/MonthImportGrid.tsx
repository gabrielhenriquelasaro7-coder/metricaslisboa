import { useState } from 'react';
import { useMonthImportStatus, MonthImportRecord, MonthStatus } from '@/hooks/useMonthImportStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar,
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  RefreshCw,
  Play,
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project } from '@/hooks/useProjects';

interface MonthImportGridProps {
  projects: Project[];
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function getStatusIcon(status: MonthStatus, size = 'w-4 h-4') {
  switch (status) {
    case 'importing':
      return <Loader2 className={cn(size, 'animate-spin text-primary')} />;
    case 'success':
      return <CheckCircle2 className={cn(size, 'text-metric-positive')} />;
    case 'error':
      return <XCircle className={cn(size, 'text-destructive')} />;
    case 'skipped':
      return <ChevronRight className={cn(size, 'text-muted-foreground')} />;
    default:
      return <Clock className={cn(size, 'text-muted-foreground')} />;
  }
}

function getStatusEmoji(status: MonthStatus): string {
  switch (status) {
    case 'importing': return '🔄';
    case 'success': return '✓';
    case 'error': return '❌';
    case 'skipped': return '⏭️';
    case 'pending': return '○';
    default: return '○';
  }
}

function getStatusColor(status: MonthStatus): string {
  switch (status) {
    case 'importing': return 'bg-primary/20 border-primary text-primary';
    case 'success': return 'bg-metric-positive/20 border-metric-positive text-metric-positive';
    case 'error': return 'bg-destructive/20 border-destructive text-destructive';
    case 'skipped': return 'bg-muted border-muted-foreground/30 text-muted-foreground';
    case 'pending': return 'bg-card border-border text-muted-foreground';
    default: return 'bg-card border-border text-muted-foreground';
  }
}

function MonthCell({ 
  month, 
  onRetry, 
  isRetrying 
}: { 
  month: MonthImportRecord | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  if (!month) {
    return (
      <div className="w-full aspect-square flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
        <span className="text-xs text-muted-foreground">-</span>
      </div>
    );
  }

  const statusColor = getStatusColor(month.status);
  const canRetry = month.status === 'error' || month.status === 'pending';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              'w-full aspect-square flex flex-col items-center justify-center rounded-lg border transition-all',
              statusColor,
              canRetry && 'cursor-pointer hover:scale-105 hover:shadow-md',
              !canRetry && 'cursor-default'
            )}
            onClick={canRetry ? onRetry : undefined}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span className="text-lg font-bold">{getStatusEmoji(month.status)}</span>
                {month.status === 'success' && month.records_count > 0 && (
                  <span className="text-[10px] font-medium mt-0.5">
                    {month.records_count >= 1000 
                      ? `${(month.records_count / 1000).toFixed(1)}k` 
                      : month.records_count}
                  </span>
                )}
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{MONTH_NAMES[month.month - 1]} {month.year}</p>
            <p className="text-sm">
              Status: <span className="capitalize">{month.status}</span>
            </p>
            {month.records_count > 0 && (
              <p className="text-sm">Registros: {month.records_count.toLocaleString('pt-BR')}</p>
            )}
            {month.error_message && (
              <p className="text-sm text-destructive">Erro: {month.error_message}</p>
            )}
            {month.retry_count > 0 && (
              <p className="text-sm text-muted-foreground">Tentativas: {month.retry_count}</p>
            )}
            {canRetry && (
              <p className="text-xs text-primary mt-1">Clique para reimportar</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProjectMonthGrid({ projectId, projectName }: { projectId: string; projectName: string }) {
  const {
    monthsByYear,
    loading,
    stats,
    progress,
    isRetrying,
    retryMonth,
    retryAllFailed,
    startChainedImport,
  } = useMonthImportStatus(projectId);

  const years = Object.keys(monthsByYear).map(Number).sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (years.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum mês configurado para importação</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={() => startChainedImport(currentYear, 1)}
        >
          <Play className="w-4 h-4 mr-2" />
          Iniciar importação desde Janeiro {currentYear}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progresso geral</span>
          <span className="font-medium">{progress.toFixed(0)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-metric-positive" />
            {stats.success} completos
          </span>
          <span className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 text-primary" />
            {stats.importing} em andamento
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-destructive" />
            {stats.error} erros
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {stats.pending} pendentes
          </span>
        </div>
      </div>

      {/* Year grids */}
      {years.map(year => (
        <div key={year} className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{year}</h4>
            <span className="text-xs text-muted-foreground">
              {monthsByYear[year]?.reduce((sum, m) => sum + (m.records_count || 0), 0).toLocaleString('pt-BR')} registros
            </span>
          </div>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const monthNum = i + 1;
              const monthRecord = monthsByYear[year]?.find(m => m.month === monthNum);
              const isCurrentOrFuture = year === currentYear && monthNum > currentMonth;
              const retryKey = `${year}-${monthNum}`;
              
              return (
                <div key={monthNum} className="relative">
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">
                    {MONTH_NAMES[i]}
                  </span>
                  {isCurrentOrFuture ? (
                    <div className="w-full aspect-square flex items-center justify-center rounded-lg bg-muted/10 border border-dashed border-border/30">
                      <span className="text-xs text-muted-foreground/50">-</span>
                    </div>
                  ) : (
                    <MonthCell 
                      month={monthRecord || null}
                      onRetry={() => retryMonth(year, monthNum)}
                      isRetrying={isRetrying === retryKey}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2">
        {stats.error > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={retryAllFailed}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reimportar {stats.error} meses com erro
          </Button>
        )}
        {stats.pending > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const firstPending = Object.values(monthsByYear)
                .flat()
                .find(m => m.status === 'pending');
              if (firstPending) {
                startChainedImport(firstPending.year, firstPending.month);
              }
            }}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            Continuar importação
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats.totalRecords > 0 && (
        <div className="text-sm text-muted-foreground pt-2 border-t border-border/50">
          Total: <span className="font-medium text-foreground">{stats.totalRecords.toLocaleString('pt-BR')}</span> registros importados
        </div>
      )}
    </div>
  );
}

export default function MonthImportGrid({ projects }: MonthImportGridProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const activeProjects = projects.filter(p => !p.archived);
  const selectedProject = activeProjects.find(p => p.id === selectedProjectId);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Importação por Mês
            </CardTitle>
            <CardDescription>
              Visualize e gerencie a importação mês a mês de cada projeto
            </CardDescription>
          </div>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {activeProjects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {selectedProject ? (
          <ProjectMonthGrid 
            projectId={selectedProject.id} 
            projectName={selectedProject.name}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Selecione um projeto para ver o status de importação
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Legenda:</p>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="text-lg">✓</span> Completo
            </span>
            <span className="flex items-center gap-1">
              <span className="text-lg">🔄</span> Importando
            </span>
            <span className="flex items-center gap-1">
              <span className="text-lg">○</span> Pendente
            </span>
            <span className="flex items-center gap-1">
              <span className="text-lg">❌</span> Erro (clique para retry)
            </span>
            <span className="flex items-center gap-1">
              <span className="text-lg">⏭️</span> Pulado
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
