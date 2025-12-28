import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, setHours, setMinutes, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncStatusBadgeProps {
  projectId?: string;
}

export function SyncStatusBadge({ projectId }: SyncStatusBadgeProps) {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [status, setStatus] = useState<'success' | 'partial' | 'error' | 'pending'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    const fetchSyncStatus = async () => {
      setLoading(true);
      
      // Get project last_sync_at and webhook_status
      const { data: project } = await supabase
        .from('projects')
        .select('last_sync_at, webhook_status')
        .eq('id', projectId)
        .single();

      if (project) {
        if (project.last_sync_at) {
          setLastSync(new Date(project.last_sync_at));
        }
        
        if (project.webhook_status === 'success') {
          setStatus('success');
        } else if (project.webhook_status === 'partial') {
          setStatus('partial');
        } else if (project.webhook_status === 'error') {
          setStatus('error');
        } else {
          setStatus('pending');
        }
      }
      
      setLoading(false);
    };

    fetchSyncStatus();
  }, [projectId]);

  // Calculate next sync time (2 AM BRT next day)
  const getNextSyncTime = (): Date => {
    const now = new Date();
    let nextSync = setMinutes(setHours(now, 2), 0);
    
    // If it's past 2 AM today, next sync is tomorrow
    if (now.getHours() >= 2) {
      nextSync = addDays(nextSync, 1);
    }
    
    return nextSync;
  };

  if (loading || !projectId) {
    return null;
  }

  const nextSync = getNextSyncTime();
  const nextSyncFormatted = format(nextSync, "dd/MM 'às' HH:mm", { locale: ptBR });

  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: CheckCircle2,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
          label: 'Sincronizado',
        };
      case 'partial':
        return {
          icon: AlertCircle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
          label: 'Parcial',
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/20',
          label: 'Erro',
        };
      default:
        return {
          icon: Clock,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          borderColor: 'border-border',
          label: 'Pendente',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`${config.bgColor} ${config.borderColor} ${config.color} gap-1.5 cursor-help`}
        >
          <Icon className="h-3 w-3" />
          <span className="text-xs">
            {lastSync 
              ? formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })
              : 'Nunca sincronizado'
            }
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${config.color}`} />
            <span className="font-medium">{config.label}</span>
          </div>
          {lastSync && (
            <p className="text-muted-foreground">
              Última sync: {format(lastSync, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          <p className="text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Próxima: {nextSyncFormatted}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Sincronização automática diária às 02:00
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
