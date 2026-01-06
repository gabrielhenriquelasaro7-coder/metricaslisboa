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
  };
  changes: Record<string, number> | null;
  sparklineData: Record<string, number[]>;
  currency: string;
}

const RESULT_ICONS: Record<string, LucideIcon> = {
  leads: Users,
  purchases: ShoppingCart,
  registrations: Target,
  store_visits: Store,
  appointments: Calendar,
  conversions: Target,
  messages: MessageSquare,
};

// Mapeamento de qual campo do banco usar para cada tipo de métrica
// Agora usa os campos separados por objetivo de campanha
const METRIC_DATA_SOURCE: Record<string, 'leads' | 'purchases' | 'messages' | 'profile_visits' | 'conversions'> = {
  leads: 'leads', // OUTCOME_LEADS conversions
  purchases: 'purchases', // OUTCOME_SALES conversions
  messages: 'messages',
  registrations: 'leads', // Similar to leads
  store_visits: 'profile_visits',
  appointments: 'leads',
  conversions: 'conversions', // All conversions combined
};

const COST_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  cpl: { label: "CPL", icon: DollarSign },
  cpa: { label: "CPA", icon: DollarSign },
  cac: { label: "CAC", icon: BadgeDollarSign },
  cpp: { label: "CPP", icon: DollarSign },
};

const EFFICIENCY_CONFIG: Record<string, { label: string; icon: LucideIcon; format: 'currency' | 'percentage' | 'multiplier' }> = {
  roas: { label: "ROAS", icon: TrendingUp, format: 'multiplier' },
  roi: { label: "ROI", icon: TrendingUp, format: 'percentage' },
  conversion_rate: { label: "Taxa de Conversão", icon: Percent, format: 'percentage' },
};

export function DynamicResultMetrics({
  config,
  metrics,
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
  
  // Calcular métricas de custo usando o total de resultados
  const getCostValue = (metric: string): number => {
    const totalResults = getTotalResults();
    if (totalResults === 0) return 0;
    switch (metric) {
      case 'cpl':
      case 'cpa':
      case 'cac':
      case 'cpp':
        return metrics.totalSpend / totalResults;
      default:
        return 0;
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

  // 1. Multiple result metrics - each gets its own card with correct data source
  resultMetrics.forEach((metricKey, index) => {
    const Icon = RESULT_ICONS[metricKey] || Target;
    const label = resultMetricsLabels[metricKey] || metricKey;
    const value = getMetricValue(metricKey);
    const sparkline = getSparklineData(metricKey);
    
    allCards.push(
      <SparklineCard
        key={`result-${metricKey}`}
        title={label}
        value={value.toLocaleString('pt-BR')}
        change={changes?.conversions}
        changeLabel="vs anterior"
        icon={Icon}
        sparklineData={sparkline}
        sparklineColor="hsl(var(--chart-1))"
        className={index === 0 ? "border-l-4 border-l-chart-1" : ""}
        tooltip="Pequenas diferenças de ±1-2 resultados em relação ao Gerenciador são normais devido ao timing de atribuição do Meta."
      />
    );
  });

  // 2. Cost metrics
  if (config.cost_metrics && config.cost_metrics.length > 0) {
    config.cost_metrics.forEach(metric => {
      const costConfig = COST_CONFIG[metric];
      if (!costConfig) return;
      
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