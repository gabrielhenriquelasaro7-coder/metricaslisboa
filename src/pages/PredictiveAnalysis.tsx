import { useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { usePredictiveAnalysis } from '@/hooks/usePredictiveAnalysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  Minus
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

  useEffect(() => {
    if (projectId) {
      fetchAnalysis();
    }
  }, [projectId, fetchAnalysis]);

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

  if (!projectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Selecione um projeto primeiro</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-primary" />
              Análise Preditiva
            </h1>
            <p className="text-muted-foreground mt-1">
              Previsões de gasto, conversões e alertas de orçamento
            </p>
          </div>
          <Button 
            onClick={fetchAnalysis} 
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar Análise
          </Button>
        </div>

        {loading && !data && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
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
            {/* Prediction Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* 7-Day Spend Prediction */}
              <Card className="bg-gradient-to-br from-card to-card/80">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Previsão 7 dias
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
              <Card className="bg-gradient-to-br from-card to-card/80">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Conversões Estimadas
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(data.predictions.next7Days.estimatedConversions)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    ~{formatNumber(data.predictions.trends.avgDailyConversions)}/dia
                  </div>
                </CardContent>
              </Card>

              {/* 30-Day Spend Prediction */}
              <Card className="bg-gradient-to-br from-card to-card/80">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Previsão 30 dias
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCurrency(data.predictions.next30Days.estimatedSpend)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    ~{formatCurrency(data.predictions.trends.avgDailySpend)}/dia
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Prediction */}
              <Card className="bg-gradient-to-br from-card to-card/80">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Receita Estimada (30d)
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCurrency(data.predictions.next30Days.estimatedRevenue)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    ROAS previsto: {(data.predictions.next30Days.estimatedRevenue / 
                      Math.max(data.predictions.next30Days.estimatedSpend, 1)).toFixed(2)}x
                  </div>
                </CardContent>
              </Card>
            </div>

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
                    Gasto diário e conversões
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

            {/* AI Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-metric-warning" />
                  Sugestões de Otimização
                </CardTitle>
                <CardDescription>
                  Recomendações baseadas em análise de dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {data.suggestions.map((suggestion, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{suggestion}</p>
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
    </DashboardLayout>
  );
}
