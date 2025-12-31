import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  ArrowLeft,
  Target, 
  BarChart3, 
  TrendingUp, 
  Sparkles,
  CheckCircle2,
  DollarSign,
  ShoppingCart,
  Users,
  MousePointerClick,
  Eye,
  Percent,
  Zap,
  LineChart,
  PieChart,
  Loader2,
  Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import v4LogoIcon from '@/assets/v4-logo-icon.png';

// Metric definitions
const RESULT_METRICS = [
  { key: 'leads', label: 'Leads', description: 'Formulários preenchidos, cadastros', icon: Users },
  { key: 'purchases', label: 'Vendas', description: 'Compras realizadas', icon: ShoppingCart },
  { key: 'registrations', label: 'Registros', description: 'Inscrições, sign-ups', icon: CheckCircle2 },
  { key: 'conversions', label: 'Conversões', description: 'Ações de conversão genéricas', icon: Target },
  { key: 'messages', label: 'Mensagens', description: 'Contatos via chat/WhatsApp', icon: Zap },
];

const BASE_METRICS = [
  { key: 'spend', label: 'Investimento', description: 'Valor gasto em anúncios', icon: DollarSign, required: true },
  { key: 'impressions', label: 'Impressões', description: 'Vezes que o anúncio foi visto', icon: Eye },
  { key: 'reach', label: 'Alcance', description: 'Pessoas únicas alcançadas', icon: Users },
  { key: 'clicks', label: 'Cliques', description: 'Cliques no anúncio', icon: MousePointerClick },
  { key: 'cpm', label: 'CPM', description: 'Custo por mil impressões', icon: BarChart3 },
  { key: 'cpc', label: 'CPC', description: 'Custo por clique', icon: TrendingUp },
  { key: 'frequency', label: 'Frequência', description: 'Média de vezes que cada pessoa viu', icon: Zap },
  { key: 'ctr', label: 'CTR', description: 'Taxa de cliques', icon: Percent },
];

const COST_METRICS = [
  { key: 'cpl', label: 'CPL', description: 'Custo por Lead', icon: Users },
  { key: 'cpa', label: 'CPA', description: 'Custo por Aquisição', icon: Target },
  { key: 'cac', label: 'CAC', description: 'Custo de Aquisição de Cliente', icon: DollarSign },
  { key: 'cpp', label: 'CPP', description: 'Custo por Compra', icon: ShoppingCart },
];

const EFFICIENCY_METRICS = [
  { key: 'roas', label: 'ROAS', description: 'Retorno sobre investimento em ads', icon: TrendingUp },
  { key: 'conversion_rate', label: 'Taxa de Conversão', description: 'Porcentagem de cliques que convertem', icon: Percent },
  { key: 'roi', label: 'ROI', description: 'Retorno sobre investimento total', icon: PieChart },
];

const CHART_METRICS = [
  { key: 'spend', label: 'Investimento' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'clicks', label: 'Cliques' },
  { key: 'conversions', label: 'Conversões' },
  { key: 'leads', label: 'Leads' },
  { key: 'purchases', label: 'Vendas' },
  { key: 'cpa', label: 'CPA' },
  { key: 'cpl', label: 'CPL' },
  { key: 'roas', label: 'ROAS' },
  { key: 'ctr', label: 'CTR' },
];

interface MetricConfig {
  result_metric: string;
  result_metric_label: string;
  base_metrics: string[];
  cost_metrics: string[];
  efficiency_metrics: string[];
  chart_primary_metric: string;
  chart_secondary_metric: string;
}

