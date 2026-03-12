export type BenchmarkDirection = 'higher_better' | 'lower_better';

export type BenchmarkUnit = 'percent' | 'currency' | 'number';

export type BenchmarkStageId =
  | 'exposicao'
  | 'atencao'
  | 'interesse'
  | 'qualificacao'
  | 'compromisso'
  | 'decisao'
  | 'retencao';

export interface BenchmarkMetric {
  key: string;
  label: string;
  unit: BenchmarkUnit;
  min: number;
  mid: number;
  max: number;
  direction: BenchmarkDirection;
  source?: string;
}

export interface SegmentBenchmarks {
  segmentKey: string;
  stages: Record<BenchmarkStageId, BenchmarkMetric[]>;
}

export interface BenchmarkConfig {
  segments: SegmentBenchmarks[];
}

type RawMetric = { min: number; mid: number; max: number };
type RawStageConfig = Record<string, RawMetric>;

interface RawSegmentConfig {
  benchmarks: {
    exposicao?: RawStageConfig;
    atencao?: RawStageConfig;
    interesse?: RawStageConfig;
    qualificacao?: RawStageConfig;
    compromisso?: RawStageConfig;
    decisao?: RawStageConfig;
    retencao?: RawStageConfig;
  };
}

const RAW_BENCHMARK_SEED: Record<string, RawSegmentConfig> = {
  recorrente_b2b: {
    benchmarks: {
      exposicao: { cpm_brl: { min: 12, mid: 18, max: 25 } },
      atencao: { ctr_pct: { min: 4.5, mid: 6.5, max: 8.5 } },
      interesse: { landing_page_cvr_pct: { min: 5, mid: 8, max: 12 } },
      qualificacao: { lead_to_sql_pct: { min: 15, mid: 25, max: 40 } },
      compromisso: { appointment_rate_pct: { min: 25, mid: 35, max: 50 } },
      decisao: { win_rate_pct: { min: 15, mid: 25, max: 40 } },
      retencao: { monthly_customer_churn_pct: { min: 1.5, mid: 3.0, max: 5.0 } },
    },
  },
  venda_unica_high_ticket: {
    benchmarks: {
      exposicao: { cpm_brl: { min: 25, mid: 45, max: 70 } },
      atencao: { ctr_pct: { min: 1.2, mid: 2.5, max: 4.5 } },
      interesse: { cpl_brl: { min: 15, mid: 35, max: 65 } },
      qualificacao: { fit_rate_ict_pct: { min: 40, mid: 60, max: 80 } },
      compromisso: { show_up_rate_pct: { min: 55, mid: 80, max: 95 } },
      decisao: { proposal_win_rate_pct: { min: 15, mid: 30, max: 50 } },
      retencao: { referral_rate_pct: { min: 10, mid: 20, max: 35 } },
    },
  },
  telecom_provedores: {
    benchmarks: {
      exposicao: { cpm_brl: { min: 8, mid: 14, max: 20 } },
      atencao: { ctr_pct: { min: 1.5, mid: 3.0, max: 5.0 } },
      interesse: { landing_page_cvr_pct: { min: 5, mid: 10, max: 18 } },
      qualificacao: { viability_check_pct: { min: 50, mid: 80, max: 95 } },
      compromisso: { installation_scheduled_pct: { min: 70, mid: 90, max: 98 } },
      decisao: { activation_rate_pct: { min: 85, mid: 95, max: 99 } },
      retencao: { monthly_customer_churn_pct: { min: 0.8, mid: 1.2, max: 2.3 } },
    },
  },
  venda_unica_low: {
    benchmarks: {
      exposicao: { cpm_brl: { min: 10, mid: 20, max: 35 } },
      atencao: { ctr_pct: { min: 1.0, mid: 2.0, max: 3.5 } },
      interesse: { visitor_to_cart_pct: { min: 3, mid: 8, max: 15 } },
      qualificacao: { cart_abandonment_pct: { min: 50, mid: 70, max: 85 } },
      compromisso: { checkout_cvr_pct: { min: 1.5, mid: 2.5, max: 4.0 } },
      decisao: { win_rate_pct: { min: 1, mid: 2, max: 4 } },
      retencao: { repurchase_rate_pct: { min: 10, mid: 20, max: 40 } },
    },
  },
  infoproduto: {
    benchmarks: {
      exposicao: { cpm_brl: { min: 15, mid: 30, max: 50 } },
      atencao: { ctr_pct: { min: 1.5, mid: 3.0, max: 5.0 } },
      interesse: { opt_in_rate_pct: { min: 30, mid: 60, max: 80 } },
      qualificacao: { event_attendance_pct: { min: 20, mid: 35, max: 55 } },
      compromisso: { checkout_cvr_pct: { min: 5, mid: 10, max: 20 } },
      decisao: { win_rate_pct: { min: 1, mid: 3, max: 7 } },
      retencao: { refund_rate_pct: { min: 3, mid: 7, max: 12 } },
    },
  },
  servico_consultivo: {
    benchmarks: {
      exposicao: { cpm_brl: { min: 15, mid: 25, max: 45 } },
      atencao: { ctr_pct: { min: 1.0, mid: 2.0, max: 3.5 } },
      interesse: { lead_to_diag_pct: { min: 10, mid: 30, max: 55 } },
      qualificacao: { proposal_acceptance_pct: { min: 20, mid: 40, max: 65 } },
      compromisso: { win_rate_final_pct: { min: 15, mid: 25, max: 45 } },
      decisao: { win_rate_pct: { min: 10, mid: 20, max: 35 } },
      retencao: { ltv_months: { min: 6, mid: 12, max: 24 } },
    },
  },
  // Fallbacks para manter compatibilidade com nomes antigos temporariamente
  'Indústria B2B': { benchmarks: {
      exposicao: { cpm_brl: { min: 12, mid: 18, max: 25 } },
      atencao: { ctr_pct: { min: 4.5, mid: 6.5, max: 8.5 } },
      interesse: { landing_page_cvr_pct: { min: 5, mid: 8, max: 12 } },
      qualificacao: { lead_to_sql_pct: { min: 15, mid: 25, max: 40 } },
      compromisso: { appointment_rate_pct: { min: 25, mid: 35, max: 50 } },
      decisao: { win_rate_pct: { min: 15, mid: 25, max: 40 } },
      retencao: { monthly_customer_churn_pct: { min: 1.5, mid: 3.0, max: 5.0 } },
    }},
  'Indústria B2C': { benchmarks: {
      exposicao: { cpm_brl: { min: 10, mid: 20, max: 35 } },
      atencao: { ctr_pct: { min: 1.0, mid: 2.0, max: 3.5 } },
      interesse: { visitor_to_cart_pct: { min: 3, mid: 8, max: 15 } },
      qualificacao: { cart_abandonment_pct: { min: 50, mid: 70, max: 85 } },
      compromisso: { checkout_cvr_pct: { min: 1.5, mid: 2.5, max: 4.0 } },
      decisao: { win_rate_pct: { min: 1, mid: 2, max: 4 } },
      retencao: { repurchase_rate_pct: { min: 10, mid: 20, max: 40 } },
    }},
  'Serviços': { benchmarks: {
      exposicao: { cpm_brl: { min: 15, mid: 25, max: 45 } },
      atencao: { ctr_pct: { min: 1.0, mid: 2.0, max: 3.5 } },
      interesse: { lead_to_diag_pct: { min: 10, mid: 30, max: 55 } },
      qualificacao: { proposal_acceptance_pct: { min: 20, mid: 40, max: 65 } },
      compromisso: { win_rate_final_pct: { min: 15, mid: 25, max: 45 } },
      decisao: { win_rate_pct: { min: 10, mid: 20, max: 35 } },
      retencao: { ltv_months: { min: 6, mid: 12, max: 24 } },
    }},
};

