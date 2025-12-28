import { useState, useMemo, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import PerformanceChart from '@/components/dashboard/PerformanceChart';
import PeriodComparison from '@/components/dashboard/PeriodComparison';
import { useProjects } from '@/hooks/useProjects';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { DateRange } from 'react-day-picker';
import { differenceInDays, format } from 'date-fns';
import { 
  DollarSign, 
  MousePointerClick, 
  Eye, 
  Target,
  TrendingUp,
  ShoppingCart,
  Users,
  Percent,
  Phone,
  Store,
  Loader2,
  GitCompare,
  RefreshCw,
  MoreVertical
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { projects, loading: projectsLoading } = useProjects();
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('last_7_days');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('last_7_days', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [showComparison, setShowComparison] = useState(true);

  // Get campaigns and selected project from hook (uses localStorage)
  const { campaigns, loading: dataLoading, syncing, syncData, selectedProject, loadMetricsByPeriod, getPeriodKeyFromDays } = useMetaAdsData();

  // Get active (non-archived) projects
  const activeProjects = useMemo(() => 
    projects.filter(p => !p.archived), 
    [projects]
  );

  // Determine business model - only show specific metrics when a project is selected
  const hasSelectedProject = selectedProject !== null && selectedProject !== undefined;
  const businessModel = selectedProject?.business_model;
  const projectTimezone = selectedProject?.timezone || 'America/Sao_Paulo';
  const isEcommerce = hasSelectedProject && businessModel === 'ecommerce';
  const isInsideSales = hasSelectedProject && businessModel === 'inside_sales';
  const isPdv = hasSelectedProject && businessModel === 'pdv';

  // Load metrics when date range changes - INSTANT from local database
  useEffect(() => {
    if (!selectedProject || !dateRange?.from || !dateRange?.to) return;
    
    const diffDays = differenceInDays(dateRange.to, dateRange.from);
    const periodKey = getPeriodKeyFromDays(diffDays);
    
    console.log(`[Dashboard] Loading period: ${periodKey}`);
    loadMetricsByPeriod(periodKey);
  }, [dateRange, selectedProject, loadMetricsByPeriod, getPeriodKeyFromDays]);

  // Handle date range change - NO sync, just load from database
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, []);

  // Handle preset change
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);

  // Manual sync
  const handleManualSync = useCallback(() => {
    if (dateRange?.from && dateRange?.to) {
      syncData({
        since: format(dateRange.from, 'yyyy-MM-dd'),
        until: format(dateRange.to, 'yyyy-MM-dd')
      });
    } else {
      syncData();
    }
  }, [dateRange, syncData]);

  const calculateMetrics = (campaignsList: typeof campaigns) => {
    const totalSpend = campaignsList.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalImpressions = campaignsList.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = campaignsList.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalReach = campaignsList.reduce((sum, c) => sum + (c.reach || 0), 0);
    const totalConversions = campaignsList.reduce((sum, c) => sum + (c.conversions || 0), 0);
    const totalConversionValue = campaignsList.reduce((sum, c) => sum + (c.conversion_value || 0), 0);

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const roas = totalSpend > 0 ? totalConversionValue / totalSpend : 0;
    const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalReach,
      totalConversions,
      totalConversionValue,
      ctr,
      cpm,
      cpc,
      cpa,
      roas,
      avgFrequency,
      campaignCount: campaignsList.length,
    };
  };

  const metrics = useMemo(() => {
    // Campaigns are already filtered by project in useMetaAdsData hook
    return calculateMetrics(campaigns);
  }, [campaigns]);

  // Calculate previous period metrics for comparison
  // This simulates previous period data - in production you'd fetch from DB with date filters
  const previousMetrics = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    
    // Calculate the length of current period
    const periodDays = differenceInDays(dateRange.to, dateRange.from);
    
    // Simulate previous period metrics (in real scenario, you'd query historical data)
    // For now, we'll use a variance to simulate changes
    const variance = () => 0.8 + Math.random() * 0.4; // 80% to 120% of current
    
    return {
      totalSpend: metrics.totalSpend * variance(),
      totalImpressions: metrics.totalImpressions * variance(),
      totalClicks: metrics.totalClicks * variance(),
      totalReach: metrics.totalReach * variance(),
      totalConversions: metrics.totalConversions * variance(),
      totalConversionValue: metrics.totalConversionValue * variance(),
      ctr: metrics.ctr * variance(),
      cpm: metrics.cpm * variance(),
      cpc: metrics.cpc * variance(),
      cpa: metrics.cpa * variance(),
      roas: metrics.roas * variance(),
      avgFrequency: metrics.avgFrequency * variance(),
      campaignCount: metrics.campaignCount,
    };
  }, [metrics, dateRange]);

  // Mock chart data based on actual metrics
  const chartData = useMemo(() => {
    return [
      { date: '01/12', value: metrics.totalSpend * 0.3, value2: metrics.roas * 0.8 },
      { date: '05/12', value: metrics.totalSpend * 0.5, value2: metrics.roas * 0.9 },
      { date: '10/12', value: metrics.totalSpend * 0.6, value2: metrics.roas * 0.95 },
      { date: '15/12', value: metrics.totalSpend * 0.7, value2: metrics.roas * 1.0 },
      { date: '20/12', value: metrics.totalSpend * 0.85, value2: metrics.roas * 1.05 },
      { date: '25/12', value: metrics.totalSpend * 0.95, value2: metrics.roas * 1.1 },
      { date: '28/12', value: metrics.totalSpend, value2: metrics.roas },
    ];
  }, [metrics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  const loading = projectsLoading || dataLoading;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral das suas campanhas</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <DateRangePicker
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={projectTimezone}
              onPresetChange={handlePresetChange}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleManualSync} disabled={syncing || !selectedProject}>
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                  {syncing ? 'Sincronizando...' : 'Forçar Sincronização'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Check if has projects */}
        {activeProjects.length === 0 && !loading ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Nenhum projeto ainda</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Crie seu primeiro projeto para começar a analisar suas campanhas de Meta Ads.
            </p>
            <Link to="/projects">
              <Button variant="gradient">Criar primeiro projeto</Button>
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Comparison Toggle */}
            <div className="flex items-center justify-end gap-2">
              <GitCompare className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="comparison-toggle" className="text-sm text-muted-foreground cursor-pointer">
                Comparar com período anterior
              </Label>
              <Switch
                id="comparison-toggle"
                checked={showComparison}
                onCheckedChange={setShowComparison}
              />
            </div>

            {/* Period Comparison */}
            {showComparison && hasSelectedProject && (
              <PeriodComparison
                currentMetrics={metrics}
                previousMetrics={previousMetrics}
                businessModel={businessModel || null}
              />
            )}

            {/* Metrics Grid - General Base Metrics */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Métricas Gerais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <MetricCard
                  title="CTR (Link)"
                  value={`${metrics.ctr.toFixed(2)}%`}
                  change={0}
                  changeLabel="vs período anterior"
                  icon={MousePointerClick}
                  trend="neutral"
                />
                <MetricCard
                  title="CPM"
                  value={formatCurrency(metrics.cpm)}
                  change={0}
                  changeLabel="vs período anterior"
                  icon={Eye}
                  trend="neutral"
                />
                <MetricCard
                  title="CPC (Link)"
                  value={formatCurrency(metrics.cpc)}
                  change={0}
                  changeLabel="vs período anterior"
                  icon={MousePointerClick}
                  trend="neutral"
                />
                <MetricCard
                  title="Cliques no Link"
                  value={formatNumber(metrics.totalClicks)}
                  change={0}
                  changeLabel="vs período anterior"
                  icon={Target}
                  trend="neutral"
                />
                <MetricCard
                  title="Gasto Total"
                  value={formatCurrency(metrics.totalSpend)}
                  change={0}
                  changeLabel="vs período anterior"
                  icon={DollarSign}
                  trend="neutral"
                />
                <MetricCard
                  title="Impressões"
                  value={formatNumber(metrics.totalImpressions)}
                  change={0}
                  changeLabel="vs período anterior"
                  icon={Eye}
                  trend="neutral"
                />
              </div>
            </div>

            {/* Result Metrics - Dynamic based on business model - Only show when a specific project is selected */}
            {hasSelectedProject && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                Métricas de Resultado 
                <span className="text-sm font-normal ml-2">
                  ({isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'})
                </span>
              </h2>
              
              {/* E-commerce Metrics */}
              {isEcommerce && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      title="ROAS"
                      value={`${metrics.roas.toFixed(2)}x`}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={TrendingUp}
                      trend="neutral"
                      className="border-l-4 border-l-metric-positive"
                    />
                    <MetricCard
                      title="Compras"
                      value={formatNumber(metrics.totalConversions)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={ShoppingCart}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Valor de Conversão"
                      value={formatCurrency(metrics.totalConversionValue)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={DollarSign}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Ticket Médio"
                      value={formatCurrency(metrics.totalConversions > 0 ? metrics.totalConversionValue / metrics.totalConversions : 0)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Target}
                      trend="neutral"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <MetricCard
                      title="CPA (Compra)"
                      value={formatCurrency(metrics.cpa)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Users}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Taxa de Conversão"
                      value={`${metrics.totalClicks > 0 ? ((metrics.totalConversions / metrics.totalClicks) * 100).toFixed(2) : 0}%`}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Percent}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Alcance"
                      value={formatNumber(metrics.totalReach)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Users}
                      trend="neutral"
                    />
                  </div>
                </>
              )}

              {/* Inside Sales Metrics */}
              {isInsideSales && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      title="Leads"
                      value={formatNumber(metrics.totalConversions)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Users}
                      trend="neutral"
                      className="border-l-4 border-l-chart-1"
                    />
                    <MetricCard
                      title="CPL (Custo por Lead)"
                      value={formatCurrency(metrics.cpa)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={DollarSign}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Taxa de Conversão"
                      value={`${metrics.totalClicks > 0 ? ((metrics.totalConversions / metrics.totalClicks) * 100).toFixed(2) : 0}%`}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Percent}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Alcance"
                      value={formatNumber(metrics.totalReach)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Users}
                      trend="neutral"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <MetricCard
                      title="Frequência Média"
                      value={metrics.avgFrequency.toFixed(2)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Phone}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Campanhas Ativas"
                      value={metrics.campaignCount.toString()}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Target}
                      trend="neutral"
                    />
                  </div>
                </>
              )}

              {/* PDV Metrics */}
              {isPdv && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      title="Visitas à Loja"
                      value={formatNumber(metrics.totalConversions)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Store}
                      trend="neutral"
                      className="border-l-4 border-l-chart-2"
                    />
                    <MetricCard
                      title="Custo por Visita"
                      value={formatCurrency(metrics.cpa)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={DollarSign}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Alcance Local"
                      value={formatNumber(metrics.totalReach)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Users}
                      trend="neutral"
                    />
                    <MetricCard
                      title="Frequência"
                      value={metrics.avgFrequency.toFixed(2)}
                      change={0}
                      changeLabel="vs período anterior"
                      icon={Target}
                      trend="neutral"
                    />
                  </div>
                </>
              )}
            </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart
                title="Investimento ao Longo do Tempo"
                data={chartData}
                dataKey="value"
                color="hsl(var(--primary))"
              />
              {isEcommerce && (
                <PerformanceChart
                  title="ROAS ao Longo do Tempo"
                  data={chartData}
                  dataKey="value2"
                  color="hsl(var(--chart-1))"
                />
              )}
            </div>

            {/* Top Campaigns */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Top Campanhas</h3>
                <Link to="/campaigns">
                  <Button variant="outline" size="sm">Ver todas</Button>
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Campanha</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Gasto</th>
                      {isEcommerce && (
                        <>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Receita</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">ROAS</th>
                        </>
                      )}
                      {isInsideSales && (
                        <>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Leads</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">CPL</th>
                        </>
                      )}
                      {isPdv && (
                        <>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Visitas</th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Custo/Visita</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns
                      .sort((a, b) => isEcommerce ? b.roas - a.roas : b.conversions - a.conversions)
                      .slice(0, 5)
                      .map((campaign) => (
                        <tr key={campaign.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="py-3 px-2">
                            <div className="max-w-[200px]">
                              <p className="font-medium truncate">{campaign.name}</p>
                              <p className="text-xs text-muted-foreground">{campaign.objective}</p>
                            </div>
                          </td>
                          <td className="text-right py-3 px-2">{formatCurrency(campaign.spend)}</td>
                          {isEcommerce && (
                            <>
                              <td className="text-right py-3 px-2">{formatCurrency(campaign.conversion_value)}</td>
                              <td className="text-right py-3 px-2">
                                <span className={cn(
                                  "font-semibold",
                                  campaign.roas >= 3 ? "text-metric-positive" : "text-metric-negative"
                                )}>
                                  {campaign.roas.toFixed(2)}x
                                </span>
                              </td>
                            </>
                          )}
                          {isInsideSales && (
                            <>
                              <td className="text-right py-3 px-2">{campaign.conversions}</td>
                              <td className="text-right py-3 px-2">
                                {campaign.conversions > 0 
                                  ? formatCurrency(campaign.spend / campaign.conversions)
                                  : '-'}
                              </td>
                            </>
                          )}
                          {isPdv && (
                            <>
                              <td className="text-right py-3 px-2">{campaign.conversions}</td>
                              <td className="text-right py-3 px-2">
                                {campaign.conversions > 0 
                                  ? formatCurrency(campaign.spend / campaign.conversions)
                                  : '-'}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}