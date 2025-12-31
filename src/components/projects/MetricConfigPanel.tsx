import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  RESULT_METRIC_OPTIONS, 
  COST_METRIC_OPTIONS, 
  EFFICIENCY_METRIC_OPTIONS,
  METRIC_TEMPLATES,
  type MetricOption 
} from '@/hooks/useProjectMetricConfig';
import { Target, DollarSign, TrendingUp, Sparkles } from 'lucide-react';

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

export function MetricConfigPanel({ value, onChange }: MetricConfigPanelProps) {
  const [customLabel, setCustomLabel] = useState(value.result_metric_label);

  // Update custom label when result_metric changes
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

  return (
    <div className="space-y-6 p-4 border border-border rounded-lg bg-card/50">
      {/* Quick Templates */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Templates Rápidos
        </Label>
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => applyTemplate('inside_sales')}
          >
            Inside Sales
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => applyTemplate('ecommerce')}
          >
            E-commerce
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => applyTemplate('pdv')}
          >
            PDV
          </Badge>
        </div>
      </div>

      {/* Result Metric Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Métrica de Resultado Principal
        </Label>
        <p className="text-xs text-muted-foreground">
          Escolha o que conta como "conversão" para este projeto
        </p>
        <div className="grid grid-cols-2 gap-2">
          {RESULT_METRIC_OPTIONS.map((metric) => (
            <button
              key={metric.key}
              type="button"
              onClick={() => handleResultMetricChange(metric.key)}
              className={`p-3 rounded-lg border text-left transition-all ${
                value.result_metric === metric.key
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-medium text-sm">{metric.label}</p>
              <p className="text-xs text-muted-foreground">{metric.description}</p>
            </button>
          ))}
        </div>
        
        {/* Custom Label */}
        <div className="pt-2">
          <Label htmlFor="result_label" className="text-xs text-muted-foreground">
            Nome personalizado (opcional)
          </Label>
          <Input
            id="result_label"
            placeholder="Ex: Leads Qualificados"
            value={customLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Cost Metrics */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-orange-500" />
          Métricas de Custo
        </Label>
        <p className="text-xs text-muted-foreground">
          Selecione as métricas de custo a exibir
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COST_METRIC_OPTIONS.map((metric) => (
            <label
              key={metric.key}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                value.cost_metrics.includes(metric.key)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Checkbox
                checked={value.cost_metrics.includes(metric.key)}
                onCheckedChange={() => handleCostMetricToggle(metric.key)}
              />
              <div>
                <p className="font-medium text-sm">{metric.label}</p>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Efficiency Metrics */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          Métricas de Eficiência
        </Label>
        <p className="text-xs text-muted-foreground">
          Selecione as métricas de eficiência a exibir
        </p>
        <div className="grid grid-cols-2 gap-2">
          {EFFICIENCY_METRIC_OPTIONS.map((metric) => (
            <label
              key={metric.key}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                value.efficiency_metrics.includes(metric.key)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Checkbox
                checked={value.efficiency_metrics.includes(metric.key)}
                onCheckedChange={() => handleEfficiencyMetricToggle(metric.key)}
              />
              <div>
                <p className="font-medium text-sm">{metric.label}</p>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="pt-4 border-t border-border">
        <Label className="text-sm text-muted-foreground">Resumo da configuração</Label>
        <div className="mt-2 p-3 rounded-lg bg-muted/50">
          <p className="text-sm">
            <span className="font-medium">Resultado:</span> {customLabel || value.result_metric_label}
          </p>
          <p className="text-sm mt-1">
            <span className="font-medium">Custos:</span> {value.cost_metrics.map(m => 
              COST_METRIC_OPTIONS.find(o => o.key === m)?.label
            ).filter(Boolean).join(', ') || 'Nenhum selecionado'}
          </p>
          <p className="text-sm mt-1">
            <span className="font-medium">Eficiência:</span> {value.efficiency_metrics.map(m => 
              EFFICIENCY_METRIC_OPTIONS.find(o => o.key === m)?.label
            ).filter(Boolean).join(', ') || 'Nenhum selecionado'}
          </p>
        </div>
      </div>
    </div>
  );
}