export default function ProjectSetup() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [projectName, setProjectName] = useState('');
  
  const [config, setConfig] = useState<MetricConfig>({
    result_metric: 'leads',
    result_metric_label: 'Leads',
    base_metrics: ['spend', 'impressions', 'clicks', 'cpm', 'cpc'],
    cost_metrics: ['cpl', 'cpa'],
    efficiency_metrics: ['roas', 'ctr'],
    chart_primary_metric: 'spend',
    chart_secondary_metric: 'leads',
  });

  useEffect(() => {
    if (projectId) {
      fetchProjectName();
    }
  }, [projectId]);

  const fetchProjectName = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();
    if (data) {
      setProjectName(data.name);
    }
  };

  const handleComplete = async () => {
    if (!projectId) return;
    
    setIsSaving(true);
    try {
      // Save the metric config
      const { error } = await supabase.from('project_metric_config').upsert({
        project_id: projectId,
        primary_metrics: config.base_metrics,
        result_metric: config.result_metric,
        result_metric_label: config.result_metric_label,
        cost_metrics: config.cost_metrics,
        efficiency_metrics: config.efficiency_metrics,
        show_comparison: true,
        chart_primary_metric: config.chart_primary_metric,
        chart_secondary_metric: config.chart_secondary_metric,
      }, { onConflict: 'project_id' });

      if (error) throw error;
      
      toast.success('Configuração salva com sucesso!');
      
      // Navigate to campaigns page
      localStorage.setItem('selectedProjectId', projectId);
      navigate('/campaigns');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigate('/projects');
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const toggleMetric = (metricKey: string, arrayKey: keyof MetricConfig) => {
    const array = config[arrayKey] as string[];
    if (array.includes(metricKey)) {
      setConfig({
        ...config,
        [arrayKey]: array.filter(m => m !== metricKey)
      });
    } else {
      setConfig({
        ...config,
        [arrayKey]: [...array, metricKey]
      });
    }
  };

  const steps = [
    { title: 'Bem-vindo', subtitle: 'Configure seu projeto' },
    { title: 'Resultado', subtitle: 'Métrica principal' },
    { title: 'Base', subtitle: 'Métricas sempre visíveis' },
    { title: 'Custo', subtitle: 'Métricas de custo' },
    { title: 'Eficiência', subtitle: 'Métricas de performance' },
    { title: 'Gráficos', subtitle: 'Configurar visualizações' },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Floating particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/10 pointer-events-none"
          style={{
            width: 3 + Math.random() * 5,
            height: 3 + Math.random() * 5,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${6 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
            filter: 'blur(1px)',
          }}
        />
      ))}

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.015)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl px-6 py-12">
        {/* Step 0: Welcome */}
        {currentStep === 0 && (
          <div className="text-center animate-fade-in flex flex-col items-center">
            <div className="relative mb-8">
              <img 
                src={v4LogoIcon} 
                alt="V4 Company" 
                className="h-20 w-auto drop-shadow-xl rounded-2xl"
              />
              <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl -z-10 scale-150" />
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Configuração Personalizada</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Configure <span className="gradient-text">{projectName || 'seu projeto'}</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
              Vamos personalizar as métricas do seu dashboard para atender exatamente às suas necessidades.
            </p>

            <div className="glass-card p-6 max-w-md mx-auto mb-10 text-left">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                O que vamos configurar:
              </h3>
              <ul className="space-y-3">
                {[
                  'Métrica principal de resultado',
                  'Métricas base do dashboard',
                  'Métricas de custo',
                  'Métricas de eficiência',
                  'Configuração dos gráficos'
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>

            <Button 
              onClick={handleNext}
              size="lg"
              className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 px-8 group"
            >
              Começar configuração
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}

        {/* Step 1: Result Metric */}
        {currentStep === 1 && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Passo 1 de 5</span>
              </div>
              <h2 className="text-3xl font-bold mb-3">
                <span className="gradient-text">Métrica de Resultado</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Escolha o que conta como conversão principal para este projeto
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
              {RESULT_METRICS.map((metric) => {
                const Icon = metric.icon;
                const isSelected = config.result_metric === metric.key;
                return (
                  <button
                    key={metric.key}
                    onClick={() => setConfig({ 
                      ...config, 
                      result_metric: metric.key, 
                      result_metric_label: metric.label,
                      chart_secondary_metric: metric.key
                    })}
                    className={cn(
                      "relative p-5 rounded-2xl border-2 text-left transition-all duration-300",
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                        : 'border-border/50 hover:border-primary/50 hover:bg-card/80'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors",
                      isSelected ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      <Icon className={cn("w-6 h-6", isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <h3 className="font-semibold mb-1">{metric.label}</h3>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleBack} className="px-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 px-8 group"
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Base Metrics */}
        {currentStep === 2 && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">Passo 2 de 5</span>
              </div>
              <h2 className="text-3xl font-bold mb-3">
                <span className="gradient-text">Métricas Base</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Selecione as métricas que sempre serão exibidas no dashboard
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto mb-10">
              {BASE_METRICS.map((metric) => {
                const Icon = metric.icon;
                const isSelected = config.base_metrics.includes(metric.key);
                const isRequired = metric.required;
                return (
                  <button
                    key={metric.key}
                    onClick={() => !isRequired && toggleMetric(metric.key, 'base_metrics')}
                    disabled={isRequired}
                    className={cn(
                      "relative p-4 rounded-xl border-2 text-left transition-all duration-300",
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-border/50 hover:border-blue-500/50',
                      isRequired && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center mb-2",
                      isSelected ? 'bg-blue-500/20' : 'bg-muted'
                    )}>
                      <Icon className={cn("w-5 h-5", isSelected ? 'text-blue-400' : 'text-muted-foreground')} />
                    </div>
                    <h3 className="font-medium text-sm mb-0.5">{metric.label}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{metric.description}</p>
                    {isRequired && (
                      <span className="absolute bottom-2 right-2 text-[10px] text-blue-400 font-medium">Obrigatório</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleBack} className="px-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 px-8 group"
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Cost Metrics */}
        {currentStep === 3 && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium">Passo 3 de 5</span>
              </div>
              <h2 className="text-3xl font-bold mb-3">
                <span className="gradient-text">Métricas de Custo</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Escolha as métricas de custo que fazem sentido para seu negócio
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-10">
              {COST_METRICS.map((metric) => {
                const Icon = metric.icon;
                const isSelected = config.cost_metrics.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key, 'cost_metrics')}
                    className={cn(
                      "relative p-5 rounded-2xl border-2 text-center transition-all duration-300",
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-border/50 hover:border-amber-500/50'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3",
                      isSelected ? 'bg-amber-500/20' : 'bg-muted'
                    )}>
                      <Icon className={cn("w-7 h-7", isSelected ? 'text-amber-400' : 'text-muted-foreground')} />
                    </div>
                    <h3 className="font-semibold mb-1">{metric.label}</h3>
                    <p className="text-xs text-muted-foreground">{metric.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleBack} className="px-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 px-8 group"
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Efficiency Metrics */}
        {currentStep === 4 && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">Passo 4 de 5</span>
              </div>
              <h2 className="text-3xl font-bold mb-3">
                <span className="gradient-text">Métricas de Eficiência</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Métricas para avaliar a performance das campanhas
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
              {EFFICIENCY_METRICS.map((metric) => {
                const Icon = metric.icon;
                const isSelected = config.efficiency_metrics.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key, 'efficiency_metrics')}
                    className={cn(
                      "relative p-5 rounded-2xl border-2 text-center transition-all duration-300",
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-border/50 hover:border-emerald-500/50'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3",
                      isSelected ? 'bg-emerald-500/20' : 'bg-muted'
                    )}>
                      <Icon className={cn("w-7 h-7", isSelected ? 'text-emerald-400' : 'text-muted-foreground')} />
                    </div>
                    <h3 className="font-semibold mb-1">{metric.label}</h3>
                    <p className="text-xs text-muted-foreground">{metric.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleBack} className="px-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 px-8 group"
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Chart Configuration */}
        {currentStep === 5 && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                <LineChart className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">Passo 5 de 5</span>
              </div>
              <h2 className="text-3xl font-bold mb-3">
                <span className="gradient-text">Configuração de Gráficos</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Escolha as métricas padrão para os gráficos do dashboard
              </p>
            </div>

            <div className="max-w-xl mx-auto space-y-8 mb-10">
              {/* Primary Metric */}
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  Métrica Primária (Barras)
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CHART_METRICS.map((metric) => (
                    <button
                      key={metric.key}
                      onClick={() => setConfig({ ...config, chart_primary_metric: metric.key })}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        config.chart_primary_metric === metric.key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Secondary Metric */}
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <LineChart className="w-4 h-4 text-emerald-400" />
                  </div>
                  Métrica Secundária (Linha)
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CHART_METRICS.map((metric) => (
                    <button
                      key={metric.key}
                      onClick={() => setConfig({ ...config, chart_secondary_metric: metric.key })}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        config.chart_secondary_metric === metric.key
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleBack} className="px-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={handleComplete}
                disabled={isSaving}
                size="lg"
                className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 px-8 group"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Finalizar e Iniciar
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mt-12">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentStep 
                  ? 'bg-primary w-8' 
                  : index < currentStep 
                    ? 'bg-primary/50' 
                    : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
