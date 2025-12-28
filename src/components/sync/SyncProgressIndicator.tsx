import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SyncStep } from '@/hooks/useSyncWithProgress';

interface SyncProgressIndicatorProps {
  step: SyncStep;
  message: string;
  syncing: boolean;
}

const stepConfig: Record<SyncStep, { icon: React.ElementType; color: string }> = {
  idle: { icon: RefreshCw, color: 'text-muted-foreground' },
  campaigns: { icon: Loader2, color: 'text-primary' },
  adsets: { icon: Loader2, color: 'text-primary' },
  ads: { icon: Loader2, color: 'text-primary' },
  insights: { icon: Loader2, color: 'text-chart-1' },
  saving: { icon: Loader2, color: 'text-chart-2' },
  complete: { icon: CheckCircle2, color: 'text-metric-positive' },
  error: { icon: AlertCircle, color: 'text-metric-negative' },
};

export function SyncProgressIndicator({ step, message, syncing }: SyncProgressIndicatorProps) {
  if (step === 'idle' && !syncing) return null;

  const config = stepConfig[step];
  const Icon = config.icon;
  const shouldAnimate = syncing && step !== 'complete' && step !== 'error';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg text-sm">
      <Icon className={cn(
        'w-4 h-4',
        config.color,
        shouldAnimate && 'animate-spin'
      )} />
      <span className={cn('font-medium', config.color)}>
        {message}
      </span>
    </div>
  );
}
