import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart3,
  Target,
  Thermometer,
  Layers,
  ChevronRight,
  ChevronLeft,
  Info,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Globe,
  FileText,
  Download,
  Zap,
  ArrowRight,
  HelpCircle,
  Database,
  History as HistoryIcon,
  Trash2,
  Plus,
  Eye,
  Search,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BENCHMARK_STAGES,
  BenchmarkStageId,
  classifyMetricValue,
  createDefaultBenchmarkConfigFromSeed
} from '@/lib/diagnosticBenchmarks';
import { RevenueFlow } from '@/components/dashboard/RevenueFlow';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DiagnosticWizard } from './diagnostic/DiagnosticWizard';
import { DiagnosticResults } from './diagnostic/DiagnosticResults';
import { DiagnosticModel } from './diagnostic/DiagnosticModel';
import { DiagnosticProject } from '@/types/diagnostic';

const PROJECTS_STORAGE_KEY = 'diagnostic_projects_v1';

export default function DiagnosticTOC() {
  const [activeTab, setActiveTab] = useState('modelo');
  const [projects, setProjects] = useState<DiagnosticProject[]>([]);
  const [currentProject, setCurrentProject] = useState<DiagnosticProject | null>(null);
  const [mode, setMode] = useState<'list' | 'wizard' | 'results'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);

  const { projects: systemProjects } = useProjects();

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('diagnostic_reports')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      if (error) throw error;

      const mapped: DiagnosticProject[] = (data || []).map((r: any) => {
        const reportData = (typeof r.data === 'object' && r.data !== null) ? r.data : {};
        return {
          ...reportData,
          id: r.id,
          dbId: r.id,
          projectId: r.project_id,
          month: r.month,
          year: r.year,
          updatedAt: r.updated_at
        } as DiagnosticProject;
      });
      setProjects(mapped);
    } catch (error: any) {
      console.error('Erro ao buscar relatórios:', error);

      const localData = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (localData) {
        const localProjects: DiagnosticProject[] = JSON.parse(localData);
        setProjects(localProjects);
      }

      if (error?.code === '42P01') {
        toast.info('Modo Local Ativo: Tabela não encontrada. Dados sendo salvos localmente.', {
          duration: 4000
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedMonth, selectedYear]);

  const saveProject = async (p: DiagnosticProject) => {
    // 1. Sempre salvar no LocalStorage primeiro como backup
    const localData = localStorage.getItem(PROJECTS_STORAGE_KEY);
    let localProjects: DiagnosticProject[] = localData ? JSON.parse(localData) : [];
    const index = localProjects.findIndex(lp => lp.id === p.id);
    if (index >= 0) {
      localProjects[index] = p;
    } else {
      localProjects.push(p);
    }
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(localProjects));

    // 2. Salvar no banco
    try {
      const systemProjectId = (p as any).systemProjectId || (p as any).projectId || p.id;

      const { error } = await supabase
        .from('diagnostic_reports')
        .upsert({
          project_id: systemProjectId,
          month: selectedMonth,
          year: selectedYear,
          data: p as any,
          updated_at: new Date().toISOString()
        } as any, {
          onConflict: 'project_id, month, year'
        });

      if (error) throw error;
      toast.success('Diagnóstico salvo na nuvem!');
      fetchReports();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      if (error?.code === '42P01') {
        toast.success('Diagnóstico salvo localmente!');
      } else {
        toast.error('Erro ao sincronizar com a nuvem, mas salvo localmente.');
      }
      fetchReports();
    }
  };

  const deleteProject = async (id: string) => {
    const localData = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (localData) {
      const localProjects: DiagnosticProject[] = JSON.parse(localData);
      const filtered = localProjects.filter(p => p.id !== id);
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(filtered));
    }

    try {
      await supabase
        .from('diagnostic_reports')
        .delete()
        .eq('id', id as any);

      toast.success('Diagnóstico removido.');
      fetchReports();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.success('Diagnóstico removido localmente.');
      fetchReports();
    }
  };

  const handleStartNew = (systemProjectId?: string) => {
    const selected = systemProjectId ? systemProjects.find(p => p.id === systemProjectId) : null;

    const newProject: DiagnosticProject = {
      id: crypto.randomUUID(),
      name: selected?.name || '',
      segment: (selected as any)?.segment || 'Serviços',
      status: 'rascunho',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      goal: { type: 'mensal', value: 0, mrr_atual: 0, restrictions: [] },
      economics: {
        averageTicket: 0,
        contributionMargin: 0,
        cycleTime: 0,
        commercialCapacity: '',
        meetingsPerWeek: 0,
        monthlySalesMktCost: 0
      },
      market: { tam: 0, sam: 0, som: 0, currentShare: 0, targetShare: 0, confidence: 'media', justification: '' },
      bowtie: {
        exposicao: { value: 0, reliability: 'media' },
        atencao: { value: 0, reliability: 'media' },
        interesse: { value: 0, reliability: 'media' },
        qualificacao: { value: 0, reliability: 'media' },
        compromisso: { value: 0, reliability: 'media' },
        decisao: { value: 0, reliability: 'media' },
        retencao: { value: 0, reliability: 'media' },
        cegueira: { value: 0, reliability: 'media' },
      },
      tracking: {
        utms_implementadas: false,
        crm_com_origem: false,
        funil_padronizado_crm: false,
        conf_crm: 'baixa'
      },
      ltp: {
        ioMap: [],
        crt: { nodes: [], coreProblemId: '' },
        ec: { objective: '', needs: [], actions: [], assumptions: [], injection: '' },
        frt: [],
        prt: [],
        tt: []
      }
    };

    if (systemProjectId) {
      (newProject as any).systemProjectId = systemProjectId;
    }

    setCurrentProject(newProject);
    setMode('wizard');
    setActiveTab('diagnostico');
    setIsModalOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 w-full">
        {/* ── HEADER ── */}
        <div className="relative overflow-hidden bg-card border border-border rounded-[2rem] p-6 sm:p-8 shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.08),transparent_60%)] pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Título + Botão */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[1.25rem] bg-red-600/10 border border-red-600/20 flex items-center justify-center flex-shrink-0">
                  <Target className="w-7 h-7 text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-foreground uppercase tracking-tighter italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Gestão de <span className="text-red-600">Restrições</span>
                  </h1>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Intelligence Engine V4 · Bowtie TOC</p>
                </div>
              </div>

              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-[#EA3829] hover:bg-[#D32F2F] text-white rounded-xl text-[11px] font-black gap-2 px-6 h-11 shadow-xl shadow-red-600/20 active:scale-95 transition-all flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" /> NOVO DIAGNÓSTICO
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-popover border-border text-popover-foreground rounded-[2rem] shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground mb-6 italic">Iniciar Diagnóstico</DialogTitle>
                  </DialogHeader>

                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar projeto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-xl focus-visible:ring-red-600/50"
                    />
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {systemProjects
                      .filter(p => !p.archived && p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(sp => (
                        <button
                          key={sp.id}
                          onClick={() => handleStartNew(sp.id)}
                          className="w-full flex items-center justify-between p-4 rounded-2xl bg-background border border-border hover:border-red-600/50 transition-all text-left group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center border border-border group-hover:border-red-600/30">
                              <Database className="w-5 h-5 text-muted-foreground group-hover:text-red-600" />
                            </div>
                            <div>
                              <p className="text-[12px] font-black text-foreground uppercase tracking-tight">{sp.name}</p>
                              <p className="text-[9px] text-muted-foreground font-bold">{(sp as any).segment || 'Serviços'}</p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-muted/50 border border-border rounded-xl flex flex-col gap-1">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Total Analisado</span>
                <span className="text-2xl font-black text-foreground tracking-tighter">{projects.length} <span className="text-xs text-muted-foreground font-bold uppercase">Projetos</span></span>
              </div>
              <div className="p-4 bg-muted/50 border border-border rounded-xl flex flex-col gap-1">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Completos</span>
                <span className="text-2xl font-black text-emerald-500 tracking-tighter">
                  {projects.filter(p => p.status === 'completo').length}
                </span>
              </div>
            </div>

            {/* Nav Tabs */}
            <div className="flex items-center gap-1 border-t border-border pt-4">
              <button
                onClick={() => { setActiveTab('diagnostico'); setMode('list'); }}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'diagnostico' ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="w-3.5 h-3.5" /> Gestão de Projetos
              </button>
              <button
                onClick={() => setActiveTab('modelo')}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'modelo' ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Thermometer className="w-3.5 h-3.5" /> Metodologia TOC
              </button>
            </div>

            {/* Seletor de Período */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Período de Análise:</span>
              <div className="flex gap-2">
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-[120px] h-8 bg-muted/50 border-border text-[10px] font-bold uppercase rounded-lg">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()} className="text-[10px] font-bold uppercase">
                        {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-[100px] h-8 bg-muted/50 border-border text-[10px] font-bold uppercase rounded-lg">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {[2024, 2025, 2026].map(y => (
                      <SelectItem key={y} value={y.toString()} className="text-[10px] font-bold uppercase">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="min-h-[600px] px-0 sm:px-2 pb-12">
          {activeTab === 'modelo' && (
            <div className="animate-in fade-in zoom-in-95 duration-500 pt-6">
              <DiagnosticModel />
            </div>
          )}

          {activeTab === 'diagnostico' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {mode === 'list' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Diagnósticos Ativos</h3>
                    <Badge variant="outline" className="text-[8px] bg-red-600/5 border-red-600/20 text-red-600 font-black tracking-widest">{projects.length} TOTAL</Badge>
                  </div>
                  <ProjectList
                    projects={projects}
                    onOpen={(p) => { setCurrentProject(p); setMode('results'); }}
                    onEdit={(p) => { setCurrentProject(p); setMode('wizard'); }}
                    onDelete={(id) => deleteProject(id)}
                  />
                </div>
              )}

              {mode === 'wizard' && currentProject && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <DiagnosticWizard
                    project={currentProject}
                    onSave={(p) => {
                      setCurrentProject(p);
                      saveProject(p);
                      setMode('results');
                    }}
                    onCancel={() => setMode('list')}
                  />
                </div>
              )}

              {mode === 'results' && currentProject && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <DiagnosticResults
                    project={currentProject}
                    onBack={() => setMode('list')}
                    onEdit={() => setMode('wizard')}
                    onSave={(p) => {
                      setCurrentProject(p);
                      saveProject(p);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}

function ProjectList({ projects, onOpen, onEdit, onDelete }: {
  projects: DiagnosticProject[],
  onOpen: (p: DiagnosticProject) => void,
  onEdit: (p: DiagnosticProject) => void,
  onDelete: (id: string) => void
}) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-zinc-950/50 rounded-[2.5rem] border border-white/5 border-dashed">
        <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center border border-white/5 shadow-2xl">
          <FileText className="w-10 h-10 text-zinc-800" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Nenhum diagnóstico ainda</h3>
          <p className="text-[10px] text-zinc-500 max-w-[240px] mx-auto uppercase font-bold tracking-widest leading-relaxed">Sua jornada guiada por dados começa aqui. Identifique restrições agora.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map(p => (
        <Card key={p.id} className="relative overflow-hidden group p-5 bg-gradient-to-br from-zinc-950 to-black border-white/5 hover:border-red-600/30 transition-all duration-500 rounded-[2rem] flex flex-col justify-between h-full shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] pointer-events-none group-hover:bg-red-600/10 transition-all duration-700" />

          <div className="relative z-10 space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-[1.25rem] flex items-center justify-center border border-white/10 group-hover:border-red-600/30 transition-all shadow-inner">
                  <Globe className="w-6 h-6 text-zinc-500 group-hover:text-red-600" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight italic leading-tight">{p.name || 'Projeto sem nome'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <HistoryIcon className="w-3 h-3 text-zinc-700" />
                    <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{p.segment}</span>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className={cn(
                "text-[8px] uppercase font-black px-3 py-1 rounded-full border-none shadow-lg",
                p.status === 'completo' ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"
              )}>
                {p.status === 'completo' ? 'Analisado' : 'Em Andamento'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Meta de Receita</span>
                <span className="text-xs font-black text-white">R$ {p.goal.value.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Última Escala</span>
                <span className="text-xs font-black text-zinc-400">Ativo</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex gap-2 mt-6">
            <Button
              className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-red-600/20 active:scale-95 transition-all"
              onClick={() => onOpen(p)}
            >
              <Eye className="w-4 h-4" /> Ver Análise
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl bg-black border-white/5 text-zinc-500 hover:text-white hover:border-white/20 active:scale-95 transition-all"
                onClick={() => onEdit(p)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl bg-black border-white/5 text-zinc-700 hover:text-red-500 hover:border-red-500/20 active:scale-95 transition-all"
                onClick={() => onDelete(p.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
