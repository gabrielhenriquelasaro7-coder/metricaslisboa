import SparklineCard from "./SparklineCard";
import MetricCard from "./MetricCard";
import { 
  Target, 
  ShoppingCart, 
  Users, 
  Store, 
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  BadgeDollarSign,
  LucideIcon,
  Eye,
  MessageSquare
} from "lucide-react";

interface MetricConfig {
  result_metric: string;
  result_metric_label: string;
  result_metrics?: string[];
  result_metrics_labels?: Record<string, string>;
  cost_metrics: string[];
  efficiency_metrics: string[];
}

interface DynamicResultMetricsProps {
  config: MetricConfig;
  metrics: {
    totalConversions: number;
    totalConversionValue: number;
    totalSpend: number;
    totalClicks: number;
    totalImpressions: number;
    totalReach?: number;
    totalMessages?: number;
    totalProfileVisits?: number;
    totalLeadsConversions?: number;
    totalSalesConversions?: number;
    totalInitiateCheckout?: number;
  };
  previousMetrics?: {
    totalConversions: number;
    totalMessages?: number;
    totalLeadsConversions?: number;
    totalSalesConversions?: number;
    totalInitiateCheckout?: number;
    totalSpend?: number;
  } | null;
  changes: Record<string, number> | null;
  sparklineData: Record<string, number[]>;
  currency: string;
}

const RESULT_ICONS: Record<string, LucideIcon> = {
  leads: Users,
  purchases: ShoppingCart,
  initiate_checkout: Target,
  registrations: Target,
  store_visits: Store,
  appointments: Calendar,
  conversions: Target,
  messages: MessageSquare,
};

// Mapeamento de qual campo do banco usar para cada tipo de métrica
// Agora usa os campos separados por objetivo de campanha
const METRIC_DATA_SOURCE: Record<string, 'leads' | 'purchases' | 'initiate_checkout' | 'messages' | 'profile_visits' | 'conversions'> = {
  leads: 'leads', // OUTCOME_LEADS conversions
  purchases: 'purchases', // OUTCOME_SALES conversions
  initiate_checkout: 'initiate_checkout', // Initiate Checkout events
  messages: 'messages',
  registrations: 'leads', // Similar to leads
  store_visits: 'profile_visits',
  appointments: 'leads',
  conversions: 'conversions', // All conversions combined
};

const COST_CONFIG: Record<string, { label: string; icon: LucideIcon; basedOn?: 'leads' | 'purchases' | 'initiate_checkout' | 'total' }> = {
  cpl: { label: "CPL", icon: DollarSign, basedOn: 'leads' },
  cpa: { label: "CPA", icon: DollarSign, basedOn: 'total' },
  cac: { label: "CAC", icon: BadgeDollarSign, basedOn: 'total' },
  cpp: { label: "CPP", icon: DollarSign, basedOn: 'purchases' },
  cpic: { label: "Custo/Init. Checkout", icon: DollarSign, basedOn: 'initiate_checkout' },
};

const EFFICIENCY_CONFIG: Record<string, { label: string; icon: LucideIcon; format: 'currency' | 'percentage' | 'multiplier' }> = {
  roas: { label: "ROAS", icon: TrendingUp, format: 'multiplier' },
  roi: { label: "ROI", icon: TrendingUp, format: 'percentage' },
  conversion_rate: { label: "Taxa de Conversão", icon: Percent, format: 'percentage' },
};