const METRIC_META: Record<
  string,
  {
    label: string;
    unit: BenchmarkUnit;
    defaultDirection: BenchmarkDirection;
  }
> = {
  // Aquisição
  cpm_brl: { label: 'CPM (R$)', unit: 'currency', defaultDirection: 'lower_better' },
  cpc_brl: { label: 'CPC (R$)', unit: 'currency', defaultDirection: 'lower_better' },
  cpl_brl: { label: 'CPL (R$)', unit: 'currency', defaultDirection: 'lower_better' },
  ctr_pct: { label: 'CTR (%)', unit: 'percent', defaultDirection: 'higher_better' },
  landing_page_cvr_pct: { label: 'CVR Landing Page (%)', unit: 'percent', defaultDirection: 'higher_better' },
  
  // Comercial / Vendas
  lead_to_sql_pct: { label: 'Taxa Lead → SQL (%)', unit: 'percent', defaultDirection: 'higher_better' },
  fit_rate_ict_pct: { label: 'Taxa de Qualificação ICP (%)', unit: 'percent', defaultDirection: 'higher_better' },
  viability_check_pct: { label: 'Viabilidade Técnica (%)', unit: 'percent', defaultDirection: 'higher_better' },
  visitor_to_cart_pct: { label: 'Taxa Visitante → Carrinho (%)', unit: 'percent', defaultDirection: 'higher_better' },
  opt_in_rate_pct: { label: 'Taxa Inscrição → Grupo (%)', unit: 'percent', defaultDirection: 'higher_better' },
  lead_to_diag_pct: { label: 'Taxa Lead → Diagnóstico (%)', unit: 'percent', defaultDirection: 'higher_better' },
  lead_to_visit_pct: { label: 'Taxa Lead → Visita (%)', unit: 'percent', defaultDirection: 'higher_better' },
  trial_to_sub_pct: { label: 'Trial → Assinante (%)', unit: 'percent', defaultDirection: 'higher_better' },
  audit_standard_pct: { label: 'Auditoria de Padrão (%)', unit: 'percent', defaultDirection: 'higher_better' },

  // Compromisso
  appointment_rate_pct: { label: 'Taxa de Agendamento (%)', unit: 'percent', defaultDirection: 'higher_better' },
  show_up_rate_pct: { label: 'Taxa de Presença (Show-up) (%)', unit: 'percent', defaultDirection: 'higher_better' },
  installation_scheduled_pct: { label: 'Agendamento Instalação (%)', unit: 'percent', defaultDirection: 'higher_better' },
  cart_abandonment_pct: { label: 'Abandono de Carrinho (%)', unit: 'percent', defaultDirection: 'lower_better' },
  event_attendance_pct: { label: 'Presença no Evento/Live (%)', unit: 'percent', defaultDirection: 'higher_better' },
  proposal_acceptance_pct: { label: 'Taxa de Aceite de Proposta (%)', unit: 'percent', defaultDirection: 'higher_better' },
  no_show_presencial_pct: { label: 'No-Show Presencial (%)', unit: 'percent', defaultDirection: 'lower_better' },
  user_activation_pct: { label: 'Ativação de Usuário (%)', unit: 'percent', defaultDirection: 'higher_better' },
  same_store_growth_pct: { label: 'Crescimento Same-Store (%)', unit: 'percent', defaultDirection: 'higher_better' },

  // Decisão
  win_rate_pct: { label: 'Win Rate (%)', unit: 'percent', defaultDirection: 'higher_better' },
  proposal_win_rate_pct: { label: 'Win Rate de Diagnóstico (%)', unit: 'percent', defaultDirection: 'higher_better' },
  activation_rate_pct: { label: 'Taxa de Ativação (%)', unit: 'percent', defaultDirection: 'higher_better' },
  checkout_cvr_pct: { label: 'Taxa de Conversão Checkout (%)', unit: 'percent', defaultDirection: 'higher_better' },
  win_rate_final_pct: { label: 'Win Rate Final (%)', unit: 'percent', defaultDirection: 'higher_better' },
  closing_rate_pct: { label: 'Taxa de Fechamento Balcão (%)', unit: 'percent', defaultDirection: 'higher_better' },
  arpu_brl: { label: 'ARPU (R$)', unit: 'currency', defaultDirection: 'higher_better' },
  markup_avg: { label: 'Markup Médio', unit: 'number', defaultDirection: 'higher_better' },

  // Retenção
  monthly_customer_churn_pct: { label: 'Churn Mensal (%)', unit: 'percent', defaultDirection: 'lower_better' },
  repurchase_rate_pct: { label: 'Taxa de Recompra (%)', unit: 'percent', defaultDirection: 'higher_better' },
  referral_rate_pct: { label: 'Taxa de Indicação Ativa (%)', unit: 'percent', defaultDirection: 'higher_better' },
  refund_rate_pct: { label: 'Taxa de Reembolso (%)', unit: 'percent', defaultDirection: 'lower_better' },
  ltv_months: { label: 'LTV (Meses)', unit: 'number', defaultDirection: 'higher_better' },
  return_rate_30d_pct: { label: 'Taxa de Retorno (30 dias) (%)', unit: 'percent', defaultDirection: 'higher_better' },
  royalty_delinquency_pct: { label: 'Inadimplência Royalties (%)', unit: 'percent', defaultDirection: 'lower_better' },
};

