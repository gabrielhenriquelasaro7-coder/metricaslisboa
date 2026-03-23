import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DiagnosticProject,
  BusinessModel,
  DiagnosticIdentification,
  DiagnosticBusiness,
  DiagnosticFunnelData,
  FunnelTravaData,
} from '@/types/diagnostic';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useProjects } from '@/hooks/useProjects';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronRight,
  ChevronLeft,
  Target,
  Users,
  Globe,
  FileText,
  Zap,
  Sparkles,
  Loader2,
  CheckCircle2,
  BarChart3,
  ShoppingCart,
  Store,
  Headphones,
  Database,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WizardProps {
  project: DiagnosticProject;
  onSave: (project: DiagnosticProject, aiResult?: any) => void;
  onCancel: () => void;
}

// ─── FUNNEL QUESTIONS BY BUSINESS MODEL ──────────────────────────────────────
interface FunnelField {
  key: string;
  label: string;
  unit: string;
  placeholder: string;
  help: string;
}

interface TravaConfig {
  id: string;
  label: string;
  description: string;
  fields: FunnelField[];
}

function getTravaConfigs(model: BusinessModel): TravaConfig[] {
  const common01: FunnelField[] = [
    { key: 'impressions', label: 'Volume de Impressões', unit: 'número', placeholder: '150000', help: 'Total de impressões no período' },
    { key: 'cpm', label: 'CPM (R$)', unit: 'R$', placeholder: '18.00', help: 'Custo por mil impressões' },
  ];
  const common02: FunnelField[] = [
    { key: 'ctr', label: 'CTR (%)', unit: '%', placeholder: '6.23', help: 'Click-through rate' },
    { key: 'clicks', label: 'Cliques', unit: 'número', placeholder: '9300', help: 'Total de cliques' },
    { key: 'cpc', label: 'CPC (R$)', unit: 'R$', placeholder: '5.70', help: 'Custo por clique' },
  ];

  switch (model) {
    case 'ecommerce':
      return [
        { id: 'trava01', label: 'Trava 01 — Exposição', description: 'Volume de impressões e custo de alcance', fields: common01 },
        { id: 'trava02', label: 'Trava 02 — Atenção', description: 'CTR, Cliques e CPC', fields: common02 },
        { id: 'trava03', label: 'Trava 03 — Interesse', description: 'Leads, CPL e conversão', fields: [
          { key: 'leads', label: 'Leads / Visitantes', unit: 'número', placeholder: '5000', help: 'Visitantes únicos ou leads gerados' },
          { key: 'cpl', label: 'CPL (R$)', unit: 'R$', placeholder: '12.00', help: 'Custo por lead / visitante' },
          { key: 'conversion_rate', label: 'Taxa de Conversão (%)', unit: '%', placeholder: '3.5', help: 'Visitantes → ação' },
        ]},
        { id: 'trava04', label: 'Trava 04 — Qualificação', description: 'MQL, Add to Cart', fields: [
          { key: 'mql', label: 'MQL / Add to Cart', unit: 'número', placeholder: '800', help: 'Produtos adicionados ao carrinho' },
          { key: 'qualification_rate', label: 'Taxa de Qualificação (%)', unit: '%', placeholder: '16', help: '% dos visitantes que adicionam ao carrinho' },
        ]},
        { id: 'trava05', label: 'Trava 05 — Checkout', description: 'Iniciaram checkout', fields: [
          { key: 'checkouts', label: 'Checkouts Iniciados', unit: 'número', placeholder: '320', help: 'Quantos iniciaram o checkout' },
          { key: 'checkout_rate', label: 'Taxa de Checkout (%)', unit: '%', placeholder: '40', help: '% do carrinho que inicia checkout' },
        ]},
        { id: 'trava06', label: 'Trava 06 — Pedido', description: 'Pedidos realizados', fields: [
          { key: 'orders', label: 'Pedidos Realizados', unit: 'número', placeholder: '180', help: 'Vendas efetivadas' },
          { key: 'order_rate', label: 'Taxa de Conversão Checkout→Pedido (%)', unit: '%', placeholder: '56', help: '% dos checkouts finalizados' },
        ]},
        { id: 'trava07', label: 'Trava 07 — Recompra', description: 'Retenção e recompra', fields: [
          { key: 'repurchase_rate', label: 'Taxa de Recompra (%)', unit: '%', placeholder: '25', help: '% de clientes que compram novamente' },
          { key: 'ltv', label: 'LTV Médio (R$)', unit: 'R$', placeholder: '450', help: 'Valor vitalício do cliente' },
        ]},
      ];

    case 'inside_sales':
      return [
        { id: 'trava01', label: 'Trava 01 — Exposição', description: 'Volume de impressões e CPM', fields: common01 },
        { id: 'trava02', label: 'Trava 02 — Atenção', description: 'CTR, Cliques e CPC', fields: common02 },
        { id: 'trava03', label: 'Trava 03 — Interesse', description: 'Leads, CPL e conversão', fields: [
          { key: 'leads', label: 'Total de Leads', unit: 'número', placeholder: '350', help: 'Leads gerados no período' },
          { key: 'cpl', label: 'CPL (R$)', unit: 'R$', placeholder: '85.00', help: 'Custo por lead' },
          { key: 'conversion_rate', label: 'Taxa de Conversão (%)', unit: '%', placeholder: '6.6', help: 'Visitantes → lead' },
        ]},
        { id: 'trava04', label: 'Trava 04 — Qualificação', description: 'MQL e taxa de qualificação', fields: [
          { key: 'mql', label: 'MQL (Marketing Qualified Leads)', unit: 'número', placeholder: '88', help: 'Leads qualificados' },
          { key: 'qualification_rate', label: 'Taxa Lead→MQL (%)', unit: '%', placeholder: '25', help: '% dos leads que se qualificam' },
        ]},
        { id: 'trava05', label: 'Trava 05 — Compromisso', description: 'Reuniões e visitas', fields: [
          { key: 'meetings_scheduled', label: 'Reuniões Agendadas', unit: 'número', placeholder: '60', help: 'Total de reuniões marcadas' },
          { key: 'meetings_done', label: 'Reuniões Realizadas', unit: 'número', placeholder: '42', help: 'Total de reuniões feitas' },
          { key: 'no_show_rate', label: 'Taxa de No-Show (%)', unit: '%', placeholder: '30', help: '% de faltas' },
        ]},
        { id: 'trava06', label: 'Trava 06 — Decisão', description: 'Fechamento de propostas', fields: [
          { key: 'proposals', label: 'Propostas Enviadas', unit: 'número', placeholder: '35', help: 'Total de propostas' },
          { key: 'wins', label: 'Vendas Fechadas', unit: 'número', placeholder: '9', help: 'Propostas aceitas' },
          { key: 'win_rate', label: 'Win Rate (%)', unit: '%', placeholder: '25', help: '% de fechamento' },
        ]},
        { id: 'trava07', label: 'Trava 07 — Retenção', description: 'Churn e recompra', fields: [
          { key: 'churn_rate', label: 'Churn Mensal (%)', unit: '%', placeholder: '3', help: '% de cancelamento mensal' },
          { key: 'repurchase_rate', label: 'Taxa de Recompra (%)', unit: '%', placeholder: '20', help: '% de recompra' },
        ]},
      ];

    case 'pdv':
      return [
        { id: 'trava01', label: 'Trava 01 — Exposição', description: 'Impressões ou fluxo de pessoas', fields: [
          { key: 'impressions', label: 'Impressões Online OU Pessoas que passam', unit: 'número', placeholder: '50000', help: 'Estimativa de fluxo ou impressões' },
          { key: 'cpm', label: 'CPM (R$) — se aplicável', unit: 'R$', placeholder: '15.00', help: 'Custo por mil, se usar mídia online' },
        ]},
        { id: 'trava02', label: 'Trava 02 — Entrada', description: 'Pessoas que entram na loja', fields: [
          { key: 'store_visitors', label: 'Pessoas que entram na loja', unit: 'número', placeholder: '3000', help: 'Visitantes físicos na loja' },
          { key: 'entry_rate', label: 'Taxa de Entrada (%)', unit: '%', placeholder: '6', help: '% do fluxo que entra' },
        ]},
        { id: 'trava03', label: 'Trava 03 — Interesse', description: 'Leads e conversão', fields: [
          { key: 'leads', label: 'Leads / Interessados', unit: 'número', placeholder: '500', help: 'Pessoas que demonstraram interesse' },
          { key: 'cpl', label: 'CPL (R$)', unit: 'R$', placeholder: '25.00', help: 'Custo por lead' },
          { key: 'add_to_cart', label: 'Add to Cart / Experimentação', unit: 'número', placeholder: '300', help: 'Pessoas que experimentaram/escolheram' },
        ]},
        { id: 'trava04', label: 'Trava 04 — Qualificação', description: 'MQL e qualificação', fields: [
          { key: 'mql', label: 'MQL (Qualificados)', unit: 'número', placeholder: '200', help: 'Interessados qualificados' },
          { key: 'qualification_rate', label: 'Taxa de Qualificação (%)', unit: '%', placeholder: '40', help: '% dos interessados que qualificam' },
        ]},
        // Trava 05 = NULL for PDV
        { id: 'trava06', label: 'Trava 06 — Venda', description: 'Vendas realizadas', fields: [
          { key: 'sales', label: 'Vendas Realizadas', unit: 'número', placeholder: '120', help: 'Total de vendas' },
          { key: 'conversion_rate', label: 'Taxa de Conversão (%)', unit: '%', placeholder: '60', help: '% dos qualificados que compram' },
        ]},
        { id: 'trava07', label: 'Trava 07 — Recompra', description: 'Retenção e recompra', fields: [
          { key: 'repurchase_rate', label: 'Taxa de Recompra (%)', unit: '%', placeholder: '35', help: '% de recompra' },
          { key: 'frequency', label: 'Frequência Mensal', unit: 'vezes', placeholder: '2.5', help: 'Vezes que o cliente volta por mês' },
        ]},
      ];
  }
}

