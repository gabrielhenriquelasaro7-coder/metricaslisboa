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
  'Indústria B2B': {
    benchmarks: {
      exposicao: {
        cpm_brl: { min: 12, mid: 18, max: 25 },
        cpc_brl: { min: 3.99, mid: 5.7, max: 7.41 },
        cpl_brl: { min: 59.94, mid: 85.63, max: 111.32 },
      },
      atencao: {
        ctr_pct: { min: 4.36, mid: 6.23, max: 8.1 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 19.6, mid: 28.0, max: 36.4 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  'Indústria B2C': {
    benchmarks: {
      exposicao: {
        cpm_brl: { min: 10, mid: 15, max: 22 },
        cpc_brl: { min: 1.5, mid: 2.5, max: 4.0 },
        cpl_brl: { min: 15.0, mid: 25.0, max: 35.0 },
      },
      atencao: {
        ctr_pct: { min: 4.36, mid: 6.23, max: 8.1 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 19.6, mid: 28.0, max: 36.4 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  Serviços: {
    benchmarks: {
      exposicao: {
        cpm_brl: { min: 12, mid: 18, max: 24 },
        cpc_brl: { min: 3.91, mid: 5.58, max: 7.25 },
        cpl_brl: { min: 72.48, mid: 103.54, max: 134.6 },
      },
      atencao: {
        ctr_pct: { min: 3.96, mid: 5.65, max: 7.35 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 19.6, mid: 28.0, max: 36.4 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  Telecom: {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 3.91, mid: 5.58, max: 7.25 },
        cpl_usd: { min: 72.48, mid: 103.54, max: 134.6 },
      },
      atencao: {
        ctr_pct: { min: 3.96, mid: 5.65, max: 7.35 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 23.1, mid: 33.0, max: 42.9 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 0.7, mid: 1.0, max: 1.5 },
      },
    },
  },
  'Financial Services (Serviços Financeiros)': {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 2.42, mid: 3.46, max: 4.5 },
        cpl_usd: { min: 58.75, mid: 83.93, max: 109.11 },
      },
      atencao: {
        ctr_pct: { min: 5.83, mid: 8.33, max: 10.83 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 18.9, mid: 27.0, max: 35.1 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  'Education (Educação)': {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 4.36, mid: 6.23, max: 8.1 },
        cpl_usd: { min: 63.01, mid: 90.02, max: 117.03 },
      },
      atencao: {
        ctr_pct: { min: 4.02, mid: 5.74, max: 7.46 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 16.8, mid: 24.0, max: 31.2 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  'Food Service (Alimentação)': {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 1.44, mid: 2.05, max: 2.67 },
        cpl_usd: { min: 21.19, mid: 30.27, max: 39.35 },
      },
      atencao: {
        ctr_pct: { min: 5.31, mid: 7.58, max: 9.85 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
        ecommerce_purchase_cvr_pct: { min: 1.37, mid: 6.19, max: 6.19 },
        cart_abandonment_pct: { min: 49.15, mid: 70.22, max: 91.29 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 17.5, mid: 25.0, max: 32.5 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  'Retail / Varejo': {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 2.44, mid: 3.49, max: 4.54 },
        cpl_usd: { min: 33.56, mid: 47.94, max: 62.32 },
      },
      atencao: {
        ctr_pct: { min: 6.24, mid: 8.92, max: 11.6 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
        ecommerce_purchase_cvr_pct: { min: 2.91, mid: 3.81, max: 5.04 },
        cart_abandonment_pct: { min: 49.15, mid: 70.22, max: 91.29 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 21.0, mid: 30.0, max: 39.0 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  'Construção Civil': {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 5.5, mid: 7.85, max: 10.21 },
        cpl_usd: { min: 63.64, mid: 90.92, max: 118.2 },
      },
      atencao: {
        ctr_pct: { min: 4.46, mid: 6.37, max: 8.28 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 20.3, mid: 29.0, max: 37.7 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  'E-commerce B2B': {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 2.44, mid: 3.49, max: 4.54 },
        cpl_usd: { min: 33.56, mid: 47.94, max: 62.32 },
      },
      atencao: {
        ctr_pct: { min: 6.24, mid: 8.92, max: 11.6 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
        ecommerce_purchase_cvr_pct: { min: 2.91, mid: 3.81, max: 5.04 },
        cart_abandonment_pct: { min: 49.15, mid: 70.22, max: 91.29 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 19.6, mid: 28.0, max: 36.4 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
  'E-commerce B2C': {
    benchmarks: {
      exposicao: {
        cpc_usd: { min: 2.44, mid: 3.49, max: 4.54 },
        cpl_usd: { min: 33.56, mid: 47.94, max: 62.32 },
      },
      atencao: {
        ctr_pct: { min: 6.24, mid: 8.92, max: 11.6 },
      },
      interesse: {
        landing_page_cvr_pct: { min: 4.62, mid: 6.6, max: 8.58 },
        ecommerce_purchase_cvr_pct: { min: 2.91, mid: 3.81, max: 5.04 },
        cart_abandonment_pct: { min: 49.15, mid: 70.22, max: 91.29 },
      },
      qualificacao: {
        lead_to_sql_pct: { min: 15, mid: 25, max: 40 },
      },
      compromisso: {
        meeting_no_show_pct: { min: 19.6, mid: 28.0, max: 36.4 },
      },
      decisao: {
        win_rate_pct: { min: 16, mid: 25, max: 40 },
      },
      retencao: {
        monthly_customer_churn_pct: { min: 2.0, mid: 3.0, max: 4.5 },
      },
    },
  },
};

const METRIC_META: Record<
  string,
  {
    label: string;
    unit: BenchmarkUnit;
    defaultDirection: BenchmarkDirection;
  }
> = {
  cpm_brl: { label: 'CPM (R$)', unit: 'currency', defaultDirection: 'lower_better' },
  cpc_brl: { label: 'CPC (R$)', unit: 'currency', defaultDirection: 'lower_better' },
  cpl_brl: { label: 'CPL (R$)', unit: 'currency', defaultDirection: 'lower_better' },
  cpc_usd: { label: 'CPC (US$)', unit: 'currency', defaultDirection: 'lower_better' },
  cpl_usd: { label: 'CPL (US$)', unit: 'currency', defaultDirection: 'lower_better' },
  ctr_pct: { label: 'CTR (%)', unit: 'percent', defaultDirection: 'higher_better' },
  landing_page_cvr_pct: { label: 'CVR Landing Page (%)', unit: 'percent', defaultDirection: 'higher_better' },
  ecommerce_purchase_cvr_pct: { label: 'CVR Compra E-commerce (%)', unit: 'percent', defaultDirection: 'higher_better' },
  cart_abandonment_pct: { label: 'Abandono de Carrinho (%)', unit: 'percent', defaultDirection: 'lower_better' },
  lead_to_sql_pct: { label: 'Leads → SQL (%)', unit: 'percent', defaultDirection: 'higher_better' },
  meeting_no_show_pct: { label: 'No-show de Reuniões (%)', unit: 'percent', defaultDirection: 'lower_better' },
  win_rate_pct: { label: 'Win Rate (%)', unit: 'percent', defaultDirection: 'higher_better' },
  monthly_customer_churn_pct: { label: 'Churn Mensal Cliente (%)', unit: 'percent', defaultDirection: 'lower_better' },
};

export const BENCHMARK_STAGES: { id: BenchmarkStageId; label: string }[] = [
  { id: 'exposicao', label: '07 · Exposição' },
  { id: 'atencao', label: '06 · Atenção' },
  { id: 'interesse', label: '05 · Interesse' },
  { id: 'qualificacao', label: '04 · Qualificação' },
  { id: 'compromisso', label: '03 · Compromisso' },
  { id: 'decisao', label: '02 · Decisão' },
  { id: 'retencao', label: '01 · Retenção' },
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
  if (value == null || Number.isNaN(value)) return 'sem_dados';
  const { min, mid, max, direction } = metric;
  if (direction === 'higher_better') {
    if (value <= min) return 'ruim';
    if (value < mid) return 'na_media';
    if (value < max) return 'bom';
    return 'proximo_do_ideal';
  } else {
    if (value >= max) return 'ruim';
    if (value > mid) return 'na_media';
    if (value > min) return 'bom';
    return 'proximo_do_ideal';
  }
}

export function metricScore(value: number | null | undefined, metric: BenchmarkMetric): number {
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

