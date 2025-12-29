import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useProjects, Project } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Database, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  AlertTriangle,
  RefreshCw
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

export default function Admin() {
  const { projects, loading: projectsLoading } = useProjects();
  const [importProgress, setImportProgress] = useState<Record<string, ImportProgress>>({});
  const [isImportingAll, setIsImportingAll] = useState(false);

  const activeProjects = projects.filter(p => !p.archived);

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

  if (projectsLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              Administração
            </h1>
            <p className="text-muted-foreground">
              Gerenciamento de dados e importação histórica
            </p>
          </div>
        </div>

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
      </div>
    </DashboardLayout>
  );
}
