import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPasswordGate from '@/components/admin/AdminPasswordGate';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProjects, Project } from '@/hooks/useProjects';
import { useImportProgress } from '@/hooks/useImportProgress';
import { useCargo } from '@/hooks/useCargo';
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
import { ExportDataButton } from '@/components/admin/ExportDataButton';
import { FullProjectExport } from '@/components/admin/FullProjectExport';
import { SquadsManagement } from '@/components/admin/SquadsManagement';
import { UserManagement } from '@/components/admin/UserManagement';
import { TabVisibilityManager } from '@/components/admin/TabVisibilityManager';
import { GuestsManagement } from '@/components/admin/GuestsManagement';
import { InvestorSuggestionsManagement } from '@/components/admin/InvestorSuggestionsManagement';
import { RequestsManagement } from '@/components/admin/RequestsManagement';
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
  PlayCircle,
  Search,
  Zap,
  Timer,
  Users,
  Building2,
  MessageSquare,
  UserPlus,
  Bell
} from 'lucide-react';
import { downloadDocumentationAsTxt, downloadDocumentationAsPdf, downloadDatabaseSchemaJSON } from '@/utils/generateSystemDocumentation';

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

interface CronJob {
  jobname: string;
  schedule: string;
  description: string;
}

function AdminContent() {
  const navigate = useNavigate();
  const { logout } = useAdminAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { isTech, isGerente, canManageSquads } = useCargo();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isRunning: false, type: null });
  const [isRunningGapDetection, setIsRunningGapDetection] = useState(false);
  const [syncProgress, setSyncProgress] = useState<any | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [syncStartTime, setSyncStartTime] = useState<Date | null>(null);

  // Refs para manter sync/import rodando em segundo plano
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeProjects = projects.filter(p => !p.archived);
  const selectedProject = activeProjects.find(p => p.id === selectedProjectId);

  // Poll for sync progress
  const pollSyncProgress = async () => {
    if (!selectedProjectId) return;

    const { data } = await supabase
      .from('projects')
      .select('sync_progress')
      .eq('id', selectedProjectId)
      .single();

    if (data?.sync_progress && typeof data.sync_progress === 'object' && !Array.isArray(data.sync_progress)) {
      const rawProgress = data.sync_progress as Record<string, any>;
      if ('step' in rawProgress || 'status' in rawProgress) {
        const progress = {
          status: rawProgress.step === 'complete' ? 'success'
            : rawProgress.step === 'error' ? 'error'
              : rawProgress.status || 'syncing',
          message: rawProgress.message || '',
          current: rawProgress.current,
          total: rawProgress.total,
          step: rawProgress.step,
          progress: rawProgress.current,
          updated_at: rawProgress.updated_at
        };
        setSyncProgress(progress);

        if (progress.status === 'success' || progress.status === 'error' || progress.status === 'partial') {
          setSyncStatus({ isRunning: false, type: null });
        }
      }
    }
  };

  // Timer effect for sync
  useEffect(() => {
    let interval: any;
    if (syncStatus.isRunning) {
      setSyncStartTime(new Date());
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        pollSyncProgress();
      }, 1500);
    } else {
      if (syncProgress?.status === 'success' || syncProgress?.status === 'error') {
        const timeout = setTimeout(() => {
          setSyncProgress(null);
          setElapsedTime(0);
          setSyncStartTime(null);
        }, 8000);
        return () => clearTimeout(timeout);
      }
    }
    return () => clearInterval(interval);
  }, [syncStatus.isRunning, selectedProjectId]);

  // Definir tabs visíveis baseado no cargo
  // TECH: vê TUDO
  // GERENTE: users, guests, squads (gestão de pessoas)
  // Outros que passaram a senha: veem tudo (são admin autenticados)
  const techTabs = ['sync', 'import', 'logs', 'docs', 'requests'];
  const gerenteTabs = ['users', 'guests', 'squads'];
  const allTabs = [...techTabs, ...gerenteTabs];

  const visibleTabs = isTech
    ? allTabs // Tech vê tudo
    : isGerente
      ? gerenteTabs // Gerente SOMENTE gestão de pessoas
      : allTabs; // Quem passou a senha vê tudo (master admin)

  // Determinar tab padrão
  const defaultTab = isTech ? 'sync' : isGerente ? 'users' : 'sync';

  // Cron jobs configuration
  const cronJobs: CronJob[] = [
    {
      jobname: 'daily-meta-sync-02am',
      schedule: '0 5 * * *',
      description: 'Sincronização diária às 02:00 AM (horário de Brasília). Busca últimos 90 dias de dados da Meta Ads API.',
    },
    {
      jobname: 'weekly-gap-detection',
      schedule: '0 3 * * 0',
      description: 'Verificação semanal de gaps aos domingos às 00:00 AM (horário de Brasília).',
    },
  ];

  const parseCronSchedule = (schedule: string) => {
    const scheduleMap: Record<string, string> = {
      '0 5 * * *': 'Diariamente às 02:00 AM (Brasília)',
      '0 3 * * 0': 'Domingos às 00:00 AM (Brasília)',
    };
    return scheduleMap[schedule] || schedule;
  };

  const runGapDetection = async () => {
    setIsRunningGapDetection(true);
    toast.info('Iniciando detecção de gaps...');

    try {
      const { data, error } = await supabase.functions.invoke('detect-and-fix-gaps', {
        body: { auto_fix: true }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Detecção concluída! ${data.gaps_found} gaps encontrados, ${data.gaps_fixed} corrigidos, ${data.records_imported} registros importados.`);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao detectar gaps';
      toast.error(errorMessage);
    } finally {
      setIsRunningGapDetection(false);
    }
  };


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

  // Generic sync function - roda em segundo plano mesmo mudando de aba
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
    setSyncProgress({ status: 'syncing', message: 'Iniciando...', progress: 5 });
    toast.info(`Sincronizando ${typeLabels[syncType]} de ${selectedProject.name}...`);

    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: selectedProject.id,
          ad_account_id: selectedProject.ad_account_id,
          date_preset: 'last_3d',
          syncOnly: syncType,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro desconhecido');

    } catch (error) {
      toast.error(`Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setSyncStatus({ isRunning: false, type: null });
    }
  };

  // Run full sync (all entities + creatives HD) - roda em segundo plano
  const runFullSync = async () => {
    if (!selectedProjectId || !selectedProject) {
      toast.error('Selecione um projeto primeiro');
      return;
    }

    setSyncStatus({ isRunning: true, type: 'campaigns' });
    setSyncProgress({ status: 'syncing', message: 'Iniciando Full Sync...', progress: 5 });
    toast.info(`Sincronização completa de ${selectedProject.name}...`);

    try {
      // FASE 1: Sync de métricas (base)
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: selectedProject.id,
          ad_account_id: selectedProject.ad_account_id,
          date_preset: 'last_3d',
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro desconhecido');

      // Phase 2 is usually handled by the edge function or triggered sequentially
      // but showing success here if the first phase finishes and updates progress
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
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
              {isTech ? 'Gerenciamento de sincronizações, importações e usuários' :
                isGerente ? 'Gerenciamento de usuários, convidados e squads' :
                  'Painel administrativo'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              Voltar aos Projetos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                logout();
                navigate('/dashboard');
              }}
              className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <LogOut className="w-4 h-4" />
              Sair do Admin
            </Button>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            {/* TECH tabs - Operacional */}
            {visibleTabs.includes('sync') && (
              <TabsTrigger value="sync" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Sincronização
              </TabsTrigger>
            )}
            {visibleTabs.includes('import') && (
              <TabsTrigger value="import" className="gap-2">
                <Activity className="w-4 h-4" />
                Importação
              </TabsTrigger>
            )}
            {visibleTabs.includes('logs') && (
              <TabsTrigger value="logs" className="gap-2">
                <Clock className="w-4 h-4" />
                Histórico
              </TabsTrigger>
            )}
            {visibleTabs.includes('docs') && (
              <TabsTrigger value="docs" className="gap-2">
                <FileText className="w-4 h-4" />
                Docs
              </TabsTrigger>
            )}

            {/* GERENTE tabs - Gestão de Pessoas */}
            {visibleTabs.includes('users') && (
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                Usuários
              </TabsTrigger>
            )}
            {visibleTabs.includes('guests') && (
              <TabsTrigger value="guests" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Convidados
              </TabsTrigger>
            )}
            {visibleTabs.includes('squads') && (
              <TabsTrigger value="squads" className="gap-2">
                <Building2 className="w-4 h-4" />
                Squads
              </TabsTrigger>
            )}
            {visibleTabs.includes('requests') && (
              <TabsTrigger value="requests" className="gap-2">
                <Bell className="w-4 h-4" />
                Solicitações
              </TabsTrigger>
            )}
          </TabsList>

          {/* SYNC TAB - TECH only */}
          {visibleTabs.includes('sync') && (
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
                    Sincronize campanhas, conjuntos, anúncios e criativos com a Meta Ads API (últimos 90 dias).
                    <span className="block mt-1 text-metric-positive">✓ Sync continua rodando mesmo ao mudar de aba</span>
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

                  {/* Progress Indicator - show if syncing OR if there's recent progress */}
                  {(syncStatus.isRunning || syncProgress) && (
                    <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-primary/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {syncProgress?.status === 'success' ? (
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          ) : syncProgress?.status === 'error' ? (
                            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                              <XCircle className="w-3 h-3 text-white" />
                            </div>
                          ) : (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          )}
                          <span className="font-semibold text-sm">
                            {syncProgress?.message || 'Iniciando sincronização...'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1 font-mono">
                            <Timer className="w-3.5 h-3.5" />
                            <span>{Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s</span>
                          </div>
                        </div>
                      </div>

                      <Progress
                        value={syncProgress?.status === 'success' ? 100 : (syncProgress?.progress || 5)}
                        className="h-2 bg-primary/10"
                      />

                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>
                          {syncProgress?.step && syncProgress.step !== 'complete' && syncProgress.step !== 'error' && `Etapa: ${syncProgress.step}`}
                          {syncProgress?.status === 'success' && <span className="text-green-600">Sincronização concluída com sucesso!</span>}
                          {syncProgress?.status === 'error' && <span className="text-red-600">Erro na sincronização</span>}
                        </span>
                        <span className="bg-primary/10 px-2 py-0.5 rounded text-primary">{syncProgress?.status === 'success' ? 100 : (syncProgress?.progress || 0)}%</span>
                      </div>
                    </div>
                  )}

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

              {/* Gap Detection */}
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Detecção de Gaps
                      </CardTitle>
                      <CardDescription>
                        Verifica todos os projetos buscando períodos sem dados (gaps ≥3 dias) e reimporta automaticamente.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={runGapDetection}
                      disabled={isRunningGapDetection}
                      className="gap-2"
                    >
                      {isRunningGapDetection ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Detectando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Executar Agora
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <h4 className="font-medium text-sm">Como funciona:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Escaneia todos os projetos ativos buscando dias sem dados</li>
                      <li>Identifica gaps de 3+ dias consecutivos</li>
                      <li>Para cada gap encontrado, chama a Meta Ads API e importa os dados</li>
                      <li>Se a API retorna 0 registros, significa que não havia campanhas ativas</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              {/* Cron Jobs Status */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="w-5 h-5" />
                    Tarefas Agendadas (Cron Jobs)
                  </CardTitle>
                  <CardDescription>
                    Processos automáticos que rodam em intervalos definidos para manter os dados sincronizados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cronJobs.map((job) => (
                    <Card key={job.jobname} className="bg-card/50">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              <CheckCircle2 className="w-5 h-5 text-metric-positive" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{job.jobname}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {parseCronSchedule(job.schedule)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {job.description}
                              </p>
                            </div>
                          </div>
                          <Badge variant="default" className="shrink-0">
                            Ativo
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* IMPORT TAB - TECH only */}
          {visibleTabs.includes('import') && (
            <TabsContent value="import" className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground mb-4">
                <span className="text-metric-positive font-medium">✓ Importações continuam rodando mesmo ao mudar de aba</span>
              </div>
              {/* Month Import Grid */}
              <MonthImportGrid projects={activeProjects} />
            </TabsContent>
          )}

          {/* USERS TAB - GERENTE + TECH */}
          {visibleTabs.includes('users') && (
            <TabsContent value="users" className="space-y-6">
              <UserManagement />
              <TabVisibilityManager />
            </TabsContent>
          )}

          {/* SQUADS TAB - GERENTE + TECH */}
          {visibleTabs.includes('squads') && (
            <TabsContent value="squads" className="space-y-6">
              <SquadsManagement />
            </TabsContent>
          )}

          {/* GUESTS TAB - GERENTE + TECH */}
          {visibleTabs.includes('guests') && (
            <TabsContent value="guests" className="space-y-6">
              <GuestsManagement />
            </TabsContent>
          )}


          {/* LOGS TAB - TECH only */}
          {visibleTabs.includes('logs') && (
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
          )}

          {/* DOCUMENTATION TAB - TECH only */}
          {visibleTabs.includes('docs') && (
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
                    <Button
                      variant="secondary"
                      onClick={() => {
                        downloadDatabaseSchemaJSON();
                        toast.success('Schema JSON do banco gerado!');
                      }}
                      className="gap-2 flex-1"
                      size="lg"
                    >
                      <Database className="w-5 h-5" />
                      Baixar Schema JSON
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    A documentação é gerada com base na estrutura atual do sistema.
                  </p>
                </CardContent>
              </Card>

              {/* Export Data Card */}
              <Card className="glass-card border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Exportar Dados do Sistema
                  </CardTitle>
                  <CardDescription>
                    Exporte todos os dados do banco de dados em formato JSON para backup ou migração.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-sm">A exportação inclui:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Todos os projetos e configurações</li>
                      <li>✓ Campanhas, Conjuntos e Anúncios</li>
                      <li>✓ Métricas diárias (Meta e Google)</li>
                      <li>✓ Leads e formulários</li>
                      <li>✓ Conexões CRM e deals</li>
                      <li>✓ Histórico de otimizações</li>
                      <li>✓ Configurações de metas</li>
                      <li>✓ Insights demográficos</li>
                      <li>✓ Histórico DRE</li>
                    </ul>
                  </div>

                  <ExportDataButton />

                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ A exportação pode demorar alguns minutos dependendo do volume de dados.
                  </p>
                </CardContent>
              </Card>

              {/* Full Project Export - New Complete Export */}
              <FullProjectExport />
            </TabsContent>
          )}

          {/* REQUESTS TAB - TECH only (Admin Access + Suggestions) */}
          {visibleTabs.includes('requests') && (
            <TabsContent value="requests" className="space-y-6">
              <RequestsManagement />
            </TabsContent>
          )}
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
