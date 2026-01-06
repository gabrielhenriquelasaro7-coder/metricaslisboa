import { 
  DollarSign, 
  Eye, 
  MousePointerClick, 
  TrendingUp, 
  Target,
  ShoppingCart,
  Users,
  Store,
  Calendar,
  Percent,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricConfig {
  resultMetric: string;
  resultMetricLabel: string;
  resultMetrics?: string[];
  resultMetricsLabels?: Record<string, string>;
  costMetrics: string[];
  efficiencyMetrics: string[];
}

interface DashboardPreviewProps {
  config: MetricConfig;
}

const RESULT_ICONS: Record<string, React.ElementType> = {
  leads: Users,
  purchases: ShoppingCart,
  registrations: Target,
  store_visits: Store,
  appointments: Calendar,
  messages: MessageSquare,
};

const COST_LABELS: Record<string, string> = {
  cpl: "CPL",
  cpa: "CPA",
  cac: "CAC",
  cpp: "CPP",
};

const EFFICIENCY_LABELS: Record<string, string> = {
  roas: "ROAS",
  roi: "ROI",
  ctr: "CTR",
  conversion_rate: "Conv %",
};

interface PreviewMetricProps {
  label: string;
  value: string;
  icon: React.ElementType;
  variant?: "default" | "primary" | "orange" | "emerald";
}

function PreviewMetric({ label, value, icon: Icon, variant = "default" }: PreviewMetricProps) {
  const styles = {
    default: {
      bg: "bg-secondary/50",
      icon: "text-muted-foreground",
      iconBg: "bg-muted/50"
    },
    primary: {
      bg: "bg-primary/10",
      icon: "text-primary",
      iconBg: "bg-primary/20"
    },
    orange: {
      bg: "bg-orange-500/10",
      icon: "text-orange-500",
      iconBg: "bg-orange-500/20"
    },
    emerald: {
      bg: "bg-emerald-500/10",
      icon: "text-emerald-500",
      iconBg: "bg-emerald-500/20"
    }
  };

  const style = styles[variant];

  return (
    <div className={cn("rounded-xl p-3 transition-all", style.bg)}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", style.iconBg)}>
          <Icon className={cn("w-3 h-3", style.icon)} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold pl-8">{value}</p>
    </div>
  );
}

export function DashboardPreview({ config }: DashboardPreviewProps) {
  // Usar múltiplas métricas se disponíveis, senão fallback para single
  const resultMetrics = config.resultMetrics && config.resultMetrics.length > 0 
    ? config.resultMetrics 
    : [config.resultMetric];
  const resultMetricsLabels = config.resultMetricsLabels || { [config.resultMetric]: config.resultMetricLabel };

  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5 overflow-hidden relative">
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Preview do Dashboard</p>
            <p className="text-[10px] text-muted-foreground">Visualização das métricas selecionadas</p>
          </div>
        </div>
        
        {/* Base Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <PreviewMetric label="Investimento" value="R$ 5.2K" icon={DollarSign} />
          <PreviewMetric label="Impressões" value="125K" icon={Eye} />
          <PreviewMetric label="Cliques" value="3.2K" icon={MousePointerClick} />
        </div>

        {/* Result Metrics - Now supports multiple */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-2">
            <Target className="w-3 h-3 text-primary" />
            Resultado{resultMetrics.length > 1 ? 's' : ''} Principal{resultMetrics.length > 1 ? 'is' : ''}
          </p>
          <div className={cn(
            "grid gap-2",
            resultMetrics.length === 1 ? "grid-cols-2" : 
            resultMetrics.length === 2 ? "grid-cols-2" : 
            "grid-cols-3"
          )}>
            {resultMetrics.map((metricKey, index) => {
              const Icon = RESULT_ICONS[metricKey] || Target;
              const label = resultMetricsLabels[metricKey] || metricKey;
              const values = ['248', '45', '12', '89', '156', '33'];
              return (
                <PreviewMetric 
                  key={metricKey}
                  label={label} 
                  value={values[index % values.length]} 
                  icon={Icon}
                  variant="primary"
                />
              );
            })}
            {resultMetrics.includes('purchases') && (
              <PreviewMetric 
                label="Faturamento" 
                value="R$ 52K" 
                icon={TrendingUp}
                variant="primary"
              />
            )}
          </div>
        </div>

        {/* Cost & Efficiency side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Cost Metrics */}
          {config.costMetrics.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-orange-500" />
                Custos
              </p>
              <div className="space-y-2">
                {config.costMetrics.slice(0, 2).map(metric => (
                  <PreviewMetric 
                    key={metric}
                    label={COST_LABELS[metric] || metric.toUpperCase()} 
                    value="R$ 21" 
                    icon={DollarSign}
                    variant="orange"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Efficiency Metrics */}
          {config.efficiencyMetrics.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                Eficiência
              </p>
              <div className="space-y-2">
                {config.efficiencyMetrics.slice(0, 2).map(metric => (
                  <PreviewMetric 
                    key={metric}
                    label={EFFICIENCY_LABELS[metric] || metric.toUpperCase()} 
                    value={metric === 'roas' ? '10.1x' : metric === 'ctr' ? '2.56%' : '4.8%'} 
                    icon={metric === 'ctr' || metric === 'conversion_rate' ? Percent : TrendingUp}
                    variant="emerald"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