export const BENCHMARK_STAGES: { id: BenchmarkStageId; label: string }[] = [
  { id: 'exposicao', label: '01 · Exposição' },
  { id: 'atencao', label: '02 · Atenção' },
  { id: 'interesse', label: '03 · Interesse' },
  { id: 'qualificacao', label: '04 · Qualificação' },
  { id: 'compromisso', label: '05 · Compromisso' },
  { id: 'decisao', label: '06 · Decisão' },
  { id: 'retencao', label: '07 · Retenção' },
];

export function createDefaultBenchmarkConfigFromSeed(): BenchmarkConfig {
  const segments: SegmentBenchmarks[] = Object.entries(RAW_BENCHMARK_SEED).map(
    ([segmentKey, raw]): SegmentBenchmarks => {
      const stages: SegmentBenchmarks['stages'] = {
        exposicao: [],
        atencao: [],
        interesse: [],
        qualificacao: [],
        compromisso: [],
        decisao: [],
        retencao: [],
      };

      (Object.keys(raw.benchmarks) as BenchmarkStageId[]).forEach((stageId) => {
        const stageConfig = raw.benchmarks[stageId];
        if (!stageConfig) return;
        const metrics: BenchmarkMetric[] = Object.entries(stageConfig).map(([metricKey, values]) => {
          const meta = METRIC_META[metricKey] || {
            label: metricKey,
            unit: 'number' as BenchmarkUnit,
            defaultDirection: 'higher_better' as BenchmarkDirection,
          };
          return {
            key: metricKey,
            label: meta.label,
            unit: meta.unit,
            min: values.min,
            mid: values.mid,
            max: values.max,
            direction: meta.defaultDirection,
          };
        });
        stages[stageId] = metrics;
      });

      return { segmentKey, stages };
    },
  );

  return { segments };
}

