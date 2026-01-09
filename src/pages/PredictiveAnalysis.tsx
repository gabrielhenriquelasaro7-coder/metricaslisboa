import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { usePredictiveAnalysis, CampaignGoal, OptimizationSuggestion } from '@/hooks/usePredictiveAnalysis';
import { useCampaignGoals } from '@/hooks/useCampaignGoals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PredictiveSkeleton } from '@/components/skeletons';
import { generatePredictiveReportPDF } from '@/components/pdf/PredictiveReportPDF';
import { CampaignGoalsConfig } from '@/components/predictive/CampaignGoalsConfig';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
} from 'recharts';

export default function PredictiveAnalysis() {
  const projectId = localStorage.getItem('selectedProjectId');
  const { data, loading, error, fetchAnalysis } = usePredictiveAnalysis(projectId);
  const { goals, fetchGoals } = useCampaignGoals(projectId);
  const [goalsVersion, setGoalsVersion] = useState(0);

  // Build campaign goals from saved data
  const campaignGoals: CampaignGoal[] = useMemo(() => {
    console.log('[PredictiveAnalysis] Building campaignGoals from:', goals);
    return goals.map(g => ({
      campaignId: g.campaign_id,
      targetCpl: g.target_cpl || undefined,
      targetRoas: g.target_roas || undefined,
      targetLeads: g.target_leads || undefined,
    }));
  }, [goals]);

  // Stringify goals for comparison to detect any changes (not just length)
  const goalsHash = useMemo(() => JSON.stringify(goals), [goals]);

  useEffect(() => {
    if (projectId) {
      console.log('[PredictiveAnalysis] Fetching analysis with campaignGoals:', campaignGoals);
      fetchAnalysis(campaignGoals);
    }
  }, [projectId, goalsHash, goalsVersion]);

  const handleGoalsSaved = async () => {
    // Refetch goals first, then trigger analysis refresh
    await fetchGoals();
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
                <CampaignGoalsConfig
                  projectId={projectId}
                  campaigns={data.campaignGoalsProgress.map(c => ({
                    campaignId: c.campaignId,
                    campaignName: c.campaignName,
                    spend: c.spend,
                  }))}
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
                onClick={() => fetchAnalysis(campaignGoals)} 
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
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Simple Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <p className="text-sm text-muted-foreground mb-1">💰 Gasto Total</p>
                      <p className="text-2xl font-bold text-blue-500">{formatCurrency(data.totals.spend30Days)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                      <p className="text-sm text-muted-foreground mb-1">🎯 {showCPL ? 'Leads' : 'Resultados'}</p>
                      <p className="text-2xl font-bold text-green-500">{formatNumber(data.totals.conversions30Days)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <p className="text-sm text-muted-foreground mb-1">📊 CPL Médio</p>
                      <p className="text-2xl font-bold text-purple-500">
                        {data.totals.conversions30Days > 0 
                          ? formatCurrency(data.totals.spend30Days / data.totals.conversions30Days)
                          : 'R$ 0'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <p className="text-sm text-muted-foreground mb-1">📅 Média/Dia</p>
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
                          <span className="text-lg">🏆</span>
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
                          <span className="text-lg">⚠️</span>
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

                  {/* Simplified Chart - Just bars for results */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      📈 <strong>{showCPL ? 'Leads' : 'Resultados'} por dia</strong> — barras maiores = mais resultados
                    </p>
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
                            tick={{ fontSize: 11 }} 
                            tickLine={false}
                            axisLine={false}
                            width={40}
                            allowDecimals={false}
                            domain={[0, 'dataMax']}
                          />
                          <ChartTooltip 
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0]?.payload;
                              return (
                                <div className="bg-popover border rounded-lg shadow-lg p-3 space-y-1">
                                  <p className="font-semibold">{d?.date}</p>
                                  <p className="text-green-500">🎯 {d?.conversions} {showCPL ? 'leads' : 'resultados'}</p>
                                  <p className="text-blue-500">💰 R$ {d?.spend?.toFixed(2)}</p>
                                  <p className="text-purple-500">
                                    📊 CPL: R$ {d?.conversions > 0 ? (d.spend / d.conversions).toFixed(2) : '0'}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="conversions"
                            name={showCPL ? "Leads" : "Resultados"}
                            fill="hsl(142, 76%, 36%)"
                            radius={[4, 4, 0, 0]}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Simplified Future Projection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    O Que Esperar nos Próximos Dias
                  </CardTitle>
                  <CardDescription>
                    Projeção baseada na média dos últimos 30 dias
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Simple Projection Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 7 Days Projection */}
                    <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <h3 className="font-semibold text-lg">Próximos 7 Dias</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">💰 Gasto estimado</span>
                          <span className="font-bold text-xl">{formatCurrency(data.predictions.next7Days.estimatedSpend)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🎯 {showCPL ? 'Leads' : 'Resultados'} esperados</span>
                          <span className="font-bold text-xl text-green-500">{formatNumber(data.predictions.next7Days.estimatedConversions)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border/50">
                          <span className="text-muted-foreground">📊 CPL projetado</span>
                          <span className="font-bold text-purple-500">
                            {data.predictions.next7Days.estimatedConversions > 0 
                              ? formatCurrency(data.predictions.next7Days.estimatedSpend / data.predictions.next7Days.estimatedConversions)
                              : 'R$ 0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 30 Days Projection */}
                    <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-purple-500" />
                        <h3 className="font-semibold text-lg">Próximos 30 Dias</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">💰 Gasto estimado</span>
                          <span className="font-bold text-xl">{formatCurrency(data.predictions.next30Days.estimatedSpend)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🎯 {showCPL ? 'Leads' : 'Resultados'} esperados</span>
                          <span className="font-bold text-xl text-green-500">{formatNumber(data.predictions.next30Days.estimatedConversions)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border/50">
                          <span className="text-muted-foreground">📊 CPL projetado</span>
                          <span className="font-bold text-purple-500">
                            {data.predictions.next30Days.estimatedConversions > 0 
                              ? formatCurrency(data.predictions.next30Days.estimatedSpend / data.predictions.next30Days.estimatedConversions)
                              : 'R$ 0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Simple Visual: How many leads per day expected */}
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-center text-muted-foreground mb-4">
                      📈 Projeção diária: <strong className="text-foreground">{formatNumber(data.predictions.trends.avgDailyConversions)} {showCPL ? 'leads' : 'resultados'}</strong> por dia
                    </p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {Array.from({ length: Math.min(Math.round(data.predictions.trends.avgDailyConversions), 10) }).map((_, i) => (
                        <div 
                          key={i}
                          className="w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center text-green-500 text-sm font-bold"
                        >
                          🎯
                        </div>
                      ))}
                      {Math.round(data.predictions.trends.avgDailyConversions) > 10 && (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center text-green-500 text-xs font-bold">
                          +{Math.round(data.predictions.trends.avgDailyConversions) - 10}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Goals Progress - Show all campaigns */}
              {data.campaignGoalsProgress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Metas por Campanha (30 dias)
                    </CardTitle>
                    <CardDescription>
                      {data.campaignGoalsProgress.filter(c => c.hasCustomGoal).length > 0 
                        ? 'Progresso em relação às metas configuradas'
                        : 'Configure metas para acompanhar o progresso das campanhas'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.campaignGoalsProgress
                        .filter(c => c.spend > 0)
                        .sort((a, b) => b.spend - a.spend)
                        .slice(0, 8)
                        .map((campaign) => (
                          <div key={campaign.campaignId} className="p-4 rounded-lg bg-muted/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate max-w-[280px]">
                                  {campaign.campaignName}
                                </span>
                                {campaign.hasCustomGoal && (
                                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Meta definida
                                  </Badge>
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {formatCurrency(campaign.spend)} investido
                              </span>
                            </div>
                            
                            <div className="grid gap-4 grid-cols-1">
                              {/* Leads Progress - Show if target is set */}
                              {campaign.targetLeads && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(campaign.leadsStatus)}
                                      Meta de Leads
                                    </span>
                                    <span className={cn(
                                      "font-medium",
                                      campaign.leadsStatus === 'success' && "text-metric-positive",
                                      campaign.leadsStatus === 'warning' && "text-metric-warning",
                                      campaign.leadsStatus === 'critical' && "text-destructive"
                                    )}>
                                      {formatNumber(campaign.conversions)} leads
                                      <span className="text-muted-foreground font-normal"> / {formatNumber(campaign.targetLeads)} meta</span>
                                    </span>
                                  </div>
                                  {campaign.leadsProgress !== null && (
                                    <Progress 
                                      value={campaign.leadsProgress} 
                                      className={cn(
                                        "h-2",
                                        campaign.leadsStatus === 'success' && "[&>div]:bg-metric-positive",
                                        campaign.leadsStatus === 'warning' && "[&>div]:bg-metric-warning",
                                        campaign.leadsStatus === 'critical' && "[&>div]:bg-destructive"
                                      )}
                                    />
                                  )}
                                </div>
                              )}

                              {/* CPL Progress - Show if custom target is set */}
                              {campaign.hasCustomGoal && campaign.cplProgress !== null && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(campaign.cplStatus)}
                                      Meta de CPL
                                    </span>
                                    <span className={cn(
                                      "font-medium",
                                      campaign.cplStatus === 'success' && "text-metric-positive",
                                      campaign.cplStatus === 'warning' && "text-metric-warning",
                                      campaign.cplStatus === 'critical' && "text-destructive"
                                    )}>
                                      {campaign.cpl !== null ? formatCurrency(campaign.cpl) : '-'}
                                      <span className="text-muted-foreground font-normal"> / {formatCurrency(campaign.targetCpl || 0)}</span>
                                    </span>
                                  </div>
                                  <Progress 
                                    value={campaign.cplProgress} 
                                    className={cn(
                                      "h-2",
                                      campaign.cplStatus === 'success' && "[&>div]:bg-metric-positive",
                                      campaign.cplStatus === 'warning' && "[&>div]:bg-metric-warning",
                                      campaign.cplStatus === 'critical' && "[&>div]:bg-destructive"
                                    )}
                                  />
                                </div>
                              )}

                              {/* ROAS Progress - Show if custom target is set */}
                              {campaign.hasCustomGoal && campaign.roasProgress !== null && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(campaign.roasStatus)}
                                      Meta de ROAS
                                    </span>
                                    <span className={cn(
                                      "font-medium",
                                      campaign.roasStatus === 'success' && "text-metric-positive",
                                      campaign.roasStatus === 'warning' && "text-metric-warning",
                                      campaign.roasStatus === 'critical' && "text-destructive"
                                    )}>
                                      {campaign.roas !== null ? `${campaign.roas.toFixed(2)}x` : '-'}
                                      <span className="text-muted-foreground font-normal"> / {campaign.targetRoas}x</span>
                                    </span>
                                  </div>
                                  <Progress 
                                    value={campaign.roasProgress} 
                                    className={cn(
                                      "h-2",
                                      campaign.roasStatus === 'success' && "[&>div]:bg-metric-positive",
                                      campaign.roasStatus === 'warning' && "[&>div]:bg-metric-warning",
                                      campaign.roasStatus === 'critical' && "[&>div]:bg-destructive"
                                    )}
                                  />
                                </div>
                              )}

                              {/* Show basic metrics if no custom goal */}
                              {!campaign.hasCustomGoal && (
                                <div className="text-sm text-muted-foreground">
                                  <p>
                                    {formatNumber(campaign.conversions)} {showCPL ? 'leads' : 'conversões'} • 
                                    CPL: {campaign.cpl ? formatCurrency(campaign.cpl) : '-'} • 
                                    CTR: {campaign.ctr?.toFixed(2) || 0}%
                                  </p>
                                  <p className="text-xs mt-1 italic">
                                    Clique em "Configurar Metas" para definir metas para esta campanha
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Additional metrics for campaigns with goals */}
                            {campaign.hasCustomGoal && (
                              <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
                                <span>{formatNumber(campaign.conversions)} {showCPL ? 'leads' : 'conversões'}</span>
                                <span>CPL atual: {campaign.cpl ? formatCurrency(campaign.cpl) : '-'}</span>
                                <span>CTR: {campaign.ctr?.toFixed(2) || 0}%</span>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Suggestions - Improved */}
              <Card>
                <CardHeader>
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
                        fetchAnalysis(campaignGoals);
                        toast.info('Atualizando análise...');
                      }}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                      Atualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.suggestions.map((suggestion, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "p-4 rounded-lg border transition-colors",
                          suggestion.priority === 'high' && "bg-destructive/5 border-destructive/20",
                          suggestion.priority === 'medium' && "bg-metric-warning/5 border-metric-warning/20",
                          suggestion.priority === 'low' && "bg-muted/50 border-border"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <Zap className={cn(
                              "w-5 h-5 mt-0.5 flex-shrink-0",
                              suggestion.priority === 'high' && "text-destructive",
                              suggestion.priority === 'medium' && "text-metric-warning",
                              suggestion.priority === 'low' && "text-primary"
                            )} />
                            <div className="space-y-1">
                              <p className="font-medium">{suggestion.title}</p>
                              <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                              <p className="text-xs text-muted-foreground/80 italic flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                {suggestion.reason}
                              </p>
                            </div>
                          </div>
                          {getPriorityBadge(suggestion.priority)}
                        </div>
                      </div>
                    ))}
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
    </DashboardLayout>
  );
}
