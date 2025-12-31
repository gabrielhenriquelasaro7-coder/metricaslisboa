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
  Eye
} from "lucide-react";

interface MetricConfig {
  result_metric: string;
  result_metric_label: string;
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
  messages: Users,
};

const COST_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  cpl: { label: "CPL", icon: DollarSign },
  cpa: { label: "CPA", icon: DollarSign },
  cac: { label: "CAC", icon: BadgeDollarSign },
  cpp: { label: "CPP", icon: DollarSign },
};

// CTR is already shown in general metrics, so exclude from efficiency metrics to avoid duplication
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
  const ResultIcon = RESULT_ICONS[config.result_metric] || Target;
  
  // Calcular métricas de custo
  const getCostValue = (metric: string): number => {
    if (metrics.totalConversions === 0) return 0;
    switch (metric) {
      case 'cpl':
      case 'cpa':
      case 'cac':
      case 'cpp':
        return metrics.totalSpend / metrics.totalConversions;
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
        return metrics.totalClicks > 0 ? (metrics.totalConversions / metrics.totalClicks) * 100 : 0;
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

  // 1. Main result metric
  allCards.push(
    <SparklineCard
      key="result-main"
      title={config.result_metric_label}
      value={metrics.totalConversions.toLocaleString('pt-BR')}
      change={changes?.conversions}
      changeLabel="vs anterior"
      icon={ResultIcon}
      sparklineData={sparklineData.conversions || []}
      sparklineColor="hsl(var(--chart-1))"
      className="border-l-4 border-l-chart-1"
    />
  );

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
