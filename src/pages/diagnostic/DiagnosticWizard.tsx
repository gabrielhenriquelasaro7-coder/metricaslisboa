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
        { id: 'trava06', label: 'Trava 06 — Pedido', description: 'Conversão final do checkout em pedido confirmado', fields: [
          { key: 'orders', label: 'Pedidos Confirmados', unit: 'número', placeholder: '180', help: 'Pedidos finalizados, pagamentos confirmados, etc.' },
          { key: 'order_rate', label: 'Taxa de Conversão Checkout→Pedido (%)', unit: '%', placeholder: '56', help: '% dos checkouts que resultaram em pedido confirmado' },
        ]},
        { id: 'trava07', label: 'Trava 07 — Recompra', description: 'Retenção, recompra e fidelização', fields: [
          { key: 'repurchase_rate', label: 'Taxa de Recompra / Retorno (%)', unit: '%', placeholder: '25', help: '% de clientes que compraram novamente ou retornaram' },
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
        { id: 'trava05', label: 'Trava 05 — Compromisso', description: 'Ações de comprometimento do lead (reunião, envio de dados, visita, etc.)', fields: [
          { key: 'meetings_scheduled', label: 'Compromissos Agendados / Solicitados', unit: 'número', placeholder: '60', help: 'Reuniões marcadas, formulários detalhados enviados, visitas agendadas, etc.' },
          { key: 'meetings_done', label: 'Compromissos Realizados / Concluídos', unit: 'número', placeholder: '42', help: 'Reuniões feitas, dados recebidos, visitas realizadas, etc.' },
          { key: 'no_show_rate', label: 'Taxa de Não-Comparecimento (%)', unit: '%', placeholder: '30', help: '% que não completou o compromisso (no-show, não enviou dados, etc.)' },
        ]},
        { id: 'trava06', label: 'Trava 06 — Decisão', description: 'Momento de decisão do lead (proposta, orçamento, contrato, etc.)', fields: [
          { key: 'proposals', label: 'Propostas / Orçamentos Enviados', unit: 'número', placeholder: '35', help: 'Propostas comerciais, orçamentos ou contratos apresentados ao lead' },
          { key: 'wins', label: 'Vendas Fechadas', unit: 'número', placeholder: '9', help: 'Contratos assinados, vendas concluídas, negócios ganhos' },
          { key: 'win_rate', label: 'Taxa de Fechamento (%)', unit: '%', placeholder: '25', help: '% das propostas que resultaram em venda' },
        ]},
        { id: 'trava07', label: 'Trava 07 — Retenção', description: 'Permanência, recompra e fidelização do cliente', fields: [
          { key: 'churn_rate', label: 'Taxa de Perda / Churn (%)', unit: '%', placeholder: '3', help: '% de clientes que deixaram de comprar, cancelaram ou não retornaram' },
          { key: 'repurchase_rate', label: 'Taxa de Recompra / Renovação (%)', unit: '%', placeholder: '20', help: '% de clientes que compraram novamente, renovaram contrato, etc.' },
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
        { id: 'trava06', label: 'Trava 06 — Venda', description: 'Conversão final em venda', fields: [
          { key: 'sales', label: 'Vendas Concretizadas', unit: 'número', placeholder: '120', help: 'Vendas finalizadas, pedidos confirmados, etc.' },
          { key: 'conversion_rate', label: 'Taxa de Conversão (%)', unit: '%', placeholder: '60', help: '% dos qualificados que efetivaram a compra' },
        ]},
        { id: 'trava07', label: 'Trava 07 — Recompra', description: 'Retenção, retorno e fidelização', fields: [
          { key: 'repurchase_rate', label: 'Taxa de Recompra / Retorno (%)', unit: '%', placeholder: '35', help: '% de clientes que retornaram ou compraram novamente' },
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
      // Filter last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const sinceDate = ninetyDaysAgo.toISOString().split('T')[0];

      // Fetch Meta Ads daily metrics (last 90 days)
      const { data: metaMetrics, error: metaError } = await supabase
        .from('ads_daily_metrics')
        .select('spend, impressions, clicks, leads_count, reach, cpm, cpc, ctr, cpa')
        .eq('project_id', systemProjectId)
        .gte('date', sinceDate);

      // Fetch Google Ads daily metrics (last 90 days)
      const { data: googleMetrics, error: googleError } = await supabase
        .from('google_ads_daily_metrics')
        .select('spend, impressions, clicks, conversions, cpm, cpc, ctr')
        .eq('project_id', systemProjectId)
        .gte('date', sinceDate);

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

  const normalizeTravaId = (trava?: string, nome?: string): string => {
    const rawTrava = (trava || '').toString();
    const digitMatch = rawTrava.match(/(\d{1,2})/);

    if (digitMatch) {
      const num = parseInt(digitMatch[1], 10);
      if (!Number.isNaN(num) && num >= 0 && num <= 7) {
        return String(num).padStart(2, '0');
      }
    }

    const merged = `${rawTrava} ${nome || ''}`.toLowerCase();
    if (merged.includes('cegueira')) return '00';
    if (merged.includes('retenc') || merged.includes('churn') || merged.includes('recompra')) return '07';
    if (merged.includes('decis') || merged.includes('fechamento') || merged.includes('proposta')) return '06';
    if (merged.includes('compromisso') || merged.includes('reuniao') || merged.includes('checkout')) return '05';
    if (merged.includes('qualifica') || merged.includes('mql')) return '04';
    if (merged.includes('lead') || merged.includes('cpl') || merged.includes('interesse')) return '03';
    if (merged.includes('ctr') || merged.includes('clique') || merged.includes('cpc') || merged.includes('atencao')) return '02';
    if (merged.includes('impress') || merged.includes('cpm') || merged.includes('exposicao')) return '01';
    return '00';
  };

  // Helper: check if user actually filled data for a given trava
  const userFilledTrava = (travaId: string): boolean => {
    const travaKey = `trava${travaId}` as keyof DiagnosticFunnelData;
    const travaData = funnelData?.[travaKey] as FunnelTravaData | undefined;
    if (!travaData) return false;
    // Check if any numeric field has a value (ignore _nao_aplica flag)
    return Object.entries(travaData).some(([key, val]) => {
      if (key === '_nao_aplica') return false;
      return val !== null && val !== undefined && val !== '' && val !== 0 && Number(val) !== 0;
    });
  };

  const enforceBlindnessRule = (analysis: any): any => {
    const stageScores = Array.isArray(analysis?.stage_scores) ? analysis.stage_scores : [];

    const missingStages = stageScores
      .filter((score: any) => score?.status === 'sem_dados')
      .map((score: any) => normalizeTravaId(score?.trava, score?.nome))
      .filter((travaId: string) => {
        if (travaId === '00') return false;

        // No modelo PDV, a Trava 05 não se aplica por definição
        if (identification.businessModel === 'pdv' && travaId === '05') return false;

        const travaKey = `trava${travaId}` as keyof DiagnosticFunnelData;
        const travaData = funnelData?.[travaKey] as FunnelTravaData | undefined;
        if (travaData?._nao_aplica === true) return false;

        // If the user actually filled data for this trava, do NOT count as missing
        if (userFilledTrava(travaId)) return false;

        return true;
      });

    if (missingStages.length < 2) return analysis;

    const missingUnique = [...new Set(missingStages)].sort();
    const missingLabel = missingUnique.map(t => `Trava ${t}`).join(', ');

    return {
      ...analysis,
      trava_identificada: 'cegueira',
      trava_nome: 'Cegueira de Dados',
      confianca: 'alta',
      razao_core_problem: `Dados insuficientes para identificar a restrição ativa com confiança. Estágios sem dados: ${missingLabel}.`,
      injecao_recomendada: 'Preencher os estágios sem dados do funil (ou marcar como Não se Aplica) e reexecutar o diagnóstico para identificar a trava real do sistema.',
      sintese: `A análise foi classificada como Cegueira de Dados, pois há dois ou mais estágios sem métricas preenchidas no funil.\n\nSem cobertura mínima de dados, qualquer identificação de gargalo ativo ficaria tecnicamente frágil e sujeita a erro de diagnóstico.\n\nPara avançar com precisão, complete os dados dos estágios pendentes (ou marque corretamente os estágios não aplicáveis) e rode a análise novamente.`,
      udes: [
        'Impossibilidade de identificar a restrição ativa do sistema com confiança',
        'Risco de decisões estratégicas baseadas em dados incompletos',
        'Falta de visibilidade sobre o desempenho real do funil de vendas',
        `Estágios sem métricas: ${missingLabel}`,
      ],
      ltp_analysis: {
        crt_nodes: [
          'A empresa não possui métricas preenchidas em dois ou mais estágios do funil',
          'Sem dados suficientes, não é possível calcular taxas de conversão entre etapas',
          'A ausência de métricas impede a comparação com benchmarks do segmento',
          'Sem comparação com benchmarks, não há como identificar onde o funil está travado',
          'A restrição ativa do sistema permanece invisível — diagnóstico em estado de cegueira',
        ],
        core_problem: 'A empresa opera sem visibilidade suficiente sobre seu funil de vendas, impossibilitando a identificação da restrição ativa e a tomada de decisões estratégicas baseadas em dados.',
        evaporating_cloud: {
          objetivo: 'Identificar e resolver a restrição ativa do funil para crescer com previsibilidade',
          necessidade_a: 'Ter dados completos e confiáveis de todas as etapas do funil para fazer um diagnóstico preciso',
          necessidade_b: 'Agir rapidamente para não perder oportunidades de mercado e receita',
          acao_a: 'Parar e dedicar tempo para instrumentar, coletar e validar métricas de cada etapa do funil antes de qualquer decisão',
          acao_b: 'Tomar decisões estratégicas imediatas baseadas na intuição e experiência, sem esperar dados completos',
          pressuposto_invalido: 'Acredita-se que instrumentar o funil é um processo longo e complexo que impede ações imediatas. Na realidade, as métricas essenciais de cada trava podem ser coletadas em 1-2 semanas com ferramentas já disponíveis (CRM, Google Analytics, plataformas de ads), permitindo agir com dados confiáveis rapidamente.',
          injecao: 'Implementar um plano de metrificação rápida (sprint de dados) focado nos estágios críticos sem dados, utilizando as ferramentas já existentes na operação, para ter visibilidade mínima em até 2 semanas e rodar o diagnóstico novamente.',
        },
        frt_effects: [
          'Todos os estágios do funil passam a ter métricas mensuráveis e atualizadas',
          'O diagnóstico TOC pode ser executado com confiança, identificando a restrição real',
          'Decisões estratégicas passam a ser baseadas em dados, reduzindo desperdício de budget',
          'A equipe ganha clareza sobre onde focar esforços para maximizar resultado',
        ],
        negative_branches: [
          'Risco de resistência da equipe ao processo de coleta de dados se não houver comunicação clara do objetivo',
          'Possibilidade de dados iniciais serem imprecisos se as ferramentas de tracking não estiverem configuradas corretamente',
          'Tempo investido na metrificação pode gerar ansiedade por resultados imediatos na liderança',
        ],
        prerequisite_tree: [
          'Obstáculo: Ferramentas de tracking podem não estar configuradas → OI: Auditar e configurar Google Analytics, pixels e CRM em até 5 dias',
          'Obstáculo: Equipe pode não saber quais métricas coletar → OI: Definir checklist de métricas prioritárias por trava do funil',
          'Obstáculo: Dados históricos podem não existir → OI: Iniciar coleta prospectiva imediata e usar estimativas conservadoras para o período anterior',
          `Obstáculo: Estágios sem dados (${missingLabel}) → OI: Preencher as métricas faltantes no diagnóstico e reexecutar a análise`,
        ],
      },
      plano_90_dias: {
        mes_1: {
          titulo: 'Sprint de Metrificação',
          acoes: [
            'Auditar todas as ferramentas de tracking (GA, pixels, CRM, plataformas de ads) e corrigir configurações',
            'Definir as métricas-chave de cada trava do funil e criar dashboard de acompanhamento',
            'Configurar coleta automatizada de dados para os estágios sem métricas',
            'Treinar equipe no preenchimento e monitoramento das métricas definidas',
            'Ao final do mês, reexecutar o diagnóstico TOC com dados completos',
          ],
        },
        mes_2: {
          titulo: 'Diagnóstico e Ação na Restrição',
          acoes: [
            'Com dados completos, rodar novo diagnóstico TOC para identificar a restrição real',
            'Desenvolver plano de ação específico para a trava identificada',
            'Implementar as primeiras ações corretivas na restrição ativa',
            'Monitorar indicadores semanalmente para validar impacto das ações',
          ],
        },
        mes_3: {
          titulo: 'Otimização e Escala',
          acoes: [
            'Avaliar resultados das ações do mês 2 e ajustar estratégia',
            'Expandir melhorias para estágios adjacentes do funil',
            'Consolidar rotina de monitoramento contínuo de métricas',
            'Preparar próximo ciclo de diagnóstico para melhoria contínua',
          ],
        },
      },
      metricas_foco: missingUnique.map(t => `Métricas da Trava ${t}`),
    };
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

      const normalizedAnalysis = enforceBlindnessRule(data);

      const finalProject: DiagnosticProject = {
        ...project,
        name: identification.companyName,
        segment: identification.segment,
        icp: identification.icp,
        businessModel: identification.businessModel,
        identification,
        businessData: business,
        funnelData,
        aiAnalysis: normalizedAnalysis,
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
      onSave(finalProject, normalizedAnalysis);
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
      <div className="bg-card p-6 rounded-[2rem] border border-border shadow-md dark:shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/3 dark:bg-red-600/5 blur-[50px] pointer-events-none" />

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
                <h3 className="text-lg font-black text-foreground">Identificação</h3>
                <p className="text-[11px] text-red-600 font-bold mt-0.5">Quanto mais detalhado, mais preciso será o diagnóstico.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Nome da Empresa</Label>
                  <Input
                    placeholder="Ex: TechCorp Brasil"
                    className="h-12 rounded-2xl bg-background border-border text-foreground text-xs font-bold px-4"
                    value={identification.companyName}
                    onChange={e => setIdentification(p => ({ ...p, companyName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Produto / Serviço Principal</Label>
                  <Input
                    placeholder="Ex: Software de gestão para PMEs"
                    className="h-12 rounded-2xl bg-background border-border text-foreground text-xs font-bold px-4"
                    value={identification.product}
                    onChange={e => setIdentification(p => ({ ...p, product: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Segmento de Atuação</Label>
                  <Input
                    placeholder="Ex: SaaS B2B, Moda Feminina, Restaurantes..."
                    className="h-12 rounded-2xl bg-background border-border text-foreground text-xs font-bold px-4"
                    value={identification.segment}
                    onChange={e => setIdentification(p => ({ ...p, segment: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Localização (Estado, Cidade, País)</Label>
                  <Input
                    placeholder="Ex: São Paulo, SP, Brasil"
                    className="h-12 rounded-2xl bg-background border-border text-foreground text-xs font-bold px-4"
                    value={identification.location}
                    onChange={e => setIdentification(p => ({ ...p, location: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">ICP (Perfil de Cliente Ideal)</Label>
                <Textarea
                  placeholder="Descreva seu cliente ideal: quem é, qual a dor principal, porte, cargo decisor..."
                  className="min-h-[100px] rounded-2xl bg-background border-border text-foreground text-xs font-bold p-4 resize-none"
                  value={identification.icp}
                  onChange={e => setIdentification(p => ({ ...p, icp: e.target.value }))}
                />
              </div>

              {/* Business Model Selection */}
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Modelo de Negócio</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {BUSINESS_MODELS.map(bm => (
                    <button
                      key={bm.value}
                      onClick={() => setIdentification(p => ({ ...p, businessModel: bm.value }))}
                      className={cn(
                        "p-5 rounded-2xl border transition-all text-left space-y-3",
                        identification.businessModel === bm.value
                          ? "border-red-600 bg-red-600/5 shadow-lg shadow-red-600/10"
                          : "border-border bg-muted/30 hover:border-border/80"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border",
                        identification.businessModel === bm.value
                          ? "bg-red-600 border-red-600 text-white"
                          : "bg-muted border-border text-muted-foreground"
                      )}>
                        <bm.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground uppercase tracking-tight">{bm.label}</p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{bm.desc}</p>
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
                <h3 className="text-lg font-black text-foreground">Business</h3>
                <p className="text-[11px] text-red-600 font-bold mt-0.5">Dados financeiros essenciais para calibrar a análise.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Margem de Contribuição (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="35"
                      className="h-12 rounded-2xl bg-background border-border text-foreground text-xl font-black text-center pr-8"
                      value={business.contributionMargin || ''}
                      onChange={e => setBusiness(p => ({ ...p, contributionMargin: parseFloat(e.target.value) || 0 }))}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Receita - Custos Variáveis (% sobre receita)</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Ticket Médio (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R$</span>
                    <Input
                      type="number"
                      placeholder="2500"
                      className="h-12 rounded-2xl bg-background border-border text-foreground text-xl font-black text-center pl-12"
                      value={business.averageTicket || ''}
                      onChange={e => setBusiness(p => ({ ...p, averageTicket: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Faturamento</Label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R$</span>
                    <Input
                      type="number"
                      placeholder="300000"
                      className="h-12 rounded-2xl bg-background border-border text-foreground text-xl font-black text-center pl-12"
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
                            : 'border-border text-muted-foreground bg-transparent hover:border-border/80'
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
                <h3 className="text-lg font-black text-foreground">Mercado — TAM / SAM / SOM</h3>
                <p className="text-[11px] text-red-600 font-bold mt-0.5">Meta sempre ANUAL. Se o mercado for a restrição, a IA identificará a Trava de Mercado.</p>
              </div>

              {/* TAM */}
              <div className="p-5 bg-muted/30 border border-border rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-600/10 text-red-600 border-none text-[8px] font-black">TAM</Badge>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Total Addressable Market</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Quantas empresas/pessoas poderiam comprar seu produto/serviço? Qual seria o ticket médio anual?</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                  <Input
                    type="number"
                    placeholder="50000000"
                    className="h-12 rounded-xl bg-background border-border text-foreground font-black text-center pl-12"
                    value={market.tam || ''}
                    onChange={e => setMarket(p => ({ ...p, tam: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* SAM */}
              <div className="p-5 bg-muted/30 border border-border rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-600/10 text-amber-500 border-none text-[8px] font-black">SAM</Badge>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Serviceable Addressable Market</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Quanto consegue realmente atender? Filtre por: região, segmento, porte, canal de venda, capacidade operacional.</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                  <Input
                    type="number"
                    placeholder="15000000"
                    className="h-12 rounded-xl bg-background border-border text-foreground font-black text-center pl-12"
                    value={market.sam || ''}
                    onChange={e => setMarket(p => ({ ...p, sam: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* SOM */}
              <div className="p-5 bg-muted/30 border border-border rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600/10 text-emerald-500 border-none text-[8px] font-black">SOM</Badge>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Serviceable Obtainable Market</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Qual sua capacidade comercial real? Considere: budget de marketing, tamanho da equipe, concorrência.</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                  <Input
                    type="number"
                    placeholder="3600000"
                    className="h-12 rounded-xl bg-background border-border text-foreground font-black text-center pl-12"
                    value={market.som || ''}
                    onChange={e => setMarket(p => ({ ...p, som: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Fonte / Justificativa</Label>
                <Input
                  placeholder="Ex: relatório Statista 2024, estimativa interna..."
                    className="h-11 rounded-xl bg-background border-border text-foreground"
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
                if (!trava) return <p className="text-muted-foreground">Sem configuração de trava disponível.</p>;

                const hasAutoData = Object.keys(autoFilledFields).length > 0;

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-foreground">{trava.label}</h3>
                        <p className="text-[11px] text-red-600 font-bold mt-0.5">{trava.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Passo {currentTravaIdx + 1} de {travaConfigs.length} · Preencha apenas o que souber. Campos vazios = sem dados.
                        </p>
                      </div>
                      {(trava.id === 'trava07' || trava.id === 'trava06' || trava.id === 'trava05') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchProjectMetrics}
                          disabled={isLoadingMetrics}
                          className="gap-2 text-[9px] font-black uppercase tracking-widest rounded-xl border-border text-muted-foreground hover:text-foreground hover:border-emerald-600/30"
                        >
                          {isLoadingMetrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          {isLoadingMetrics ? 'Importando...' : 'Importar do Sistema'}
                        </Button>
                      )}
                    </div>

                    {/* N/A Toggle */}
                     <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border">
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
                        className="border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground"
                      />
                      <label htmlFor={`nao-aplica-${trava.id}`} className="text-[11px] text-muted-foreground font-bold cursor-pointer select-none">
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
                              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
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
                                "h-12 rounded-xl bg-background border-border text-foreground text-lg font-black text-center",
                                isAuto && "border-emerald-600/20 bg-emerald-950/10"
                              )}
                              value={(funnelData[trava.id as keyof DiagnosticFunnelData] as any)?.[field.key] ?? ''}
                              onChange={e => updateFunnelField(trava.id, field.key, e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">{field.help}</p>
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
                              idx < currentTravaIdx ? "bg-emerald-600" : "bg-muted"
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
                    <h4 className="text-xl font-black text-foreground uppercase tracking-tight italic">Analisando com IA...</h4>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">Processando dados de {identification.companyName || 'sua empresa'}</p>
                    <p className="text-[10px] text-muted-foreground/70">A IA está correlacionando suas métricas com o contexto do seu negócio para identificar a trava principal.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="w-20 h-20 bg-red-600/10 rounded-[1.5rem] flex items-center justify-center border border-red-600/20">
                    <Sparkles className="w-10 h-10 text-red-600" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-foreground uppercase tracking-tight italic">Análise não iniciada</h4>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">Ocorreu um erro ou a análise precisa ser reiniciada</p>
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
          <div className="px-8 py-6 border-t border-border flex justify-between">
            <Button variant="ghost" onClick={handleBack} className="text-muted-foreground hover:text-foreground gap-1">
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
