import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { usePredictiveAnalysis, CampaignGoal, OptimizationSuggestion } from '@/hooks/usePredictiveAnalysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { generatePredictiveReportPDF } from '@/components/pdf/PredictiveReportPDF';
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
  XCircle
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
  const [campaignGoals, setCampaignGoals] = useState<CampaignGoal[]>([]);

  useEffect(() => {
    if (projectId) {
      fetchAnalysis(campaignGoals);
    }
  }, [projectId]);

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
  const isInsideSales = data?.project.businessModel === 'inside_sales';
  const isEcommerce = data?.project.businessModel === 'ecommerce' || data?.project.businessModel === 'pdv';
  const isCustom = data?.project.businessModel === 'custom';

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-8 px-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-primary" />
                Análise Preditiva
              </h1>
              <p className="text-muted-foreground mt-1">
                Previsões de gasto, conversões, metas e alertas de orçamento
              </p>
            </div>
            <div className="flex gap-2">
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
                        <p className="text-sm text-muted-foreground mt-1">
                          {data.accountBalance.lastUpdated 
                            ? `Atualizado: ${new Date(data.accountBalance.lastUpdated).toLocaleString('pt-BR')}`
                            : 'Saldo não disponível via API'
                          }
                        </p>
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
                      {data.accountBalance.status === 'critical' && (
                        <p className="text-sm text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Recarregue sua conta urgentemente!
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Prediction Cards - With proper spacing and margins */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 p-1">
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

                {/* 7-Day Conversions Prediction */}
                <Card className="bg-gradient-to-br from-card to-card/80 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Conversões Estimadas (7d)
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Projeção de conversões para os próximos 7 dias</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardDescription>
                    <CardTitle className="text-2xl">
                      {formatNumber(data.predictions.next7Days.estimatedConversions)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      ~{formatNumber(data.predictions.trends.avgDailyConversions)} conversões/dia
                    </div>
                  </CardContent>
                </Card>

                {/* CPL for Inside Sales / ROAS for Ecommerce / Both for Custom */}
                {(isInsideSales || isCustom) && (
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

                {(isEcommerce || isCustom) && (
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

                {/* 30-Day Revenue Prediction */}
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
              </div>

              {/* Totals Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Resumo dos Últimos 30 Dias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Gasto Total</p>
                      <p className="text-xl font-semibold">{formatCurrency(data.totals.spend30Days)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversões</p>
                      <p className="text-xl font-semibold">{formatNumber(data.totals.conversions30Days)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Receita</p>
                      <p className="text-xl font-semibold">{formatCurrency(data.totals.revenue30Days)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cliques</p>
                      <p className="text-xl font-semibold">{formatNumber(data.totals.clicks30Days)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Impressões</p>
                      <p className="text-xl font-semibold">{formatNumber(data.totals.impressions30Days)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts and Alerts Row */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Trend Chart */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Tendência dos Últimos 30 Dias
                    </CardTitle>
                    <CardDescription>
                      Gasto diário e conversões ao longo do tempo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
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
                            name="Conversões"
                            fill="hsl(var(--metric-positive))"
                            radius={[4, 4, 0, 0]}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Budget Alerts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-metric-warning" />
                      Alertas de Orçamento
                    </CardTitle>
                    <CardDescription>
                      Campanhas com orçamento baixo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.budgetAlerts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma campanha com orçamento configurado
                      </p>
                    ) : (
                      data.budgetAlerts
                        .filter(alert => alert.lifetimeBudget > 0)
                        .sort((a, b) => (a.daysRemaining || 999) - (b.daysRemaining || 999))
                        .slice(0, 5)
                        .map((alert) => (
                          <div key={alert.campaignId} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate max-w-[180px]">
                                {alert.campaignName}
                              </span>
                              <Badge variant={
                                alert.budgetStatus === 'critical' ? 'destructive' :
                                alert.budgetStatus === 'warning' ? 'secondary' : 'outline'
                              }>
                                {alert.daysRemaining !== null 
                                  ? `${alert.daysRemaining}d restantes`
                                  : 'OK'
                                }
                              </Badge>
                            </div>
                            {alert.percentUsed !== null && (
                              <div className="space-y-1">
                                <Progress 
                                  value={Math.min(alert.percentUsed, 100)} 
                                  className={cn(
                                    "h-2",
                                    alert.budgetStatus === 'critical' && "[&>div]:bg-destructive",
                                    alert.budgetStatus === 'warning' && "[&>div]:bg-metric-warning"
                                  )}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>{formatCurrency(alert.currentSpend)}</span>
                                  <span>{formatCurrency(alert.lifetimeBudget)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Campaign Goals Progress - Adapted by business model */}
              {data.campaignGoalsProgress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Metas por Campanha (30 dias)
                    </CardTitle>
                    <CardDescription>
                      {isInsideSales 
                        ? 'Progresso de CPL em relação às metas'
                        : isEcommerce 
                          ? 'Progresso de ROAS em relação às metas'
                          : 'Progresso de ROAS e CPL em relação às metas'
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
                            
                            <div className={cn(
                              "grid gap-4",
                              isCustom ? "grid-cols-2" : "grid-cols-1"
                            )}>
                              {/* CPL Progress - Show for Inside Sales and Custom */}
                              {(isInsideSales || isCustom) && (
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

                              {/* ROAS Progress - Show for Ecommerce and Custom */}
                              {(isEcommerce || isCustom) && (
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
                              <span>{formatNumber(campaign.conversions)} {isInsideSales ? 'leads' : 'conversões'}</span>
                              {(isEcommerce || isCustom) && (
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
              <div className="text-center text-sm text-muted-foreground">
                Última atualização: {new Date(data.generatedAt).toLocaleString('pt-BR')}
              </div>
            </>
          )}
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
