import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SparklineCard from '@/components/dashboard/SparklineCard';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { CustomizableChart } from '@/components/dashboard/CustomizableChart';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { useDemographicInsights } from '@/hooks/useDemographicInsights';
import PeriodComparison from '@/components/dashboard/PeriodComparison';
import { PDFBuilderDialog } from '@/components/pdf/PDFBuilderDialog';
import { useProjects } from '@/hooks/useProjects';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
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
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [showComparison, setShowComparison] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  // Get campaigns and selected project from hook (uses localStorage)
  const { campaigns, loading: dataLoading, syncing, syncData, syncDemographics, selectedProject, loadMetricsByPeriod } = useMetaAdsData();
  
  // Get daily metrics for charts
  const { dailyData, comparison: periodComparison, loading: dailyLoading } = useDailyMetrics(selectedProject?.id, selectedPreset);
  
  // Calculate date range for demographics based on preset
  const demographicDateRange = useMemo(() => {
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) {
      return {
        startDate: new Date(period.since),
        endDate: new Date(period.until),
      };
    }
    // Fallback to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { startDate: start, endDate: end };
  }, [selectedPreset, selectedProject?.timezone]);

  // Get demographic insights
  const { data: demographicData, isLoading: demographicLoading } = useDemographicInsights({
    projectId: selectedProject?.id || null,
    startDate: demographicDateRange.startDate,
    endDate: demographicDateRange.endDate,
  });

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

  // Load metrics when preset changes - INSTANT from local database
  useEffect(() => {
    if (!selectedProject) return;
    
    console.log(`[Dashboard] Loading period: ${selectedPreset}`);
    loadMetricsByPeriod(selectedPreset);
  }, [selectedPreset, selectedProject, loadMetricsByPeriod]);

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

  // Sync demographics
  const handleSyncDemographics = useCallback(() => {
    if (dateRange?.from && dateRange?.to) {
      syncDemographics({
        since: format(dateRange.from, 'yyyy-MM-dd'),
        until: format(dateRange.to, 'yyyy-MM-dd')
      });
    } else {
      syncDemographics();
    }
  }, [dateRange, syncDemographics]);

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

  // Use daily metrics aggregation for consistent current/previous comparison
  const metrics = useMemo(() => {
    // If we have daily data from the hook, use those totals for consistency
    if (periodComparison?.currentTotals) {
      const curr = periodComparison.currentTotals;
      return {
        totalSpend: curr.spend,
        totalImpressions: curr.impressions,
        totalClicks: curr.clicks,
        totalReach: curr.reach,
        totalConversions: curr.conversions,
        totalConversionValue: curr.conversion_value,
        ctr: curr.ctr,
        cpm: curr.cpm,
        cpc: curr.cpc,
        cpa: curr.cpa,
        roas: curr.roas,
        avgFrequency: curr.reach > 0 ? curr.impressions / curr.reach : 0,
        campaignCount: campaigns.length,
      };
    }
    // Fallback to campaigns data if daily metrics not loaded yet
    return calculateMetrics(campaigns);
  }, [periodComparison, campaigns]);

  // Calculate previous period metrics from real data
  const previousMetrics = useMemo(() => {
    if (!periodComparison?.previousTotals) return null;
    
    const prev = periodComparison.previousTotals;
    return {
      totalSpend: prev.spend,
      totalImpressions: prev.impressions,
      totalClicks: prev.clicks,
      totalReach: prev.reach,
      totalConversions: prev.conversions,
      totalConversionValue: prev.conversion_value,
      ctr: prev.ctr,
      cpm: prev.cpm,
      cpc: prev.cpc,
      cpa: prev.cpa,
      roas: prev.roas,
      avgFrequency: prev.reach > 0 ? prev.impressions / prev.reach : 0,
      campaignCount: campaigns.length,
    };
  }, [periodComparison, campaigns.length]);

  // Extract sparkline data from daily metrics
  const sparklineData = useMemo(() => {
    if (!dailyData.length) return {
      spend: [],
      conversions: [],
      revenue: [],
      clicks: [],
      impressions: [],
      ctr: [],
      roas: [],
      cpl: [],
    };
    
    return {
      spend: dailyData.map(d => d.spend),
      conversions: dailyData.map(d => d.conversions),
      revenue: dailyData.map(d => d.conversion_value),
      clicks: dailyData.map(d => d.clicks),
      impressions: dailyData.map(d => d.impressions),
      ctr: dailyData.map(d => d.ctr),
      roas: dailyData.map(d => d.roas),
      cpl: dailyData.map(d => d.cpa),
    };
  }, [dailyData]);

  // Get change values from comparison
  const changes = useMemo(() => {
    if (!periodComparison) return null;
    return periodComparison.changes;
  }, [periodComparison]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: selectedProject?.currency || 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };
  const loading = projectsLoading || dataLoading || dailyLoading;

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
            
            {/* PDF Builder Button */}
            {hasSelectedProject && selectedProject && (
              <PDFBuilderDialog
                projectId={selectedProject.id}
                projectName={selectedProject.name}
                businessModel={businessModel || null}
                currency={selectedProject.currency || 'BRL'}
                currentPeriod={getDateRangeFromPreset(selectedPreset, projectTimezone) || { since: format(new Date(), 'yyyy-MM-dd'), until: format(new Date(), 'yyyy-MM-dd') }}
              />
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleManualSync} disabled={syncing || !selectedProject}>
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar Campanhas'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSyncDemographics} disabled={syncing || !selectedProject}>
                  <Users className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                  Sincronizar Demográficos
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
                currentPeriodLabel={selectedPreset === 'this_month' ? 'Este Mês' : selectedPreset === 'last_7d' ? 'Últimos 7 dias' : selectedPreset === 'last_30d' ? 'Últimos 30 dias' : 'Período Atual'}
                previousPeriodLabel={selectedPreset === 'this_month' ? 'Mês Anterior' : selectedPreset === 'last_7d' ? '7 dias antes' : selectedPreset === 'last_30d' ? '30 dias antes' : 'Período Anterior'}
              />
            )}

            {/* Metrics Grid - General Base Metrics with Sparklines */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Métricas Gerais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <SparklineCard
                  title="Gasto Total"
                  value={formatCurrency(metrics.totalSpend)}
                  change={changes?.spend}
                  changeLabel="vs anterior"
                  icon={DollarSign}
                  sparklineData={sparklineData.spend}
                  sparklineColor="hsl(var(--primary))"
                />
                <SparklineCard
                  title="Impressões"
                  value={formatNumber(metrics.totalImpressions)}
                  sparklineData={sparklineData.impressions}
                  sparklineColor="hsl(var(--chart-1))"
                  icon={Eye}
                />
                <SparklineCard
                  title="Cliques"
                  value={formatNumber(metrics.totalClicks)}
                  sparklineData={sparklineData.clicks}
                  sparklineColor="hsl(var(--chart-2))"
                  icon={MousePointerClick}
                />
                <SparklineCard
                  title="CTR"
                  value={`${metrics.ctr.toFixed(2)}%`}
                  change={changes?.ctr}
                  changeLabel="vs anterior"
                  sparklineData={sparklineData.ctr}
                  sparklineColor="hsl(var(--chart-3))"
                  icon={Target}
                />
                <SparklineCard
                  title="CPM"
                  value={formatCurrency(metrics.cpm)}
                  icon={Eye}
                  invertTrend
                />
                <SparklineCard
                  title="CPC"
                  value={formatCurrency(metrics.cpc)}
                  icon={MousePointerClick}
                  invertTrend
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SparklineCard
                    title="ROAS"
                    value={`${metrics.roas.toFixed(2)}x`}
                    change={changes?.roas}
                    changeLabel="vs anterior"
                    icon={TrendingUp}
                    sparklineData={sparklineData.roas}
                    sparklineColor="hsl(142, 76%, 36%)"
                    className="border-l-4 border-l-metric-positive"
                  />
                  <SparklineCard
                    title="Compras"
                    value={formatNumber(metrics.totalConversions)}
                    change={changes?.conversions}
                    changeLabel="vs anterior"
                    icon={ShoppingCart}
                    sparklineData={sparklineData.conversions}
                    sparklineColor="hsl(var(--chart-1))"
                  />
                  <SparklineCard
                    title="Receita"
                    value={formatCurrency(metrics.totalConversionValue)}
                    change={changes?.revenue}
                    changeLabel="vs anterior"
                    icon={DollarSign}
                    sparklineData={sparklineData.revenue}
                    sparklineColor="hsl(142, 76%, 36%)"
                  />
                  <SparklineCard
                    title="CPA"
                    value={formatCurrency(metrics.cpa)}
                    change={changes?.cpa}
                    changeLabel="vs anterior"
                    icon={Target}
                    sparklineData={sparklineData.cpl}
                    sparklineColor="hsl(var(--chart-2))"
                    invertTrend
                  />
                </div>
              )}

              {/* Inside Sales Metrics */}
              {isInsideSales && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SparklineCard
                    title="Leads"
                    value={formatNumber(metrics.totalConversions)}
                    change={changes?.conversions}
                    changeLabel="vs anterior"
                    icon={Users}
                    sparklineData={sparklineData.conversions}
                    sparklineColor="hsl(var(--chart-1))"
                    className="border-l-4 border-l-chart-1"
                  />
                  <SparklineCard
                    title="CPL"
                    value={formatCurrency(metrics.cpa)}
                    change={changes?.cpa}
                    changeLabel="vs anterior"
                    icon={DollarSign}
                    sparklineData={sparklineData.cpl}
                    sparklineColor="hsl(var(--chart-2))"
                    invertTrend
                  />
                  <MetricCard
                    title="Taxa de Conversão"
                    value={`${metrics.totalClicks > 0 ? ((metrics.totalConversions / metrics.totalClicks) * 100).toFixed(2) : 0}%`}
                    icon={Percent}
                    trend="neutral"
                  />
                  <MetricCard
                    title="Alcance"
                    value={formatNumber(metrics.totalReach)}
                    icon={Users}
                    trend="neutral"
                  />
                </div>
              )}

              {/* PDV Metrics */}
              {isPdv && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SparklineCard
                    title="Visitas"
                    value={formatNumber(metrics.totalConversions)}
                    change={changes?.conversions}
                    changeLabel="vs anterior"
                    icon={Store}
                    sparklineData={sparklineData.conversions}
                    sparklineColor="hsl(var(--chart-2))"
                    className="border-l-4 border-l-chart-2"
                  />
                  <SparklineCard
                    title="Custo/Visita"
                    value={formatCurrency(metrics.cpa)}
                    change={changes?.cpa}
                    changeLabel="vs anterior"
                    icon={DollarSign}
                    sparklineData={sparklineData.cpl}
                    sparklineColor="hsl(var(--chart-3))"
                    invertTrend
                  />
                  <MetricCard
                    title="Alcance Local"
                    value={formatNumber(metrics.totalReach)}
                    icon={Users}
                    trend="neutral"
                  />
                  <MetricCard
                    title="Frequência"
                    value={metrics.avgFrequency.toFixed(2)}
                    icon={Target}
                    trend="neutral"
                  />
                </div>
              )}
            </div>
            )}

            {/* Customizable Charts - Real daily data */}
            <div className="space-y-6">
              <div ref={chartRef}>
                <CustomizableChart
                  chartKey="dashboard-chart-1"
                  data={dailyData}
                  defaultTitle="Gráfico 1 - Performance"
                  defaultPrimaryMetric="spend"
                  defaultSecondaryMetric={isEcommerce ? 'conversions' : 'conversions'}
                  defaultChartType="composed"
                />
              </div>
              <CustomizableChart
                chartKey="dashboard-chart-2"
                data={dailyData}
                defaultTitle="Gráfico 2 - Alcance"
                defaultPrimaryMetric="impressions"
                defaultSecondaryMetric="ctr"
                defaultChartType="area"
              />
              <CustomizableChart
                chartKey="dashboard-chart-3"
                data={dailyData}
                defaultTitle="Gráfico 3 - Custo"
                defaultPrimaryMetric="cpc"
                defaultSecondaryMetric="clicks"
                defaultChartType="bar"
              />
            </div>

            {/* Demographic Charts */}
            <DemographicCharts
              data={demographicData}
              isLoading={demographicLoading}
            />

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