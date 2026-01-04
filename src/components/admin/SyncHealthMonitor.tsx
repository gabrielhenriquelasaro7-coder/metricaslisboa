import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Loader2,
  Bell,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Project {
  id: string;
  name: string;
  last_sync_at: string | null;
  ad_account_id: string;
}

interface SyncHealthMonitorProps {
  projects: Project[];
}

interface ProjectHealth {
  project: Project;
  hoursSinceSync: number | null;
  status: 'healthy' | 'warning' | 'critical' | 'never_synced';
  lastSyncText: string;
}

export default function SyncHealthMonitor({ projects }: SyncHealthMonitorProps) {
  const [projectHealth, setProjectHealth] = useState<ProjectHealth[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    calculateHealth();
  }, [projects]);

  const calculateHealth = () => {
    const health: ProjectHealth[] = projects.map(project => {
      if (!project.last_sync_at) {
        return {
          project,
          hoursSinceSync: null,
          status: 'never_synced' as const,
          lastSyncText: 'Nunca sincronizado'
        };
      }

      const lastSync = new Date(project.last_sync_at);
      const hoursSinceSync = differenceInHours(new Date(), lastSync);
      
      let status: 'healthy' | 'warning' | 'critical';
      if (hoursSinceSync <= 24) {
        status = 'healthy';
      } else if (hoursSinceSync <= 48) {
        status = 'warning';
      } else {
        status = 'critical';
      }

      const lastSyncText = formatDistanceToNow(lastSync, { 
        addSuffix: true, 
        locale: ptBR 
      });

      return {
        project,
        hoursSinceSync,
        status,
        lastSyncText
      };
    });

    // Sort by status priority: critical > warning > never_synced > healthy
    const statusOrder = { critical: 0, warning: 1, never_synced: 2, healthy: 3 };
    health.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    setProjectHealth(health);
  };

  const handleResync = async (project: Project) => {
    setSyncingProjects(prev => new Set([...prev, project.id]));
    
    try {
      toast.info(`Sincronizando ${project.name}...`);
      
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: project.id,
          ad_account_id: project.ad_account_id,
          date_preset: 'last_90d',
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`${project.name}: Sync concluído! ${data.data?.daily_records_count || 0} registros`);
        // Refresh health after successful sync
        setTimeout(calculateHealth, 2000);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      toast.error(`Erro ao sincronizar ${project.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSyncingProjects(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
    }
  };

  const handleResyncAll = async () => {
    const problematicProjects = projectHealth.filter(
      h => h.status === 'critical' || h.status === 'warning' || h.status === 'never_synced'
    );

    if (problematicProjects.length === 0) {
      toast.info('Todos os projetos estão sincronizados!');
      return;
    }

    setIsRefreshing(true);
    toast.info(`Sincronizando ${problematicProjects.length} projetos...`);

    for (const health of problematicProjects) {
      await handleResync(health.project);
      // Small delay between syncs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setIsRefreshing(false);
    toast.success('Sincronização de projetos concluída!');
  };

  const getStatusIcon = (status: ProjectHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-metric-positive" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-metric-warning" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'never_synced':
        return <XCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ProjectHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-metric-positive/20 text-metric-positive border-metric-positive/30">Saudável</Badge>;
      case 'warning':
        return <Badge className="bg-metric-warning/20 text-metric-warning border-metric-warning/30">Atenção</Badge>;
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'never_synced':
        return <Badge variant="outline">Nunca sync</Badge>;
    }
  };

  const criticalCount = projectHealth.filter(h => h.status === 'critical').length;
  const warningCount = projectHealth.filter(h => h.status === 'warning').length;
  const healthyCount = projectHealth.filter(h => h.status === 'healthy').length;
  const neverSyncedCount = projectHealth.filter(h => h.status === 'never_synced').length;

  return (
    <Card className="glass-card border-destructive/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Monitoramento de Sync
            </CardTitle>
            <CardDescription>
              Alertas automáticos para projetos que não sincronizam há mais de 24 horas
            </CardDescription>
          </div>
          {(criticalCount > 0 || warningCount > 0 || neverSyncedCount > 0) && (
            <Button
              onClick={handleResyncAll}
              disabled={isRefreshing}
              variant="destructive"
              className="gap-2"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sincronizar Todos com Problema
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-metric-positive/10 border border-metric-positive/20 text-center">
            <p className="text-2xl font-bold text-metric-positive">{healthyCount}</p>
            <p className="text-xs text-muted-foreground">Saudáveis</p>
          </div>
          <div className="p-3 rounded-lg bg-metric-warning/10 border border-metric-warning/20 text-center">
            <p className="text-2xl font-bold text-metric-warning">{warningCount}</p>
            <p className="text-xs text-muted-foreground">Atenção (24-48h)</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
            <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Críticos (&gt;48h)</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
            <p className="text-2xl font-bold text-muted-foreground">{neverSyncedCount}</p>
            <p className="text-xs text-muted-foreground">Nunca Sync</p>
          </div>
        </div>

        {/* Project List */}
        {projectHealth.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum projeto ativo encontrado
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {projectHealth.map(({ project, status, lastSyncText, hoursSinceSync }) => (
              <div 
                key={project.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  status === 'critical' 
                    ? 'bg-destructive/5 border-destructive/30' 
                    : status === 'warning'
                    ? 'bg-metric-warning/5 border-metric-warning/30'
                    : status === 'never_synced'
                    ? 'bg-muted/30 border-border'
                    : 'bg-metric-positive/5 border-metric-positive/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(status)}
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {lastSyncText}
                      {hoursSinceSync !== null && ` (${hoursSinceSync}h)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(status)}
                  {(status === 'critical' || status === 'warning' || status === 'never_synced') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResync(project)}
                      disabled={syncingProjects.has(project.id)}
                      className="gap-1"
                    >
                      {syncingProjects.has(project.id) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Sync
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-muted/50 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-sm mb-2">Como funciona:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><span className="text-metric-positive">Saudável</span>: Última sync há menos de 24 horas</li>
            <li><span className="text-metric-warning">Atenção</span>: Última sync entre 24-48 horas</li>
            <li><span className="text-destructive">Crítico</span>: Última sync há mais de 48 horas</li>
            <li>O cron job roda diariamente às 02:00 AM (Brasília)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
