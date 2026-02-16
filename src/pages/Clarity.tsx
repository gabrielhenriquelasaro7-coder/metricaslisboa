import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, ExternalLink, Trash2, Eye, BarChart3, MousePointerClick, Clock, ScrollText, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import clarityIcon from '@/assets/clarity-icon.png';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/PageTransition';

interface ClarityProject {
  id: string;
  project_id: string;
  clarity_project_id: string;
  label: string;
  created_at: string;
}

interface ClarityMetric {
  metricName: string;
  information: Record<string, any>[];
}

export default function Clarity() {
  const { projects } = useProjects();
  const [clarityProjects, setClarityProjects] = useState<ClarityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [clarityId, setClarityId] = useState('');
  const [clarityLabel, setClarityLabel] = useState('');
  const [clarityToken, setClarityToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [selectedClarityProject, setSelectedClarityProject] = useState<ClarityProject | null>(null);
  const [clarityData, setClarityData] = useState<ClarityMetric[] | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const fetchClarityProjects = useCallback(async () => {
    if (!selectedProject?.id) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('clarity_projects')
      .select('id, project_id, clarity_project_id, label, created_at')
      .eq('project_id', selectedProject.id);
    if (!error && data) setClarityProjects(data);
    setLoading(false);
  }, [selectedProject?.id]);

  useEffect(() => { fetchClarityProjects(); }, [fetchClarityProjects]);

  const handleAddClarity = async () => {
    if (!clarityId || !clarityLabel || !clarityToken || !selectedProject) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('clarity_projects').insert({
        project_id: selectedProject.id,
        clarity_project_id: clarityId,
        label: clarityLabel,
        api_token: clarityToken,
      });
      if (error) throw error;
      setAddDialogOpen(false);
      setClarityId('');
      setClarityLabel('');
      setClarityToken('');
      toast.success('Projeto Clarity conectado!');
      fetchClarityProjects();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('clarity_projects').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    setClarityProjects(prev => prev.filter(p => p.id !== id));
    toast.success('Projeto removido');
  };

  const handleViewData = async (cp: ClarityProject) => {
    setSelectedClarityProject(cp);
    setDataModalOpen(true);
    setClarityData(null);
    setLoadingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('clarity-proxy', {
        body: { clarityProjectId: cp.id, numOfDays: 3, dimension1: 'Device' },
      });
      if (error) throw error;
      setClarityData(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Clarity fetch error:', err);
      toast.error('Erro ao buscar dados do Clarity');
      setClarityData([]);
    } finally {
      setLoadingData(false);
    }
  };

  const getMetricValue = (metrics: ClarityMetric[] | null, name: string) => {
    if (!metrics) return null;
    const m = metrics.find(m => m.metricName === name);
    if (!m || !m.information?.length) return null;
    return m.information;
  };

  const trafficInfo = getMetricValue(clarityData, 'Traffic');
  const engagementInfo = getMetricValue(clarityData, 'Engagement Time');
  const deadClickInfo = getMetricValue(clarityData, 'Dead Click Count');
  const rageClickInfo = getMetricValue(clarityData, 'Rage Click Count');
  const scrollInfo = getMetricValue(clarityData, 'Excessive Scroll');
  const quickbackInfo = getMetricValue(clarityData, 'Quickback Click');

  const totalSessions = trafficInfo?.reduce((s, i) => s + Number(i.totalSessionCount || 0), 0) || 0;
  const totalUsers = trafficInfo?.reduce((s, i) => s + Number(i.distantUserCount || 0), 0) || 0;

  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        <div className="relative z-10 p-4 sm:p-6 lg:p-8 pb-16 space-y-6 sm:space-y-8">
          {/* Hero Header */}
          <FadeIn>
            <div className="glass-card overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-purple-600/20 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <img src={clarityIcon} alt="Clarity" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        Microsoft Clarity
                      </h1>
                      <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                        Análise de comportamento e mapas de calor das Landing Pages
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setAddDialogOpen(true)} className="gap-2" disabled={!selectedProject}>
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Conectar Projeto</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{clarityProjects.length}</p>
                    <p className="text-[10px] text-muted-foreground">Projetos Conectados</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">10</p>
                    <p className="text-[10px] text-muted-foreground">Chamadas/dia por projeto</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Project List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedProject ? (
            <div className="glass-card p-8 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Selecione um projeto</h3>
              <p className="text-muted-foreground text-sm">Escolha um projeto no menu lateral para gerenciar as conexões Clarity.</p>
            </div>
          ) : clarityProjects.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <img src={clarityIcon} alt="Clarity" className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-semibold mb-1">Nenhum projeto Clarity conectado</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Conecte o Microsoft Clarity para analisar mapas de calor e comportamento dos usuários.
              </p>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Conectar Clarity
              </Button>
            </div>
          ) : (
            <StaggerContainer staggerDelay={0.05} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clarityProjects.map(cp => (
                <StaggerItem key={cp.id}>
                  <div className="glass-card overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <img src={clarityIcon} alt="" className="w-5 h-5 object-contain" />
                          <h3 className="font-semibold text-sm">{cp.label}</h3>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-500">
                          Conectado
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => handleViewData(cp)}>
                          <Eye className="w-3 h-3" /> Ver Dados
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(`https://clarity.microsoft.com/projects/view/${cp.clarity_project_id}/dashboard`, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleRemove(cp.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>
      </div>

      {/* Add Clarity Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={clarityIcon} alt="" className="w-5 h-5" />
              Conectar Microsoft Clarity
            </DialogTitle>
            <DialogDescription>
              Adicione o token da API do Clarity para começar a receber dados de análise.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Landing Page</Label>
              <Input value={clarityLabel} onChange={e => setClarityLabel(e.target.value)} placeholder="Ex: LP Institucional" className="bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Clarity Project ID</Label>
              <Input value={clarityId} onChange={e => setClarityId(e.target.value)} placeholder="Ex: abc123xyz" className="bg-muted/30" />
              <p className="text-[10px] text-muted-foreground">Encontre em clarity.microsoft.com → Settings → Overview</p>
            </div>
            <div className="space-y-2">
              <Label>API Token</Label>
              <Input type="password" value={clarityToken} onChange={e => setClarityToken(e.target.value)} placeholder="Cole o token JWT aqui" className="bg-muted/30" />
              <p className="text-[10px] text-muted-foreground">Gere em Settings → Data Export → Generate new API token</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddClarity} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Modal */}
      <Dialog open={dataModalOpen} onOpenChange={setDataModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={clarityIcon} alt="" className="w-5 h-5" />
              {selectedClarityProject?.label} — Dados Clarity
            </DialogTitle>
            <DialogDescription>Últimos 3 dias de insights</DialogDescription>
          </DialogHeader>

          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Buscando dados do Clarity...</p>
            </div>
          ) : !clarityData || clarityData.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
              <p className="font-medium">Nenhum dado disponível</p>
              <p className="text-sm text-muted-foreground mt-1">Verifique se o token e o projeto estão corretos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricMiniCard icon={<BarChart3 className="w-4 h-4" />} label="Sessões" value={totalSessions.toLocaleString()} />
                <MetricMiniCard icon={<Eye className="w-4 h-4" />} label="Usuários" value={totalUsers.toLocaleString()} />
                <MetricMiniCard icon={<MousePointerClick className="w-4 h-4" />} label="Dead Clicks" value={deadClickInfo?.reduce((s, i) => s + Number(i.value || i.deadClickCount || 0), 0).toLocaleString() || '0'} color="text-yellow-500" />
                <MetricMiniCard icon={<AlertTriangle className="w-4 h-4" />} label="Rage Clicks" value={rageClickInfo?.reduce((s, i) => s + Number(i.value || i.rageClickCount || 0), 0).toLocaleString() || '0'} color="text-red-500" />
              </div>

              {/* Breakdown by device */}
              {trafficInfo && trafficInfo.length > 0 && (
                <div className="glass-card p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-primary" /> Tráfego por Dispositivo
                  </h4>
                  <div className="space-y-2">
                    {trafficInfo.map((item, i) => {
                      const sessions = Number(item.totalSessionCount || 0);
                      const pct = totalSessions > 0 ? (sessions / totalSessions) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs w-20 truncate text-muted-foreground">{item.Device || item.OS || 'N/A'}</span>
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                          <span className="text-xs font-medium w-16 text-right">{sessions.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All other metrics raw */}
              {clarityData.filter(m => m.metricName !== 'Traffic').map((metric, idx) => (
                <div key={idx} className="glass-card p-4">
                  <h4 className="text-sm font-semibold mb-2">{metric.metricName}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {metric.information?.slice(0, 6).map((info, j) => (
                      <div key={j} className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground truncate">{info.Device || info.OS || info.Browser || `Item ${j + 1}`}</p>
                        <p className="text-sm font-bold mt-0.5">
                          {Object.values(info).find(v => typeof v === 'string' && !isNaN(Number(v)) && v !== info.Device && v !== info.OS && v !== info.Browser) || '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function MetricMiniCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 text-center">
      <div className={cn("flex items-center justify-center mb-1", color || "text-primary")}>{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
