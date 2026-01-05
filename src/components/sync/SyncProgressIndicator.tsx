import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Database, BarChart3, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SyncStep, SyncProgress, CacheStats } from '@/hooks/useSyncWithProgress';
import { Progress } from '@/components/ui/progress';

interface SyncProgressIndicatorProps {
  step: SyncStep;
  message: string;
  syncing: boolean;
  detail?: SyncProgress['detail'];
  cacheStats?: CacheStats;
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

export function SyncProgressIndicator({ step, message, syncing, detail, cacheStats }: SyncProgressIndicatorProps) {
  if (step === 'idle' && !syncing) return null;

  const config = stepConfig[step];
  const Icon = config.icon;
  const shouldAnimate = syncing && step !== 'complete' && step !== 'error';
  
  // Calculate progress percentage based on step
  const stepIndex = stepOrder.indexOf(step);
  const progressPercent = step === 'complete' ? 100 : step === 'error' ? 0 : Math.max(10, (stepIndex + 1) * 16);

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
            {message}
          </span>
        </div>
        {syncing && step !== 'complete' && step !== 'error' && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>
      
      {syncing && step !== 'complete' && step !== 'error' && (
        <Progress value={progressPercent} className="h-1.5" />
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