export function resetSegmentFromSeed(segmentKey: string, currentConfig: BenchmarkConfig): BenchmarkConfig {
  const seed = RAW_BENCHMARK_SEED[segmentKey];
  if (!seed) return currentConfig;
  const fresh = createDefaultBenchmarkConfigFromSeed();
  const freshSegment = fresh.segments.find((s) => s.segmentKey === segmentKey);
  if (!freshSegment) return currentConfig;
  return {
    ...currentConfig,
    segments: currentConfig.segments.map((s) => (s.segmentKey === segmentKey ? freshSegment : s)),
  };
}

export type BenchmarkStatus = 'ruim' | 'na_media' | 'bom' | 'proximo_do_ideal' | 'sem_dados';

export function classifyMetricValue(value: number | null | undefined, metric: BenchmarkMetric): BenchmarkStatus {
  // Se for nulo ou indefinido, sem dados. 0 pode ser um dado real em métricas de custo ou churn.
  if (value == null || Number.isNaN(value) || !metric) return 'sem_dados';
  
  const { min, mid, max, direction } = metric;
  
  if (direction === 'higher_better') {
    if (value <= min) return 'ruim';
    if (value < mid) return 'na_media';
    if (value < max) return 'bom';
    return 'proximo_do_ideal';
  } else {
    // Para lower_better (ex: CPM, CPC, Churn)
    // Se o valor é 0, é excelente (próximo do ideal)
    if (value === 0) return 'proximo_do_ideal';
    if (value >= max) return 'ruim';
    if (value > mid) return 'na_media';
    if (value > min) return 'bom';
    return 'proximo_do_ideal';
  }
}

