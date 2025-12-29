// PDF Builder Types - Separate file to avoid circular dependencies and reduce type complexity

export type ChartType = 'line' | 'bar' | 'area' | 'composed';

export type MetricKey = 
  | 'spend' 
  | 'impressions' 
  | 'clicks' 
  | 'reach' 
  | 'conversions' 
  | 'conversion_value' 
  | 'ctr' 
  | 'cpm' 
  | 'cpc' 
  | 'roas' 
  | 'cpa';

export interface ChartConfig {
  type: ChartType;
  primaryMetric: MetricKey;
  secondaryMetric: MetricKey | 'none';
  primaryColor: string;
  secondaryColor: string;
  showGrid: boolean;
}

export interface PageStyle {
  headerColor: string;
  footerColor: string;
  accentColor: string;
  fontFamily: 'helvetica' | 'times' | 'courier';
  showHeaderBar: boolean;
  showFooterBar: boolean;
}

export interface MetricItem {
  key: MetricKey;
  label: string;
  value: string;
  category: 'general' | 'result';
  isCurrency?: boolean;
}

export interface PDFBuilderDialogProps {
  projectName: string;
  periodLabel: string;
  metrics: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalReach: number;
    totalConversions: number;
    totalConversionValue: number;
    ctr: number;
    cpm: number;
    cpc: number;
    cpa: number;
    roas: number;
    avgFrequency?: number;
    campaignCount: number;
  };
  businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | null;
  currency: string;
  chartRef?: React.RefObject<HTMLDivElement>;
  projectId?: string;
}

// Constants
export const METRIC_LABELS: Record<MetricKey, string> = {
  spend: 'Gasto',
  impressions: 'Impressões',
  clicks: 'Cliques',
  reach: 'Alcance',
  conversions: 'Conversões',
  conversion_value: 'Receita',
  ctr: 'CTR (%)',
  cpm: 'CPM',
  cpc: 'CPC',
  roas: 'ROAS',
  cpa: 'CPA',
};

// Currency metrics (that should be formatted with R$)
export const CURRENCY_METRICS: MetricKey[] = ['spend', 'conversion_value', 'cpm', 'cpc', 'cpa'];

// V4 Company colors - Red primary
export const COLOR_PRESETS = [
  '#dc2626', // Red (V4 Primary)
  '#ef4444', // Red lighter
  '#1f2937', // Dark gray
  '#374151', // Gray
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
];

export const PERIOD_PRESETS = [
  { label: 'Últimos 7 dias', value: '7d', days: 7 },
  { label: 'Últimos 14 dias', value: '14d', days: 14 },
  { label: 'Últimos 30 dias', value: '30d', days: 30 },
  { label: 'Últimos 60 dias', value: '60d', days: 60 },
  { label: 'Últimos 90 dias', value: '90d', days: 90 },
  { label: 'Este mês', value: 'this_month', days: 0 },
  { label: 'Mês passado', value: 'last_month', days: 0 },
  { label: 'Personalizar', value: 'custom', days: 0 },
];

export const FONT_OPTIONS = [
  { label: 'Helvetica (Moderno)', value: 'helvetica' },
  { label: 'Times (Clássico)', value: 'times' },
  { label: 'Courier (Técnico)', value: 'courier' },
];
