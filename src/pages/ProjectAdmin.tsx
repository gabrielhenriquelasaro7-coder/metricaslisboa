import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/hooks/useProjects';
import { ArrowLeft, Database, Activity, RefreshCw, Clock, Loader2, Megaphone, Layers, FileText, Image as ImageIcon, Timer, Images, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import SyncHistoryChart from '@/components/admin/SyncHistoryChart';
import MonthImportGrid from '@/components/admin/MonthImportGrid';

type SyncType = 'all' | 'campaigns' | 'adsets' | 'ads' | 'creatives' | 'hd_images_batch';

interface SyncLog {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface SyncProgressData {
  status: 'idle' | 'importing' | 'syncing' | 'success' | 'partial' | 'error';
  progress?: number;
  message: string;
  started_at?: string;
  current?: number;
  total?: number;
  step?: string;
  updated_at?: string;
}

interface ImageStats {
  totalAds: number;
  cachedAds: number;
  pendingAds: number;
  percentage: number;
}

export default function ProjectAdmin() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [recentLogs, setRecentLogs] = useState<SyncLog[]>([]);
  const [syncingType, setSyncingType] = useState<SyncType | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgressData | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [syncStartTime, setSyncStartTime] = useState<Date | null>(null);
  const [imageStats, setImageStats] = useState<ImageStats | null>(null);
  const [batchSyncProgress, setBatchSyncProgress] = useState<{ current: number; total: number } | null>(null);

  // Poll for sync progress
  const pollSyncProgress = useCallback(async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('projects')
      .select('sync_progress')
      .eq('id', id)
      .single();
    
    if (data?.sync_progress && typeof data.sync_progress === 'object' && !Array.isArray(data.sync_progress)) {
      const rawProgress = data.sync_progress as Record<string, unknown>;
      // Accept either 'step' (edge function format) or 'status' (legacy format)
      if ('step' in rawProgress || 'status' in rawProgress) {
        const progress: SyncProgressData = {
          status: rawProgress.step === 'complete' ? 'success' 
                : rawProgress.step === 'error' ? 'error' 
                : rawProgress.status as SyncProgressData['status'] || 'syncing',
          message: rawProgress.message as string || '',
          current: rawProgress.current as number,
          total: rawProgress.total as number,
          step: rawProgress.step as string,
          progress: rawProgress.current as number, // current IS the percentage (0-100)
          updated_at: rawProgress.updated_at as string
        };
        setSyncProgress(progress);
      
        // Stop polling when complete or error
        if (progress.status === 'success' || progress.status === 'error' || progress.status === 'partial') {
          setSyncingType(null);
          
          // Refresh logs after completion
          const { data: logsData } = await supabase
            .from('sync_logs')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false })
            .limit(15);
          
          if (logsData) {
            setRecentLogs(logsData);
          }
          
          // Update last sync time
          const { data: projectData } = await supabase
            .from('projects')
            .select('last_sync_at')
            .eq('id', id)
            .single();
          
          if (projectData?.last_sync_at) {
            setLastSync(new Date(projectData.last_sync_at));
          }
        }
      }
    }
  }, [id]);

  // Start polling when sync starts
  useEffect(() => {
    if (!syncingType) {
      // Keep progress visible for longer to show final status
      const timeout = setTimeout(() => {
        setSyncProgress(null);
        setElapsedTime(0);
        setSyncStartTime(null);
      }, 5000); // Show for 5 seconds after completion
      return () => clearTimeout(timeout);
    }

    setSyncStartTime(new Date());
    
    // Poll immediately, then every 1 second for faster updates
    pollSyncProgress();
    const pollInterval = setInterval(pollSyncProgress, 1000);
    
    // Safety timeout - if sync runs for more than 5 minutes, stop polling
    const safetyTimeout = setTimeout(() => {
      console.log('Sync safety timeout reached (5 min)');
      setSyncingType(null);
      toast.warning('Sincronização pode estar demorando. Verifique os logs.');
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(pollInterval);
      clearTimeout(safetyTimeout);
    };
  }, [syncingType, pollSyncProgress]);

  // Timer for elapsed time
  useEffect(() => {
    if (!syncStartTime || !syncingType) return;

    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - syncStartTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [syncStartTime, syncingType]);

  // Format elapsed time
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Estimate remaining time based on progress
  const getEstimatedRemaining = () => {
    if (!syncProgress?.progress || syncProgress.progress <= 5 || elapsedTime < 5) return null;
    
    const estimatedTotal = (elapsedTime * 100) / syncProgress.progress;
    const remaining = Math.max(0, estimatedTotal - elapsedTime);
    
    if (remaining < 5) return 'Finalizando...';
    return `~${formatElapsedTime(Math.round(remaining))} restantes`;
  };

  // Fetch image stats
  const fetchImageStats = useCallback(async () => {
    if (!id) return;
    
    const { count: totalAds } = await supabase
      .from('ads')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id);
    
    const { count: cachedAds } = await supabase
      .from('ads')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .not('cached_image_url', 'is', null);
    
    const total = totalAds || 0;
    const cached = cachedAds || 0;
    const pending = total - cached;
    const percentage = total > 0 ? Math.round((cached / total) * 100) : 0;
    
    setImageStats({ totalAds: total, cachedAds: cached, pendingAds: pending, percentage });
  }, [id]);

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
      
      // Fetch image stats
      await fetchImageStats();
      
      setLoading(false);
    };

    fetchProjectData();
  }, [id, fetchImageStats]);

  const handleSync = async (type: SyncType) => {
    if (!id || !project) return;
    
    setSyncingType(type);
    setSyncProgress({ status: 'syncing', message: 'Iniciando sincronização...', progress: 0 });
    
    try {
      const body: Record<string, unknown> = { 
        project_id: id,
        ad_account_id: project.ad_account_id
      };
      
      // Map sync type to syncMode for edge function
      // 'creatives' -> syncMode: 'creatives' (only creative content)
      if (type === 'creatives') {
        body.syncMode = 'creatives';
      } else if (type === 'hd_images_batch') {
        // Batch sync for HD images - will run multiple times
        body.syncMode = 'hd_images';
      } else if (type !== 'all') {
        // For campaigns, adsets, ads - use base sync with date_preset
        body.date_preset = 'last_7d';
      }
      
      const typeLabels: Record<SyncType, string> = {
        all: 'Completa',
        campaigns: 'Campanhas',
        adsets: 'Conjuntos',
        ads: 'Anúncios',
        creatives: 'Criativos',
        hd_images_batch: 'Imagens HD'
      };
      
      toast.success(`Sincronização de ${typeLabels[type]} iniciada`);
      
      // Don't await here - let it run in background while we poll progress
      supabase.functions.invoke('meta-ads-sync', { body })
        .then(({ error, data }) => {
          if (error) {
            console.error('Erro na sincronização:', error);
            // Don't immediately hide progress - let polling handle it
            // The edge function updates sync_progress on error too
            toast.error(`Erro na sincronização: ${error.message || 'Erro desconhecido'}`);
          } else {
            console.log('Sync completed:', data);
            // Refresh image stats after sync
            fetchImageStats();
          }
        })
        .catch((err) => {
          // Network/timeout errors - the sync might still be running on the server
          console.warn('Sync request failed (may still be running):', err);
          // Don't show error immediately - check progress first
        });
      
      // Don't set syncingType to null here - let the polling handle completion
    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro ao iniciar sincronização');
      // Update progress to show error
      setSyncProgress({ status: 'error', message: 'Erro ao iniciar sincronização' });
      // Keep showing the error for a moment before hiding
      setTimeout(() => {
        setSyncingType(null);
      }, 3000);
    }
  };

  // Batch sync for all pending HD images with real-time progress
  const handleBatchImageSync = async () => {
    if (!id || !project) {
      toast.error('Projeto não encontrado');
      return;
    }
    
    // Re-fetch stats before starting to get fresh data
    const { count: totalAdsCount } = await supabase
      .from('ads')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id);
    
    const { count: cachedAdsCount } = await supabase
      .from('ads')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .not('cached_image_url', 'is', null);
    
    const totalAds = totalAdsCount || 0;
    const initialCached = cachedAdsCount || 0;
    const pendingImages = totalAds - initialCached;
    
    if (pendingImages === 0) {
      toast.info('Todas as imagens já estão cacheadas!');
      return;
    }
    
    setSyncingType('hd_images_batch');
    setBatchSyncProgress({ current: initialCached, total: totalAds });
    
    // Start real-time polling of image progress
    let isPolling = true;
    const pollImageProgress = async () => {
      while (isPolling) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
        
        if (!isPolling) break;
        
        const { count: currentCached } = await supabase
          .from('ads')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', id)
          .not('cached_image_url', 'is', null);
        
        if (currentCached !== null) {
          setBatchSyncProgress(prev => prev ? { ...prev, current: currentCached } : { current: currentCached, total: totalAds });
        }
      }
    };
    
    // Start polling in background
    pollImageProgress();
    
    try {
      // Single call to edge function - it will process all images
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: id,
          ad_account_id: project.ad_account_id,
          syncMode: 'hd_images' // This processes ALL pending images
        }
      });
      
      if (error) {
        console.error('Batch sync error:', error);
        toast.error(`Erro na sincronização: ${error.message}`);
        isPolling = false;
        setSyncingType(null);
        setBatchSyncProgress(null);
        return;
      }
      
      // Wait a bit then keep polling for a few more seconds
      // as edge function may still be processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (err) {
      console.error('Batch sync exception:', err);
      toast.error('Erro inesperado na sincronização');
    }
    
    // Stop polling and get final count
    isPolling = false;
    
    // Refresh stats
    await fetchImageStats();
    
    // Final count
    const { count: finalCached } = await supabase
      .from('ads')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .not('cached_image_url', 'is', null);
    
    const finalCachedCount = finalCached || 0;
    const finalPending = totalAds - finalCachedCount;
    const newlyCached = finalCachedCount - initialCached;
    
    setSyncingType(null);
    setBatchSyncProgress(null);
    
    // Show appropriate final message
    if (finalPending === 0) {
      toast.success(`✅ Todas ${totalAds} imagens sincronizadas!`, { duration: 5000 });
    } else if (newlyCached > 0) {
      toast.success(
        `Sync parcial: ${newlyCached} novas imagens. ${finalPending} ainda pendentes (URLs podem estar expiradas).`,
        { duration: 8000 }
      );
    } else {
      toast.warning(
        `Nenhuma nova imagem cacheada. ${finalPending} pendentes podem ter URLs expiradas no Meta.`,
        { duration: 8000 }
      );
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
          <Link to="/dashboard">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              
              {/* Image Cache Status Card */}
              <Card className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Imagens HD</p>
                      {imageStats ? (
                        <div className="mt-1">
                          <p className="font-semibold">
                            {imageStats.cachedAds}/{imageStats.totalAds} 
                            <span className="text-xs text-muted-foreground ml-1">
                              ({imageStats.percentage}%)
                            </span>
                          </p>
                          {imageStats.pendingAds > 0 && (
                            <p className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                              <AlertCircle className="w-3 h-3" />
                              {imageStats.pendingAds} pendentes
                            </p>
                          )}
                        </div>
                      ) : (
                        <Skeleton className="h-5 w-20 mt-1" />
                      )}
                    </div>
                    <Images className="w-8 h-8 text-muted-foreground" />
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
                
                {/* HD Images Batch Sync */}
                {/* Image sync status - simplified */}
                {imageStats && (
                  <div className={`mt-4 p-4 rounded-lg border ${imageStats.pendingAds > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Images className={`w-5 h-5 ${imageStats.pendingAds > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                        <div>
                          <p className="font-medium">
                            Imagens HD: {imageStats.cachedAds}/{imageStats.totalAds} ({imageStats.percentage}%)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {imageStats.pendingAds > 0 
                              ? `${imageStats.pendingAds} pendentes - use "Criativos" acima para sincronizar`
                              : 'Todas as imagens sincronizadas!'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                    <Progress 
                      value={imageStats.percentage} 
                      className="h-2 mt-3" 
                    />
                  </div>
                )}

                {/* Progress Indicator - show if syncing OR if there's recent progress */}
                {(syncingType || syncProgress) && (
                  <div className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {syncProgress?.status === 'success' ? (
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        ) : syncProgress?.status === 'error' ? (
                          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs">✕</span>
                          </div>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                        <span className="font-medium text-sm">
                          {syncProgress?.message || 'Iniciando sincronização...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          <span>{formatElapsedTime(elapsedTime)}</span>
                        </div>
                        {getEstimatedRemaining() && syncingType && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {getEstimatedRemaining()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <Progress 
                      value={syncProgress?.status === 'success' ? 100 : (syncProgress?.current || syncProgress?.progress || 5)} 
                      className="h-2" 
                    />
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {syncProgress?.step && syncProgress.step !== 'complete' && syncProgress.step !== 'error' && `Etapa: ${syncProgress.step}`}
                        {syncProgress?.status === 'success' && 'Sincronização concluída!'}
                        {syncProgress?.status === 'error' && 'Erro na sincronização'}
                      </span>
                      <span>{syncProgress?.status === 'success' ? 100 : (syncProgress?.current || syncProgress?.progress || 0)}%</span>
                    </div>
                    
                    {syncProgress?.current !== undefined && syncProgress?.total !== undefined && syncProgress.status !== 'success' && (
                      <p className="text-xs text-muted-foreground">
                        Processando {syncProgress.current} de {syncProgress.total} registros
                      </p>
                    )}
                  </div>
                )}
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