export function calculateRatio(value: number | null | undefined, metric: BenchmarkMetric): number {
  if (value == null || Number.isNaN(value) || !metric) return 0;
  const { mid, direction } = metric;

  if (value === 0) {
    return direction === 'lower_better' ? 2 : 0;
  }

  if (direction === 'higher_better') {
    if (mid === 0) return value > 0 ? 2 : 1;
    return value / mid;
  } else {
    if (mid === 0) return 0.1;
    return mid / value;
  }
}

export function metricScore(value: number | null | undefined, metric: BenchmarkMetric): number {
  if (!metric) return 0.5;
  const status = classifyMetricValue(value, metric);
  switch (status) {
    case 'ruim':
      return 1;
    case 'na_media':
      return 0.66;
    case 'bom':
      return 0.33;
    case 'proximo_do_ideal':
      return 0;
    default:
      return 0.5;
  }
}

export function getStageName(id: string): string {
  const map: Record<string, string> = {
    exposicao: 'Exposição',
    atencao: 'Atenção',
    interesse: 'Interesse',
    qualificacao: 'Qualificação',
    compromisso: 'Compromisso',
    decisao: 'Decisão',
    retencao: 'Retenção',
    cegueira: 'Cegueira'
  };
  return map[id] || id;
}

export function getStageLabel(id: string, _segment?: string): string {
  return getStageName(id);
}

export function getMetricLabel(id: string, segment?: string): string | null {
  if (!segment || id === 'cegueira') return null;
  const seed = RAW_BENCHMARK_SEED[segment];
  if (!seed) return null;

  const stageKey = id as BenchmarkStageId;
  const metrics = seed.benchmarks[stageKey];
  
  if (metrics && Object.keys(metrics).length > 0) {
    const firstMetricKey = Object.keys(metrics)[0];
    const meta = METRIC_META[firstMetricKey];
    return meta ? meta.label : null;
  }
  return null;
}

export function getStageReason(id: string, businessModel?: string): string {
  // Razões Específicas por Modelo
  if (businessModel === 'venda_unica_high_ticket') {
    const highTicketMap: Record<string, string> = {
      qualificacao: 'Leads desqualificados (sem poder aquisitivo) ou falta de triagem agresiva por parte do SDR.',
      compromisso: 'Baixa autoridade percebida no agendamento, gerando show-up rate crítico nas reuniões.',
      decisao: 'Oferta com baixo valor percebido perante o preço, ou script focado em técnica e não em ROI.',
    };
    if (highTicketMap[id]) return highTicketMap[id];
  }

  if (businessModel === 'telecom_provedores') {
    const telecomMap: Record<string, string> = {
      qualificacao: 'Baixa cobertura de rede nas áreas onde o marketing está atuando (falha de geolocalização).',
      compromisso: 'Lentidão no agendamento da instalação, fazendo o cliente optar por um concorrente local.',
      decisao: 'Processo de ativação burocrático ou falha técnica no momento da instalação final.',
    };
    if (telecomMap[id]) return telecomMap[id];
  }

  if (businessModel === 'venda_unica_low') {
    const ecommerceMap: Record<string, string> = {
      interesse: 'Falta de confiança na loja, fotos de baixa qualidade ou descrição de produto insuficiente.',
      compromisso: 'Frete abusivo ou poucas opções de pagamento gerando alto abandono de checkout.',
      decisao: 'Inexistência de prova social real (reviews) ou falta de gatilhos de urgência/escassez.',
    };
    if (ecommerceMap[id]) return ecommerceMap[id];
  }

  // Fallback e Padrões
  const map: Record<string, string> = {
    exposicao: 'Falta de alcance massivo ou segmentação extremamente nichada que impede o volume de topo.',
    atencao: 'Criativos saturados ou mensagem que não conecta com o ICP, gerando um CTR abaixo da média.',
    interesse: 'Landing Page com fricção alta ou promessa de valor fraca que não retém a curiosidade inicial.',
    qualificacao: 'Processo de triagem ineficiente ou SDRs sem critérios claros de MQL para SQL.',
    compromisso: 'Baixa taxa de show-up ou falha em converter a intenção em agendamento firme.',
    decisao: 'Script de vendas focado em features e não em ROI, ou falta de prova social relevante.',
    retencao: 'Pós-venda reativo que não entrega o "sucesso do cliente", gerando churn precoce.',
    cegueira: 'Falta de mensuração no funil, tornando qualquer otimização uma aposta às cegas.'
  };
  return map[id] || 'Performance limitada por ineficiência estrutural na etapa.';
}