export function DynamicResultMetrics({
  config,
  metrics,
  previousMetrics,
  changes,
  sparklineData,
  currency
}: DynamicResultMetricsProps) {
  // Usar múltiplas métricas se disponíveis, senão fallback para single
  const resultMetrics = config.result_metrics && config.result_metrics.length > 0 
    ? config.result_metrics 
    : [config.result_metric];
  const resultMetricsLabels = config.result_metrics_labels || { [config.result_metric]: config.result_metric_label };
  
  // Obter o valor correto baseado no tipo de métrica
  const getMetricValue = (metricKey: string): number => {
    const dataSource = METRIC_DATA_SOURCE[metricKey] || 'conversions';
    switch (dataSource) {
      case 'leads':
        return metrics.totalLeadsConversions || 0;
      case 'purchases':
        return metrics.totalSalesConversions || 0;
      case 'initiate_checkout':
        return metrics.totalInitiateCheckout || 0;
      case 'messages':
        return metrics.totalMessages || 0;
      case 'profile_visits':
        return metrics.totalProfileVisits || 0;
      case 'conversions':
      default:
        return metrics.totalConversions;
    }
  };

  // Obter o sparkline correto baseado no tipo de métrica
  const getSparklineData = (metricKey: string): number[] => {
    const dataSource = METRIC_DATA_SOURCE[metricKey] || 'conversions';
    switch (dataSource) {
      case 'leads':
        return sparklineData.leads || [];
      case 'purchases':
        return sparklineData.purchases || [];
      case 'initiate_checkout':
        return sparklineData.initiate_checkout || [];
      case 'messages':
        return sparklineData.messages || [];
      case 'profile_visits':
        return sparklineData.profile_visits || [];
      case 'conversions':
      default:
        return sparklineData.conversions || [];
    }
  };

  // Calcular total de resultados para métricas de custo (soma de todas as métricas selecionadas)
  const getTotalResults = (): number => {
    return resultMetrics.reduce((sum, key) => sum + getMetricValue(key), 0);
  };

  // Calcular total do período anterior
  const getPreviousTotalResults = (): number => {
    if (!previousMetrics) return 0;
    const prevLeads = previousMetrics.totalLeadsConversions || 0;
    const prevMessages = previousMetrics.totalMessages || 0;
    return (prevLeads + prevMessages) > 0 
      ? prevLeads + prevMessages 
      : previousMetrics.totalConversions || 0;
  };
  
  // Calcular métricas de custo - cada uma baseada no seu resultado específico
  const getCostValue = (metric: string): number => {
    const costConfig = COST_CONFIG[metric];
    if (!costConfig) return 0;
    
    switch (costConfig.basedOn) {
      case 'leads': {
        const leads = metrics.totalLeadsConversions || 0;
        return leads > 0 ? metrics.totalSpend / leads : 0;
      }
      case 'purchases': {
        const purchases = metrics.totalSalesConversions || 0;
        return purchases > 0 ? metrics.totalSpend / purchases : 0;
      }
      case 'initiate_checkout': {
        const ic = metrics.totalInitiateCheckout || 0;
        return ic > 0 ? metrics.totalSpend / ic : 0;
      }
      case 'total':
      default: {
        const totalResults = getTotalResults();
        return totalResults > 0 ? metrics.totalSpend / totalResults : 0;
      }
    }
  };

  // Verificar se deve mostrar a métrica de custo (esconde se o resultado base for 0)
  const shouldShowCostMetric = (metric: string): boolean => {
    const costConfig = COST_CONFIG[metric];
    if (!costConfig) return false;
    
    switch (costConfig.basedOn) {
      case 'purchases':
        return (metrics.totalSalesConversions || 0) > 0;
      case 'initiate_checkout':
        return (metrics.totalInitiateCheckout || 0) > 0;
      case 'leads':
        return (metrics.totalLeadsConversions || 0) > 0;
      case 'total':
      default:
        return getTotalResults() > 0;
    }
  };

  // Calcular métricas de eficiência
  const getEfficiencyValue = (metric: string): number => {
    switch (metric) {
      case 'roas':
        return metrics.totalSpend > 0 ? metrics.totalConversionValue / metrics.totalSpend : 0;
      case 'roi':
        return metrics.totalSpend > 0 ? ((metrics.totalConversionValue - metrics.totalSpend) / metrics.totalSpend) * 100 : 0;
      case 'ctr':
        return metrics.totalImpressions > 0 ? (metrics.totalClicks / metrics.totalImpressions) * 100 : 0;
      case 'conversion_rate':
        return metrics.totalClicks > 0 ? (getTotalResults() / metrics.totalClicks) * 100 : 0;
      default:
        return 0;
    }
  };

  // Formatar valor de eficiência
  const formatEfficiency = (value: number, format: 'currency' | 'percentage' | 'multiplier'): string => {
    switch (format) {
      case 'multiplier':
        return `${value.toFixed(2)}x`;
      case 'percentage':
        return `${value.toFixed(2)}%`;
      default:
        return value.toFixed(2);
    }
  };

  // Build all metrics for a unified grid (same as predefined models)
  const allCards: JSX.Element[] = [];

  // 1. SEPARATE cards for each result metric (not summed)
  // Show each configured metric as a separate card
  for (const metricKey of resultMetrics) {
    const value = getMetricValue(metricKey);
    const label = resultMetricsLabels[metricKey] || metricKey;
    const Icon = RESULT_ICONS[metricKey] || Target;
    const metricSparkline = getSparklineData(metricKey);
    
    // Always show configured metrics (even if 0), but hide purchases if 0
    const shouldShow = metricKey !== 'purchases' || value > 0;
    
    if (shouldShow) {
      allCards.push(
        <SparklineCard
          key={`result-${metricKey}`}
          title={label}
          value={value.toLocaleString('pt-BR')}
          changeLabel="vs anterior"
          icon={Icon}
          sparklineData={metricSparkline.length > 0 ? metricSparkline : (sparklineData.conversions || [])}
          sparklineColor="hsl(var(--chart-1))"
          className="border-l-4 border-l-chart-1"
        />
      );
    }
  }

  // 2. Cost metrics - only show if the base result exists
  if (config.cost_metrics && config.cost_metrics.length > 0) {
    config.cost_metrics.forEach(metric => {
      const costConfig = COST_CONFIG[metric];
      if (!costConfig) return;
      
      // Skip if the base result is 0
      if (!shouldShowCostMetric(metric)) return;
      
      const value = getCostValue(metric);
      const formattedValue = new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency 
      }).format(value);

      allCards.push(
        <SparklineCard
          key={`cost-${metric}`}
          title={costConfig.label}
          value={formattedValue}
          change={changes?.cpa}
          changeLabel="vs anterior"
          icon={costConfig.icon}
          sparklineData={sparklineData.cpa || []}
          sparklineColor="hsl(var(--chart-2))"
          invertTrend
        />
      );
    });
  }

  // 3. Efficiency metrics
  if (config.efficiency_metrics && config.efficiency_metrics.length > 0) {
    config.efficiency_metrics.forEach(metric => {
      const effConfig = EFFICIENCY_CONFIG[metric];
      if (!effConfig) return;
      
      const value = getEfficiencyValue(metric);
      const formattedValue = formatEfficiency(value, effConfig.format);

      allCards.push(
        <SparklineCard
          key={`eff-${metric}`}
          title={effConfig.label}
          value={formattedValue}
          change={metric === 'roas' ? changes?.roas : metric === 'ctr' ? changes?.ctr : undefined}
          changeLabel="vs anterior"
          icon={effConfig.icon}
          sparklineData={metric === 'roas' ? (sparklineData.roas || []) : (sparklineData.ctr || [])}
          sparklineColor="hsl(142, 76%, 36%)"
        />
      );
    });
  }

  // 4. Add reach metric (similar to predefined models)
  allCards.push(
    <MetricCard
      key="reach"
      title="Alcance"
      value={(metrics.totalReach || 0).toLocaleString('pt-BR')}
      icon={Eye}
      trend="neutral"
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {allCards}
    </div>
  );
}