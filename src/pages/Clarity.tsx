import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, ExternalLink, Trash2, Eye, BarChart3 } from 'lucide-react';
import clarityIcon from '@/assets/clarity-icon.png';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/PageTransition';
import ClarityDataModal from '@/components/clarity/ClarityDataModal';

interface ClarityProject {
  id: string;
  project_id: string;
  clarity_project_id: string;
  label: string;
  created_at: string;
}

interface ClarityFullData {
  byDevice: any[] | null;
  bySource: any[] | null;
  byUtm: any[] | null;
  byEngagement: any[] | null;
  byChannel: any[] | null;
}

export default function Clarity() {
  // Clarity is ACCOUNT-LEVEL: show ALL user projects, not just selected one
  const { projects } = useProjects();
  const [clarityProjects, setClarityProjects] = useState<ClarityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [clarityId, setClarityId] = useState('');
  const [clarityLabel, setClarityLabel] = useState('');
  const [clarityToken, setClarityToken] = useState('');
  const [selectedAddProjectId, setSelectedAddProjectId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [selectedClarityProject, setSelectedClarityProject] = useState<ClarityProject | null>(null);
  const [clarityData, setClarityData] = useState<ClarityFullData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [numOfDays, setNumOfDays] = useState(3);

  // Use selected project as default for add dialog, but show ALL projects' clarity configs
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // When dialog opens, default to selected project
  useEffect(() => {
    if (addDialogOpen && selectedProject) {
      setSelectedAddProjectId(selectedProject.id);
    }
  }, [addDialogOpen, selectedProject]);

  // Fetch ALL clarity projects for ALL user projects (account-level)
  const fetchClarityProjects = useCallback(async () => {
    if (!projects.length) { setLoading(false); return; }
    setLoading(true);
    const projectIds = projects.map(p => p.id);
    const { data, error } = await supabase
      .from('clarity_projects')
      .select('id, project_id, clarity_project_id, label, created_at')
      .in('project_id', projectIds);
    if (!error && data) setClarityProjects(data);
    setLoading(false);
  }, [projects]);

  useEffect(() => { fetchClarityProjects(); }, [fetchClarityProjects]);

  const handleAddClarity = async () => {
    if (!clarityId || !clarityLabel || !clarityToken || !selectedAddProjectId) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('clarity_projects').insert({
        project_id: selectedAddProjectId,
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

  const fetchClarityData = useCallback(async (cp: ClarityProject, days: number) => {
    setSelectedClarityProject(cp);
    setDataModalOpen(true);
    setClarityData(null);
    setLoadingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('clarity-proxy', {
        body: { clarityProjectId: cp.id, numOfDays: days },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.errorType === 'rate_limit') {
          toast.error('Limite diário excedido (10 chamadas/dia). Tente amanhã.');
        } else if (data.errorType === 'auth') {
          toast.error('Token inválido ou expirado. Verifique nas configurações do Clarity.');
        } else {
          toast.error(data.error);
        }
        setClarityData(null);
        return;
      }
      setClarityData(data as ClarityFullData);
    } catch (err: any) {
      console.error('Clarity fetch error:', err);
      toast.error('Erro ao buscar dados do Clarity. Verifique a conexão.');
      setClarityData(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const handleViewData = (cp: ClarityProject) => {
    fetchClarityData(cp, numOfDays);
  };

  const handleChangeDays = (days: number) => {
    setNumOfDays(days);
    if (selectedClarityProject) {
      fetchClarityData(selectedClarityProject, days);
    }
  };

  // Get project name for a clarity project
  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Projeto';
  };

  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        <div className="relative z-10 p-4 sm:p-6 lg:p-8 pb-16 space-y-6 sm:space-y-8">
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
                        Análise completa de comportamento nas Landing Pages · Todos os projetos
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setAddDialogOpen(true)} className="gap-2" disabled={!projects.length}>
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Conectar Projeto</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{clarityProjects.length}</p>
                    <p className="text-[10px] text-muted-foreground">LPs Conectadas</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">10</p>
                    <p className="text-[10px] text-muted-foreground">Chamadas/dia por projeto</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !projects.length ? (
            <div className="glass-card p-8 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Nenhum projeto encontrado</h3>
              <p className="text-muted-foreground text-sm">Crie um projeto para conectar o Clarity.</p>
            </div>
          ) : clarityProjects.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <img src={clarityIcon} alt="Clarity" className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-semibold mb-1">Nenhum projeto Clarity conectado</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Conecte o Microsoft Clarity para analisar mapas de calor e comportamento dos usuários em qualquer projeto.
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
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <img src={clarityIcon} alt="" className="w-5 h-5 object-contain" />
                          <h3 className="font-semibold text-sm">{cp.label}</h3>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-500">
                          Conectado
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3 pl-7">{getProjectName(cp.project_id)}</p>
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

      {/* Add Dialog */}
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
              <Label>Projeto</Label>
              <Select value={selectedAddProjectId} onValueChange={setSelectedAddProjectId}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
      <ClarityDataModal
        open={dataModalOpen}
        onOpenChange={setDataModalOpen}
        label={selectedClarityProject?.label || ''}
        data={clarityData}
        loading={loadingData}
        numOfDays={numOfDays}
        onChangeDays={handleChangeDays}
      />
    </DashboardLayout>
  );
}
