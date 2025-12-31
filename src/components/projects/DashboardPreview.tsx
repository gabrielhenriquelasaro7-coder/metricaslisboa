import { Card, CardContent } from "@/components/ui/card";
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
  Percent
} from "lucide-react";

interface MetricConfig {
  resultMetric: string;
  resultMetricLabel: string;
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
  conversion_rate: "Taxa Conv.",
};

const PreviewCard = ({ 
  label, 
  value, 
  icon: Icon,
  variant = "default"
}: { 
  label: string; 
  value: string; 
  icon: React.ElementType;
  variant?: "default" | "result" | "cost" | "efficiency";
}) => {
  const bgColors = {
    default: "bg-muted/50",
    result: "bg-primary/10",
    cost: "bg-orange-500/10",
    efficiency: "bg-emerald-500/10"
  };

  const iconColors = {
    default: "text-muted-foreground",
    result: "text-primary",
    cost: "text-orange-500",
    efficiency: "text-emerald-500"
  };

  return (
    <div className={`rounded-md p-2 ${bgColors[variant]} transition-all duration-300`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${iconColors[variant]}`} />
        <span className="text-[10px] text-muted-foreground truncate">{label}</span>
      </div>
      <p className="text-xs font-semibold mt-0.5">{value}</p>
    </div>
  );
};

export function DashboardPreview({ config }: DashboardPreviewProps) {
  const ResultIcon = RESULT_ICONS[config.resultMetric] || Target;

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Preview do Dashboard
        </p>
        
        {/* Métricas Gerais */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <PreviewCard label="Investimento" value="R$ 5.200" icon={DollarSign} />
          <PreviewCard label="Impressões" value="125.4K" icon={Eye} />
          <PreviewCard label="Cliques" value="3.2K" icon={MousePointerClick} />
        </div>

        {/* Seção de Resultados */}
        <div className="border-t pt-3 mb-3">
          <p className="text-[10px] text-muted-foreground mb-2">Resultados</p>
          <div className="grid grid-cols-2 gap-2">
            <PreviewCard 
              label={config.resultMetricLabel} 
              value="248" 
              icon={ResultIcon}
              variant="result"
            />
            {config.resultMetric === 'purchases' && (
              <PreviewCard 
                label="Faturamento" 
                value="R$ 52.4K" 
                icon={TrendingUp}
                variant="result"
              />
            )}
          </div>
        </div>

        {/* Métricas de Custo */}
        {config.costMetrics.length > 0 && (
          <div className="border-t pt-3 mb-3">
            <p className="text-[10px] text-muted-foreground mb-2">Custos</p>
            <div className="grid grid-cols-2 gap-2">
              {config.costMetrics.map(metric => (
                <PreviewCard 
                  key={metric}
                  label={COST_LABELS[metric] || metric.toUpperCase()} 
                  value="R$ 21,00" 
                  icon={DollarSign}
                  variant="cost"
                />
              ))}
            </div>
          </div>
        )}

        {/* Métricas de Eficiência */}
        {config.efficiencyMetrics.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-[10px] text-muted-foreground mb-2">Eficiência</p>
            <div className="grid grid-cols-2 gap-2">
              {config.efficiencyMetrics.map(metric => (
                <PreviewCard 
                  key={metric}
                  label={EFFICIENCY_LABELS[metric] || metric.toUpperCase()} 
                  value={metric === 'roas' ? '10.1x' : metric === 'ctr' ? '2.56%' : '4.8%'} 
                  icon={metric === 'ctr' || metric === 'conversion_rate' ? Percent : TrendingUp}
                  variant="efficiency"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
