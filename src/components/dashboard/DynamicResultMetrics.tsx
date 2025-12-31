import SparklineCard from "./SparklineCard";
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
  LucideIcon
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
  ctr: { label: "CTR", icon: Percent, format: 'percentage' },
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

  // Determinar cor do ROAS/ROI
  const getEfficiencyColor = (metric: string, value: number): "default" | "success" | "warning" | "danger" => {
    if (metric === 'roas') {
      if (value >= 3) return "success";
      if (value >= 1) return "warning";
      return "danger";
    }
    if (metric === 'roi') {
      if (value >= 100) return "success";
      if (value >= 0) return "warning";
      return "danger";
    }
    if (metric === 'ctr') {
      if (value >= 2) return "success";
      if (value >= 1) return "warning";
      return "default";
    }
    if (metric === 'conversion_rate') {
      if (value >= 5) return "success";
      if (value >= 2) return "warning";
      return "default";
    }
    return "default";
  };

  return (
    <div className="space-y-6">
      {/* Métrica de Resultado Principal */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          {config.result_metric_label}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SparklineCard
            title={config.result_metric_label}
            value={metrics.totalConversions.toLocaleString('pt-BR')}
            change={changes?.conversions}
            icon={ResultIcon}
            sparklineData={sparklineData.conversions || []}
            sparklineColor="hsl(var(--primary))"
          />
          
          {/* Mostrar valor de conversão apenas para purchases */}
          {config.result_metric === 'purchases' && (
            <SparklineCard
              title="Faturamento"
              value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(metrics.totalConversionValue)}
              change={changes?.conversionValue}
              icon={TrendingUp}
              sparklineData={sparklineData.conversionValue || []}
              sparklineColor="hsl(var(--chart-2))"
            />
          )}
        </div>
      </div>

      {/* Métricas de Custo */}
      {config.cost_metrics && config.cost_metrics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Custos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {config.cost_metrics.map(metric => {
              const costConfig = COST_CONFIG[metric];
              if (!costConfig) return null;
              
              const value = getCostValue(metric);
              const formattedValue = new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency 
              }).format(value);

              return (
                <SparklineCard
                  key={metric}
                  title={costConfig.label}
                  value={formattedValue}
                  change={changes?.cpa}
                  icon={costConfig.icon}
                  sparklineData={sparklineData.cpa || []}
                  sparklineColor="hsl(var(--chart-3))"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Métricas de Eficiência */}
      {config.efficiency_metrics && config.efficiency_metrics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Eficiência
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {config.efficiency_metrics.map(metric => {
              const effConfig = EFFICIENCY_CONFIG[metric];
              if (!effConfig) return null;
              
              const value = getEfficiencyValue(metric);
              const formattedValue = formatEfficiency(value, effConfig.format);
              const color = getEfficiencyColor(metric, value);

              return (
                <SparklineCard
                  key={metric}
                  title={effConfig.label}
                  value={formattedValue}
                  change={metric === 'roas' ? changes?.roas : metric === 'ctr' ? changes?.ctr : undefined}
                  icon={effConfig.icon}
                  sparklineData={metric === 'roas' ? (sparklineData.roas || []) : (sparklineData.ctr || [])}
                  sparklineColor={
                    color === "success" ? "hsl(var(--chart-2))" :
                    color === "warning" ? "hsl(var(--chart-4))" :
                    color === "danger" ? "hsl(var(--destructive))" :
                    "hsl(var(--primary))"
                  }
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