export function getStageNum(id: string): string {
  const map: Record<string, string> = {
    exposicao: '01',
    atencao: '02',
    interesse: '03',
    qualificacao: '04',
    compromisso: '05',
    decisao: '06',
    retencao: '07',
    cegueira: '00'
  };
  return map[id] || 'XX';
}

export function getStageInjection(id: string, businessModel?: string): string {
  // Injeções Específicas por Modelo
  if (businessModel === 'venda_unica_high_ticket') {
    const highTicketMap: Record<string, string> = {
      qualificacao: 'Implementar formulário de aplicação com filtro de faturamento e focar em MQLs de alto valor.',
      compromisso: 'Criar vídeo de autoridade pré-call e fluxo de lembretes multicanal para garantir o show-up.',
      decisao: 'Ajustar o pitch para Venda Consultiva baseada em Gap Analysis e Garantia de Performance.',
    };
    if (highTicketMap[id]) return highTicketMap[id];
  }

  if (businessModel === 'telecom_provedores') {
    const telecomMap: Record<string, string> = {
      qualificacao: 'Sincronizar campanhas de tráfego pago exatamente com os raios de viabilidade técnica da fibra.',
      compromisso: 'Implementar sistema de agendamento online imediato após a consulta de viabilidade positiva.',
      decisao: 'Oferecer instalação expressas (em até 24h) e bonificação por migração de concorrente.',
    };
    if (telecomMap[id]) return telecomMap[id];
  }

  if (businessModel === 'venda_unica_low') {
    const ecommerceMap: Record<string, string> = {
      interesse: 'Otimizar velocidade da loja, inserir reviews reais com fotos e implementar selos de segurança.',
      compromisso: 'Oferecer frete grátis para primeira compra e habilitar One-Click Checkout.',
      decisao: 'Implementar Pop-ups de intenção de saída e régua de recuperação de carrinho via WhatsApp.',
    };
    if (ecommerceMap[id]) return ecommerceMap[id];
  }

  // Fallback e Padrões
  const map: Record<string, string> = {
    exposicao: 'Expandir canais de aquisição e implementar Lookalike de 1% baseado em LTV.',
    atencao: 'Refresh total de criativos focados em ganchos emocionais e prova social imediata.',
    interesse: 'Redesign de LP com foco em CRO e implementação de micro-conversões rastreáveis.',
    qualificacao: 'Implementar Lead Scoring automatizado e script de qualificação via IA/SDR.',
    compromisso: 'Implementar fluxo de lembretes multicanal e pré-call de confirmação.',
    decisao: 'Implementar Playbook de Fechamento Baseado em Desafios e Garantia de Performance.',
    retencao: 'Estabelecer Roadmap de Sucesso do Cliente e monitoramento de NPS trimestral.',
    cegueira: 'Setup imediato de GA4, API de Conversão e Dashboard de Métricas em Tempo Real.'
  };
  return map[id] || 'Consultoria de Processo e Infraestrutura de Dados.';
}

export function calculateScore1to10(ratio: number): number {
  if (ratio === undefined || ratio === null || isNaN(ratio)) return 1;
  if (ratio >= 1.5 || ratio === Infinity) return 10;
  if (ratio <= 0.05) return 1;

  if (ratio < 1.0) {
    // Escala 1-7 para ratios 0.1-1.0
    const val = Math.round((ratio - 0.1) / 0.9 * 6 + 1);
    return Math.max(1, Math.min(7, val));
  } else {
    // Escala 7-10 para ratios 1.0-1.5
    const val = Math.round((ratio - 1.0) / 0.5 * 3 + 7);
    return Math.max(7, Math.min(10, val));
  }
}

