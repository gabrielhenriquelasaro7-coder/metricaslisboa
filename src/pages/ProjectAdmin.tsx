import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/hooks/useProjects';
import { ArrowLeft, Database, Activity, RefreshCw, Clock, Loader2, Megaphone, Layers, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import SyncHistoryChart from '@/components/admin/SyncHistoryChart';
import MonthImportGrid from '@/components/admin/MonthImportGrid';

type SyncType = 'all' | 'campaigns' | 'adsets' | 'ads' | 'creatives';

interface SyncLog {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
}

export default function ProjectAdmin() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [recentLogs, setRecentLogs] = useState<SyncLog[]>([]);
  const [syncingType, setSyncingType] = useState<SyncType | null>(null);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!id) return;
      
      // Salvar o projeto selecionado no localStorage para a Sidebar
      localStorage.setItem('selectedProjectId', id);
      
      setLoading(true);
      
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!projectError && projectData) {
        setProject(projectData as unknown as Project);
        if (projectData.last_sync_at) {
          setLastSync(new Date(projectData.last_sync_at));
        }
      }
      
      // Fetch recent sync logs
      const { data: logsData } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (logsData) {
        setRecentLogs(logsData);
      }
      
      setLoading(false);
    };

    fetchProjectData();
  }, [id]);

  const handleSync = async (type: SyncType) => {
    if (!id) return;
    
    setSyncingType(type);
    try {
      const body: Record<string, unknown> = { projectId: id };
      
      if (type !== 'all') {
        body.syncOnly = type;
      }
      
      const { error } = await supabase.functions.invoke('meta-ads-sync', {
        body
      });
      
      if (error) throw error;
      
      const typeLabels: Record<SyncType, string> = {
        all: 'Completa',
        campaigns: 'Campanhas',
        adsets: 'Conjuntos',
        ads: 'Anúncios',
        creatives: 'Criativos'
      };
      
      toast.success(`Sincronização de ${typeLabels[type]} iniciada`);
      
      // Refresh data after a delay
      setTimeout(async () => {
        const { data } = await supabase
          .from('projects')
          .select('last_sync_at')
          .eq('id', id)
          .single();
        
        if (data?.last_sync_at) {
          setLastSync(new Date(data.last_sync_at));
        }
        
        // Refresh logs
        const { data: logsData } = await supabase
          .from('sync_logs')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(15);
        
        if (logsData) {
          setRecentLogs(logsData);
        }
        
        setSyncingType(null);
      }, 5000);
    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro ao iniciar sincronização');
      setSyncingType(null);
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Projeto não encontrado</h1>
          <Link to="/projects">
            <Button variant="outline">Voltar aos projetos</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={`/project/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
                <Database className="w-8 h-8 text-primary" />
                Administração - {project.name}
              </h1>
              <p className="text-muted-foreground">
                Gerenciamento de sincronização e importação de dados
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="monitoring" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="w-4 h-4" />
              Monitoramento
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Importação
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Clock className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* MONITORING TAB */}
          <TabsContent value="monitoring" className="space-y-6">
            {/* Status Cards */}
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
                      <p className="text-sm text-muted-foreground">Logs Recentes</p>
                      <p className="font-semibold mt-1">{recentLogs.length} registros</p>
                    </div>
                    <Database className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sync Buttons */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Sincronização Manual</CardTitle>
                <CardDescription>Sincronize dados específicos ou tudo de uma vez</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Full Sync */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div>
                    <h4 className="font-medium">Sincronização Completa</h4>
                    <p className="text-sm text-muted-foreground">
                      Sincroniza campanhas, conjuntos, anúncios e criativos
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleSync('all')} 
                    disabled={syncingType !== null}
                    className="w-full sm:w-auto"
                  >
                    {syncingType === 'all' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sincronizar Tudo
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Individual Sync Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleSync('campaigns')}
                    disabled={syncingType !== null}
                    className="justify-start h-auto py-3"
                  >
                    {syncingType === 'campaigns' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Megaphone className="w-4 h-4 mr-2" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Campanhas</div>
                      <div className="text-xs text-muted-foreground">Sincronizar só campanhas</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleSync('adsets')}
                    disabled={syncingType !== null}
                    className="justify-start h-auto py-3"
                  >
                    {syncingType === 'adsets' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Layers className="w-4 h-4 mr-2" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Conjuntos</div>
                      <div className="text-xs text-muted-foreground">Sincronizar só ad sets</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleSync('ads')}
                    disabled={syncingType !== null}
                    className="justify-start h-auto py-3"
                  >
                    {syncingType === 'ads' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Anúncios</div>
                      <div className="text-xs text-muted-foreground">Sincronizar só anúncios</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleSync('creatives')}
                    disabled={syncingType !== null}
                    className="justify-start h-auto py-3"
                  >
                    {syncingType === 'creatives' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 mr-2" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Criativos</div>
                      <div className="text-xs text-muted-foreground">Sincronizar só criativos</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sync History Chart */}
            <SyncHistoryChart projectId={id} showProjectSelector={false} />
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-6">
            <MonthImportGrid projects={[project]} />
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Logs de Sincronização</CardTitle>
                <CardDescription>Últimas 15 sincronizações do projeto</CardDescription>
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
                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5 shrink-0">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5 shrink-0">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                            </div>
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
