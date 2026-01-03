import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { usePredictiveAnalysis, CampaignGoal, OptimizationSuggestion } from '@/hooks/usePredictiveAnalysis';
import { useCampaignGoals } from '@/hooks/useCampaignGoals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Bar,
} from 'recharts';

export default function PredictiveAnalysis() {
  const projectId = localStorage.getItem('selectedProjectId');
  const { data, loading, error, fetchAnalysis } = usePredictiveAnalysis(projectId);
  const { goals } = useCampaignGoals(projectId);

  // Build campaign goals from saved data
  const campaignGoals: CampaignGoal[] = useMemo(() => {
    return goals.map(g => ({
      campaignId: g.campaign_id,
      targetCpl: g.target_cpl || undefined,
      targetRoas: g.target_roas || undefined,
    }));
  }, [goals]);

  useEffect(() => {
    if (projectId) {
      fetchAnalysis(campaignGoals);
    }
  }, [projectId, goals.length]);

  const handleGoalsSaved = () => {
    // Refetch analysis with updated goals
    fetchAnalysis(campaignGoals);
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
    return data.dailyTrend.map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    }));
  }, [data]);

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
                Análise Preditiva
              </h1>
              <p className="text-muted-foreground mt-1">
                Previsões baseadas nos dados dos últimos 30 dias
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

          {/* Explanation Card */}
          <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-primary/10">
                  <HelpCircle className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold">O que é a Análise Preditiva?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Esta ferramenta analisa os dados de performance dos últimos 30 dias para projetar 
                    resultados futuros. Use as metas personalizadas para acompanhar o progresso de cada 
                    campanha em relação aos seus objetivos.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium text-foreground">Previsão 7 dias</p>
                      <p className="text-muted-foreground text-xs">Estimativa de gasto baseada na média dos últimos 7 dias</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium text-foreground">{showCPL ? 'Leads Estimados' : 'Conversões Estimadas'}</p>
                      <p className="text-muted-foreground text-xs">Projeção de {showCPL ? 'leads' : 'conversões'} para os próximos 7 e 30 dias</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium text-foreground">{showCPL ? 'CPL Médio' : 'ROAS Médio'}</p>
                      <p className="text-muted-foreground text-xs">{showCPL ? 'Custo médio por lead nos últimos 7 dias' : 'Retorno sobre investimento nos últimos 7 dias'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium text-foreground">{showCPL ? 'Leads 30d' : 'Receita 30d'}</p>
                      <p className="text-muted-foreground text-xs">Projeção de {showCPL ? 'leads' : 'receita'} e gasto para os próximos 30 dias</p>
                    </div>
                  </div>
                  {data && (
                    <Badge variant="outline" className="mt-2">
                      Modelo: {getBusinessModelLabel(data.project.businessModel)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {loading && !data && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
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
              {/* Account Balance - Hero Card */}
              <Card className={cn(
                "bg-gradient-to-br border-2",
                data.accountBalance.status === 'critical' && "from-destructive/10 to-background border-destructive/50",
                data.accountBalance.status === 'warning' && "from-metric-warning/10 to-background border-metric-warning/50",
                data.accountBalance.status === 'healthy' && "from-metric-positive/10 to-background border-metric-positive/50",
                data.accountBalance.status === 'unknown' && "from-muted/50 to-background border-border"
              )}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-4 rounded-full",
                        data.accountBalance.status === 'critical' && "bg-destructive/20",
                        data.accountBalance.status === 'warning' && "bg-metric-warning/20",
                        data.accountBalance.status === 'healthy' && "bg-metric-positive/20",
                        data.accountBalance.status === 'unknown' && "bg-muted"
                      )}>
                        <Wallet className={cn(
                          "w-8 h-8",
                          getBalanceStatusColor(data.accountBalance.status)
                        )} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Saldo da Conta Meta Ads</p>
                        <p className={cn(
                          "text-3xl font-bold",
                          getBalanceStatusColor(data.accountBalance.status)
                        )}>
                          {formatCurrency(data.accountBalance.balance)}
                        </p>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <p className="text-sm text-muted-foreground">
                            {data.accountBalance.lastUpdated 
                              ? `Atualizado: ${new Date(data.accountBalance.lastUpdated).toLocaleString('pt-BR')}`
                              : 'Saldo não disponível via API'
                            }
                          </p>
                          {data.accountBalance.autoReloadEnabled && (
                            <p className="text-xs text-metric-positive flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Recarga automática ativa
                              {data.accountBalance.autoReloadThreshold && (
                                <span className="text-muted-foreground">
                                  (quando atingir {formatCurrency(data.accountBalance.autoReloadThreshold)})
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      {data.accountBalance.daysOfSpendRemaining !== null && (
                        <>
                          <Badge variant={
                            data.accountBalance.status === 'critical' ? 'destructive' :
                            data.accountBalance.status === 'warning' ? 'secondary' : 'outline'
                          } className="text-sm px-3 py-1">
                            {data.accountBalance.daysOfSpendRemaining} dias de saldo restante
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Baseado no gasto médio de {formatCurrency(data.predictions.trends.avgDailySpend)}/dia
                          </p>
                        </>
                      )}
                      {data.accountBalance.status === 'critical' && !data.accountBalance.autoReloadEnabled && (
                        <p className="text-sm text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Recarregue urgentemente!
                        </p>
                      )}
                      {data.accountBalance.status === 'critical' && data.accountBalance.autoReloadEnabled && (
                        <p className="text-sm text-metric-warning font-medium flex items-center gap-1">
                          <Info className="w-4 h-4" />
                          Aguardando recarga automática
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Prediction Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* 7-Day Spend Prediction */}
                <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Previsão 7 dias
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Estimativa baseada na média dos últimos 7 dias</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardDescription>
                    <CardTitle className="text-2xl">
                      {formatCurrency(data.predictions.next7Days.estimatedSpend)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      {getTrendIcon(data.predictions.trends.spendTrend)}
                      <span className={cn(
                        data.predictions.trends.spendTrend > 0 ? 'text-metric-positive' : 
                        data.predictions.trends.spendTrend < 0 ? 'text-metric-negative' : 'text-muted-foreground'
                      )}>
                        {data.predictions.trends.spendTrend > 0 ? '+' : ''}
                        {data.predictions.trends.spendTrend.toFixed(1)}% vs semana anterior
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 7-Day Conversions/Leads Prediction */}
                <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      {showCPL ? 'Leads Estimados (7d)' : 'Conversões Estimadas (7d)'}
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Projeção para os próximos 7 dias</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardDescription>
                    <CardTitle className="text-2xl">
                      {formatNumber(data.predictions.next7Days.estimatedConversions)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      ~{formatNumber(data.predictions.trends.avgDailyConversions)} {showCPL ? 'leads' : 'conversões'}/dia
                    </div>
                  </CardContent>
                </Card>

                {/* CPL for Inside Sales and Custom */}
                {showCPL && (
                  <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        CPL Médio
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Custo por lead/conversão</p>
                          </TooltipContent>
                        </Tooltip>
                      </CardDescription>
                      <CardTitle className="text-2xl">
                        {formatCurrency(data.predictions.trends.avgDailyCpl || 0)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Meta recomendada: R$ 30 ou inferior
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ROAS for E-commerce/PDV only */}
                {showROAS && (
                  <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        ROAS Médio
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Retorno sobre investimento em anúncios</p>
                          </TooltipContent>
                        </Tooltip>
                      </CardDescription>
                      <CardTitle className="text-2xl">
                        {(data.predictions.trends.avgDailyRoas || 0).toFixed(2)}x
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Meta recomendada: 3x ou superior
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 30-Day Revenue Prediction - Only for Ecommerce/PDV */}
                {showROAS && (
                  <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Receita Estimada (30d)
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Projeção de receita para os próximos 30 dias</p>
                          </TooltipContent>
                        </Tooltip>
                      </CardDescription>
                      <CardTitle className="text-2xl">
                        {formatCurrency(data.predictions.next30Days.estimatedRevenue)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Gasto previsto: {formatCurrency(data.predictions.next30Days.estimatedSpend)}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 30-Day Leads Prediction - For Inside Sales and Custom */}
                {showCPL && (
                  <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Leads Estimados (30d)
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Projeção de leads para os próximos 30 dias</p>
                          </TooltipContent>
                        </Tooltip>
                      </CardDescription>
                      <CardTitle className="text-2xl">
                        {formatNumber(data.predictions.next30Days.estimatedConversions)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Gasto previsto: {formatCurrency(data.predictions.next30Days.estimatedSpend)}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Totals Summary - Adapted by business model */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Resumo dos Últimos 30 Dias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "grid gap-6",
                    showROAS ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"
                  )}>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Gasto Total</p>
                      <p className="text-xl font-semibold">{formatCurrency(data.totals.spend30Days)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{showCPL ? 'Leads' : 'Conversões'}</p>
                      <p className="text-xl font-semibold">{formatNumber(data.totals.conversions30Days)}</p>
                    </div>
                    {showROAS && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Receita</p>
                        <p className="text-xl font-semibold">{formatCurrency(data.totals.revenue30Days)}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Cliques</p>
                      <p className="text-xl font-semibold">{formatNumber(data.totals.clicks30Days)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Impressões</p>
                      <p className="text-xl font-semibold">{formatNumber(data.totals.impressions30Days)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts Row - Trend Chart Full Width */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Tendência dos Últimos 30 Dias
                  </CardTitle>
                  <CardDescription>
                    Gasto diário e {showCPL ? 'leads' : 'conversões'} ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[350px] w-full !aspect-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          yAxisId="left"
                          tick={{ fontSize: 12 }} 
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12 }} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="spend"
                          name="Gasto"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.2}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="conversions"
                          name={showCPL ? "Leads" : "Conversões"}
                          fill="hsl(var(--metric-positive))"
                          radius={[4, 4, 0, 0]}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Future Projection Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Projeção Futura (7 e 30 dias)
                  </CardTitle>
                  <CardDescription>
                    Estimativa de gasto e {showCPL ? 'leads' : 'conversões'} com base nos dados históricos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Build projection data
                    const today = new Date();
                    const projectionData = [];
                    
                    // Last 7 days of historical data
                    const last7Days = chartData.slice(-7);
                    last7Days.forEach((d, i) => {
                      projectionData.push({
                        date: d.date,
                        spend: d.spend,
                        conversions: d.conversions,
                        type: 'historical'
                      });
                    });
                    
                    // Projection for next 7 days
                    const avgDailySpend = data.predictions.trends.avgDailySpend;
                    const avgDailyConversions = data.predictions.trends.avgDailyConversions;
                    
                    for (let i = 1; i <= 7; i++) {
                      const projDate = new Date(today);
                      projDate.setDate(projDate.getDate() + i);
                      projectionData.push({
                        date: projDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                        projectedSpend: avgDailySpend,
                        projectedConversions: avgDailyConversions,
                        type: 'projection'
                      });
                    }
                    
                    const projectionConfig = {
                      spend: { label: 'Gasto Real', color: 'hsl(var(--primary))' },
                      projectedSpend: { label: 'Gasto Projetado', color: 'hsl(var(--primary))' },
                      conversions: { label: showCPL ? 'Leads Reais' : 'Conversões Reais', color: 'hsl(var(--metric-positive))' },
                      projectedConversions: { label: showCPL ? 'Leads Projetados' : 'Conversões Projetadas', color: 'hsl(var(--metric-positive))' },
                    };
                    
                    return (
                      <ChartContainer config={projectionConfig} className="h-[300px] w-full !aspect-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={projectionData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              axisLine={false}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            {/* Historical Data - Solid Lines */}
                            <Area
                              yAxisId="left"
                              type="monotone"
                              dataKey="spend"
                              name="Gasto Real"
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary))"
                              fillOpacity={0.2}
                              connectNulls={false}
                            />
                            <Bar
                              yAxisId="right"
                              dataKey="conversions"
                              name={showCPL ? "Leads Reais" : "Conversões Reais"}
                              fill="hsl(var(--metric-positive))"
                              radius={[4, 4, 0, 0]}
                            />
                            {/* Projected Data - Dashed Lines */}
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="projectedSpend"
                              name="Gasto Projetado"
                              stroke="hsl(var(--primary))"
                              strokeDasharray="8 4"
                              strokeWidth={3}
                              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                              connectNulls={false}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="projectedConversions"
                              name={showCPL ? "Leads Projetados" : "Conversões Projetadas"}
                              stroke="hsl(var(--metric-positive))"
                              strokeDasharray="8 4"
                              strokeWidth={3}
                              dot={{ fill: 'hsl(var(--metric-positive))', strokeWidth: 2 }}
                              connectNulls={false}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    );
                  })()}
                  <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0.5 bg-primary" />
                      <span>Dados históricos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0.5 bg-primary border-dashed" style={{ borderTop: '3px dashed hsl(var(--primary))' }} />
                      <span>Projeção futura</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
                    <div className="text-center p-4 rounded-lg bg-muted/30">
                      <p className="text-sm text-muted-foreground">Projeção 7 Dias</p>
                      <p className="text-xl font-bold text-primary">{formatCurrency(data.predictions.next7Days.estimatedSpend)}</p>
                      <p className="text-sm text-muted-foreground">{formatNumber(data.predictions.next7Days.estimatedConversions)} {showCPL ? 'leads' : 'conversões'}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/30">
                      <p className="text-sm text-muted-foreground">Projeção 30 Dias</p>
                      <p className="text-xl font-bold text-primary">{formatCurrency(data.predictions.next30Days.estimatedSpend)}</p>
                      <p className="text-sm text-muted-foreground">{formatNumber(data.predictions.next30Days.estimatedConversions)} {showCPL ? 'leads' : 'conversões'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Goals Progress - Adapted by business model */}
              {data.campaignGoalsProgress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Metas por Campanha (30 dias)
                    </CardTitle>
                    <CardDescription>
                      {showCPL 
                        ? 'Progresso de CPL em relação às metas'
                        : 'Progresso de ROAS em relação às metas'
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
                              <span className="font-medium truncate max-w-[300px]">
                                {campaign.campaignName}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatCurrency(campaign.spend)} investido
                              </span>
                            </div>
                            
                            <div className="grid gap-4 grid-cols-1">
                              {/* CPL Progress - Show for Inside Sales and Custom */}
                              {showCPL && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(campaign.cplStatus)}
                                      CPL
                                    </span>
                                    <span className={cn(
                                      "font-medium",
                                      campaign.cplStatus === 'success' && "text-metric-positive",
                                      campaign.cplStatus === 'warning' && "text-metric-warning",
                                      campaign.cplStatus === 'critical' && "text-destructive"
                                    )}>
                                      {campaign.cpl !== null ? formatCurrency(campaign.cpl) : '-'}
                                      <span className="text-muted-foreground font-normal"> / {formatCurrency(campaign.targetCpl)}</span>
                                    </span>
                                  </div>
                                  {campaign.cplProgress !== null && (
                                    <Progress 
                                      value={campaign.cplProgress} 
                                      className={cn(
                                        "h-2",
                                        campaign.cplStatus === 'success' && "[&>div]:bg-metric-positive",
                                        campaign.cplStatus === 'warning' && "[&>div]:bg-metric-warning",
                                        campaign.cplStatus === 'critical' && "[&>div]:bg-destructive"
                                      )}
                                    />
                                  )}
                                </div>
                              )}

                              {/* ROAS Progress - Show for Ecommerce only */}
                              {showROAS && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(campaign.roasStatus)}
                                      ROAS
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
                                  {campaign.roasProgress !== null && (
                                    <Progress 
                                      value={campaign.roasProgress} 
                                      className={cn(
                                        "h-2",
                                        campaign.roasStatus === 'success' && "[&>div]:bg-metric-positive",
                                        campaign.roasStatus === 'warning' && "[&>div]:bg-metric-warning",
                                        campaign.roasStatus === 'critical' && "[&>div]:bg-destructive"
                                      )}
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Additional metrics - Adapted by business model */}
                            <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
                              <span>{formatNumber(campaign.conversions)} {showCPL ? 'leads' : 'conversões'}</span>
                              {showROAS && (
                                <span>{formatCurrency(campaign.conversion_value)} receita</span>
                              )}
                              <span>CTR: {campaign.ctr?.toFixed(2) || 0}%</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Suggestions - Improved */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-metric-warning" />
                    Sugestões de Otimização
                  </CardTitle>
                  <CardDescription>
                    Recomendações baseadas em análise dos seus dados
                  </CardDescription>
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
