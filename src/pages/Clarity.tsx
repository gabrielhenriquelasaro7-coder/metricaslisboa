import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClientSelector } from '@/components/layout/ClientSelector';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, ExternalLink, Trash2, Eye, Settings, BarChart3 } from 'lucide-react';
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

export default function Clarity() {
  const { projects } = useProjects();
  const [clarityProjects, setClarityProjects] = useState<ClarityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [clarityId, setClarityId] = useState('');
  const [clarityLabel, setClarityLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedClarityProject, setSelectedClarityProject] = useState<ClarityProject | null>(null);

  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // For now, clarity projects are stored in-memory since we haven't created the table yet
  // This will be connected to a DB table later
  useEffect(() => {
    setLoading(false);
  }, [selectedProject?.id]);

  const handleAddClarity = async () => {
    if (!clarityId || !clarityLabel || !selectedProject) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    try {
      // For now, store locally until DB table is created
      const newProject: ClarityProject = {
        id: crypto.randomUUID(),
        project_id: selectedProject.id,
        clarity_project_id: clarityId,
        label: clarityLabel,
        created_at: new Date().toISOString(),
      };
      setClarityProjects(prev => [...prev, newProject]);
      setAddDialogOpen(false);
      setClarityId('');
      setClarityLabel('');
      toast.success('Projeto Clarity adicionado!');
    } catch (err) {
      toast.error('Erro ao adicionar');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (id: string) => {
    setClarityProjects(prev => prev.filter(p => p.id !== id));
    if (selectedClarityProject?.id === id) setSelectedClarityProject(null);
    toast.success('Projeto removido');
  };

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
                  <div className="flex items-center gap-3">
                    <ClientSelector />
                    <Button onClick={() => setAddDialogOpen(true)} className="gap-2" disabled={!selectedProject}>
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Novo Projeto</span>
                    </Button>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{clarityProjects.length}</p>
                    <p className="text-[10px] text-muted-foreground">Projetos Conectados</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-metric-positive">{clarityProjects.filter(p => p.project_id === selectedProject?.id).length}</p>
                    <p className="text-[10px] text-muted-foreground">Projeto Atual</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">-</p>
                    <p className="text-[10px] text-muted-foreground">Sessões Analisadas</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Project List */}
          {!selectedProject ? (
            <div className="glass-card p-8 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Selecione um projeto</h3>
              <p className="text-muted-foreground text-sm">Escolha um projeto no seletor acima para gerenciar as conexões Clarity.</p>
            </div>
          ) : clarityProjects.filter(p => p.project_id === selectedProject.id).length === 0 ? (
            <div className="glass-card p-8 text-center">
              <img src={clarityIcon} alt="Clarity" className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-semibold mb-1">Nenhum projeto Clarity conectado</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Conecte o Microsoft Clarity para analisar mapas de calor e comportamento dos usuários nas suas Landing Pages.
              </p>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Conectar Clarity
              </Button>
            </div>
          ) : (
            <StaggerContainer staggerDelay={0.05} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clarityProjects
                .filter(p => p.project_id === selectedProject.id)
                .map(cp => (
                  <StaggerItem key={cp.id}>
                    <div
                      className={cn(
                        "glass-card overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all",
                        selectedClarityProject?.id === cp.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedClarityProject(cp)}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <img src={clarityIcon} alt="" className="w-5 h-5 object-contain" />
                            <h3 className="font-semibold text-sm">{cp.label}</h3>
                          </div>
                          <Badge variant="outline" className="text-[9px] border-metric-positive/30 text-metric-positive">
                            Conectado
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-3">
                          ID: {cp.clarity_project_id}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setSelectedClarityProject(cp); }}>
                            <Eye className="w-3 h-3" /> Ver Dados
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); handleRemove(cp.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
            </StaggerContainer>
          )}

          {/* Selected Clarity Project - Data View */}
          {selectedClarityProject && (
            <FadeIn>
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={clarityIcon} alt="" className="w-6 h-6 object-contain" />
                    <div>
                      <h3 className="font-semibold">{selectedClarityProject.label}</h3>
                      <p className="text-xs text-muted-foreground">Projeto ID: {selectedClarityProject.clarity_project_id}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.open(`https://clarity.microsoft.com/projects/view/${selectedClarityProject.clarity_project_id}/dashboard`, '_blank')}>
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir no Clarity
                  </Button>
                </div>
                <div className="bg-secondary/30 rounded-lg p-8 text-center border border-border">
                  <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <h4 className="font-medium mb-1">Integração em desenvolvimento</h4>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Os dados do mapa de calor e sessões serão exibidos aqui após a configuração completa da API do Clarity.
                  </p>
                </div>
              </div>
            </FadeIn>
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
              Adicione o ID do seu projeto Clarity para analisar mapas de calor e comportamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Landing Page</Label>
              <Input
                value={clarityLabel}
                onChange={e => setClarityLabel(e.target.value)}
                placeholder="Ex: LP Institucional, LP Black Friday"
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <Label>Clarity Project ID</Label>
              <Input
                value={clarityId}
                onChange={e => setClarityId(e.target.value)}
                placeholder="Ex: abc123xyz"
                className="bg-muted/30"
              />
              <p className="text-[10px] text-muted-foreground">
                Encontre o ID em clarity.microsoft.com → Settings → Overview
              </p>
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
    </DashboardLayout>
  );
}
