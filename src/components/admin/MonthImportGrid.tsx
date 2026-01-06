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
  Play,
  RotateCcw,
  Database,
  TrendingUp,
  AlertCircle,
  Zap,
  Plus,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project } from '@/hooks/useProjects';

interface MonthImportGridProps {
  projects: Project[];
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getStatusStyles(status: MonthStatus) {
  switch (status) {
    case 'importing':
      return {
        bg: 'bg-primary/10 hover:bg-primary/20',
        border: 'border-primary/50',
        text: 'text-primary',
        glow: 'shadow-primary/20'
      };
    case 'success':
      return {
        bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
        border: 'border-emerald-500/50',
        text: 'text-emerald-500',
        glow: 'shadow-emerald-500/20'
      };
    case 'error':
      return {
        bg: 'bg-red-500/10 hover:bg-red-500/20',
        border: 'border-red-500/50',
        text: 'text-red-500',
        glow: 'shadow-red-500/20'
      };
    case 'skipped':
      return {
        bg: 'bg-muted/30 hover:bg-muted/50',
        border: 'border-muted-foreground/20',
        text: 'text-muted-foreground',
        glow: ''
      };
    default:
      return {
        bg: 'bg-muted/20 hover:bg-muted/40',
        border: 'border-border/50',
        text: 'text-muted-foreground',
        glow: ''
      };
  }
}

function MonthCell({ 
  month,
  monthIndex,
  year,
  onRetry, 
  isRetrying,
  isFuture
}: { 
  month: MonthImportRecord | null;
  monthIndex: number;
  year: number;
  onRetry?: () => void;
  isRetrying?: boolean;
  isFuture?: boolean;
}) {
  if (isFuture) {
    return (
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground/50 mb-1 font-medium">{MONTH_NAMES[monthIndex]}</span>
        <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-dashed border-border/30 bg-muted/5">
          <span className="text-muted-foreground/30 text-xs">—</span>
        </div>
      </div>
    );
  }

  // Se não tem registro do mês, ainda pode importar
  if (!month) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground/70 mb-1 font-medium">{MONTH_NAMES[monthIndex]}</span>
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer hover:scale-110"
              >
                {isRetrying ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Play className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-popover/95 backdrop-blur-sm">
            <div className="space-y-1">
              <p className="font-semibold text-sm">{MONTH_FULL_NAMES[monthIndex]} {year}</p>
              <p className="text-xs text-muted-foreground">Nunca importado</p>
              <p className="text-xs text-primary font-medium flex items-center gap-1">
                <Play className="w-3 h-3" />
                Clique para importar
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const styles = getStatusStyles(month.status);
  const isImporting = month.status === 'importing';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center">
            <span className={cn("text-[10px] mb-1 font-medium", styles.text)}>{MONTH_NAMES[monthIndex]}</span>
            <button
              className={cn(
                'w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-200',
                styles.bg,
                styles.border,
                !isImporting && 'cursor-pointer hover:scale-110 hover:shadow-lg',
                isImporting && 'cursor-not-allowed',
                styles.glow && `hover:shadow-lg ${styles.glow}`
              )}
              onClick={!isImporting ? onRetry : undefined}
              disabled={isRetrying || isImporting}
            >
              {isRetrying ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : month.status === 'importing' ? (
                <Loader2 className={cn("w-5 h-5 animate-spin", styles.text)} />
              ) : month.status === 'success' ? (
                <CheckCircle2 className={cn("w-5 h-5", styles.text)} />
              ) : month.status === 'error' ? (
                <XCircle className={cn("w-5 h-5", styles.text)} />
              ) : (
                <Clock className={cn("w-4 h-4", styles.text)} />
              )}
            </button>
            {month.status === 'success' && month.records_count > 0 && (
              <span className="text-[9px] mt-0.5 text-muted-foreground font-medium">
                {month.records_count >= 1000 
                  ? `${(month.records_count / 1000).toFixed(1)}k` 
                  : month.records_count}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-popover/95 backdrop-blur-sm">
          <div className="space-y-1.5">
            <p className="font-semibold text-sm">{MONTH_FULL_NAMES[month.month - 1]} {month.year}</p>
            <div className="flex items-center gap-2">
              <Badge variant={month.status === 'success' ? 'default' : month.status === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                {month.status === 'success' ? 'Completo' : month.status === 'error' ? 'Erro' : month.status === 'importing' ? 'Importando...' : 'Pendente'}
              </Badge>
            </div>
            {month.records_count > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Database className="w-3 h-3" />
                {month.records_count.toLocaleString('pt-BR')} registros
              </p>
            )}
            {month.error_message && (
              <p className="text-xs text-red-400 flex items-start gap-1">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                {month.error_message}
              </p>
            )}
            {month.retry_count > 0 && (
              <p className="text-xs text-muted-foreground">{month.retry_count} tentativa(s)</p>
            )}
            {!isImporting && (
              <p className="text-xs text-primary font-medium pt-1 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                Clique para reimportar
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", color)}>
      <Icon className="w-4 h-4" />
      <div className="flex flex-col">
        <span className="text-lg font-bold leading-none">{value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function ProjectMonthGrid({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [selectedYearToAdd, setSelectedYearToAdd] = useState<number | null>(null);
  const [syncingYear, setSyncingYear] = useState<number | null>(null);
  
  const {
    monthsByYear,
    loading,
    stats,
    progress,
    isRetrying,
    retryMonth,
    retryAllFailed,
    startChainedImport,
    syncEntireYear,
  } = useMonthImportStatus(projectId);

  const existingYears = Object.keys(monthsByYear).map(Number);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Anos disponíveis para adicionar (de 2020 até o ano atual, excluindo os que já existem)
  const availableYearsToAdd = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i)
    .filter(y => !existingYears.includes(y));
  
  // Anos a exibir: existentes + ano selecionado para adicionar
  const yearsToDisplay = [...existingYears];
  if (selectedYearToAdd && !yearsToDisplay.includes(selectedYearToAdd)) {
    yearsToDisplay.push(selectedYearToAdd);
  }
  const years = yearsToDisplay.sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando status...</span>
        </div>
      </div>
    );
  }

  if (years.length === 0 && availableYearsToAdd.length > 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
          <Calendar className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Nenhum mês importado</h3>
        <p className="text-muted-foreground text-sm mb-6">Selecione um ano para começar a importação</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {availableYearsToAdd.slice(0, 5).map(year => (
            <Button 
              key={year}
              variant="outline"
              onClick={() => startChainedImport(year, 1)}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Iniciar {year}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-3">
        <StatCard 
          icon={CheckCircle2} 
          label="Completos" 
          value={stats.success} 
          color="bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
        />
        <StatCard 
          icon={Loader2} 
          label="Importando" 
          value={stats.importing} 
          color="bg-primary/10 border-primary/30 text-primary"
        />
        <StatCard 
          icon={XCircle} 
          label="Erros" 
          value={stats.error} 
          color="bg-red-500/10 border-red-500/30 text-red-500"
        />
        <StatCard 
          icon={Clock} 
          label="Pendentes" 
          value={stats.pending} 
          color="bg-muted border-border text-muted-foreground"
        />
        
        {stats.totalRecords > 0 && (
          <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <Database className="w-4 h-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-primary leading-none">{stats.totalRecords.toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-muted-foreground">registros total</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Progresso geral</span>
          <span className="font-bold text-lg">{progress.toFixed(0)}%</span>
        </div>
        <div className="relative">
          <Progress value={progress} className="h-3 bg-muted/30" />
          {progress > 0 && progress < 100 && (
            <div 
              className="absolute top-0 h-3 bg-primary/30 animate-pulse rounded-full"
              style={{ left: `${Math.max(0, progress - 5)}%`, width: '5%' }}
            />
          )}
        </div>
      </div>

      {/* Year grids */}
      {years.map(year => {
        const yearRecords = monthsByYear[year]?.reduce((sum, m) => sum + (m.records_count || 0), 0) || 0;
        
        return (
          <div key={year} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {year}
              </h4>
              <div className="flex items-center gap-2">
                {yearRecords > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {yearRecords.toLocaleString('pt-BR')} registros
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setSyncingYear(year);
                    await syncEntireYear(year);
                    setSyncingYear(null);
                  }}
                  disabled={syncingYear === year || stats.importing > 0}
                  className="gap-1.5 h-7 text-xs"
                >
                  {syncingYear === year ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Sync {year}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 sm:gap-3 p-4 rounded-xl bg-muted/20 border border-border/50">
              {Array.from({ length: 12 }, (_, i) => {
                const monthNum = i + 1;
                const monthRecord = monthsByYear[year]?.find(m => m.month === monthNum);
                const isFuture = year === currentYear && monthNum > currentMonth;
                const retryKey = `${year}-${monthNum}`;
                
                return (
                  <MonthCell 
                    key={monthNum}
                    month={monthRecord || null}
                    monthIndex={i}
                    year={year}
                    onRetry={() => retryMonth(year, monthNum)}
                    isRetrying={isRetrying === retryKey}
                    isFuture={isFuture}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add year button */}
      {availableYearsToAdd.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/50">
          <span className="text-sm text-muted-foreground font-medium">Adicionar ano:</span>
          <div className="flex flex-wrap gap-2">
            {availableYearsToAdd.map(year => (
              <Button 
                key={year}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedYearToAdd(year);
                  // Inicia a importação do primeiro mês desse ano
                  startChainedImport(year, 1);
                }}
                className="gap-1.5"
              >
                <Plus className="w-3 h-3" />
                {year}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(stats.error > 0 || stats.pending > 0) && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {stats.error > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={retryAllFailed}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reimportar {stats.error} {stats.error === 1 ? 'mês com erro' : 'meses com erro'}
            </Button>
          )}
          {stats.pending > 0 && (
            <Button 
              variant="default" 
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
              <Zap className="w-4 h-4" />
              Continuar importação
            </Button>
          )}
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
    <Card className="glass-card overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Importação por Mês</CardTitle>
              <CardDescription className="text-sm">
                Status de importação mês a mês de cada projeto
              </CardDescription>
            </div>
          </div>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full sm:w-[220px] bg-background">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {activeProjects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  <span className="flex items-center gap-2">
                    <Database className="w-3 h-3" />
                    {project.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {selectedProject ? (
          <ProjectMonthGrid 
            projectId={selectedProject.id} 
            projectName={selectedProject.name}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Selecione um projeto para ver o status de importação</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
