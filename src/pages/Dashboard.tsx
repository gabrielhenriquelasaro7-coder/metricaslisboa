import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SparklineCard from '@/components/dashboard/SparklineCard';
import { DashboardSkeleton } from '@/components/skeletons';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { CustomizableChart } from '@/components/dashboard/CustomizableChart';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { DynamicResultMetrics } from '@/components/dashboard/DynamicResultMetrics';
import { TopCampaignsCard } from '@/components/dashboard/TopCampaignsCard';
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { LeadsSyncCard } from '@/components/leads/LeadsSyncCard';
import { AccountBalanceCard } from '@/components/dashboard/AccountBalanceCard';
import { useDemographicInsights } from '@/hooks/useDemographicInsights';
import { useProjectMetricConfig } from '@/hooks/useProjectMetricConfig';
import PeriodComparison from '@/components/dashboard/PeriodComparison';
import { PDFBuilderDialog } from '@/components/pdf/PDFBuilderDialog';
import { useProjects } from '@/hooks/useProjects';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useTour } from '@/hooks/useTour';
import { useBalanceAlert } from '@/hooks/useBalanceAlert';
import { useProfileVisitsMetrics } from '@/hooks/useProfileVisitsMetrics';
import { usePeriodContext } from '@/hooks/usePeriodContext';
import { GuidedTour } from '@/components/tour/GuidedTour';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { DollarSign, MousePointerClick, Eye, Target, TrendingUp, ShoppingCart, Users, Percent, Phone, Store, Loader2, GitCompare, RefreshCw, MoreVertical, Banknote, BarChart3, Activity, Crosshair, Receipt, Zap, Instagram } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import v4LogoFull from '@/assets/v4-logo-full.png';
export default function Dashboard() {
  const {
    projects,
    loading: projectsLoading
  } = useProjects();
  const {
    selectedPreset,
    dateRange,
    setSelectedPreset,
    setDateRange
  } = usePeriodContext();
  const [showComparison, setShowComparison] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  // Tour hook
  const {
    showTour,
    completeTour,
    skipTour
  } = useTour();

  // Get campaigns and selected project from hook (uses localStorage)
  const {
    campaigns,
    loading: dataLoading,
    syncing,
    syncData,
    syncDemographics,
    selectedProject,
    loadMetricsByPeriod
  } = useMetaAdsData();

  // Balance alert hook - shows notification when balance is critical
  useBalanceAlert(selectedProject?.id || null, selectedProject?.name);

  // Get daily metrics for charts - pass custom date range for custom preset
  const {
    dailyData,
    comparison: periodComparison,
    loading: dailyLoading
  } = useDailyMetrics(selectedProject?.id, selectedPreset, selectedPreset === 'custom' ? dateRange : undefined);

  // Get profile visits metrics (for Instagram traffic campaigns)
  const {
    data: profileVisitsData,
    loading: profileVisitsLoading
  } = useProfileVisitsMetrics(selectedProject?.id, selectedPreset, selectedPreset === 'custom' ? dateRange : undefined);

  // Calculate date range for demographics based on preset
  const demographicDateRange = useMemo(() => {
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) {
      return {
        startDate: new Date(period.since),
        endDate: new Date(period.until)
      };
    }
    // Fallback to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start,
      endDate: end
    };
  }, [selectedPreset, selectedProject?.timezone]);

  // Get demographic insights
  const {
    data: demographicData,
    isLoading: demographicLoading
  } = useDemographicInsights({
    projectId: selectedProject?.id || null,
    startDate: demographicDateRange.startDate,
    endDate: demographicDateRange.endDate
  });

  // Get active (non-archived) projects
  const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects]);

  // Determine business model - only show specific metrics when a project is selected
  const hasSelectedProject = selectedProject !== null && selectedProject !== undefined;
  const businessModel = selectedProject?.business_model;
  const projectTimezone = selectedProject?.timezone || 'America/Sao_Paulo';
  const isEcommerce = hasSelectedProject && businessModel === 'ecommerce';
  const isInsideSales = hasSelectedProject && businessModel === 'inside_sales';
  const isPdv = hasSelectedProject && businessModel === 'pdv';
  const isCustom = hasSelectedProject && businessModel === 'custom';
  const isInfoproduto = hasSelectedProject && businessModel === 'infoproduto';

  // Get custom metric config for custom business model
  const {
    config: metricConfig,
    loading: metricConfigLoading
  } = useProjectMetricConfig(isCustom ? selectedProject?.id : null);

  // Load metrics when preset or date range changes - INSTANT from local database
  useEffect(() => {
    if (!selectedProject) return;
    console.log(`[Dashboard] Loading period: ${selectedPreset}`);
    loadMetricsByPeriod(selectedPreset, false, selectedPreset === 'custom' ? dateRange : undefined);
  }, [selectedPreset, dateRange, selectedProject, loadMetricsByPeriod]);

  // Handle date range change - NO sync, just load from database
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, [setDateRange]);

  // Handle preset change
  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset as any);
  }, [setSelectedPreset]);

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
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions * 100 : 0;
    const cpm = totalImpressions > 0 ? totalSpend / totalImpressions * 1000 : 0;
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
      campaignCount: campaignsList.length
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
        totalMessages: curr.messaging_replies,
        totalProfileVisits: curr.profile_visits,
        totalLeadsConversions: curr.leads_conversions,
        totalSalesConversions: curr.sales_conversions,
        ctr: curr.ctr,
        cpm: curr.cpm,
        cpc: curr.cpc,
        cpa: curr.cpa,
        roas: curr.roas,
        avgFrequency: curr.reach > 0 ? curr.impressions / curr.reach : 0,
        campaignCount: campaigns.length
      };
    }
    // Fallback to campaigns data if daily metrics not loaded yet
    return {
      ...calculateMetrics(campaigns),
      totalMessages: 0,
      totalProfileVisits: 0,
      totalLeadsConversions: 0,
      totalSalesConversions: 0
    };
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
      totalMessages: prev.messaging_replies,
      totalLeadsConversions: prev.leads_conversions,
      ctr: prev.ctr,
      cpm: prev.cpm,
      cpc: prev.cpc,
      cpa: prev.cpa,
      roas: prev.roas,
      avgFrequency: prev.reach > 0 ? prev.impressions / prev.reach : 0,
      campaignCount: campaigns.length
    };
  }, [periodComparison, campaigns.length]);

  // Extract sparkline data from daily metrics
  const sparklineData = useMemo(() => {
    if (!dailyData.length) return {
      spend: [],
      conversions: [],
      messages: [],
      profile_visits: [],
      leads: [],
      purchases: [],
      revenue: [],
      clicks: [],
      impressions: [],
      ctr: [],
      roas: [],
      cpl: []
    };
    return {
      spend: dailyData.map(d => d.spend),
      conversions: dailyData.map(d => d.conversions),
      messages: dailyData.map(d => d.messaging_replies),
      profile_visits: dailyData.map(d => d.profile_visits),
      leads: dailyData.map(d => d.leads_conversions),
      purchases: dailyData.map(d => d.sales_conversions),
      revenue: dailyData.map(d => d.conversion_value),
      clicks: dailyData.map(d => d.clicks),
      impressions: dailyData.map(d => d.impressions),
      ctr: dailyData.map(d => d.ctr),
      roas: dailyData.map(d => d.roas),
      cpl: dailyData.map(d => d.cpa)
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
      maximumFractionDigits: 2
    }).format(value);
  };
  const formatNumber = (num: number) => {
    return num.toLocaleString('pt-BR');
  };
  const formatNumberCompact = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };
  // Only show loading if projects are still loading, or if we have a selected project and data is loading
  const loading = projectsLoading || (selectedProject ? (dataLoading || dailyLoading) : false);
  return <DashboardLayout>
      {/* Guided Tour */}
      {showTour && <GuidedTour onComplete={completeTour} onSkip={skipTour} />}
      
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        {/* Background effects - subtle on mobile */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[200px] sm:w-[400px] lg:w-[600px] h-[200px] sm:h-[400px] lg:h-[600px] bg-primary/3 rounded-full blur-[80px] sm:blur-[150px]" />
        </div>
        
        <div className="relative z-10 p-3 sm:p-6 lg:p-8 space-y-3 sm:space-y-6 lg:space-y-8 animate-fade-in overflow-x-hidden w-full">
          {/* Header - Compact on mobile */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>Dashboard</h1>
              <p className="text-muted-foreground text-[11px] sm:text-sm">Visão geral das campanhas</p>
            </div>
          
            {/* Controls - Stack on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div data-tour="date-picker" className="w-full sm:w-auto">
                <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} timezone={projectTimezone} onPresetChange={handlePresetChange} selectedPreset={selectedPreset} />
              </div>
              
              <div className="flex items-center gap-2">
                {/* PDF Builder Button */}
                {hasSelectedProject && selectedProject && <div data-tour="pdf-export">
                    <PDFBuilderDialog projectId={selectedProject.id} projectName={selectedProject.name} businessModel={businessModel || null} currency={selectedProject.currency || 'BRL'} currentPeriod={getDateRangeFromPreset(selectedPreset, projectTimezone) || {
                  since: format(new Date(), 'yyyy-MM-dd'),
                  until: format(new Date(), 'yyyy-MM-dd')
                }} />
                  </div>}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 touch-target">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border z-50">
                    <DropdownMenuItem onClick={handleManualSync} disabled={syncing || !selectedProject}>
                      <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                      <span className="truncate">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSyncDemographics} disabled={syncing || !selectedProject}>
                      <Users className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                      <span className="truncate">Demográficos</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

        {/* Check if has projects */}
        {activeProjects.length === 0 && !loading ? <div className="glass-card p-12 text-center">
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
          </div> : loading ? <DashboardSkeleton /> : <>
            {/* Account Balance Card - Top of Dashboard */}
            {hasSelectedProject && <AccountBalanceCard projectId={selectedProject?.id || null} currency={selectedProject?.currency} />}
            
            {/* Comparison Toggle - Compact */}
            <div className="flex items-center justify-end gap-2">
              <Label htmlFor="comparison-toggle" className="text-[11px] sm:text-sm text-muted-foreground cursor-pointer">
                <span className="hidden sm:inline">Comparar período</span>
                <span className="sm:hidden">Comparar</span>
              </Label>
              <Switch id="comparison-toggle" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90 sm:scale-100" />
            </div>

            {/* Period Comparison */}
            {showComparison && hasSelectedProject && <PeriodComparison currentMetrics={metrics} previousMetrics={previousMetrics} businessModel={businessModel || null} currentPeriodLabel={selectedPreset === 'this_month' ? 'Este Mês' : selectedPreset === 'last_7d' ? '7 dias' : selectedPreset === 'last_30d' ? '30 dias' : 'Atual'} previousPeriodLabel={selectedPreset === 'this_month' ? 'Anterior' : selectedPreset === 'last_7d' ? 'Anterior' : selectedPreset === 'last_30d' ? 'Anterior' : 'Anterior'} currency={selectedProject?.currency || 'BRL'} />}

            {/* Metrics Grid - Responsive */}
            <div data-tour="metrics">
              <div className="flex items-center gap-2 mb-2 sm:mb-4">
                <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                  Métricas Gerais
                </h2>
              </div>
              <div className="metric-grid-mobile">
                <SparklineCard title="Gasto Total" value={formatCurrency(metrics.totalSpend)} change={changes?.spend} changeLabel="ant." icon={Banknote} sparklineData={sparklineData.spend} />
                <SparklineCard title="Impressões" value={formatNumberCompact(metrics.totalImpressions)} change={changes?.impressions} changeLabel="ant." sparklineData={sparklineData.impressions} icon={Eye} />
                <SparklineCard title="Cliques" value={formatNumberCompact(metrics.totalClicks)} change={changes?.clicks} changeLabel="ant." sparklineData={sparklineData.clicks} icon={MousePointerClick} />
                <SparklineCard title="CTR" value={`${metrics.ctr.toFixed(2)}%`} change={changes?.ctr} changeLabel="ant." sparklineData={sparklineData.ctr} icon={Crosshair} />
                <SparklineCard title="CPM" value={formatCurrency(metrics.cpm)} change={changes?.cpm} changeLabel="ant." icon={BarChart3} invertTrend />
                <SparklineCard title="CPC" value={formatCurrency(metrics.cpc)} change={changes?.cpc} changeLabel="ant." icon={Zap} invertTrend />
              </div>
            </div>

            {/* Top of Funnel Metrics - Only show when there are Instagram traffic campaigns with profile visits */}
            {hasSelectedProject && profileVisitsData.hasProfileVisitCampaigns && <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                  <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-pink-500 to-pink-500/50 rounded-full" />
                  <h2 className="text-sm sm:text-lg font-semibold text-foreground flex items-center gap-1 sm:gap-2 flex-wrap" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                    <Instagram className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" />
                    <span>Topo de Funil</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                  <SparklineCard title="Visitas ao Perfil" value={formatNumberCompact(profileVisitsData.totalProfileVisits)} icon={Instagram} className="border-l-4 border-l-pink-500" />
                  <SparklineCard title="Custo/Visita" value={formatCurrency(profileVisitsData.costPerVisit)} icon={DollarSign} invertTrend />
                </div>
              </div>}

            {/* Result Metrics - Dynamic based on business model */}
            {hasSelectedProject && <div>
              <div className="flex items-center gap-2 mb-2 sm:mb-4">
                <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-emerald-500 to-emerald-500/50 rounded-full" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground flex items-center flex-wrap gap-1" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                  <span>Resultados</span>
                  {!isCustom && <span className="text-[10px] sm:text-sm font-normal text-muted-foreground">
                      ({isEcommerce ? 'E-com' : isInsideSales ? 'Inside' : isPdv ? 'PDV' : isInfoproduto ? 'Info' : ''})
                    </span>}
                </h2>
              </div>
              
              {/* E-commerce Metrics */}
              {isEcommerce && <div className="metric-grid-mobile">
                  <SparklineCard title="ROAS" value={`${metrics.roas.toFixed(2)}x`} change={changes?.roas} changeLabel="ant." icon={TrendingUp} sparklineData={sparklineData.roas} className="border-l-4 border-l-metric-positive" />
                  <SparklineCard title="Compras" value={formatNumberCompact(metrics.totalSalesConversions || metrics.totalConversions)} change={changes?.conversions} changeLabel="ant." icon={ShoppingCart} sparklineData={sparklineData.purchases.length > 0 ? sparklineData.purchases : sparklineData.conversions} tooltip="Total de compras via pixel" />
                  <SparklineCard title="Receita" value={formatCurrency(metrics.totalConversionValue)} change={changes?.revenue} changeLabel="ant." icon={Receipt} sparklineData={sparklineData.revenue} />
                  <SparklineCard title="CPA" value={formatCurrency(metrics.cpa)} change={changes?.cpa} changeLabel="ant." icon={Target} sparklineData={sparklineData.cpl} invertTrend />
                </div>}

              {/* Inside Sales Metrics */}
              {isInsideSales && (() => {
              const totalLeads = metrics.totalConversions;
              const cpl = totalLeads > 0 ? metrics.totalSpend / totalLeads : 0;
              const convRate = metrics.totalClicks > 0 ? totalLeads / metrics.totalClicks * 100 : 0;
              return <div className="metric-grid-mobile">
                    <SparklineCard title="Leads" value={formatNumberCompact(totalLeads)} change={changes?.conversions} changeLabel="ant." icon={Users} sparklineData={sparklineData.leads.length > 0 ? sparklineData.leads : sparklineData.conversions} className="border-l-4 border-l-chart-1" tooltip="Total de resultados" />
                    <SparklineCard title="CPL" value={formatCurrency(cpl)} change={changes?.cpa} changeLabel="ant." icon={Receipt} sparklineData={sparklineData.cpl} invertTrend />
                    <SparklineCard title="Conv." value={`${convRate.toFixed(2)}%`} icon={Activity} />
                    <SparklineCard title="Alcance" value={formatNumberCompact(metrics.totalReach)} change={changes?.reach} changeLabel="ant." icon={Eye} />
                  </div>;
            })()}

              {/* Infoproduto Metrics */}
              {isInfoproduto && <div className="metric-grid-mobile">
                  <SparklineCard title="Vendas" value={formatNumberCompact(metrics.totalSalesConversions || metrics.totalConversions)} change={changes?.conversions} changeLabel="ant." icon={ShoppingCart} sparklineData={sparklineData.purchases} className="border-l-4 border-l-metric-positive" tooltip="Compras via pixel" />
                  <SparklineCard title="Receita" value={formatCurrency(metrics.totalConversionValue)} change={changes?.revenue} changeLabel="ant." icon={Receipt} sparklineData={sparklineData.revenue} />
                  <SparklineCard title="ROAS" value={`${metrics.roas.toFixed(2)}x`} change={changes?.roas} changeLabel="ant." icon={TrendingUp} sparklineData={sparklineData.roas} className="border-l-4 border-l-metric-positive" />
                  <SparklineCard title="CPA" value={formatCurrency(metrics.cpa)} change={changes?.cpa} changeLabel="ant." icon={Target} sparklineData={sparklineData.cpl} invertTrend />
                </div>}

              {/* PDV Metrics */}
              {isPdv && <div className="metric-grid-mobile">
                  <SparklineCard title="Visitas" value={formatNumberCompact(metrics.totalConversions)} change={changes?.conversions} changeLabel="ant." icon={Store} sparklineData={sparklineData.conversions} sparklineColor="hsl(var(--chart-2))" className="border-l-4 border-l-chart-2" />
                  <SparklineCard title="Custo/Visita" value={formatCurrency(metrics.cpa)} change={changes?.cpa} changeLabel="ant." icon={DollarSign} sparklineData={sparklineData.cpl} sparklineColor="hsl(var(--chart-3))" invertTrend />
                  <MetricCard title="Alcance" value={formatNumberCompact(metrics.totalReach)} icon={Users} trend="neutral" />
                  <MetricCard title="Frequência" value={metrics.avgFrequency.toFixed(2)} icon={Target} trend="neutral" />
                </div>}

              {/* Custom Business Model Metrics */}
              {isCustom && metricConfig && <DynamicResultMetrics config={metricConfig} metrics={{
              totalConversions: metrics.totalConversions,
              totalConversionValue: metrics.totalConversionValue,
              totalSpend: metrics.totalSpend,
              totalClicks: metrics.totalClicks,
              totalImpressions: metrics.totalImpressions,
              totalReach: metrics.totalReach,
              totalMessages: metrics.totalMessages,
              totalProfileVisits: metrics.totalProfileVisits,
              totalLeadsConversions: metrics.totalLeadsConversions
            }} previousMetrics={previousMetrics ? {
              totalConversions: previousMetrics.totalConversions,
              totalMessages: previousMetrics.totalMessages,
              totalLeadsConversions: previousMetrics.totalLeadsConversions,
              totalSpend: previousMetrics.totalSpend
            } : null} changes={changes} sparklineData={sparklineData} currency={selectedProject?.currency || 'BRL'} />}
            </div>}

            {/* Customizable Charts - Real daily data */}
            <div className="space-y-4 sm:space-y-6" data-tour="charts">
              <div ref={chartRef}>
                <CustomizableChart chartKey="dashboard-chart-1" data={dailyData} defaultTitle="Gráfico 1 - Performance" defaultPrimaryMetric="spend" defaultSecondaryMetric={isEcommerce ? 'conversions' : 'conversions'} defaultChartType="composed" currency={selectedProject?.currency || 'BRL'} className="chart-container-mobile" />
              </div>
              <CustomizableChart chartKey="dashboard-chart-2" data={dailyData} defaultTitle="Gráfico 2 - Alcance" defaultPrimaryMetric="impressions" defaultSecondaryMetric="ctr" defaultChartType="line" currency={selectedProject?.currency || 'BRL'} className="chart-container-mobile" />
              <CustomizableChart chartKey="dashboard-chart-3" data={dailyData} defaultTitle="Gráfico 3 - Custo" defaultPrimaryMetric="cpc" defaultSecondaryMetric="clicks" defaultChartType="bar" currency={selectedProject?.currency || 'BRL'} className="chart-container-mobile" />
            </div>

            {/* Funnel Chart */}
            {hasSelectedProject && <FunnelChart impressions={metrics.totalImpressions} reach={metrics.totalReach} clicks={metrics.totalClicks} conversions={metrics.totalConversions} spend={metrics.totalSpend} ctr={metrics.ctr} cpc={metrics.cpc} cpl={metrics.cpa} cpm={metrics.cpm} frequency={metrics.avgFrequency} currency={selectedProject?.currency || 'BRL'} />}

            {/* Demographic Charts */}
            <DemographicCharts data={demographicData} isLoading={demographicLoading} currency={selectedProject?.currency || 'BRL'} />


            {/* Top Campaigns */}
            <TopCampaignsCard campaigns={campaigns} businessModel={businessModel || null} currency={selectedProject?.currency || 'BRL'} />
          </>}
        </div>
      </div>

    </DashboardLayout>;
}