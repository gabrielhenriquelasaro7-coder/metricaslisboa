import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  RESULT_METRIC_OPTIONS, 
  COST_METRIC_OPTIONS, 
  EFFICIENCY_METRIC_OPTIONS,
  BASE_METRIC_OPTIONS,
} from '@/hooks/useProjectMetricConfig';
import { 
  Target, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  Users, 
  ShoppingCart, 
  Store, 
  MessageSquare,
  Check,
  ChevronRight,
  ChevronLeft,
  Eye,
  MousePointerClick,
  Repeat,
  BarChart3,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CustomMetricConfigData {
  result_metric: string;
  result_metric_label: string;
  cost_metrics: string[];
  efficiency_metrics: string[];
  base_metrics: string[];
  chart_primary_metric: string;
  chart_secondary_metric: string;
}

interface CustomProjectWizardProps {
  value: CustomMetricConfigData;
  onChange: (data: CustomMetricConfigData) => void;
  onBack: () => void;
  onComplete: () => void;
}

const RESULT_ICONS: Record<string, React.ElementType> = {
  leads: Users,
  purchases: ShoppingCart,
  registrations: Target,
  store_visits: Store,
  appointments: Calendar,
  messages: MessageSquare,
};

const BASE_ICONS: Record<string, React.ElementType> = {
  spend: DollarSign,
  impressions: Eye,
  reach: Users,
  clicks: MousePointerClick,
  cpm: DollarSign,
  cpc: DollarSign,
  frequency: Repeat,
};

const STEPS = [
  { id: 1, title: 'Resultado', description: 'O que conta como conversão?' },
  { id: 2, title: 'Métricas Base', description: 'Quais métricas sempre exibir?' },
  { id: 3, title: 'Custos', description: 'Como medir seus custos?' },
  { id: 4, title: 'Eficiência', description: 'Métricas de performance' },
  { id: 5, title: 'Gráficos', description: 'Configurar visualizações' },
];

export function CustomProjectWizard({ value, onChange, onBack, onComplete }: CustomProjectWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [customLabel, setCustomLabel] = useState(value.result_metric_label);

  const progress = (currentStep / STEPS.length) * 100;

  const handleResultMetricChange = (metricKey: string) => {
    const selectedMetric = RESULT_METRIC_OPTIONS.find(m => m.key === metricKey);
    onChange({
      ...value,
      result_metric: metricKey,
      result_metric_label: selectedMetric?.label || metricKey,
    });
    setCustomLabel(selectedMetric?.label || metricKey);
  };

  const handleBaseMetricToggle = (metricKey: string) => {
    const newBaseMetrics = value.base_metrics.includes(metricKey)
      ? value.base_metrics.filter(m => m !== metricKey)
      : [...value.base_metrics, metricKey];
    onChange({ ...value, base_metrics: newBaseMetrics });
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

  const handleChartMetricChange = (type: 'primary' | 'secondary', metricKey: string) => {
    if (type === 'primary') {
      onChange({ ...value, chart_primary_metric: metricKey });
    } else {
      onChange({ ...value, chart_secondary_metric: metricKey });
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {RESULT_METRIC_OPTIONS.map((metric) => {
                const Icon = RESULT_ICONS[metric.key] || Target;
                const isSelected = value.result_metric === metric.key;
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => handleResultMetricChange(metric.key)}
                    className={cn(
                      "relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300",
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card hover:scale-[1.01]'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                      isSelected ? 'bg-primary/20' : 'bg-muted/50'
                    )}>
                      <Icon className={cn("w-7 h-7", isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="text-center">
                      <p className={cn("text-sm font-semibold", isSelected && 'text-primary')}>{metric.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <Label htmlFor="result_label" className="text-sm font-medium">
                  Nome personalizado (opcional)
                </Label>
                <Input
                  id="result_label"
                  placeholder="Ex: Leads Qualificados, Vendas VIP..."
                  value={customLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className="h-9 mt-2 bg-background/50 border-border/50"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Selecione as métricas base que sempre aparecerão no dashboard. Recomendamos manter pelo menos Investimento, Impressões e Cliques.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BASE_METRIC_OPTIONS.map((metric) => {
                const Icon = BASE_ICONS[metric.key] || BarChart3;
                const isSelected = value.base_metrics.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => handleBaseMetricToggle(metric.key)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/40 bg-card/50 hover:border-primary/40'
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      isSelected ? 'bg-primary/20' : 'bg-muted/50'
                    )}>
                      <Icon className={cn("w-5 h-5", isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium", isSelected && 'text-primary')}>{metric.label}</p>
                      <p className="text-xs text-muted-foreground">{metric.description}</p>
                    </div>
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                    )}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Selecione as métricas de custo que deseja acompanhar. Isso ajuda a entender quanto está pagando por cada resultado.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {COST_METRIC_OPTIONS.map((metric) => {
                const isSelected = value.cost_metrics.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => handleCostMetricToggle(metric.key)}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left",
                      isSelected
                        ? 'border-orange-500/50 bg-orange-500/10'
                        : 'border-border/40 bg-card/50 hover:border-orange-500/30'
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      isSelected ? 'bg-orange-500/20' : 'bg-muted/50'
                    )}>
                      <DollarSign className={cn("w-6 h-6", isSelected ? 'text-orange-500' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-lg", isSelected && 'text-orange-400')}>{metric.label}</p>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                    </div>
                    <div className={cn(
                      "w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      isSelected ? 'bg-orange-500 border-orange-500' : 'border-muted-foreground/30'
                    )}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Métricas de eficiência mostram a qualidade da sua campanha. ROAS e CTR são as mais usadas.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {EFFICIENCY_METRIC_OPTIONS.map((metric) => {
                const isSelected = value.efficiency_metrics.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => handleEfficiencyMetricToggle(metric.key)}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left",
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-border/40 bg-card/50 hover:border-emerald-500/30'
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      isSelected ? 'bg-emerald-500/20' : 'bg-muted/50'
                    )}>
                      <TrendingUp className={cn("w-6 h-6", isSelected ? 'text-emerald-500' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-lg", isSelected && 'text-emerald-400')}>{metric.label}</p>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                    </div>
                    <div className={cn(
                      "w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/30'
                    )}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 5:
        const chartOptions = [
          { key: 'spend', label: 'Investimento' },
          { key: 'impressions', label: 'Impressões' },
          { key: 'reach', label: 'Alcance' },
          { key: 'clicks', label: 'Cliques' },
          { key: 'conversions', label: 'Conversões' },
          { key: value.result_metric, label: value.result_metric_label },
        ];
        
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Configure quais métricas aparecerão nos gráficos principais do dashboard.
            </p>
            
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5">
                <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  Métrica Primária (linha principal)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {chartOptions.map((opt) => (
                    <button
                      key={`primary-${opt.key}`}
                      type="button"
                      onClick={() => handleChartMetricChange('primary', opt.key)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        value.chart_primary_metric === opt.key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="p-5 rounded-2xl border border-muted bg-muted/5">
                <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  Métrica Secundária (linha de comparação)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {chartOptions.map((opt) => (
                    <button
                      key={`secondary-${opt.key}`}
                      type="button"
                      onClick={() => handleChartMetricChange('secondary', opt.key)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        value.chart_secondary_metric === opt.key
                          ? 'bg-foreground text-background'
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-5 rounded-2xl border border-dashed border-border bg-card/50">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <span className="font-semibold">Preview</span>
              </div>
              <div className="h-24 rounded-xl bg-gradient-to-r from-primary/10 via-transparent to-primary/5 flex items-end justify-around px-4 pb-2">
                <div className="w-8 h-12 rounded bg-primary/30" />
                <div className="w-8 h-16 rounded bg-primary/40" />
                <div className="w-8 h-10 rounded bg-primary/30" />
                <div className="w-8 h-20 rounded bg-primary/50" />
                <div className="w-8 h-14 rounded bg-primary/35" />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  {chartOptions.find(o => o.key === value.chart_primary_metric)?.label || 'Primária'}
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  {chartOptions.find(o => o.key === value.chart_secondary_metric)?.label || 'Secundária'}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-lg font-bold gradient-text">Configuração Personalizada</h3>
          <p className="text-sm text-muted-foreground">Configure métricas específicas para seu projeto</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-primary">Etapa {currentStep} de {STEPS.length}</span>
          <span className="text-muted-foreground">{STEPS[currentStep - 1].title}</span>
        </div>
        <Progress value={progress} className="h-2" />
        
        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2",
                index < STEPS.length - 1 && "flex-1"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                currentStep > step.id
                  ? 'bg-primary text-primary-foreground'
                  : currentStep === step.id
                  ? 'bg-primary/20 text-primary border-2 border-primary'
                  : 'bg-muted text-muted-foreground'
              )}>
                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 rounded",
                  currentStep > step.id ? 'bg-primary' : 'bg-muted'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Title */}
      <div className="text-center py-2">
        <h4 className="text-xl font-bold">{STEPS[currentStep - 1].title}</h4>
        <p className="text-muted-foreground">{STEPS[currentStep - 1].description}</p>
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Button
          type="button"
          variant="ghost"
          onClick={handlePrev}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {currentStep === 1 ? 'Voltar' : 'Anterior'}
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="gap-2 bg-gradient-to-r from-primary to-red-600"
        >
          {currentStep === STEPS.length ? 'Concluir' : 'Próximo'}
          {currentStep < STEPS.length && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
