import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database,
  Activity,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import SyncHistoryChart from './SyncHistoryChart';

interface ProjectAdminTabProps {
  projectId: string;
  projectName: string;
}

interface SyncLog {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface ImportMonth {
  id: string;
  month: number;
  year: number;
  status: string;
  records_count: number | null;
  completed_at: string | null;
}

export default function ProjectAdminTab({ projectId, projectName }: ProjectAdminTabProps) {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [recentLogs, setRecentLogs] = useState<SyncLog[]>([]);
  const [importMonths, setImportMonths] = useState<ImportMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Reset state when projectId changes
    setLastSync(null);
    setRecentLogs([]);
    setImportMonths([]);
    
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch project last_sync_at
      const { data: projectData } = await supabase
        .from('projects')
        .select('last_sync_at')
        .eq('id', projectId)
        .single();
      
      if (projectData?.last_sync_at) {
        setLastSync(new Date(projectData.last_sync_at));
      }
      
      // Fetch recent sync logs
      const { data: logsData } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (logsData) {
        setRecentLogs(logsData);
      }
      
      // Fetch import months
      const { data: monthsData } = await supabase
        .from('project_import_months')
        .select('*')
        .eq('project_id', projectId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      
      if (monthsData) {
        setImportMonths(monthsData);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [projectId]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('meta-ads-sync', {
        body: { projectId }
      });
      
      if (error) throw error;
      
      toast.success('Sincronização iniciada com sucesso');
      
      // Refresh data after a delay
      setTimeout(async () => {
        const { data } = await supabase
          .from('projects')
          .select('last_sync_at')
          .eq('id', projectId)
          .single();
        
        if (data?.last_sync_at) {
          setLastSync(new Date(data.last_sync_at));
        }
        setSyncing(false);
      }, 5000);
    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro ao iniciar sincronização');
      setSyncing(false);
    }
  };

  const getSyncStatus = () => {
    if (!lastSync) return { status: 'never', color: 'bg-muted', text: 'Nunca sincronizado' };
    
    const hoursAgo = differenceInHours(new Date(), lastSync);
    
    if (hoursAgo <= 24) return { status: 'healthy', color: 'bg-green-500', text: 'Saudável' };
    if (hoursAgo <= 48) return { status: 'warning', color: 'bg-yellow-500', text: 'Atenção' };
    return { status: 'critical', color: 'bg-red-500', text: 'Crítico' };
  };

  const syncStatus = getSyncStatus();

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months[month - 1];
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status da Sync</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${syncStatus.color}`} />
                  <span className="font-semibold">{syncStatus.text}</span>
                </div>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Última Sincronização</p>
                <p className="font-semibold mt-1">
                  {lastSync 
                    ? format(lastSync, "dd/MM 'às' HH:mm", { locale: ptBR })
                    : 'Nunca'
                  }
                </p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Meses Importados</p>
                <p className="font-semibold mt-1">
                  {importMonths.filter(m => m.status === 'completed').length} de {importMonths.length}
                </p>
              </div>
              <Database className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Button */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Sincronização Manual</h3>
              <p className="text-sm text-muted-foreground">
                Force uma sincronização imediata dos dados do Meta Ads
              </p>
            </div>
            <Button 
              onClick={handleManualSync} 
              disabled={syncing}
              className="w-full sm:w-auto"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Agora
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync History Chart */}
      <SyncHistoryChart projectId={projectId} showProjectSelector={false} />

      {/* Recent Logs */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Logs Recentes</CardTitle>
          <CardDescription>Últimas 10 sincronizações</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum log de sincronização encontrado
            </p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map(log => {
                let messageInfo = null;
                try {
                  if (log.message) {
                    messageInfo = JSON.parse(log.message);
                  }
                } catch {
                  messageInfo = { raw: log.message };
                }
                
                return (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30"
                  >
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                          {log.status}
                        </Badge>
                        {messageInfo?.type && (
                          <Badge variant="outline" className="text-xs">
                            {messageInfo.type}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                      {messageInfo && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {messageInfo.daily_records !== undefined && `${messageInfo.daily_records} registros`}
                          {messageInfo.records !== undefined && `${messageInfo.records} registros importados`}
                          {messageInfo.elapsed && ` • ${messageInfo.elapsed}`}
                          {messageInfo.error && <span className="text-red-400">{messageInfo.error}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Months Status */}
      {importMonths.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Status de Importação por Mês</CardTitle>
            <CardDescription>Histórico de importação de dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
              {importMonths.map(month => (
                <div 
                  key={month.id}
                  className={`
                    p-2 rounded-lg text-center text-xs
                    ${month.status === 'completed' 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : month.status === 'error'
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-muted/50 border border-border'
                    }
                  `}
                  title={`${getMonthName(month.month)} ${month.year} - ${month.records_count || 0} registros`}
                >
                  <div className="font-medium">{getMonthName(month.month)}</div>
                  <div className="text-muted-foreground">{month.year}</div>
                  {month.records_count !== null && (
                    <div className="text-[10px] mt-1 text-muted-foreground">
                      {month.records_count}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
