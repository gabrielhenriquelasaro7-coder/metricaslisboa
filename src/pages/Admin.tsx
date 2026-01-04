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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import MonthImportGrid from '@/components/admin/MonthImportGrid';
import SyncHealthMonitor from '@/components/admin/SyncHealthMonitor';
import SyncHistoryChart from '@/components/admin/SyncHistoryChart';
import { 
  Database, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  AlertTriangle,
  RefreshCw,
  Calendar as CalendarIcon,
  Timer,
  Activity,
  Search,
  Zap,
  Shield,
  LogOut
} from 'lucide-react';

interface ImportProgress {
  project_id: string;
  status: 'idle' | 'running' | 'success' | 'error' | 'partial';
  message: string;
  current_batch: number;
  total_batches: number;
  total_records: number;
  elapsed_seconds: number;
  error?: string;
}

interface ImportResult {
  batch: number;
  since: string;
  until: string;
  success: boolean;
  records?: number;
  error?: string;
}

interface CronJob {
  jobname: string;
  schedule: string;
  description: string;
  next_run?: string;
}

interface SyncLog {
  id: string;
  project_id: string;
  project_name?: string;
  status: string;
  message: string;
  created_at: string;
  type?: string;
}

function AdminContent() {
  const { logout } = useAdminAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const [importProgress, setImportProgress] = useState<Record<string, ImportProgress>>({});
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [isRunningGapDetection, setIsRunningGapDetection] = useState(false);

  // Custom period import state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(new Date(2025, 0, 1));
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(new Date());
  const [safeMode, setSafeMode] = useState(true);
  const [isCustomImporting, setIsCustomImporting] = useState(false);
  const { monitor, isMonitoring, startMonitoring, stopMonitoring } = useImportProgress();

  const activeProjects = projects.filter(p => !p.archived);

  // Cron jobs configuration
  const cronJobs: CronJob[] = [
    {
      jobname: 'daily-meta-sync-02am',
      schedule: '0 5 * * *',
      description: 'Sincronização diária às 02:00 AM (horário de Brasília). Busca últimos 90 dias de dados da Meta Ads API e salva na tabela ads_daily_metrics. Após sincronizar, detecta e corrige gaps automaticamente.',
    },
    {
      jobname: 'weekly-gap-detection',
      schedule: '0 3 * * 0',
      description: 'Verificação semanal de gaps aos domingos às 00:00 AM (horário de Brasília). Escaneia todo o ano buscando períodos sem dados e reimporta automaticamente.',
    },
  ];

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

        // Enrich with project names
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

  // Start custom period import
  const startCustomImport = async () => {
    if (!selectedProjectId || !customDateFrom || !customDateTo) {
      toast.error('Selecione um projeto e período');
      return;
    }

    const project = activeProjects.find(p => p.id === selectedProjectId);
    if (!project) return;

    setIsCustomImporting(true);
    startMonitoring(project.id, project.name);

    try {
      const { data, error } = await supabase.functions.invoke('import-historical-data', {
        body: {
          project_id: project.id,
          since: format(customDateFrom, 'yyyy-MM-dd'),
          until: format(customDateTo, 'yyyy-MM-dd'),
          safe_mode: safeMode,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Importação iniciada para ${project.name}! ${data.total_batches} lotes estimados em ~${data.estimated_minutes} min`);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao iniciar importação';
      toast.error(errorMessage);
      stopMonitoring();
    } finally {
      setIsCustomImporting(false);
    }
  };

  const initializeProgress = (projectId: string): ImportProgress => ({
    project_id: projectId,
    status: 'idle',
    message: 'Aguardando início',
    current_batch: 0,
    total_batches: 0,
    total_records: 0,
    elapsed_seconds: 0,
  });

  const startImport = async (project: Project) => {
    const projectId = project.id;
    
    setImportProgress(prev => ({
      ...prev,
      [projectId]: {
        ...initializeProgress(projectId),
        status: 'running',
        message: 'Iniciando importação histórica...',
      }
    }));

    try {
      const { data, error } = await supabase.functions.invoke('import-historical-data', {
        body: {
          project_id: projectId,
          since: '2025-01-01',
        }
      });

      if (error) throw error;

      if (data.success) {
        setImportProgress(prev => ({
          ...prev,
          [projectId]: {
            project_id: projectId,
            status: 'success',
            message: `Importação concluída! ${data.total_records} registros em ${data.elapsed_seconds?.toFixed(1)}s`,
            current_batch: data.total_batches,
            total_batches: data.total_batches,
            total_records: data.total_records,
            elapsed_seconds: data.elapsed_seconds,
          }
        }));
        toast.success(`${project.name}: Importação concluída com ${data.total_records} registros`);
      } else if (data.success_batches && data.success_batches < data.total_batches) {
        setImportProgress(prev => ({
          ...prev,
          [projectId]: {
            project_id: projectId,
            status: 'partial',
            message: `Parcial: ${data.success_batches}/${data.total_batches} batches, ${data.total_records} registros`,
            current_batch: data.success_batches,
            total_batches: data.total_batches,
            total_records: data.total_records,
            elapsed_seconds: data.elapsed_seconds,
          }
        }));
        toast.warning(`${project.name}: Importação parcial`);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao importar';
      setImportProgress(prev => ({
        ...prev,
        [projectId]: {
          ...initializeProgress(projectId),
          status: 'error',
          message: errorMessage,
          error: errorMessage,
        }
      }));
      toast.error(`${project.name}: ${errorMessage}`);
    }
  };

  const startImportAll = async () => {
    if (isImportingAll) return;
    
    setIsImportingAll(true);
    toast.info(`Iniciando importação para ${activeProjects.length} projetos...`);

    // Initialize all progress
    const newProgress: Record<string, ImportProgress> = {};
    activeProjects.forEach(p => {
      newProgress[p.id] = {
        ...initializeProgress(p.id),
        message: 'Na fila...',
      };
    });
    setImportProgress(newProgress);

    // Process projects sequentially to avoid rate limits
    for (const project of activeProjects) {
      await startImport(project);
      // Small delay between projects
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setIsImportingAll(false);
    toast.success('Importação de todos os projetos concluída!');
  };

  const getStatusIcon = (status: ImportProgress['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-metric-positive" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'partial':
        return <AlertTriangle className="w-5 h-5 text-metric-warning" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ImportProgress['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      running: 'default',
      success: 'default',
      error: 'destructive',
      partial: 'secondary',
      idle: 'outline',
    };
    const labels: Record<string, string> = {
      running: 'Importando',
      success: 'Concluído',
      error: 'Erro',
      partial: 'Parcial',
      idle: 'Aguardando',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || 'Aguardando'}
      </Badge>
    );
  };

  const getProgressPercent = (progress: ImportProgress): number => {
    if (progress.total_batches === 0) return 0;
    return (progress.current_batch / progress.total_batches) * 100;
  };

  const navigate = useNavigate();

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-background red-texture-bg">
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Helper to format date for display
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

  // Parse cron schedule to human readable
  const parseCronSchedule = (schedule: string) => {
    const scheduleMap: Record<string, string> = {
      '0 5 * * *': 'Diariamente às 02:00 AM (Brasília)',
      '0 3 * * 0': 'Domingos às 00:00 AM (Brasília)',
    };
    return scheduleMap[schedule] || schedule;
  };

  // Get log type badge
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

  return (
    <div className="min-h-screen bg-background red-texture-bg">
      <div className="p-8 space-y-8 animate-fade-in max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              Administração Global
            </h1>
            <p className="text-muted-foreground">
              Gerenciamento de dados, sincronizações e monitoramento de todos os projetos
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
              onClick={logout}
              className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <LogOut className="w-4 h-4" />
              Sair do Admin
            </Button>
          </div>
        </div>

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
            {/* Sync Health Monitor */}
            <SyncHealthMonitor projects={activeProjects} />

            {/* Sync History Chart - NEW */}
            <SyncHistoryChart showProjectSelector={true} />

            {/* Quick Sync Card */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-primary" />
                      Sync Rápido (últimos 90 dias)
                    </CardTitle>
                    <CardDescription>
                      Sincronize os dados mais recentes de um projeto específico com a Meta Ads API
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select 
                    value={selectedProjectId} 
                    onValueChange={setSelectedProjectId}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProjects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={async () => {
                      if (!selectedProjectId) {
                        toast.error('Selecione um projeto');
                        return;
                      }
                      const project = activeProjects.find(p => p.id === selectedProjectId);
                      if (!project) return;
                      
                      toast.info(`Iniciando sync para ${project.name}...`);
                      try {
                        const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
                          body: {
                            project_id: project.id,
                            ad_account_id: project.ad_account_id,
                            date_preset: 'last_90d',
                          }
                        });
                        
                        if (error) throw error;
                        if (data.success) {
                          toast.success(`${project.name}: Sync concluído! ${data.data?.daily_records_count || 0} registros importados`);
                        } else {
                          throw new Error(data.error || 'Erro desconhecido');
                        }
                      } catch (error) {
                        toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                      }
                    }}
                    disabled={!selectedProjectId}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Sincronizar Agora
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Month Import Grid */}
            <MonthImportGrid projects={activeProjects} />

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
                    <li>Identifica gaps de 3+ dias consecutivos (gaps menores são normais - dias sem gasto)</li>
                    <li>Para cada gap encontrado, chama a Meta Ads API e importa os dados</li>
                    <li>Se a API retorna 0 registros, significa que não havia campanhas ativas no período</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

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
                      {cronJobs.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Cron Jobs Ativos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-accent">
                      {syncLogs.filter(l => l.status === 'success').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Syncs Bem-Sucedidos (últimos 50)</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-6">

            {/* Custom Period Import - NEW FEATURE */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Importar Período Específico
                </CardTitle>
                <CardDescription>
                  Importe dados de qualquer período para um projeto específico. 
                  Use o Modo Ultra-Seguro para evitar rate limits em importações grandes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Project Selection */}
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProjects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateFrom ? format(customDateFrom, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateFrom}
                          onSelect={setCustomDateFrom}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateTo ? format(customDateTo, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateTo}
                          onSelect={setCustomDateTo}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Safe Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-metric-positive" />
                    <div>
                      <Label htmlFor="safe-mode" className="font-medium">Modo Ultra-Seguro</Label>
                      <p className="text-xs text-muted-foreground">
                        Delays de 60s entre lotes (mais lento, mas evita 100% rate limits)
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="safe-mode"
                    checked={safeMode}
                    onCheckedChange={setSafeMode}
                  />
                </div>

                {/* Progress Monitor - Enhanced */}
                {isMonitoring && monitor && (
                  <div className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center border-2 border-primary">
                            <span className="text-[8px] font-bold text-primary">{monitor.progress}%</span>
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-lg">{monitor.projectName}</span>
                          <p className="text-xs text-muted-foreground">Importação em andamento</p>
                        </div>
                      </div>
                      <Badge 
                        variant={monitor.status === 'success' ? 'default' : monitor.status === 'error' ? 'destructive' : 'secondary'}
                        className="text-sm px-3 py-1"
                      >
                        {monitor.status === 'importing' ? '⏳ Importando' : 
                         monitor.status === 'success' ? '✅ Concluído' : 
                         monitor.status === 'error' ? '❌ Erro' : 
                         monitor.status === 'partial' ? '⚠️ Parcial' : '⏸️ Aguardando'}
                      </Badge>
                    </div>

                    {/* Progress Bar Enhanced */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progresso</span>
                        <span className="font-mono">{monitor.progress}%</span>
                      </div>
                      <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div 
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${monitor.progress}%` }}
                        />
                        <div 
                          className="absolute inset-y-0 left-0 bg-white/30 rounded-full animate-pulse"
                          style={{ width: `${monitor.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Status Message */}
                    <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg">
                      <Activity className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{monitor.message}</p>
                        {monitor.startedAt && (
                          <p className="text-xs text-muted-foreground">
                            Iniciado: {new Date(monitor.startedAt).toLocaleTimeString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Safe Mode Indicator */}
                    {safeMode && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="w-3 h-3 text-metric-positive" />
                        <span>Modo Ultra-Seguro ativo (delays de 60s entre lotes)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Start Button */}
                <Button
                  onClick={startCustomImport}
                  disabled={!selectedProjectId || !customDateFrom || !customDateTo || isCustomImporting || isMonitoring}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isCustomImporting || isMonitoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Iniciar Importação
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>


        {/* Historical Import Section */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Importação Histórica
                </CardTitle>
                <CardDescription>
                  Importar dados da Meta Ads API desde 01/01/2025 até hoje. 
                  Essa operação salva dados diários na tabela ads_daily_metrics.
                </CardDescription>
              </div>
              <Button 
                onClick={startImportAll} 
                disabled={isImportingAll || activeProjects.length === 0}
                size="lg"
                className="gap-2"
              >
                {isImportingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Importar Todos ({activeProjects.length})
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum projeto ativo encontrado</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeProjects.map(project => {
                  const progress = importProgress[project.id] || initializeProgress(project.id);
                  const isRunning = progress.status === 'running';
                  
                  return (
                    <Card key={project.id} className="bg-card/50">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(progress.status)}
                            <div>
                              <h4 className="font-semibold">{project.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {project.ad_account_id}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(progress.status)}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startImport(project)}
                              disabled={isRunning || isImportingAll}
                            >
                              {isRunning ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        {(isRunning || progress.total_batches > 0) && (
                          <div className="space-y-2">
                            <Progress 
                              value={getProgressPercent(progress)} 
                              className="h-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{progress.message}</span>
                              {progress.total_batches > 0 && (
                                <span>
                                  {progress.current_batch}/{progress.total_batches} batches • {progress.total_records} registros
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {progress.error && (
                          <p className="text-xs text-destructive mt-2">
                            Erro: {progress.error}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

            {/* Import Stats */}
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
                      {Object.values(importProgress).filter(p => p.status === 'success').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Importações Concluídas</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-accent">
                      {Object.values(importProgress).reduce((sum, p) => sum + p.total_records, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Total de Registros</p>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                  Últimas 50 execuções de sincronização e detecção de gaps.
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
                              {parsedMessage.gaps_found !== undefined && (
                                <span className="mr-3">
                                  🔍 {parsedMessage.gaps_found} gaps encontrados
                                </span>
                              )}
                              {parsedMessage.gaps_fixed !== undefined && (
                                <span className="mr-3">
                                  ✅ {parsedMessage.gaps_fixed} corrigidos
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
