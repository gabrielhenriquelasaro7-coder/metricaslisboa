import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  RESULT_METRIC_OPTIONS, 
  COST_METRIC_OPTIONS, 
  EFFICIENCY_METRIC_OPTIONS,
  METRIC_TEMPLATES,
} from '@/hooks/useProjectMetricConfig';
import { 
  Target, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  Users, 
  ShoppingCart, 
  Calendar, 
  Store, 
  MessageSquare,
  Check,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricConfigData {
  result_metric: string;
  result_metric_label: string;
  cost_metrics: string[];
  efficiency_metrics: string[];
}

interface MetricConfigPanelProps {
  value: MetricConfigData;
  onChange: (data: MetricConfigData) => void;
}

const RESULT_ICONS: Record<string, React.ElementType> = {
  leads: Users,
  purchases: ShoppingCart,
  registrations: Target,
  store_visits: Store,
  appointments: Calendar,
  messages: MessageSquare,
};

export function MetricConfigPanel({ value, onChange }: MetricConfigPanelProps) {
  const [customLabel, setCustomLabel] = useState(value.result_metric_label);

  useEffect(() => {
    const selectedResult = RESULT_METRIC_OPTIONS.find(m => m.key === value.result_metric);
    if (selectedResult && customLabel === '') {
      setCustomLabel(selectedResult.label);
    }
  }, [value.result_metric]);

  const handleResultMetricChange = (metricKey: string) => {
    const selectedMetric = RESULT_METRIC_OPTIONS.find(m => m.key === metricKey);
    onChange({
      ...value,
      result_metric: metricKey,
      result_metric_label: selectedMetric?.label || metricKey,
    });
    setCustomLabel(selectedMetric?.label || metricKey);
  };

  const handleCostMetricToggle = (metricKey: string) => {
    const newCostMetrics = value.cost_metrics.includes(metricKey)
      ? value.cost_metrics.filter(m => m !== metricKey)
      : [...value.cost_metrics, metricKey];
    onChange({ ...value, cost_metrics: newCostMetrics });
  };

  const handleEfficiencyMetricToggle = (metricKey: string) => {
    const newEfficiencyMetrics = value.efficiency_metrics.includes(metricKey)
      ? value.efficiency_metrics.filter(m => m !== metricKey)
      : [...value.efficiency_metrics, metricKey];
    onChange({ ...value, efficiency_metrics: newEfficiencyMetrics });
  };

  const handleLabelChange = (newLabel: string) => {
    setCustomLabel(newLabel);
    onChange({ ...value, result_metric_label: newLabel });
  };

  const applyTemplate = (templateKey: keyof typeof METRIC_TEMPLATES) => {
    const template = METRIC_TEMPLATES[templateKey];
    onChange({
      result_metric: template.result_metric,
      result_metric_label: template.result_metric_label,
      cost_metrics: template.cost_metrics,
      efficiency_metrics: template.efficiency_metrics,
    });
    setCustomLabel(template.result_metric_label);
  };

  const templates = [
    { key: 'inside_sales', label: 'Inside Sales', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30' },
    { key: 'ecommerce', label: 'E-commerce', icon: ShoppingCart, color: 'text-purple-400', bg: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30' },
    { key: 'pdv', label: 'PDV', icon: Store, color: 'text-amber-400', bg: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30' },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Templates */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Templates Rápidos</Label>
            <p className="text-xs text-muted-foreground">Comece com uma configuração pré-definida</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.key}
                type="button"
                onClick={() => applyTemplate(template.key as keyof typeof METRIC_TEMPLATES)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border transition-all duration-300",
                  template.bg
                )}
              >
                <Icon className={cn("w-4 h-4", template.color)} />
                <span className="text-xs font-medium">{template.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result Metric Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Métrica de Resultado</Label>
            <p className="text-xs text-muted-foreground">O que conta como conversão?</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RESULT_METRIC_OPTIONS.map((metric) => {
            const Icon = RESULT_ICONS[metric.key] || Target;
            const isSelected = value.result_metric === metric.key;
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => handleResultMetricChange(metric.key)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-300",
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                    : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card'
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isSelected ? 'bg-primary/20' : 'bg-muted/50'
                )}>
                  <Icon className={cn("w-5 h-5", isSelected ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div className="text-center">
                  <p className={cn("text-sm font-medium", isSelected && 'text-primary')}>{metric.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{metric.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Custom Label */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1">
            <Label htmlFor="result_label" className="text-xs text-muted-foreground">
              Nome personalizado
            </Label>
            <Input
              id="result_label"
              placeholder="Ex: Leads Qualificados"
              value={customLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="h-8 mt-1 bg-background/50 border-border/50"
            />
          </div>
        </div>
      </div>

      {/* Cost & Efficiency Metrics in 2 columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <Label className="text-sm font-semibold">Custos</Label>
          </div>
          <div className="space-y-2">
            {COST_METRIC_OPTIONS.map((metric) => {
              const isSelected = value.cost_metrics.includes(metric.key);
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => handleCostMetricToggle(metric.key)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 p-3 rounded-xl border transition-all duration-200",
                    isSelected
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-border/30 bg-card/30 hover:border-orange-500/30'
                  )}
                >
                  <div className="text-left">
                    <p className={cn("text-sm font-medium", isSelected && 'text-orange-400')}>{metric.label}</p>
                    <p className="text-[10px] text-muted-foreground">{metric.description}</p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
                    isSelected ? 'bg-orange-500 border-orange-500' : 'border-muted-foreground/30'
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <Label className="text-sm font-semibold">Eficiência</Label>
          </div>
          <div className="space-y-2">
            {EFFICIENCY_METRIC_OPTIONS.map((metric) => {
              const isSelected = value.efficiency_metrics.includes(metric.key);
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => handleEfficiencyMetricToggle(metric.key)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 p-3 rounded-xl border transition-all duration-200",
                    isSelected
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-border/30 bg-card/30 hover:border-emerald-500/30'
                  )}
                >
                  <div className="text-left">
                    <p className={cn("text-sm font-medium", isSelected && 'text-emerald-400')}>{metric.label}</p>
                    <p className="text-[10px] text-muted-foreground">{metric.description}</p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
                    isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/30'
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
