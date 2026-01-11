import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SyncStatusCardProps {
  status: 'syncing' | 'synced' | 'error' | 'pending';
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  progress?: number;
  recordsSynced?: number;
  errorMessage?: string;
  onRetry?: () => void;
  onForceSync?: () => void;
}

export function SyncStatusCard({
  status,
  lastSyncAt,
  nextSyncAt,
  progress = 0,
  recordsSynced = 0,
  errorMessage,
  onRetry,
  onForceSync
}: SyncStatusCardProps) {
  const statusConfig = {
    syncing: {
      icon: Loader2,
      label: 'Sincronizando',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/30'
    },
    synced: {
      icon: CheckCircle2,
      label: 'Sincronizado',
      color: 'text-metric-positive',
      bgColor: 'bg-metric-positive/10',
      borderColor: 'border-metric-positive/30'
    },
    error: {
      icon: AlertTriangle,
      label: 'Erro na sincronização',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30'
    },
    pending: {
      icon: Clock,
      label: 'Aguardando',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      borderColor: 'border-muted'
    }
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const formatDate = (date?: Date) => {
    if (!date) return '--';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatRelativeTime = (date?: Date) => {
    if (!date) return '--';
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const minutes = Math.round(diff / 60000);
    
    if (minutes < 0) {
      return `${Math.abs(minutes)} min atrás`;
    }
    return `em ${minutes} min`;
  };

  return (
    <Card className={cn('transition-colors', config.borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', config.bgColor)}>
              <StatusIcon className={cn('w-5 h-5', config.color, status === 'syncing' && 'animate-spin')} />
            </div>
            <div>
              <CardTitle className="text-base">Status da Sincronização</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn('font-medium', config.color, config.bgColor)}>
                  {config.label}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'error' && onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </Button>
            )}
            {status === 'synced' && onForceSync && (
              <Button variant="ghost" size="sm" onClick={onForceSync} className="gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4" />
                Sincronizar agora
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'syncing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Importando dados...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {recordsSynced > 0 && (
              <p className="text-xs text-muted-foreground">
                {recordsSynced.toLocaleString('pt-BR')} registros importados
              </p>
            )}
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Última sincronização</p>
            <p className="text-sm font-medium">{formatDate(lastSyncAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Próxima sincronização</p>
            <p className="text-sm font-medium">{formatRelativeTime(nextSyncAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
