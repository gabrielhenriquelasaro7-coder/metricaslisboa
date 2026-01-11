import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPasswordGate from '@/components/admin/AdminPasswordGate';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProjects, Project } from '@/hooks/useProjects';
import { useImportProgress } from '@/hooks/useImportProgress';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import MonthImportGrid from '@/components/admin/MonthImportGrid';
import SyncHealthMonitor from '@/components/admin/SyncHealthMonitor';
import SyncHistoryChart from '@/components/admin/SyncHistoryChart';
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  AlertTriangle,
  RefreshCw,
  Activity,
  LogOut,
  FileText,
  Download,
  Megaphone,
  Layers,
  Image,
  PlayCircle
} from 'lucide-react';
import { downloadDocumentationAsTxt, downloadDocumentationAsPdf } from '@/utils/generateSystemDocumentation';

interface SyncLog {
  id: string;
  project_id: string;
  project_name?: string;
  status: string;
  message: string;
  created_at: string;
  type?: string;
}

interface SyncStatus {
  isRunning: boolean;
  type: 'campaigns' | 'adsets' | 'ads' | 'creatives' | null;
}

function AdminContent() {
  const navigate = useNavigate();
  const { logout } = useAdminAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isRunning: false, type: null });

  const activeProjects = projects.filter(p => !p.archived);
  const selectedProject = activeProjects.find(p => p.id === selectedProjectId);

  // Fetch sync logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLogsLoading(true);
      try {
        const { data, error } = await supabase
          .from('sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const enrichedLogs = data?.map(log => {
          const project = projects.find(p => p.id === log.project_id);
          let parsedMessage: any = {};
          try {
            parsedMessage = JSON.parse(log.message || '{}');
          } catch {
            parsedMessage = { raw: log.message };
          }
          return {
            ...log,
            project_name: project?.name || 'Projeto desconhecido',
            type: parsedMessage.type || 'sync',
          };
        }) || [];

        setSyncLogs(enrichedLogs);
      } catch (error) {
        console.error('Error fetching sync logs:', error);
      } finally {
        setLogsLoading(false);
      }
    };

    if (projects.length > 0) {
      fetchLogs();
    }
  }, [projects]);

  // Generic sync function
  const runSync = async (syncType: 'campaigns' | 'adsets' | 'ads' | 'creatives') => {
    if (!selectedProjectId || !selectedProject) {
      toast.error('Selecione um projeto primeiro');
      return;
    }

    const typeLabels = {
      campaigns: 'Campanhas',
      adsets: 'Conjuntos de Anúncios',
      ads: 'Anúncios',
      creatives: 'Criativos'
    };

    setSyncStatus({ isRunning: true, type: syncType });
    toast.info(`Sincronizando ${typeLabels[syncType]} de ${selectedProject.name}...`);

    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: selectedProject.id,
          ad_account_id: selectedProject.ad_account_id,
          date_preset: 'last_90d',
          syncOnly: syncType,
        }
      });

      if (error) throw error;

      if (data.success) {
        const recordCount = data.data?.daily_records_count || 
                           data.data?.campaigns_count || 
                           data.data?.adsets_count || 
                           data.data?.ads_count || 
                           data.data?.creatives_count || 0;
        toast.success(`${typeLabels[syncType]} sincronizados! ${recordCount} registros`);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      toast.error(`Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSyncStatus({ isRunning: false, type: null });
    }
  };

  // Run full sync (all entities)
  const runFullSync = async () => {
    if (!selectedProjectId || !selectedProject) {
      toast.error('Selecione um projeto primeiro');
      return;
    }

    setSyncStatus({ isRunning: true, type: 'campaigns' });
    toast.info(`Sincronização completa de ${selectedProject.name}...`);

    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: selectedProject.id,
          ad_account_id: selectedProject.ad_account_id,
          date_preset: 'last_90d',
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Sync completo! ${data.data?.daily_records_count || 0} registros importados`);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSyncStatus({ isRunning: false, type: null });
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLogTypeBadge = (type: string, status: string) => {
    const typeConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      daily_sync: { label: 'Sync Diário', variant: 'default' },
      gap_detection: { label: 'Detecção de Gaps', variant: 'secondary' },
      sync: { label: 'Sincronização', variant: 'outline' },
    };
    
    const config = typeConfig[type] || { label: type, variant: 'outline' };
    const finalVariant = status === 'error' ? 'destructive' : config.variant;
    
    return <Badge variant={finalVariant}>{config.label}</Badge>;
  };

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-background red-texture-bg">
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background red-texture-bg">
      <div className="p-8 space-y-8 animate-fade-in max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              Administração Global
            </h1>
            <p className="text-muted-foreground">
              Gerenciamento de sincronizações e importações
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/projects')}
              className="gap-2"
            >
              Voltar aos Projetos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                logout();
                navigate('/projects');
              }}
              className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <LogOut className="w-4 h-4" />
              Sair do Admin
            </Button>
          </div>
        </div>

        <Tabs defaultValue="sync" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="sync" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sincronização
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Activity className="w-4 h-4" />
              Importação Mensal
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Clock className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <FileText className="w-4 h-4" />
              Documentação
            </TabsTrigger>
          </TabsList>

          {/* SYNC TAB */}
          <TabsContent value="sync" className="space-y-6">
            {/* Sync Health Monitor */}
            <SyncHealthMonitor projects={activeProjects} />

            {/* Main Sync Card */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Sincronização Meta Ads
                </CardTitle>
                <CardDescription>
                  Sincronize campanhas, conjuntos, anúncios e criativos com a Meta Ads API (últimos 90 dias)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Project Selection */}
                <div className="space-y-2">
                  <Label>Selecione o Projeto</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha um projeto para sincronizar" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProjects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} ({project.ad_account_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Full Sync Button */}
                <Button
                  onClick={runFullSync}
                  disabled={!selectedProjectId || syncStatus.isRunning}
                  className="w-full gap-2"
                  size="lg"
                >
                  {syncStatus.isRunning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-5 h-5" />
                      Sync Completo (Tudo)
                    </>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou sincronize individualmente</span>
                  </div>
                </div>

                {/* Individual Sync Buttons */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Campaigns */}
                  <Button
                    variant="outline"
                    onClick={() => runSync('campaigns')}
                    disabled={!selectedProjectId || syncStatus.isRunning}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {syncStatus.isRunning && syncStatus.type === 'campaigns' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    ) : (
                      <Megaphone className="w-6 h-6 text-primary" />
                    )}
                    <span className="text-sm font-medium">Campanhas</span>
                    <span className="text-xs text-muted-foreground">Status e métricas</span>
                  </Button>

                  {/* Ad Sets */}
                  <Button
                    variant="outline"
                    onClick={() => runSync('adsets')}
                    disabled={!selectedProjectId || syncStatus.isRunning}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {syncStatus.isRunning && syncStatus.type === 'adsets' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    ) : (
                      <Layers className="w-6 h-6 text-primary" />
                    )}
                    <span className="text-sm font-medium">Conjuntos</span>
                    <span className="text-xs text-muted-foreground">Ad Sets</span>
                  </Button>

                  {/* Ads */}
                  <Button
                    variant="outline"
                    onClick={() => runSync('ads')}
                    disabled={!selectedProjectId || syncStatus.isRunning}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {syncStatus.isRunning && syncStatus.type === 'ads' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    ) : (
                      <Activity className="w-6 h-6 text-primary" />
                    )}
                    <span className="text-sm font-medium">Anúncios</span>
                    <span className="text-xs text-muted-foreground">Ads</span>
                  </Button>

                  {/* Creatives */}
                  <Button
                    variant="outline"
                    onClick={() => runSync('creatives')}
                    disabled={!selectedProjectId || syncStatus.isRunning}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {syncStatus.isRunning && syncStatus.type === 'creatives' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    ) : (
                      <Image className="w-6 h-6 text-primary" />
                    )}
                    <span className="text-sm font-medium">Criativos</span>
                    <span className="text-xs text-muted-foreground">Imagens/Vídeos</span>
                  </Button>
                </div>

                {/* Info */}
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="font-medium mb-2">💡 Dica:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li><strong>Sync Completo:</strong> Sincroniza tudo de uma vez (recomendado)</li>
                    <li><strong>Campanhas:</strong> Atualiza status e métricas das campanhas</li>
                    <li><strong>Conjuntos:</strong> Atualiza ad sets (segmentação, orçamento)</li>
                    <li><strong>Anúncios:</strong> Atualiza anúncios individuais</li>
                    <li><strong>Criativos:</strong> Sincroniza imagens e vídeos dos anúncios</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Sync History Chart */}
            <SyncHistoryChart showProjectSelector={true} />

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      {activeProjects.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-metric-positive">
                      {syncLogs.filter(l => l.status === 'success').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Syncs Bem-Sucedidos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-destructive">
                      {syncLogs.filter(l => l.status === 'error').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Syncs com Erro</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-6">
            {/* Month Import Grid */}
            <MonthImportGrid projects={activeProjects} />
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Histórico de Sincronizações
                </CardTitle>
                <CardDescription>
                  Últimas 50 execuções de sincronização.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : syncLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum log encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {syncLogs.map((log) => {
                      let parsedMessage: any = {};
                      try {
                        parsedMessage = JSON.parse(log.message || '{}');
                      } catch {
                        parsedMessage = { raw: log.message };
                      }

                      return (
                        <div 
                          key={log.id} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50"
                        >
                          <div className="mt-0.5">
                            {log.status === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-metric-positive" />
                            ) : log.status === 'error' ? (
                              <XCircle className="w-4 h-4 text-destructive" />
                            ) : log.status === 'partial' ? (
                              <AlertTriangle className="w-4 h-4 text-metric-warning" />
                            ) : (
                              <Clock className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{log.project_name}</span>
                              {getLogTypeBadge(log.type || 'sync', log.status)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {parsedMessage.daily_records !== undefined && (
                                <span className="mr-3">
                                  📊 {parsedMessage.daily_records} registros
                                </span>
                              )}
                              {parsedMessage.elapsed && (
                                <span className="mr-3">
                                  ⏱️ {parsedMessage.elapsed}
                                </span>
                              )}
                              {parsedMessage.error && (
                                <span className="text-destructive">
                                  ❌ {parsedMessage.error}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {formatDateTime(log.created_at)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCUMENTATION TAB */}
          <TabsContent value="docs" className="space-y-6">
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Documentação do Sistema
                </CardTitle>
                <CardDescription>
                  Gere um documento completo com toda a estrutura, fluxos, endpoints, queries e regras de funcionamento do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm">O documento inclui:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Visão geral e arquitetura do sistema</li>
                    <li>✓ Estrutura completa de pastas e componentes</li>
                    <li>✓ Todas as tabelas do banco de dados</li>
                    <li>✓ Todos os endpoints (Edge Functions)</li>
                    <li>✓ Todos os hooks customizados</li>
                    <li>✓ Todas as páginas da aplicação</li>
                    <li>✓ Fluxo completo de sincronização</li>
                    <li>✓ Regras de negócio e cálculos</li>
                    <li>✓ Configurações de segurança</li>
                    <li>✓ Integrações externas</li>
                    <li>✓ Guia de troubleshooting</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => {
                      downloadDocumentationAsPdf();
                      toast.success('Documentação PDF gerada com sucesso!');
                    }}
                    className="gap-2 flex-1"
                    size="lg"
                  >
                    <Download className="w-5 h-5" />
                    Baixar como PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      downloadDocumentationAsTxt();
                      toast.success('Documentação TXT gerada com sucesso!');
                    }}
                    className="gap-2 flex-1"
                    size="lg"
                  >
                    <FileText className="w-5 h-5" />
                    Baixar como TXT
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  A documentação é gerada com base na estrutura atual do sistema.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <AdminPasswordGate>
      <AdminContent />
    </AdminPasswordGate>
  );
}
