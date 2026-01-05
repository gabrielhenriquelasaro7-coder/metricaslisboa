import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Database, BarChart3, HardDrive, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SyncStep, SyncProgress, CacheStats, ChunkProgress, DbSyncProgress } from '@/hooks/useSyncWithProgress';
import { Progress } from '@/components/ui/progress';

interface SyncProgressIndicatorProps {
  step: SyncStep;
  message: string;
  syncing: boolean;
  detail?: SyncProgress['detail'];
  cacheStats?: CacheStats;
  chunk?: ChunkProgress;
  dbProgress?: DbSyncProgress | null;
}

const stepConfig: Record<SyncStep, { icon: React.ElementType; color: string; label: string }> = {
  idle: { icon: RefreshCw, color: 'text-muted-foreground', label: '' },
  campaigns: { icon: Database, color: 'text-primary', label: 'Campanhas' },
  adsets: { icon: Database, color: 'text-primary', label: 'Conjuntos' },
  ads: { icon: Database, color: 'text-primary', label: 'Anúncios' },
  insights: { icon: BarChart3, color: 'text-chart-1', label: 'Métricas' },
  saving: { icon: Database, color: 'text-chart-2', label: 'Salvando' },
  complete: { icon: CheckCircle2, color: 'text-metric-positive', label: 'Concluído' },
  error: { icon: AlertCircle, color: 'text-metric-negative', label: 'Erro' },
};

// Step order for progress calculation
const stepOrder: SyncStep[] = ['campaigns', 'adsets', 'ads', 'insights', 'saving', 'complete'];

export function SyncProgressIndicator({ step, message, syncing, detail, cacheStats, chunk, dbProgress }: SyncProgressIndicatorProps) {
  if (step === 'idle' && !syncing && !dbProgress) return null;

  const config = stepConfig[step];
  const Icon = config.icon;
  const shouldAnimate = syncing && step !== 'complete' && step !== 'error';
  
  // Calculate progress percentage based on step and chunk
  const stepIndex = stepOrder.indexOf(step);
  let progressPercent = step === 'complete' ? 100 : step === 'error' ? 0 : Math.max(10, (stepIndex + 1) * 16);
  
  // If we have chunk info, use that for more accurate progress
  const activeChunk = chunk || (dbProgress?.current_chunk ? {
    current: dbProgress.completed_chunks + 1,
    total: dbProgress.total_chunks,
    since: dbProgress.current_chunk.since,
    until: dbProgress.current_chunk.until
  } : null);
  
  if (activeChunk && activeChunk.total > 1) {
    progressPercent = Math.round((activeChunk.current / activeChunk.total) * 100);
  }

  // Use db progress if available
  const showDbProgress = dbProgress && dbProgress.status === 'in_progress';
  const displayMessage = showDbProgress 
    ? `Chunk ${dbProgress.completed_chunks + 1}/${dbProgress.total_chunks}: ${dbProgress.current_chunk?.since || ''} a ${dbProgress.current_chunk?.until || ''}`
    : message;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-secondary/50 rounded-lg border border-border/50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            'w-4 h-4',
            config.color,
            shouldAnimate && (step === 'insights' || step === 'saving' ? 'animate-pulse' : 'animate-spin')
          )} />
          <span className={cn('font-medium text-sm', config.color)}>
            {displayMessage}
          </span>
        </div>
        {syncing && step !== 'complete' && step !== 'error' && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>
      
      {/* Progress bar */}
      {(syncing || showDbProgress) && step !== 'complete' && step !== 'error' && (
        <Progress value={progressPercent} className="h-1.5" />
      )}
      
      {/* Chunk info */}
      {activeChunk && activeChunk.total > 1 && (syncing || showDbProgress) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3 text-chart-1" />
          <span>
            Período {activeChunk.current}/{activeChunk.total}: {activeChunk.since} a {activeChunk.until}
          </span>
        </div>
      )}
      
      {/* Records synced */}
      {dbProgress && dbProgress.records_synced > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="w-3 h-3 text-chart-2" />
          <span>{dbProgress.records_synced.toLocaleString()} registros sincronizados</span>
        </div>
      )}
      
      {detail && step === 'complete' && (
        <p className="text-xs text-muted-foreground">
          {detail.entity}
        </p>
      )}
      
      {cacheStats && step === 'complete' && cacheStats.cache_hit_rate > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HardDrive className="w-3 h-3 text-chart-2" />
          <span>Cache: {cacheStats.cache_hit_rate}% ({cacheStats.cached_creatives} criativos em cache)</span>
        </div>
      )}
    </div>
  );
}
