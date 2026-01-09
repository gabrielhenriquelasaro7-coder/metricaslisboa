import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { usePredictiveAnalysis, OptimizationSuggestion } from '@/hooks/usePredictiveAnalysis';
import { useAccountGoals } from '@/hooks/useAccountGoals';
import { useSuggestionActions } from '@/hooks/useSuggestionActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PredictiveSkeleton } from '@/components/skeletons';
import { generatePredictiveReportPDF } from '@/components/pdf/PredictiveReportPDF';
import { AccountGoalsConfig } from '@/components/predictive/AccountGoalsConfig';
import { SuggestionActionDialog } from '@/components/predictive/SuggestionActionDialog';

import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Target, 
  Lightbulb,
  RefreshCw,
  Calendar,
  BarChart3,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  Wallet,
  Info,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  AreaChart,
  BarChart,
  LineChart,
} from 'recharts';
import { Settings2, Palette, LineChart as LineChartIcon } from 'lucide-react';
import { ChartCustomizationDialog } from '@/components/dashboard/ChartCustomizationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function PredictiveAnalysis() {
  const projectId = localStorage.getItem('selectedProjectId');
  const { data, loading, error, fetchAnalysis } = usePredictiveAnalysis(projectId);
  const { goal, refetch: refetchGoal } = useAccountGoals(projectId);
  const { markSuggestion, getActionForSuggestion, removeMark } = useSuggestionActions(projectId);
  const [goalsVersion, setGoalsVersion] = useState(0);
  
  // State for suggestion action dialog
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<{ title: string; actionType: 'applied' | 'ignored' } | null>(null);
  
  // Filters for suggestions
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'applied' | 'ignored'>('all');
  
  // Chart customization state
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [chartColor, setChartColor] = useState('hsl(142, 76%, 36%)');
  const [secondaryColor, setSecondaryColor] = useState('hsl(217, 91%, 60%)');
  const [chartCustomizationOpen, setChartCustomizationOpen] = useState(false);
  const [showSecondaryMetric, setShowSecondaryMetric] = useState(true);

  // Stringify goal for comparison to detect changes
  const goalHash = useMemo(() => JSON.stringify(goal), [goal]);

  useEffect(() => {
    if (projectId) {
      console.log('[PredictiveAnalysis] Fetching analysis with accountGoal:', goal);
      fetchAnalysis(goal ? {
        targetLeadsMonthly: goal.target_leads_monthly,
        targetCpl: goal.target_cpl,
        targetRoas: goal.target_roas,
        targetCtr: goal.target_ctr,
        targetSpendDaily: goal.target_spend_daily,
        targetSpendMonthly: goal.target_spend_monthly,
      } : undefined);
    }
  }, [projectId, goalHash, goalsVersion]);

  const handleGoalsSaved = async () => {
    await refetchGoal();
    setGoalsVersion(v => v + 1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: data?.project.currency || 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <ArrowUp className="w-4 h-4 text-metric-positive" />;
    if (trend < -5) return <ArrowDown className="w-4 h-4 text-metric-negative" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-metric-positive" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-metric-warning" />;
      case 'critical': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-xs">Média</Badge>;
      case 'low': return <Badge variant="outline" className="text-xs">Baixa</Badge>;
    }
  };

  const getBusinessModelLabel = (model: string) => {
    switch (model) {
      case 'inside_sales': return 'Inside Sales';
      case 'ecommerce': return 'E-commerce';
      case 'pdv': return 'PDV';
      case 'custom': return 'Personalizado';
      default: return model;
    }
  };

  const chartData = useMemo(() => {
    if (!data?.dailyTrend) return [];
    const processed = data.dailyTrend.map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    }));
    // Debug: log conversions range
    const conversions = processed.map(d => d.conversions);
    console.log('[CHART DEBUG] Conversions values:', conversions, 'Min:', Math.min(...conversions), 'Max:', Math.max(...conversions));
    return processed;
  }, [data]);
  
  // Calculate Y-axis domain for conversions to ensure proper scaling
  const conversionsYDomain = useMemo(() => {
    if (!chartData || chartData.length === 0) return [0, 10];
    const values = chartData.map(d => d.conversions || 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    // Ensure we have a visible range
    if (maxVal === minVal) {
      return [0, Math.max(maxVal + 1, 1)];
    }
    return [0, Math.ceil(maxVal * 1.1)];
  }, [chartData]);

  // Calculate best and worst performance days based on CPL (lower is better) or ROAS (higher is better)
  const performanceMarkers = useMemo(() => {
    if (!chartData || chartData.length === 0) return { best: null, worst: null };
    
    // Filter days with conversions > 0 to calculate valid CPL
    const validDays = chartData.filter(d => d.conversions > 0 && d.spend > 0);
    if (validDays.length === 0) return { best: null, worst: null };

    // Calculate CPL for each day (lower is better)
    const daysWithCPL = validDays.map(d => ({
      ...d,
      cpl: d.spend / d.conversions
    }));

    // Best day = lowest CPL (most efficient)
    const bestDay = daysWithCPL.reduce((min, d) => d.cpl < min.cpl ? d : min, daysWithCPL[0]);
    // Worst day = highest CPL (least efficient)
    const worstDay = daysWithCPL.reduce((max, d) => d.cpl > max.cpl ? d : max, daysWithCPL[0]);

    return { 
      best: bestDay, 
      worst: worstDay,
      bestCPL: bestDay.cpl,
      worstCPL: worstDay.cpl
    };
  }, [chartData]);

  const chartConfig = {
    spend: { label: 'Gasto', color: 'hsl(var(--primary))' },
    conversions: { label: 'Conversões', color: 'hsl(var(--metric-positive))' },
    conversion_value: { label: 'Receita', color: 'hsl(var(--chart-2))' },
  };

  const getBalanceStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-metric-positive';
      case 'warning': return 'text-metric-warning';
      case 'critical': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (!projectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Selecione um projeto primeiro</p>
        </div>
      </DashboardLayout>
    );
  }

  // Determine which metrics to show based on business model
  // ROAS: ecommerce e custom
  // CPL: inside_sales, custom e pdv
  const isInsideSales = data?.project.businessModel === 'inside_sales';
  const isEcommerce = data?.project.businessModel === 'ecommerce';
  const isPDV = data?.project.businessModel === 'pdv';
  const isCustom = data?.project.businessModel === 'custom';
  
  // CPL para inside_sales, custom e pdv
  const showCPL = isInsideSales || isCustom || isPDV;
  // ROAS para ecommerce e custom
  const showROAS = isEcommerce || isCustom;

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-primary" />
                Projeções Futuras
              </h1>
              <p className="text-muted-foreground mt-1">
                Estimamos os resultados com base na tendência dos últimos 30 dias
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {data && (
                <AccountGoalsConfig
                  projectId={projectId}
                  businessModel={data.project.businessModel}
                  onGoalsSaved={handleGoalsSaved}
                />
              )}
              <Button 
                variant="outline"
                onClick={() => {
                  if (data) {
                    generatePredictiveReportPDF(data);
                    toast.success('Relatório PDF gerado com sucesso!');
                  }
                }}
                disabled={!data}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Exportar PDF
              </Button>
              <Button 
                onClick={() => fetchAnalysis()} 
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Trend Context Card */}
          {data && (
            <Card className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full bg-primary/10">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">Análise de Tendência</h3>
                      <Badge variant={data.predictions.trends.confidenceLevel === 'alta' ? 'default' : data.predictions.trends.confidenceLevel === 'média' ? 'secondary' : 'outline'}>
                        Confiança {data.predictions.trends.confidenceLevel}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        Tendência {data.predictions.trends.trendDirection}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {data.predictions.trends.trendDirection === 'crescente' && (
                        <>A tendência indica um <strong className="text-metric-positive">crescimento de {Math.abs(data.predictions.trends.spendTrend).toFixed(1)}%</strong> no investimento. Projetamos que esse ritmo se mantenha, resultando em maior volume de resultados.</>
                      )}
                      {data.predictions.trends.trendDirection === 'decrescente' && (
                        <>Observamos uma <strong className="text-metric-warning">redução de {Math.abs(data.predictions.trends.spendTrend).toFixed(1)}%</strong> no investimento. Isso pode impactar o volume de resultados nas próximas semanas.</>
                      )}
                      {data.predictions.trends.trendDirection === 'estável' && (
                        <>O investimento está <strong className="text-foreground">estável</strong>. Projetamos que os resultados sigam o padrão atual, sem grandes variações.</>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loading && !data && (
            <PredictiveSkeleton />
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {data && (
            <>

              {/* Scenario-Based Projections */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* 7-Day Projection */}
                <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="w-5 h-5 text-primary" />
                      Próximos 7 Dias
                    </CardTitle>
                    <CardDescription>Projetamos os seguintes cenários</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Realistic - Main */}
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Cenário Realista</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Investimento</p>
                          <p className="text-xl font-bold">{formatCurrency(data.predictions.next7Days.scenarios?.realistic?.spend || data.predictions.next7Days.estimatedSpend)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{showCPL ? 'Leads' : 'Conversões'}</p>
                          <p className="text-xl font-bold">{formatNumber(data.predictions.next7Days.scenarios?.realistic?.conversions || data.predictions.next7Days.estimatedConversions)}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Pessimistic & Optimistic */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-metric-warning/10 border border-metric-warning/20">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingDown className="w-3 h-3 text-metric-warning" />
                          <span className="text-xs font-medium text-metric-warning">Pessimista</span>
                        </div>
                        <p className="text-sm font-semibold">{formatNumber(data.predictions.next7Days.scenarios?.pessimistic?.conversions || Math.round(data.predictions.next7Days.estimatedConversions * 0.7))} {showCPL ? 'leads' : 'conv.'}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(data.predictions.next7Days.scenarios?.pessimistic?.spend || data.predictions.next7Days.estimatedSpend * 0.8)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-metric-positive/10 border border-metric-positive/20">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingUp className="w-3 h-3 text-metric-positive" />
                          <span className="text-xs font-medium text-metric-positive">Otimista</span>
                        </div>
                        <p className="text-sm font-semibold">{formatNumber(data.predictions.next7Days.scenarios?.optimistic?.conversions || Math.round(data.predictions.next7Days.estimatedConversions * 1.3))} {showCPL ? 'leads' : 'conv.'}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(data.predictions.next7Days.scenarios?.optimistic?.spend || data.predictions.next7Days.estimatedSpend * 1.2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 30-Day Projection */}
                <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="w-5 h-5 text-primary" />
                      Próximos 30 Dias
                    </CardTitle>
                    <CardDescription>Estimamos com base na tendência atual</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Realistic - Main */}
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Cenário Realista</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Investimento</p>
                          <p className="text-xl font-bold">{formatCurrency(data.predictions.next30Days.scenarios?.realistic?.spend || data.predictions.next30Days.estimatedSpend)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{showCPL ? 'Leads' : 'Conversões'}</p>
                          <p className="text-xl font-bold">{formatNumber(data.predictions.next30Days.scenarios?.realistic?.conversions || data.predictions.next30Days.estimatedConversions)}</p>
                        </div>
                      </div>
                      {showROAS && (
                        <div className="mt-2 pt-2 border-t border-primary/20">
                          <p className="text-xs text-muted-foreground">Receita Projetada</p>
                          <p className="text-lg font-bold text-metric-positive">{formatCurrency(data.predictions.next30Days.scenarios?.realistic?.revenue || data.predictions.next30Days.estimatedRevenue)}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Pessimistic & Optimistic */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-metric-warning/10 border border-metric-warning/20">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingDown className="w-3 h-3 text-metric-warning" />
                          <span className="text-xs font-medium text-metric-warning">Pessimista</span>
                        </div>
                        <p className="text-sm font-semibold">{formatNumber(data.predictions.next30Days.scenarios?.pessimistic?.conversions || Math.round(data.predictions.next30Days.estimatedConversions * 0.7))} {showCPL ? 'leads' : 'conv.'}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(data.predictions.next30Days.scenarios?.pessimistic?.spend || data.predictions.next30Days.estimatedSpend * 0.8)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-metric-positive/10 border border-metric-positive/20">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingUp className="w-3 h-3 text-metric-positive" />
                          <span className="text-xs font-medium text-metric-positive">Otimista</span>
                        </div>
                        <p className="text-sm font-semibold">{formatNumber(data.predictions.next30Days.scenarios?.optimistic?.conversions || Math.round(data.predictions.next30Days.estimatedConversions * 1.3))} {showCPL ? 'leads' : 'conv.'}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(data.predictions.next30Days.scenarios?.optimistic?.spend || data.predictions.next30Days.estimatedSpend * 1.2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* End of Year Projection */}
                <Card className="bg-card hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className="w-5 h-5 text-primary" />
                      Até Final de {new Date().getFullYear()}
                    </CardTitle>
                    <CardDescription>
                      {data.predictions.endOfYear?.daysRemaining || Math.ceil((new Date(new Date().getFullYear(), 11, 31).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dias restantes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Realistic - Main */}
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Projeção Realista</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Investimento Total</p>
                          <p className="text-xl font-bold">{formatCurrency(data.predictions.endOfYear?.scenarios?.realistic?.spend || data.predictions.next30Days.estimatedSpend * 4)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{showCPL ? 'Leads Totais' : 'Conversões'}</p>
                          <p className="text-xl font-bold">{formatNumber(data.predictions.endOfYear?.scenarios?.realistic?.conversions || data.predictions.next30Days.estimatedConversions * 4)}</p>
                        </div>
                      </div>
                      {showROAS && (
                        <div className="mt-2 pt-2 border-t border-primary/20">
                          <p className="text-xs text-muted-foreground">Receita Projetada</p>
                          <p className="text-lg font-bold text-metric-positive">{formatCurrency(data.predictions.endOfYear?.scenarios?.realistic?.revenue || data.predictions.next30Days.estimatedRevenue * 4)}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Pessimistic & Optimistic */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-metric-warning/10 border border-metric-warning/20">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingDown className="w-3 h-3 text-metric-warning" />
                          <span className="text-xs font-medium text-metric-warning">Pessimista</span>
                        </div>
                        <p className="text-sm font-semibold">{formatNumber(data.predictions.endOfYear?.scenarios?.pessimistic?.conversions || Math.round(data.predictions.next30Days.estimatedConversions * 2.8))} {showCPL ? 'leads' : 'conv.'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-metric-positive/10 border border-metric-positive/20">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingUp className="w-3 h-3 text-metric-positive" />
                          <span className="text-xs font-medium text-metric-positive">Otimista</span>
                        </div>
                        <p className="text-sm font-semibold">{formatNumber(data.predictions.endOfYear?.scenarios?.optimistic?.conversions || Math.round(data.predictions.next30Days.estimatedConversions * 5.2))} {showCPL ? 'leads' : 'conv.'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Key Metrics Summary */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-card to-card/80">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Média Diária</p>
                        <p className="text-lg font-bold">{formatCurrency(data.predictions.trends.avgDailySpend)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-card to-card/80">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-metric-positive/10">
                        <Target className="w-5 h-5 text-metric-positive" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{showCPL ? 'CPL Atual' : 'ROAS Atual'}</p>
                        <p className="text-lg font-bold">
                          {showCPL 
                            ? formatCurrency(data.predictions.trends.avgDailyCpl || 0)
                            : `${(data.predictions.trends.avgDailyRoas || 0).toFixed(2)}x`
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-card to-card/80">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CTR Médio</p>
                        <p className="text-lg font-bold">{(data.predictions.trends.avgCtr || 0).toFixed(2)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-card to-card/80">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        data.predictions.trends.trendDirection === 'crescente' ? "bg-metric-positive/10" :
                        data.predictions.trends.trendDirection === 'decrescente' ? "bg-metric-warning/10" : "bg-muted"
                      )}>
                        {data.predictions.trends.trendDirection === 'crescente' ? (
                          <ArrowUp className="w-5 h-5 text-metric-positive" />
                        ) : data.predictions.trends.trendDirection === 'decrescente' ? (
                          <ArrowDown className="w-5 h-5 text-metric-warning" />
                        ) : (
                          <Minus className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tendência</p>
                        <p className="text-lg font-bold capitalize">{data.predictions.trends.trendDirection || 'estável'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Simplified Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Desempenho dos Últimos 30 Dias
                  </CardTitle>
                  <CardDescription>
                    Veja quanto você gastou e quantos {showCPL ? 'leads' : 'resultados'} obteve por dia
                  </CardDescription>
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                      <span>
                        <strong className="text-foreground">Como interpretar:</strong> O melhor dia não é necessariamente o que teve mais {showCPL ? 'leads' : 'resultados'}, mas sim aquele com o <strong className="text-primary">menor CPL</strong> (custo por lead). Dias com menos leads podem ter sido mais eficientes se o custo foi baixo.
                      </span>
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Simple Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <p className="text-sm text-muted-foreground mb-1">Gasto Total</p>
                      <p className="text-2xl font-bold text-blue-500">{formatCurrency(data.totals.spend30Days)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                      <p className="text-sm text-muted-foreground mb-1">{showCPL ? 'Leads' : 'Resultados'}</p>
                      <p className="text-2xl font-bold text-green-500">{formatNumber(data.totals.conversions30Days)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <p className="text-sm text-muted-foreground mb-1">CPL Médio</p>
                      <p className="text-2xl font-bold text-purple-500">
                        {data.totals.conversions30Days > 0 
                          ? formatCurrency(data.totals.spend30Days / data.totals.conversions30Days)
                          : 'R$ 0'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <p className="text-sm text-muted-foreground mb-1">Média/Dia</p>
                      <p className="text-2xl font-bold text-amber-500">
                        {formatNumber(data.totals.conversions30Days / 30)} {showCPL ? 'leads' : 'conv.'}
                      </p>
                    </div>
                  </div>

                  {/* Best and Worst Days Highlight */}
                  {performanceMarkers.best && performanceMarkers.worst && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-green-500" />
                          <span className="font-semibold text-green-500">Melhor Dia: {performanceMarkers.best.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {performanceMarkers.best.conversions} {showCPL ? 'leads' : 'conversões'} com R$ {performanceMarkers.best.spend.toFixed(2)} de gasto
                        </p>
                        <p className="text-sm font-medium text-green-500 mt-1">
                          CPL: R$ {performanceMarkers.bestCPL?.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="font-semibold text-red-500">Pior Dia: {performanceMarkers.worst.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {performanceMarkers.worst.conversions} {showCPL ? 'leads' : 'conversões'} com R$ {performanceMarkers.worst.spend.toFixed(2)} de gasto
                        </p>
                        <p className="text-sm font-medium text-red-500 mt-1">
                          CPL: R$ {performanceMarkers.worstCPL?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Chart with customization controls */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                          <strong>{showCPL ? 'Leads' : 'Resultados'} por dia</strong>
                        </p>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: chartColor }} />
                            <span className="text-muted-foreground">{showCPL ? 'Leads' : 'Resultados'}</span>
                          </div>
                          {showSecondaryMetric && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: secondaryColor }} />
                              <span className="text-muted-foreground">Investimento (R$)</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Toggle Secondary Metric */}
                        <Button
                          variant={showSecondaryMetric ? 'default' : 'outline'}
                          size="sm"
                          className="gap-2 text-xs"
                          onClick={() => setShowSecondaryMetric(!showSecondaryMetric)}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Investimento
                        </Button>
                        
                        {/* Chart Type Selector */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <LineChartIcon className="w-4 h-4" />
                              Tipo
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setChartType('bar')} className={chartType === 'bar' ? 'bg-accent' : ''}>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Barras
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setChartType('line')} className={chartType === 'line' ? 'bg-accent' : ''}>
                              <LineChartIcon className="w-4 h-4 mr-2" />
                              Linhas
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setChartType('area')} className={chartType === 'area' ? 'bg-accent' : ''}>
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Área
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        {/* Color customization */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => setChartCustomizationOpen(true)}
                        >
                          <Palette className="w-4 h-4" />
                          Cores
                        </Button>
                      </div>
                    </div>
                    
                    <ChartContainer config={chartConfig} className="h-[250px] w-full !aspect-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }} 
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            yAxisId="left"
                            tick={{ fontSize: 11 }} 
                            tickLine={false}
                            axisLine={false}
                            width={40}
                            allowDecimals={false}
                            domain={[0, 'dataMax']}
                          />
                          {showSecondaryMetric && (
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 11 }} 
                              tickLine={false}
                              axisLine={false}
                              width={50}
                              tickFormatter={(value) => `R$${value}`}
                            />
                          )}
                          <ChartTooltip 
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0]?.payload;
                              return (
                                <div className="bg-popover border rounded-lg shadow-lg p-3 space-y-1">
                                  <p className="font-semibold">{d?.date}</p>
                                  <p style={{ color: chartColor }}>{d?.conversions} {showCPL ? 'leads' : 'resultados'}</p>
                                  <p style={{ color: secondaryColor }}>R$ {d?.spend?.toFixed(2)}</p>
                                  <p className="text-purple-500">
                                    CPL: R$ {d?.conversions > 0 ? (d.spend / d.conversions).toFixed(2) : '0'}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          {chartType === 'bar' ? (
                            <Bar
                              yAxisId="left"
                              dataKey="conversions"
                              name={showCPL ? "Leads" : "Resultados"}
                              fill={chartColor}
                              radius={[4, 4, 0, 0]}
                            />
                          ) : chartType === 'area' ? (
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="conversions"
                              name={showCPL ? "Leads" : "Resultados"}
                              fill={chartColor}
                              fillOpacity={0.3}
                              stroke={chartColor}
                              strokeWidth={2}
                            />
                          ) : (
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="conversions"
                              name={showCPL ? "Leads" : "Resultados"}
                              stroke={chartColor}
                              strokeWidth={2}
                              dot={false}
                            />
                          )}
                          {showSecondaryMetric && (
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="spend"
                              name="Investimento"
                              stroke={secondaryColor}
                              strokeWidth={2}
                              dot={false}
                              strokeDasharray="4 4"
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
              
              {/* Chart Customization Dialog */}
              <ChartCustomizationDialog
                open={chartCustomizationOpen}
                onOpenChange={setChartCustomizationOpen}
                chartName="Gráfico de Desempenho"
                primaryColor={chartColor}
                secondaryColor={secondaryColor}
                onSave={(_, primary, secondary) => {
                  setChartColor(primary);
                  if (secondary) setSecondaryColor(secondary);
                }}
              />


              {/* Account Goals Progress - General Goals */}
              {goal && (goal.target_leads_monthly || goal.target_cpl || goal.target_roas || goal.target_ctr) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Progresso das Metas Gerais
                    </CardTitle>
                    <CardDescription>
                      Acompanhamento das metas definidas para a conta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {/* Leads Progress */}
                      {goal.target_leads_monthly && (
                        <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Leads/Mês</span>
                            <span className={cn(
                              "text-sm font-bold",
                              data.totals.conversions30Days >= goal.target_leads_monthly ? "text-metric-positive" : "text-metric-warning"
                            )}>
                              {formatNumber(data.totals.conversions30Days)} / {formatNumber(goal.target_leads_monthly)}
                            </span>
                          </div>
                          <Progress 
                            value={Math.min((data.totals.conversions30Days / goal.target_leads_monthly) * 100, 100)} 
                            className={cn(
                              "h-2",
                              data.totals.conversions30Days >= goal.target_leads_monthly ? "[&>div]:bg-metric-positive" : "[&>div]:bg-primary"
                            )}
                          />
                        </div>
                      )}

                      {/* CPL Progress */}
                      {goal.target_cpl && data.totals.conversions30Days > 0 && (
                        <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">CPL</span>
                            {(() => {
                              const currentCpl = data.totals.spend30Days / data.totals.conversions30Days;
                              const isGood = currentCpl <= goal.target_cpl;
                              return (
                                <span className={cn(
                                  "text-sm font-bold",
                                  isGood ? "text-metric-positive" : "text-destructive"
                                )}>
                                  {formatCurrency(currentCpl)} / {formatCurrency(goal.target_cpl)}
                                </span>
                              );
                            })()}
                          </div>
                          <Progress 
                            value={Math.min((goal.target_cpl / (data.totals.spend30Days / data.totals.conversions30Days)) * 100, 100)} 
                            className="h-2"
                          />
                        </div>
                      )}

                      {/* CTR Progress */}
                      {goal.target_ctr && data.totals.impressions30Days > 0 && (
                        <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">CTR</span>
                            {(() => {
                              const currentCtr = (data.totals.clicks30Days / data.totals.impressions30Days) * 100;
                              const isGood = currentCtr >= goal.target_ctr;
                              return (
                                <span className={cn(
                                  "text-sm font-bold",
                                  isGood ? "text-metric-positive" : "text-metric-warning"
                                )}>
                                  {currentCtr.toFixed(2)}% / {goal.target_ctr}%
                                </span>
                              );
                            })()}
                          </div>
                          <Progress 
                            value={Math.min(((data.totals.clicks30Days / data.totals.impressions30Days) * 100 / goal.target_ctr) * 100, 100)} 
                            className="h-2"
                          />
                        </div>
                      )}

                      {/* Spend Progress */}
                      {goal.target_spend_monthly && (
                        <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Gasto/Mês</span>
                            <span className="text-sm font-bold">
                              {formatCurrency(data.totals.spend30Days)} / {formatCurrency(goal.target_spend_monthly)}
                            </span>
                          </div>
                          <Progress 
                            value={Math.min((data.totals.spend30Days / goal.target_spend_monthly) * 100, 100)} 
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Suggestions - Improved */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-metric-warning" />
                          Sugestões de Otimização
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Recomendações baseadas em análise dos seus dados ({data.project?.businessModel === 'ecommerce' || data.project?.businessModel === 'infoproduto' ? 'foco em ROAS' : 'foco em CPL/Leads'})
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          fetchAnalysis();
                          toast.info('Atualizando análise...');
                        }}
                        disabled={loading}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Atualizar
                      </Button>
                    </div>
                    
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Filter className="w-4 h-4" />
                        <span>Filtros:</span>
                      </div>
                      
                      {/* Priority Filter */}
                      <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
                        <button
                          onClick={() => setPriorityFilter('all')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            priorityFilter === 'all' 
                              ? "bg-primary text-primary-foreground" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Todas
                        </button>
                        <button
                          onClick={() => setPriorityFilter('high')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            priorityFilter === 'high' 
                              ? "bg-destructive text-destructive-foreground" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Alta
                        </button>
                        <button
                          onClick={() => setPriorityFilter('medium')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            priorityFilter === 'medium' 
                              ? "bg-metric-warning text-white" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Média
                        </button>
                        <button
                          onClick={() => setPriorityFilter('low')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            priorityFilter === 'low' 
                              ? "bg-primary text-primary-foreground" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Baixa
                        </button>
                      </div>
                      
                      <div className="w-px h-5 bg-border hidden sm:block" />
                      
                      {/* Status Filter */}
                      <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
                        <button
                          onClick={() => setStatusFilter('all')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            statusFilter === 'all' 
                              ? "bg-primary text-primary-foreground" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Todas
                        </button>
                        <button
                          onClick={() => setStatusFilter('pending')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            statusFilter === 'pending' 
                              ? "bg-metric-warning text-white" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Pendentes
                        </button>
                        <button
                          onClick={() => setStatusFilter('applied')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            statusFilter === 'applied' 
                              ? "bg-metric-positive text-white" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Aplicadas
                        </button>
                        <button
                          onClick={() => setStatusFilter('ignored')}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all",
                            statusFilter === 'ignored' 
                              ? "bg-muted-foreground text-white" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          Ignoradas
                        </button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.suggestions
                      .filter(suggestion => {
                        // Priority filter
                        if (priorityFilter !== 'all' && suggestion.priority !== priorityFilter) {
                          return false;
                        }
                        // Status filter
                        const action = getActionForSuggestion(suggestion.title);
                        if (statusFilter === 'pending' && action) return false;
                        if (statusFilter === 'applied' && action?.action_type !== 'applied') return false;
                        if (statusFilter === 'ignored' && action?.action_type !== 'ignored') return false;
                        return true;
                      })
                      .map((suggestion, index) => {
                      const existingAction = getActionForSuggestion(suggestion.title);
                      const isMarked = !!existingAction;
                      
                      return (
                        <motion.div 
                          key={`${suggestion.title}-${index}`}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ 
                            opacity: isMarked && existingAction?.action_type === 'ignored' ? 0.6 : 1, 
                            y: 0,
                            scale: 1
                          }}
                          transition={{ 
                            duration: 0.3, 
                            ease: "easeOut",
                            layout: { duration: 0.2 }
                          }}
                          className={cn(
                            "p-4 rounded-lg border relative overflow-hidden",
                            isMarked && existingAction.action_type === 'applied' && "bg-metric-positive/5 border-metric-positive/30",
                            isMarked && existingAction.action_type === 'ignored' && "bg-muted/30 border-muted-foreground/20",
                            !isMarked && suggestion.priority === 'high' && "bg-destructive/5 border-destructive/20",
                            !isMarked && suggestion.priority === 'medium' && "bg-metric-warning/5 border-metric-warning/20",
                            !isMarked && suggestion.priority === 'low' && "bg-muted/50 border-border"
                          )}
                        >
                          {/* Status badge if marked - animated */}
                          <AnimatePresence>
                            {isMarked && (
                              <motion.div 
                                className="absolute -top-2 -right-2 z-10"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                              >
                                <Badge 
                                  variant={existingAction.action_type === 'applied' ? 'default' : 'secondary'}
                                  className={cn(
                                    "text-xs shadow-sm",
                                    existingAction.action_type === 'applied' && "bg-metric-positive text-white"
                                  )}
                                >
                                  {existingAction.action_type === 'applied' ? '✓ Aplicada' : 'Ignorada'}
                                </Badge>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <motion.div
                                animate={{ 
                                  rotate: isMarked && existingAction?.action_type === 'applied' ? [0, -10, 10, 0] : 0
                                }}
                                transition={{ duration: 0.4 }}
                              >
                                <Zap className={cn(
                                  "w-5 h-5 mt-0.5 flex-shrink-0 transition-colors duration-300",
                                  isMarked && existingAction.action_type === 'applied' && "text-metric-positive",
                                  isMarked && existingAction.action_type === 'ignored' && "text-muted-foreground",
                                  !isMarked && suggestion.priority === 'high' && "text-destructive",
                                  !isMarked && suggestion.priority === 'medium' && "text-metric-warning",
                                  !isMarked && suggestion.priority === 'low' && "text-primary"
                                )} />
                              </motion.div>
                              <div className="space-y-1">
                                <p className={cn(
                                  "font-medium transition-all duration-300",
                                  isMarked && existingAction?.action_type === 'applied' && "line-through decoration-metric-positive/50"
                                )}>{suggestion.title}</p>
                                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                                <p className="text-xs text-muted-foreground/80 italic flex items-center gap-1">
                                  <Info className="w-3 h-3" />
                                  {suggestion.reason}
                                </p>
                                {/* Show reason if marked - animated */}
                                <AnimatePresence>
                                  {isMarked && existingAction.reason && (
                                    <motion.p 
                                      className="text-xs text-primary/80 mt-2 p-2 bg-primary/5 rounded"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <span className="font-medium">Nota:</span> {existingAction.reason}
                                    </motion.p>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-3">
                              <AnimatePresence mode="wait">
                                {!isMarked && (
                                  <motion.div
                                    key="priority"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    {getPriorityBadge(suggestion.priority)}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              
                              {/* Action buttons - animated */}
                              <AnimatePresence mode="wait">
                                {isMarked ? (
                                  <motion.div
                                    key="undo"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-8 text-muted-foreground hover:text-foreground"
                                      onClick={() => removeMark(suggestion.title)}
                                    >
                                      Desfazer
                                    </Button>
                                  </motion.div>
                                ) : (
                                  <motion.div 
                                    key="actions"
                                    className="flex items-center gap-2 bg-muted/50 rounded-full p-1"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <button
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-transparent hover:bg-metric-positive/20 text-muted-foreground hover:text-metric-positive active:scale-95"
                                      onClick={() => {
                                        setSelectedSuggestion({ title: suggestion.title, actionType: 'applied' });
                                        setActionDialogOpen(true);
                                      }}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Aplicar
                                    </button>
                                    <div className="w-px h-4 bg-border" />
                                    <button
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95"
                                      onClick={() => {
                                        setSelectedSuggestion({ title: suggestion.title, actionType: 'ignored' });
                                        setActionDialogOpen(true);
                                      }}
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      Ignorar
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    
                    {/* Empty state when filters return no results */}
                    {data.suggestions.filter(suggestion => {
                      if (priorityFilter !== 'all' && suggestion.priority !== priorityFilter) return false;
                      const action = getActionForSuggestion(suggestion.title);
                      if (statusFilter === 'pending' && action) return false;
                      if (statusFilter === 'applied' && action?.action_type !== 'applied') return false;
                      if (statusFilter === 'ignored' && action?.action_type !== 'ignored') return false;
                      return true;
                    }).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Filter className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Nenhuma sugestão encontrada</p>
                        <p className="text-sm mt-1">Ajuste os filtros para ver mais sugestões</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setPriorityFilter('all');
                            setStatusFilter('all');
                          }}
                        >
                          Limpar filtros
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Last Updated */}
              <div className="text-center text-sm text-muted-foreground pb-4">
                Última atualização: {new Date(data.generatedAt).toLocaleString('pt-BR')}
              </div>
            </>
          )}
        </div>
      </TooltipProvider>
      
      {/* Suggestion Action Dialog */}
      {selectedSuggestion && (
        <SuggestionActionDialog
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          suggestionTitle={selectedSuggestion.title}
          actionType={selectedSuggestion.actionType}
          onConfirm={(reason) => {
            markSuggestion(selectedSuggestion.title, selectedSuggestion.actionType, reason);
            setSelectedSuggestion(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
