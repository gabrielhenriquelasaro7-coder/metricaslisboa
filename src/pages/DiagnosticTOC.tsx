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

const toISODate = (date: Date) => date.toISOString().slice(0, 10);
const sumMetric = (rows: any[], key: string) => rows.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);
const pct = (part: number, total: number) => total > 0 ? Number(((part / total) * 100).toFixed(2)) : 0;

async function refreshDiagnosticProjectWithLiveData(project: DiagnosticProject): Promise<DiagnosticProject> {
  const systemProjectId = (project as any).systemProjectId || (project as any).projectId;
  if (!systemProjectId) {
    console.warn('[DiagnosticTOC] Projeto sem systemProjectId — não é possível recalcular com dados atuais.');
    return project;
  }

  const untilDate = new Date();
  const sinceDate = new Date();
  sinceDate.setDate(untilDate.getDate() - 30);
  const since = toISODate(sinceDate);
  const until = toISODate(untilDate);

  const [{ data: adsRows, error: adsError }, { data: crmConnections }, { data: crmDeals, error: crmError }] = await Promise.all([
    supabase
      .from('ads_daily_metrics')
      .select('date, spend, impressions, clicks, conversions, leads_count, purchases_count, synced_at')
      .eq('project_id', systemProjectId)
      .gte('date', since)
      .lte('date', until)
      .order('date', { ascending: false })
      .range(0, 9999),
    supabase
      .from('crm_connections')
      .select('id, provider, status, display_name, updated_at, last_error')
      .eq('project_id', systemProjectId)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('crm_deals')
      .select('id, status, value, stage_name, created_date, closed_date, synced_at')
      .eq('project_id', systemProjectId)
      .gte('created_date', `${since}T00:00:00`)
      .lte('created_date', `${until}T23:59:59`)
      .order('created_date', { ascending: false })
      .range(0, 9999),
  ]);

  if (adsError) console.warn('[DiagnosticTOC] Erro ao atualizar mídia do diagnóstico:', adsError);
  if (crmError) console.warn('[DiagnosticTOC] Erro ao atualizar CRM do diagnóstico:', crmError);

  const ads = adsRows || [];
  const deals = crmDeals || [];
  const crm = crmConnections?.[0];
  const crmConnected = crm?.status === 'connected';

  const spend = sumMetric(ads, 'spend');
  const impressions = sumMetric(ads, 'impressions');
  const clicks = sumMetric(ads, 'clicks');
  const adsLeads = sumMetric(ads, 'leads_count') || sumMetric(ads, 'conversions');
  const sales = deals.filter((deal: any) => deal.status === 'won').length;
  const proposalStages = ['NEGOCIA', 'PROPOSTA', 'FECHADO', 'PERDIDO', 'WON', 'LOST'];
  const proposals = deals.filter((deal: any) => proposalStages.some(token => String(deal.stage_name || '').toUpperCase().includes(token)) || ['won', 'lost'].includes(deal.status)).length;
  const latestAdsSync = ads.map((row: any) => row.synced_at).filter(Boolean).sort().at(-1);
  const latestCrmSync = deals.map((row: any) => row.synced_at).filter(Boolean).sort().at(-1) || crm?.updated_at;

  const mediaEvidence = latestAdsSync ? `Mídia atualizada em ${new Date(latestAdsSync).toLocaleString('pt-BR')}` : 'Mídia recalculada dos últimos 30 dias';
  const crmEvidence = latestCrmSync ? `CRM ${crmConnected ? 'conectado' : 'não conectado'} · atualizado em ${new Date(latestCrmSync).toLocaleString('pt-BR')}` : 'CRM recalculado dos últimos 30 dias';

  // REGRA: Nunca reutilizar snapshot antigo. Sempre recalcular com dados atuais.
  // Quando não há dados, value = 0 e reliability = 'baixa'.
  const hasMedia = ads.length > 0 && impressions > 0;
  const noDataEvidence = 'Sem dados nos últimos 30 dias — recalculado agora';

  return {
    ...project,
    id: project.id,
    projectId: (project as any).projectId || systemProjectId,
    systemProjectId,
    updatedAt: new Date().toISOString(),
    tracking: {
      ...project.tracking,
      crm_com_origem: crmConnected,
      funil_padronizado_crm: crmConnected,
      conf_crm: crmConnected ? 'alta' : 'baixa',
    },
    bowtie: {
      ...project.bowtie,
      exposicao:    { ...project.bowtie.exposicao,    value: hasMedia ? Number(((spend / impressions) * 1000).toFixed(2)) : 0, reliability: hasMedia ? 'alta' : 'baixa', evidence: hasMedia ? mediaEvidence : noDataEvidence },
      atencao:      { ...project.bowtie.atencao,      value: hasMedia ? pct(clicks, impressions) : 0, reliability: hasMedia ? 'alta' : 'baixa', evidence: hasMedia ? mediaEvidence : noDataEvidence },
      interesse:    { ...project.bowtie.interesse,    value: adsLeads > 0 ? pct(deals.length, adsLeads) : 0, reliability: crmConnected && hasMedia ? 'alta' : 'baixa', evidence: `${crmEvidence} · ${deals.length} negócios / ${adsLeads} leads` },
      qualificacao: { ...project.bowtie.qualificacao, value: deals.length > 0 ? pct(proposals, deals.length) : 0, reliability: crmConnected ? 'alta' : 'baixa', evidence: `${crmEvidence} · ${proposals} propostas / ${deals.length} negócios` },
      compromisso:  { ...project.bowtie.compromisso,  value: proposals > 0 ? pct(sales, proposals) : 0, reliability: crmConnected ? 'alta' : 'baixa', evidence: `${crmEvidence} · ${sales} vendas / ${proposals} propostas` },
      decisao:      { ...project.bowtie.decisao,      value: deals.length > 0 ? pct(sales, deals.length) : 0, reliability: crmConnected ? 'alta' : 'baixa', evidence: `${crmEvidence} · ${sales} vendas / ${deals.length} negócios` },
      cegueira:     { ...project.bowtie.cegueira,     value: crmConnected && hasMedia ? 10 : 0, reliability: crmConnected && hasMedia ? 'alta' : 'baixa', evidence: crmConnected ? crmEvidence : noDataEvidence },
    }
  } as DiagnosticProject;
}

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
          // Preserve link to the system project (used for live data lookups)
          systemProjectId: reportData.systemProjectId || r.project_id,
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

  useEffect(() => {
    let cancelled = false;
    if (mode === 'results' && currentProject) {
      refreshDiagnosticProjectWithLiveData(currentProject)
        .then((fresh) => {
          if (!cancelled) setCurrentProject(fresh);
        })
        .catch((error) => console.warn('[DiagnosticTOC] Não foi possível atualizar dados ao abrir resultado:', error));
    }
    return () => { cancelled = true; };
  }, [mode, currentProject?.id]);

  const openProject = async (p: DiagnosticProject, nextMode: 'wizard' | 'results') => {
    setIsLoading(true);
    try {
      const fresh = await refreshDiagnosticProjectWithLiveData(p);
      setCurrentProject(fresh);
      setMode(nextMode);
      if (nextMode === 'results') toast.success('Resultado atualizado com dados atuais.');
    } catch (error) {
      console.error('[DiagnosticTOC] Erro ao abrir diagnóstico atualizado:', error);
      setCurrentProject(p);
      setMode(nextMode);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProject = async (p: DiagnosticProject): Promise<DiagnosticProject> => {
    const systemProjectId = (p as any).systemProjectId || (p as any).projectId || p.id;
    // Always persist systemProjectId inside the snapshot so future loads keep the link
    const payload: any = { ...p, systemProjectId };

    // 1. Backup local
    const localData = localStorage.getItem(PROJECTS_STORAGE_KEY);
    let localProjects: DiagnosticProject[] = localData ? JSON.parse(localData) : [];
    const index = localProjects.findIndex(lp => lp.id === payload.id);
    if (index >= 0) {
      localProjects[index] = payload;
    } else {
      localProjects.push(payload);
    }
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(localProjects));

    // 2. Salvar no banco e devolver a row fresca
    try {
      const { data: upserted, error } = await supabase
        .from('diagnostic_reports')
        .upsert({
          project_id: systemProjectId,
          month: selectedMonth,
          year: selectedYear,
          data: payload as any,
          updated_at: new Date().toISOString()
        } as any, {
          onConflict: 'project_id, month, year'
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Diagnóstico salvo na nuvem!');

      const fresh: DiagnosticProject = {
        ...((upserted as any)?.data ?? payload),
        id: (upserted as any)?.id ?? payload.id,
        dbId: (upserted as any)?.id ?? payload.id,
        projectId: (upserted as any)?.project_id ?? systemProjectId,
        systemProjectId,
        month: (upserted as any)?.month ?? selectedMonth,
        year: (upserted as any)?.year ?? selectedYear,
        updatedAt: (upserted as any)?.updated_at ?? new Date().toISOString(),
      } as DiagnosticProject;

      await fetchReports();
      return fresh;
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      if (error?.code === '42P01') {
        toast.success('Diagnóstico salvo localmente!');
      } else {
        toast.error('Erro ao sincronizar com a nuvem, mas salvo localmente.');
      }
      await fetchReports();
      return payload;
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
                    <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Diagnósticos Ativos</h3>
                    <Badge variant="outline" className="text-[8px] bg-red-600/5 border-red-600/20 text-red-600 font-black tracking-widest">{projects.length} TOTAL</Badge>
                  </div>
                  <ProjectList
                    projects={projects}
                    onOpen={(p) => openProject(p, 'results')}
                    onEdit={(p) => openProject(p, 'wizard')}
                    onDelete={(id) => deleteProject(id)}
                  />
                </div>
              )}

              {mode === 'wizard' && currentProject && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <DiagnosticWizard
                    project={currentProject}
                    onSave={async (p) => {
                      const fresh = await saveProject(p);
                      setCurrentProject(fresh);
                      setMode('results');
                    }}
                    onCancel={() => setMode('list')}
                  />
                </div>
              )}

              {mode === 'results' && currentProject && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <DiagnosticResults
                    key={`${currentProject.id}-${currentProject.updatedAt}`}
                    project={currentProject}
                    onBack={() => setMode('list')}
                    onEdit={() => setMode('wizard')}
                    onSave={async (p) => {
                      const fresh = await saveProject(p);
                      setCurrentProject(fresh);
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
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-muted/30 rounded-[2.5rem] border border-border border-dashed">
        <div className="w-20 h-20 bg-card rounded-3xl flex items-center justify-center border border-border shadow-lg">
          <FileText className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-foreground uppercase tracking-tight italic">Nenhum diagnóstico ainda</h3>
          <p className="text-[10px] text-muted-foreground max-w-[240px] mx-auto uppercase font-bold tracking-widest leading-relaxed">Sua jornada guiada por dados começa aqui. Identifique restrições agora.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map(p => (
        <Card key={p.id} className="relative overflow-hidden group p-5 bg-card border-border hover:border-red-600/30 transition-all duration-500 rounded-[2rem] flex flex-col justify-between h-full shadow-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] pointer-events-none group-hover:bg-red-600/10 transition-all duration-700" />

          <div className="relative z-10 space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-[1.25rem] flex items-center justify-center border border-border group-hover:border-red-600/30 transition-all shadow-inner">
                  <Globe className="w-6 h-6 text-muted-foreground group-hover:text-red-600" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-tight italic leading-tight">{p.name || 'Projeto sem nome'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <HistoryIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">{p.segment}</span>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className={cn(
                "text-[8px] uppercase font-black px-3 py-1 rounded-full border-none shadow-sm",
                p.status === 'completo' ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"
              )}>
                {p.status === 'completo' ? 'Analisado' : 'Em Andamento'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-2xl border border-border flex flex-col gap-1">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Meta de Receita</span>
                <span className="text-xs font-black text-foreground">R$ {p.goal.value.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-muted/50 rounded-2xl border border-border flex flex-col gap-1">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Última Escala</span>
                <span className="text-xs font-black text-muted-foreground">Ativo</span>
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
                className="h-11 w-11 rounded-xl bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 active:scale-95 transition-all"
                onClick={() => onEdit(p)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl bg-card border-border text-muted-foreground hover:text-red-500 hover:border-red-500/20 active:scale-95 transition-all"
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
