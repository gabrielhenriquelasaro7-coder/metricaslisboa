import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SparklineCard from '@/components/dashboard/SparklineCard';
import { DashboardSkeleton } from '@/components/skeletons';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { CustomizableChart } from '@/components/dashboard/CustomizableChart';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { GeographicHeatMap } from '@/components/dashboard/GeographicHeatMap';
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
import { DollarSign, MousePointerClick, Eye, Target, TrendingUp, ShoppingCart, Users, Percent, Phone, Store, Loader2, GitCompare, RefreshCw, MoreVertical, Banknote, BarChart3, Activity, Crosshair, Receipt, Zap, Instagram, Building2 } from 'lucide-react';
import { MetricVisibilityConfig } from '@/components/metrics/MetricVisibilityConfig';
import { useHiddenMetrics, MetricKey } from '@/hooks/useHiddenMetrics';
import { useUserRole } from '@/hooks/useUserRole';
import { useCargo } from '@/hooks/useCargo';
import { useSquads } from '@/hooks/useSquads';
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
  const { t } = useTranslation();
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

  // UserRole for guests
  const { isGuest } = useUserRole();

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

  // Calculate date range for demographics - use dateRange from context directly
  // The PeriodContext already updates dateRange when selectedPreset changes
  const demographicDateRange = useMemo(() => {
    // Use dateRange from context directly - it's always updated by PeriodContext
    if (dateRange?.from && dateRange?.to) {
      return {
        startDate: dateRange.from,
        endDate: dateRange.to
      };
    }
    
    // Fallback: recalculate from preset
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) {
      return {
        startDate: new Date(period.since + 'T00:00:00'),
        endDate: new Date(period.until + 'T23:59:59')
      };
    }
    
    // Last resort fallback to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start,
      endDate: end
    };
  }, [selectedPreset, selectedProject?.timezone, dateRange]);

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

  // Hidden metrics for guests - must be after businessModel is defined
  const { isMetricHidden, hiddenMetrics, toggleMetric, loading: hiddenMetricsLoading } = useHiddenMetrics('dashboard', businessModel as any);

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
        totalInitiateCheckout: curr.initiate_checkout_conversions,
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
      totalSalesConversions: 0,
      totalInitiateCheckout: 0
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
      totalProfileVisits: prev.profile_visits,
      totalLeadsConversions: prev.leads_conversions,
      totalSalesConversions: prev.sales_conversions,
      totalInitiateCheckout: prev.initiate_checkout_conversions,
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
      initiate_checkout: [],
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
      initiate_checkout: dailyData.map(d => d.initiate_checkout_conversions),
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
              }}>{t('dashboard.title')}</h1>
              <p className="text-muted-foreground text-[11px] sm:text-sm">{t('dashboard.overview')}</p>
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
                      <span className="truncate">{syncing ? t('dashboard.syncing') : t('dashboard.syncNow')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSyncDemographics} disabled={syncing || !selectedProject}>
                      <Users className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                      <span className="truncate">{t('dashboard.demographics')}</span>
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
            <h2 className="text-xl font-semibold mb-2">{t('dashboard.noProjectYet')}</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('dashboard.createFirstProjectDesc')}
            </p>
            <Link to="/projects">
              <Button variant="gradient">{t('dashboard.createFirstProject')}</Button>
            </Link>
          </div> : loading ? <DashboardSkeleton /> : <>
            {/* Account Balance Card - Top of Dashboard */}
            {hasSelectedProject && <AccountBalanceCard projectId={selectedProject?.id || null} currency={selectedProject?.currency} />}
            
            {/* Comparison Toggle + Metric Config - Compact - Available for ALL roles */}
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <MetricVisibilityConfig 
                hiddenMetrics={hiddenMetrics}
                toggleMetric={toggleMetric}
                loading={hiddenMetricsLoading}
              />
              <Label htmlFor="comparison-toggle" className="text-[11px] sm:text-sm text-muted-foreground cursor-pointer">
                <span className="hidden sm:inline">{t('dashboard.periodComparison')}</span>
                <span className="sm:hidden">{t('comparison.compare')}</span>
              </Label>
              <Switch id="comparison-toggle" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90 sm:scale-100" />
            </div>

            {/* Period Comparison */}
            {showComparison && hasSelectedProject && <PeriodComparison currentMetrics={metrics} previousMetrics={previousMetrics} businessModel={businessModel || null} currentPeriodLabel={selectedPreset === 'this_month' ? t('periods.thisMonth') : selectedPreset === 'last_7d' ? t('periods.last7Days') : selectedPreset === 'last_30d' ? t('periods.last30Days') : t('comparison.current')} previousPeriodLabel={t('dashboard.previous')} currency={selectedProject?.currency || 'BRL'} resultMetrics={metricConfig?.result_metrics} resultMetricsLabels={metricConfig?.result_metrics_labels} hiddenMetrics={hiddenMetrics} />}

            {/* Metrics Grid - Responsive */}
            <div data-tour="metrics">
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                  {t('metrics.generalMetrics')}
                </h2>
              </div>
              <div className="metric-grid-mobile">
                {!isMetricHidden('spend') && <SparklineCard title={t('metrics.spend')} value={formatCurrency(metrics.totalSpend)} change={changes?.spend} icon={Banknote} sparklineData={sparklineData.spend} />}
                {!isMetricHidden('impressions') && <SparklineCard title={t('metrics.impressions')} value={formatNumberCompact(metrics.totalImpressions)} change={changes?.impressions} sparklineData={sparklineData.impressions} icon={Eye} />}
                {!isMetricHidden('clicks') && <SparklineCard title={t('metrics.clicks')} value={formatNumberCompact(metrics.totalClicks)} change={changes?.clicks} sparklineData={sparklineData.clicks} icon={MousePointerClick} />}
                {!isMetricHidden('ctr') && <SparklineCard title={t('metrics.ctr')} value={`${metrics.ctr.toFixed(2)}%`} change={changes?.ctr} sparklineData={sparklineData.ctr} icon={Crosshair} />}
                {!isMetricHidden('cpm') && <SparklineCard title={t('metrics.cpm')} value={formatCurrency(metrics.cpm)} change={changes?.cpm} icon={BarChart3} invertTrend />}
                {!isMetricHidden('cpc') && <SparklineCard title={t('metrics.cpc')} value={formatCurrency(metrics.cpc)} change={changes?.cpc} icon={Zap} invertTrend />}
              </div>
            </div>

            {/* Top of Funnel Metrics - Only show when there are Instagram traffic campaigns with profile visits */}
            {hasSelectedProject && profileVisitsData.hasProfileVisitCampaigns && !isMetricHidden('profile_visits') && <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                  <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-pink-500 to-pink-500/50 rounded-full" />
                  <h2 className="text-sm sm:text-lg font-semibold text-foreground flex items-center gap-1 sm:gap-2 flex-wrap" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                    <Instagram className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" />
                    <span>{t('metrics.topOfFunnel')}</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                  <SparklineCard title={t('metrics.profileVisits')} value={formatNumber(profileVisitsData.totalProfileVisits)} icon={Instagram} className="border-l-4 border-l-pink-500" />
                  <SparklineCard title={t('metrics.costPerVisit')} value={formatCurrency(profileVisitsData.costPerVisit)} icon={DollarSign} invertTrend />
                </div>
              </div>}

            {/* Result Metrics - Dynamic based on business model */}
            {hasSelectedProject && <div>
              <div className="flex items-center gap-2 mb-2 sm:mb-4">
                <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-emerald-500 to-emerald-500/50 rounded-full" />
                <h2 className="text-sm sm:text-lg font-semibold text-foreground flex items-center flex-wrap gap-1" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                  <span>{t('metrics.results')}</span>
                  {!isCustom && <span className="text-[10px] sm:text-sm font-normal text-muted-foreground">
                      ({isEcommerce ? 'E-com' : isInsideSales ? 'Inside' : isPdv ? 'PDV' : isInfoproduto ? 'Info' : ''})
                    </span>}
                </h2>
              </div>
              
              {/* E-commerce Metrics */}
              {isEcommerce && <div className="metric-grid-results">
                  {!isMetricHidden('roas') && <SparklineCard title={t('metrics.roas')} value={`${metrics.roas.toFixed(2)}x`} change={changes?.roas} icon={TrendingUp} sparklineData={sparklineData.roas} className="border-l-4 border-l-metric-positive" />}
                  {!isMetricHidden('conversions') && !isMetricHidden('purchases') && <SparklineCard title={t('metrics.purchases')} value={formatNumber(metrics.totalSalesConversions || metrics.totalConversions)} change={changes?.conversions} icon={ShoppingCart} sparklineData={sparklineData.purchases.length > 0 ? sparklineData.purchases : sparklineData.conversions} tooltip={t('metrics.purchasesTooltip')} />}
                  {!isMetricHidden('conversion_value') && <SparklineCard title={t('metrics.revenue')} value={formatCurrency(metrics.totalConversionValue)} change={changes?.revenue} icon={Receipt} sparklineData={sparklineData.revenue} />}
                  {!isMetricHidden('cpa') && <SparklineCard title={t('metrics.cpa')} value={formatCurrency(metrics.cpa)} change={changes?.cpa} icon={Target} sparklineData={sparklineData.cpl} invertTrend />}
                </div>}

              {/* Inside Sales Metrics */}
              {isInsideSales && (() => {
              const totalLeads = metrics.totalConversions;
              const cpl = totalLeads > 0 ? metrics.totalSpend / totalLeads : 0;
              const convRate = metrics.totalClicks > 0 ? totalLeads / metrics.totalClicks * 100 : 0;
              return <div className="metric-grid-results">
                    {!isMetricHidden('conversions') && !isMetricHidden('leads') && <SparklineCard title={t('metrics.leads')} value={formatNumber(totalLeads)} change={changes?.conversions} icon={Users} sparklineData={sparklineData.leads.length > 0 ? sparklineData.leads : sparklineData.conversions} className="border-l-4 border-l-chart-1" tooltip={t('metrics.totalResults')} />}
                    {!isMetricHidden('cpa') && <SparklineCard title={t('metrics.cpl')} value={formatCurrency(cpl)} change={changes?.cpa} icon={Receipt} sparklineData={sparklineData.cpl} invertTrend />}
                    <SparklineCard title={t('metrics.conversionRate')} value={`${convRate.toFixed(2)}%`} icon={Activity} />
                    {!isMetricHidden('reach') && <SparklineCard title={t('metrics.reach')} value={formatNumber(metrics.totalReach)} change={changes?.reach} icon={Eye} />}
                  </div>;
            })()}

              {/* Infoproduto Metrics */}
              {isInfoproduto && <div className="metric-grid-results">
                  {!isMetricHidden('conversions') && !isMetricHidden('purchases') && <SparklineCard title={t('metrics.sales')} value={formatNumber(metrics.totalSalesConversions || metrics.totalConversions)} change={changes?.conversions} icon={ShoppingCart} sparklineData={sparklineData.purchases} className="border-l-4 border-l-metric-positive" tooltip={t('metrics.purchasesTooltip')} />}
                  {!isMetricHidden('conversion_value') && <SparklineCard title={t('metrics.revenue')} value={formatCurrency(metrics.totalConversionValue)} change={changes?.revenue} icon={Receipt} sparklineData={sparklineData.revenue} />}
                  {!isMetricHidden('roas') && <SparklineCard title={t('metrics.roas')} value={`${metrics.roas.toFixed(2)}x`} change={changes?.roas} icon={TrendingUp} sparklineData={sparklineData.roas} className="border-l-4 border-l-metric-positive" />}
                  {!isMetricHidden('cpa') && <SparklineCard title={t('metrics.cpa')} value={formatCurrency(metrics.cpa)} change={changes?.cpa} icon={Target} sparklineData={sparklineData.cpl} invertTrend />}
                </div>}

              {/* PDV Metrics */}
              {isPdv && <div className="metric-grid-results">
                  {!isMetricHidden('conversions') && <SparklineCard title={t('metrics.visits')} value={formatNumber(metrics.totalConversions)} change={changes?.conversions} icon={Store} sparklineData={sparklineData.conversions} sparklineColor="hsl(var(--chart-2))" className="border-l-4 border-l-chart-2" />}
                  {!isMetricHidden('cpa') && <SparklineCard title={t('metrics.costPerVisit')} value={formatCurrency(metrics.cpa)} change={changes?.cpa} icon={DollarSign} sparklineData={sparklineData.cpl} sparklineColor="hsl(var(--chart-3))" invertTrend />}
                  {!isMetricHidden('reach') && <MetricCard title={t('metrics.reach')} value={formatNumber(metrics.totalReach)} icon={Users} trend="neutral" />}
                  {!isMetricHidden('frequency') && <MetricCard title={t('metrics.frequency')} value={metrics.avgFrequency.toFixed(2)} icon={Target} trend="neutral" />}
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
              totalLeadsConversions: metrics.totalLeadsConversions,
              totalSalesConversions: metrics.totalSalesConversions,
              totalInitiateCheckout: metrics.totalInitiateCheckout
            }} previousMetrics={previousMetrics ? {
              totalConversions: previousMetrics.totalConversions,
              totalMessages: previousMetrics.totalMessages,
              totalLeadsConversions: previousMetrics.totalLeadsConversions,
              totalSalesConversions: previousMetrics.totalSalesConversions,
              totalInitiateCheckout: previousMetrics.totalInitiateCheckout,
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

            {/* Geographic Heat Map */}
            <GeographicHeatMap 
              countryData={demographicData?.country || []} 
              regionData={demographicData?.region || []} 
              isLoading={demographicLoading} 
              currency={selectedProject?.currency || 'BRL'} 
            />

            {/* Demographic Charts */}
            <DemographicCharts data={demographicData} isLoading={demographicLoading} currency={selectedProject?.currency || 'BRL'} />


            {/* Top Campaigns */}
            <TopCampaignsCard campaigns={campaigns} businessModel={businessModel || null} currency={selectedProject?.currency || 'BRL'} />
          </>}
        </div>
      </div>

    </DashboardLayout>;
}