// ─── WIZARD STEPS ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'identification', label: 'Identificação', icon: FileText },
  { id: 'business', label: 'Business', icon: Users },
  { id: 'market', label: 'Mercado', icon: Globe },
  { id: 'funnel', label: 'Funil', icon: BarChart3 },
  { id: 'review', label: 'Análise IA', icon: Sparkles },
];

const BUSINESS_MODELS: { value: BusinessModel; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'ecommerce', label: 'E-commerce', icon: ShoppingCart, desc: 'Venda online de produtos' },
  { value: 'inside_sales', label: 'Inside Sales', icon: Headphones, desc: 'Venda consultiva / B2B' },
  { value: 'pdv', label: 'PDV', icon: Store, desc: 'Ponto de Venda físico' },
];

export function DiagnosticWizard({ project: initialProject, onSave, onCancel }: WizardProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [project, setProject] = useState<DiagnosticProject>(initialProject);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTravaIdx, setCurrentTravaIdx] = useState(0);
  const [autoFilledFields, setAutoFilledFields] = useState<Record<string, Set<string>>>({});
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // New data structures
  const [identification, setIdentification] = useState<DiagnosticIdentification>(
    initialProject.identification || {
      companyName: initialProject.name || '',
      product: '',
      icp: initialProject.icp || '',
      segment: initialProject.segment || '',
      location: '',
      businessModel: initialProject.businessModel || 'inside_sales',
    }
  );

  const [business, setBusiness] = useState<DiagnosticBusiness>(
    initialProject.businessData || {
      contributionMargin: initialProject.economics.contributionMargin || 0,
      averageTicket: initialProject.economics.averageTicket || 0,
      revenue: initialProject.goal.value || 0,
      revenueType: 'mensal',
    }
  );

  const [market, setMarket] = useState(initialProject.market);

  const [funnelData, setFunnelData] = useState<DiagnosticFunnelData>(
    initialProject.funnelData || {
      trava07: {},
      trava06: {},
      trava05: {},
      trava04: {},
      trava03: {},
      trava02: {},
      trava01: {},
    }
  );

  // Auto-fetch project metrics from ads_daily_metrics
  const fetchProjectMetrics = useCallback(async () => {
    const systemProjectId = (initialProject as any).systemProjectId || (initialProject as any).projectId;
    if (!systemProjectId) return;

    setIsLoadingMetrics(true);
    try {
      // Fetch Meta Ads daily metrics
      const { data: metaMetrics, error: metaError } = await supabase
        .from('ads_daily_metrics')
        .select('spend, impressions, clicks, leads_count, reach, cpm, cpc, ctr, cpa')
        .eq('project_id', systemProjectId);

      // Fetch Google Ads daily metrics
      const { data: googleMetrics, error: googleError } = await supabase
        .from('google_ads_daily_metrics')
        .select('spend, impressions, clicks, conversions, cpm, cpc, ctr')
        .eq('project_id', systemProjectId);

      let totalImpressions = 0, totalClicks = 0, totalSpend = 0, totalLeads = 0;

      if (metaMetrics && metaMetrics.length > 0) {
        for (const m of metaMetrics) {
          totalImpressions += m.impressions || 0;
          totalClicks += m.clicks || 0;
          totalSpend += m.spend || 0;
          totalLeads += m.leads_count || 0;
        }
      }

      if (googleMetrics && googleMetrics.length > 0) {
        for (const m of googleMetrics) {
          totalImpressions += m.impressions || 0;
          totalClicks += m.clicks || 0;
          totalSpend += m.spend || 0;
          totalLeads += (m.conversions || 0);
        }
      }

      if (totalImpressions === 0 && totalClicks === 0) {
        toast.info('Nenhum dado de mídia encontrado para este projeto.');
        setIsLoadingMetrics(false);
        return;
      }

      const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

      const newAutoFields: Record<string, Set<string>> = {};

      setFunnelData(prev => {
        const updated = { ...prev };

      // Trava 01 - Exposição
      if (totalImpressions > 0) {
        updated.trava01 = {
          ...updated.trava01,
          impressions: Math.round(totalImpressions),
          cpm: parseFloat(cpm.toFixed(2)),
        };
        newAutoFields['trava01'] = new Set(['impressions', 'cpm']);
      }

      // Trava 02 - Atenção
      if (totalClicks > 0) {
        updated.trava02 = {
          ...updated.trava02,
          ctr: parseFloat(ctr.toFixed(2)),
          clicks: Math.round(totalClicks),
          cpc: parseFloat(cpc.toFixed(2)),
        };
        newAutoFields['trava02'] = new Set(['ctr', 'clicks', 'cpc']);
      }

      // Trava 03 - Interesse (leads + CPL)
      if (totalLeads > 0) {
        updated.trava03 = {
          ...updated.trava03,
          leads: Math.round(totalLeads),
          cpl: parseFloat(cpl.toFixed(2)),
        };
        newAutoFields['trava03'] = new Set(['leads', 'cpl']);
      }

        return updated;
      });

      setAutoFilledFields(newAutoFields);
      toast.success(`Dados importados: ${totalImpressions.toLocaleString()} impressões, ${totalClicks.toLocaleString()} cliques, ${totalLeads.toLocaleString()} leads`);
    } catch (err) {
      console.error('Error fetching project metrics:', err);
      toast.error('Erro ao buscar métricas do projeto');
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [initialProject]);

  // Auto-fetch on mount if project has systemProjectId
  useEffect(() => {
    const systemProjectId = (initialProject as any).systemProjectId || (initialProject as any).projectId;
    if (systemProjectId && !initialProject.funnelData?.trava01?.impressions) {
      fetchProjectMetrics();
    }
  }, []);

  const travaConfigs = getTravaConfigs(identification.businessModel);
  const currentStep = STEPS[currentStepIdx];
  const progress = ((currentStepIdx + 1) / STEPS.length) * 100;

  const isFieldAutoFilled = (travaId: string, fieldKey: string) => {
    return autoFilledFields[travaId]?.has(fieldKey) || false;
  };

  const updateFunnelField = (travaId: string, key: string, value: string) => {
    setFunnelData(prev => ({
      ...prev,
      [travaId]: {
        ...prev[travaId as keyof DiagnosticFunnelData],
        [key]: value === '' ? null : parseFloat(value) || value,
      },
    }));
    // Remove auto-filled flag if user manually edits
    setAutoFilledFields(prev => {
      const updated = { ...prev };
      if (updated[travaId]) {
        const newSet = new Set(updated[travaId]);
        newSet.delete(key);
        updated[travaId] = newSet;
      }
      return updated;
    });
  };

  const handleBack = () => {
    if (currentStep.id === 'funnel' && currentTravaIdx > 0) {
      setCurrentTravaIdx(prev => prev - 1);
      window.scrollTo(0, 0);
    } else if (currentStepIdx > 0) {
      setCurrentStepIdx(prev => prev - 1);
      setCurrentTravaIdx(0);
      window.scrollTo(0, 0);
    } else {
      onCancel();
    }
  };

  const handleNext = async () => {
    if (currentStep.id === 'funnel' && currentTravaIdx < travaConfigs.length - 1) {
      setCurrentTravaIdx(prev => prev + 1);
      window.scrollTo(0, 0);
      return;
    }

    if (currentStepIdx < STEPS.length - 2) {
      setCurrentStepIdx(prev => prev + 1);
      setCurrentTravaIdx(0);
      window.scrollTo(0, 0);
    } else if (currentStep.id === 'funnel') {
      // Move to review & trigger AI analysis
      setCurrentStepIdx(STEPS.length - 1);
      window.scrollTo(0, 0);
      await runAIAnalysis();
    }
  };

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnostic-ai-analysis', {
        body: {
          diagnosticData: {
            identification,
            business,
            market,
            funnel: funnelData,
            businessModel: identification.businessModel,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const finalProject: DiagnosticProject = {
        ...project,
        name: identification.companyName,
        segment: identification.segment,
        icp: identification.icp,
        businessModel: identification.businessModel,
        identification,
        businessData: business,
        funnelData,
        aiAnalysis: data,
        economics: {
          ...project.economics,
          averageTicket: business.averageTicket,
          contributionMargin: business.contributionMargin,
        },
        market,
        goal: {
          ...project.goal,
          value: business.revenue,
          type: business.revenueType === 'anual' ? 'anual' : 'mensal',
        },
        status: 'completo',
        updatedAt: new Date().toISOString(),
      };

      toast.success('Análise concluída!');
      onSave(finalProject, data);
    } catch (err: any) {
      console.error('AI Analysis error:', err);
      toast.error(err.message || 'Erro ao executar análise. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Phase Stepper */}
      <div className="bg-card p-6 rounded-[2rem] border border-border shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] pointer-events-none" />

        <div className="flex items-center justify-between mb-8 overflow-x-auto no-scrollbar pb-2">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStepIdx;
            const isPast = idx < currentStepIdx;
            return (
              <div key={idx} className="flex items-center gap-4 group">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                    isActive ? "bg-red-600 border-red-600 shadow-xl shadow-red-600/20 text-white" :
                      isPast ? "bg-muted border-emerald-600/30 text-emerald-500" : "bg-muted/50 border-border text-muted-foreground"
                  )}>
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", isActive ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && <div className="w-8 h-px bg-border mx-2" />}
              </div>
            );
          })}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-end mb-2 px-1">
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight italic">
              {currentStep.id === 'funnel' ? travaConfigs[currentTravaIdx]?.label || 'Funil' : currentStep.label}
            </h2>
            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1 bg-muted" />
        </div>
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-8 pt-5 pb-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors group"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Voltar
          </button>
        </div>

        <div className="px-8 py-6 md:px-10 md:py-8">
          {/* STEP 1: IDENTIFICATION */}
          {currentStep.id === 'identification' && (
            <div className="space-y-6 w-full">
              <div>
                <h3 className="text-lg font-black text-white">Identificação</h3>
                <p className="text-[11px] text-red-600 font-bold mt-0.5">Quanto mais detalhado, mais preciso será o diagnóstico.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Nome da Empresa</Label>
                  <Input
                    placeholder="Ex: TechCorp Brasil"
                    className="h-12 rounded-2xl bg-black border-white/10 text-white text-xs font-bold px-4"
                    value={identification.companyName}
                    onChange={e => setIdentification(p => ({ ...p, companyName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Produto / Serviço Principal</Label>
                  <Input
                    placeholder="Ex: Software de gestão para PMEs"
                    className="h-12 rounded-2xl bg-black border-white/10 text-white text-xs font-bold px-4"
                    value={identification.product}
                    onChange={e => setIdentification(p => ({ ...p, product: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Segmento de Atuação</Label>
                  <Input
                    placeholder="Ex: SaaS B2B, Moda Feminina, Restaurantes..."
                    className="h-12 rounded-2xl bg-black border-white/10 text-white text-xs font-bold px-4"
                    value={identification.segment}
                    onChange={e => setIdentification(p => ({ ...p, segment: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Localização (Estado, Cidade, País)</Label>
                  <Input
                    placeholder="Ex: São Paulo, SP, Brasil"
                    className="h-12 rounded-2xl bg-black border-white/10 text-white text-xs font-bold px-4"
                    value={identification.location}
                    onChange={e => setIdentification(p => ({ ...p, location: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">ICP (Perfil de Cliente Ideal)</Label>
                <Textarea
                  placeholder="Descreva seu cliente ideal: quem é, qual a dor principal, porte, cargo decisor..."
                  className="min-h-[100px] rounded-2xl bg-black border-white/10 text-white text-xs font-bold p-4 resize-none"
                  value={identification.icp}
                  onChange={e => setIdentification(p => ({ ...p, icp: e.target.value }))}
                />
              </div>

              {/* Business Model Selection */}
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Modelo de Negócio</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {BUSINESS_MODELS.map(bm => (
                    <button
                      key={bm.value}
                      onClick={() => setIdentification(p => ({ ...p, businessModel: bm.value }))}
                      className={cn(
                        "p-5 rounded-2xl border transition-all text-left space-y-3",
                        identification.businessModel === bm.value
                          ? "border-red-600 bg-red-600/5 shadow-lg shadow-red-600/10"
                          : "border-white/5 bg-black hover:border-white/15"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border",
                        identification.businessModel === bm.value
                          ? "bg-red-600 border-red-600 text-white"
                          : "bg-zinc-900 border-white/5 text-zinc-500"
                      )}>
                        <bm.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">{bm.label}</p>
                        <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{bm.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS (simplified) */}
          {currentStep.id === 'business' && (
            <div className="space-y-6 w-full">
              <div>
                <h3 className="text-lg font-black text-white">Business</h3>
                <p className="text-[11px] text-red-600 font-bold mt-0.5">Dados financeiros essenciais para calibrar a análise.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Margem de Contribuição (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="35"
                      className="h-12 rounded-2xl bg-black border-white/10 text-white text-xl font-black text-center pr-8"
                      value={business.contributionMargin || ''}
                      onChange={e => setBusiness(p => ({ ...p, contributionMargin: parseFloat(e.target.value) || 0 }))}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-zinc-600">Receita - Custos Variáveis (% sobre receita)</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Ticket Médio (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">R$</span>
                    <Input
                      type="number"
                      placeholder="2500"
                      className="h-12 rounded-2xl bg-black border-white/10 text-white text-xl font-black text-center pl-12"
                      value={business.averageTicket || ''}
                      onChange={e => setBusiness(p => ({ ...p, averageTicket: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Faturamento</Label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">R$</span>
                    <Input
                      type="number"
                      placeholder="300000"
                      className="h-12 rounded-2xl bg-black border-white/10 text-white text-xl font-black text-center pl-12"
                      value={business.revenue || ''}
                      onChange={e => setBusiness(p => ({ ...p, revenue: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex gap-1">
                    {(['mensal', 'anual'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setBusiness(p => ({ ...p, revenueType: type }))}
                        className={cn(
                          'px-4 py-3 rounded-xl text-[10px] font-black uppercase border transition-all',
                          business.revenueType === type
                            ? 'border-red-600 text-red-600 bg-red-600/5'
                            : 'border-white/10 text-zinc-500 bg-transparent hover:border-white/20'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: MARKET (TAM/SAM/SOM) */}
          {currentStep.id === 'market' && (
            <div className="space-y-6 w-full">
              <div>
                <h3 className="text-lg font-black text-white">Mercado — TAM / SAM / SOM</h3>
                <p className="text-[11px] text-red-600 font-bold mt-0.5">Meta sempre ANUAL. Se o mercado for a restrição, a IA identificará a Trava de Mercado.</p>
              </div>

              {/* TAM */}
              <div className="p-5 bg-black/50 border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-600/10 text-red-600 border-none text-[8px] font-black">TAM</Badge>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">Total Addressable Market</span>
                </div>
                <p className="text-[11px] text-zinc-500">Quantas empresas/pessoas poderiam comprar seu produto/serviço? Qual seria o ticket médio anual?</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-sm">R$</span>
                  <Input
                    type="number"
                    placeholder="50000000"
                    className="h-12 rounded-xl bg-zinc-950 border-white/10 text-white font-black text-center pl-12"
                    value={market.tam || ''}
                    onChange={e => setMarket(p => ({ ...p, tam: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* SAM */}
              <div className="p-5 bg-black/50 border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-600/10 text-amber-500 border-none text-[8px] font-black">SAM</Badge>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">Serviceable Addressable Market</span>
                </div>
                <p className="text-[11px] text-zinc-500">Quanto consegue realmente atender? Filtre por: região, segmento, porte, canal de venda, capacidade operacional.</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-sm">R$</span>
                  <Input
                    type="number"
                    placeholder="15000000"
                    className="h-12 rounded-xl bg-zinc-950 border-white/10 text-white font-black text-center pl-12"
                    value={market.sam || ''}
                    onChange={e => setMarket(p => ({ ...p, sam: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* SOM */}
              <div className="p-5 bg-black/50 border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600/10 text-emerald-500 border-none text-[8px] font-black">SOM</Badge>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">Serviceable Obtainable Market</span>
                </div>
                <p className="text-[11px] text-zinc-500">Qual sua capacidade comercial real? Considere: budget de marketing, tamanho da equipe, concorrência.</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-sm">R$</span>
                  <Input
                    type="number"
                    placeholder="3600000"
                    className="h-12 rounded-xl bg-zinc-950 border-white/10 text-white font-black text-center pl-12"
                    value={market.som || ''}
                    onChange={e => setMarket(p => ({ ...p, som: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Fonte / Justificativa</Label>
                <Input
                  placeholder="Ex: relatório Statista 2024, estimativa interna..."
                  className="h-11 rounded-xl bg-black border-white/10 text-white"
                  value={market.justification}
                  onChange={e => setMarket(p => ({ ...p, justification: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* STEP 4: FUNNEL (dynamic per business model) */}
          {currentStep.id === 'funnel' && (
            <div className="space-y-6 w-full">
              {(() => {
                const trava = travaConfigs[currentTravaIdx];
                if (!trava) return <p className="text-zinc-500">Sem configuração de trava disponível.</p>;

                const hasAutoData = Object.keys(autoFilledFields).length > 0;

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-white">{trava.label}</h3>
                        <p className="text-[11px] text-red-600 font-bold mt-0.5">{trava.description}</p>
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Passo {currentTravaIdx + 1} de {travaConfigs.length} · Preencha apenas o que souber. Campos vazios = sem dados.
                        </p>
                      </div>
                      {(trava.id === 'trava07' || trava.id === 'trava06' || trava.id === 'trava05') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchProjectMetrics}
                          disabled={isLoadingMetrics}
                          className="gap-2 text-[9px] font-black uppercase tracking-widest rounded-xl border-white/10 text-zinc-400 hover:text-white hover:border-emerald-600/30"
                        >
                          {isLoadingMetrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          {isLoadingMetrics ? 'Importando...' : 'Importar do Sistema'}
                        </Button>
                      )}
                    </div>

                    {/* N/A Toggle */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-white/5">
                      <Checkbox
                        id={`nao-aplica-${trava.id}`}
                        checked={(funnelData[trava.id as keyof DiagnosticFunnelData] as any)?._nao_aplica === true}
                        onCheckedChange={(checked) => {
                          setFunnelData(prev => ({
                            ...prev,
                            [trava.id]: {
                              ...prev[trava.id as keyof DiagnosticFunnelData],
                              _nao_aplica: checked === true,
                            },
                          }));
                        }}
                        className="border-zinc-600 data-[state=checked]:bg-zinc-600 data-[state=checked]:border-zinc-600"
                      />
                      <label htmlFor={`nao-aplica-${trava.id}`} className="text-[11px] text-zinc-400 font-bold cursor-pointer select-none">
                        Esta trava não se aplica ao meu negócio
                      </label>
                    </div>

                    <div className={cn(
                      "grid grid-cols-1 sm:grid-cols-2 gap-5 transition-all",
                      (funnelData[trava.id as keyof DiagnosticFunnelData] as any)?._nao_aplica && "opacity-30 pointer-events-none"
                    )}>
                      {trava.fields.map(field => {
                        const isAuto = isFieldAutoFilled(trava.id, field.key);
                        return (
                          <div key={field.key} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                {field.label}
                              </Label>
                              {isAuto && (
                                <Badge className="bg-emerald-600/10 text-emerald-500 border-emerald-600/20 text-[7px] font-black uppercase px-1.5 py-0">
                                  <Database className="w-2.5 h-2.5 mr-1" /> Auto
                                </Badge>
                              )}
                            </div>
                            <Input
                              type="number"
                              placeholder={field.placeholder}
                              step="0.01"
                              className={cn(
                                "h-12 rounded-xl bg-black border-white/10 text-white text-lg font-black text-center",
                                isAuto && "border-emerald-600/20 bg-emerald-950/10"
                              )}
                              value={(funnelData[trava.id as keyof DiagnosticFunnelData] as any)?.[field.key] ?? ''}
                              onChange={e => updateFunnelField(trava.id, field.key, e.target.value)}
                            />
                            <p className="text-[10px] text-zinc-600">{field.help}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-2 pt-4">
                      {travaConfigs.map((_, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            idx === currentTravaIdx ? "bg-red-600 scale-125" :
                              idx < currentTravaIdx ? "bg-emerald-600" : "bg-zinc-800"
                          )}
                        />
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* STEP 5: AI REVIEW */}
          {currentStep.id === 'review' && (
            <div className="space-y-8 w-full flex flex-col items-center justify-center py-12">
              {isAnalyzing ? (
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="w-20 h-20 bg-red-600/10 rounded-[1.5rem] flex items-center justify-center border border-red-600/20 animate-pulse">
                    <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-white uppercase tracking-tight italic">Analisando com IA...</h4>
                    <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Processando dados de {identification.companyName || 'sua empresa'}</p>
                    <p className="text-[10px] text-zinc-600">A IA está correlacionando suas métricas com o contexto do seu negócio para identificar a trava principal.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="w-20 h-20 bg-red-600/10 rounded-[1.5rem] flex items-center justify-center border border-red-600/20">
                    <Sparkles className="w-10 h-10 text-red-600" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-white uppercase tracking-tight italic">Análise não iniciada</h4>
                    <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Ocorreu um erro ou a análise precisa ser reiniciada</p>
                  </div>
                  <Button
                    onClick={runAIAnalysis}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-8 h-12 text-[11px] font-black uppercase tracking-widest gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Executar Análise IA
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {currentStep.id !== 'review' && (
          <div className="px-8 py-6 border-t border-white/5 flex justify-between">
            <Button variant="ghost" onClick={handleBack} className="text-zinc-500 hover:text-white gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button onClick={handleNext} className="bg-red-600 hover:bg-red-700 text-white rounded-xl gap-1 px-6">
              {currentStep.id === 'funnel' && currentTravaIdx === travaConfigs.length - 1
                ? <><Sparkles className="w-4 h-4" /> Analisar com IA</>
                : <>Próximo <ChevronRight className="w-4 h-4" /></>
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
