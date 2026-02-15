import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClientSelector } from '@/components/layout/ClientSelector';
import SparklineCard from '@/components/dashboard/SparklineCard';
import { DashboardSkeleton } from '@/components/skeletons';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { CustomizableChart } from '@/components/dashboard/CustomizableChart';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { GeographicHeatMap } from '@/components/dashboard/GeographicHeatMap';
import { DynamicResultMetrics } from '@/components/dashboard/DynamicResultMetrics';
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
import { useBalanceAlert } from '@/hooks/useBalanceAlert';
import { useProfileVisitsMetrics } from '@/hooks/useProfileVisitsMetrics';
import { usePeriodContext } from '@/hooks/usePeriodContext';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { DollarSign, MousePointerClick, Eye, Target, TrendingUp, ShoppingCart, Users, Phone, Store, RefreshCw, MoreVertical, Banknote, BarChart3, Activity, Crosshair, Receipt, Zap, Instagram, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { MetricVisibilityConfig } from '@/components/metrics/MetricVisibilityConfig';
import { useHiddenMetrics } from '@/hooks/useHiddenMetrics';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DatePresetKey, getDateRangeFromPreset } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import metaIcon from '@/assets/meta-icon.png';

export default function MetaAds() {
  const { t } = useTranslation();
  const { projects, loading: projectsLoading } = useProjects();
  const { selectedPreset, dateRange, setSelectedPreset, setDateRange } = usePeriodContext();
  const [showComparison, setShowComparison] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const chartRef = useRef<HTMLDivElement>(null);

  const { isGuest } = useUserRole();

  const { campaigns, adSets, ads, loading: dataLoading, syncing, syncData, syncDemographics, selectedProject, loadMetricsByPeriod } = useMetaAdsData();

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAdSet = (id: string) => {
    setExpandedAdSets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useBalanceAlert(selectedProject?.id || null, selectedProject?.name);

  const { dailyData, comparison: periodComparison, loading: dailyLoading } = useDailyMetrics(selectedProject?.id, selectedPreset, selectedPreset === 'custom' ? dateRange : undefined);

  const { data: profileVisitsData, loading: profileVisitsLoading } = useProfileVisitsMetrics(selectedProject?.id, selectedPreset, selectedPreset === 'custom' ? dateRange : undefined);

  const demographicDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return { startDate: dateRange.from, endDate: dateRange.to };
    }
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) {
      return { startDate: new Date(period.since + 'T00:00:00'), endDate: new Date(period.until + 'T23:59:59') };
    }
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { startDate: start, endDate: end };
  }, [selectedPreset, selectedProject?.timezone, dateRange]);

  const { data: demographicData, isLoading: demographicLoading } = useDemographicInsights({
    projectId: selectedProject?.id || null,
    startDate: demographicDateRange.startDate,
    endDate: demographicDateRange.endDate
  });

  const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects]);

  const hasSelectedProject = selectedProject !== null && selectedProject !== undefined;
  const businessModel = selectedProject?.business_model;
  const projectTimezone = selectedProject?.timezone || 'America/Sao_Paulo';
  const isEcommerce = hasSelectedProject && businessModel === 'ecommerce';
  const isInsideSales = hasSelectedProject && businessModel === 'inside_sales';
  const isPdv = hasSelectedProject && businessModel === 'pdv';
  const isCustom = hasSelectedProject && businessModel === 'custom';
  const isInfoproduto = hasSelectedProject && businessModel === 'infoproduto';

  const { isMetricHidden, hiddenMetrics, toggleMetric, loading: hiddenMetricsLoading } = useHiddenMetrics('dashboard', businessModel as any);

  const { config: metricConfig, loading: metricConfigLoading } = useProjectMetricConfig(isCustom ? selectedProject?.id : null);

  useEffect(() => {
    if (!selectedProject) return;
    loadMetricsByPeriod(selectedPreset, false, selectedPreset === 'custom' ? dateRange : undefined);
  }, [selectedPreset, dateRange, selectedProject, loadMetricsByPeriod]);

  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, [setDateRange]);

  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset as any);
  }, [setSelectedPreset]);

  const handleManualSync = useCallback(() => {
    if (dateRange?.from && dateRange?.to) {
      syncData({ since: format(dateRange.from, 'yyyy-MM-dd'), until: format(dateRange.to, 'yyyy-MM-dd') });
    } else {
      syncData();
    }
  }, [dateRange, syncData]);

  const handleSyncDemographics = useCallback(() => {
    if (dateRange?.from && dateRange?.to) {
      syncDemographics({ since: format(dateRange.from, 'yyyy-MM-dd'), until: format(dateRange.to, 'yyyy-MM-dd') });
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
    return { totalSpend, totalImpressions, totalClicks, totalReach, totalConversions, totalConversionValue, ctr, cpm, cpc, cpa, roas, avgFrequency, campaignCount: campaignsList.length };
  };

  const metrics = useMemo(() => {
    if (periodComparison?.currentTotals) {
      const curr = periodComparison.currentTotals;
      return {
        totalSpend: curr.spend, totalImpressions: curr.impressions, totalClicks: curr.clicks, totalReach: curr.reach,
        totalConversions: curr.conversions, totalConversionValue: curr.conversion_value, totalMessages: curr.messaging_replies,
        totalProfileVisits: curr.profile_visits, totalLeadsConversions: curr.leads_conversions, totalSalesConversions: curr.sales_conversions,
        totalInitiateCheckout: curr.initiate_checkout_conversions, ctr: curr.ctr, cpm: curr.cpm, cpc: curr.cpc, cpa: curr.cpa, roas: curr.roas,
        avgFrequency: curr.reach > 0 ? curr.impressions / curr.reach : 0, campaignCount: campaigns.length
      };
    }
    return { ...calculateMetrics(campaigns), totalMessages: 0, totalProfileVisits: 0, totalLeadsConversions: 0, totalSalesConversions: 0, totalInitiateCheckout: 0 };
  }, [periodComparison, campaigns]);

  const previousMetrics = useMemo(() => {
    if (!periodComparison?.previousTotals) return null;
    const prev = periodComparison.previousTotals;
    return {
      totalSpend: prev.spend, totalImpressions: prev.impressions, totalClicks: prev.clicks, totalReach: prev.reach,
      totalConversions: prev.conversions, totalConversionValue: prev.conversion_value, totalMessages: prev.messaging_replies,
      totalProfileVisits: prev.profile_visits, totalLeadsConversions: prev.leads_conversions, totalSalesConversions: prev.sales_conversions,
      totalInitiateCheckout: prev.initiate_checkout_conversions, ctr: prev.ctr, cpm: prev.cpm, cpc: prev.cpc, cpa: prev.cpa, roas: prev.roas,
      avgFrequency: prev.reach > 0 ? prev.impressions / prev.reach : 0, campaignCount: campaigns.length
    };
  }, [periodComparison, campaigns.length]);

  const sparklineData = useMemo(() => {
    if (!dailyData.length) return { spend: [], conversions: [], messages: [], profile_visits: [], leads: [], purchases: [], initiate_checkout: [], revenue: [], clicks: [], impressions: [], ctr: [], roas: [], cpl: [] };
    return {
      spend: dailyData.map(d => d.spend), conversions: dailyData.map(d => d.conversions), messages: dailyData.map(d => d.messaging_replies),
      profile_visits: dailyData.map(d => d.profile_visits), leads: dailyData.map(d => d.leads_conversions), purchases: dailyData.map(d => d.sales_conversions),
      initiate_checkout: dailyData.map(d => d.initiate_checkout_conversions), revenue: dailyData.map(d => d.conversion_value), clicks: dailyData.map(d => d.clicks),
      impressions: dailyData.map(d => d.impressions), ctr: dailyData.map(d => d.ctr), roas: dailyData.map(d => d.roas), cpl: dailyData.map(d => d.cpa)
    };
  }, [dailyData]);

  const changes = useMemo(() => periodComparison?.changes || null, [periodComparison]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: selectedProject?.currency || 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatNumberCompact = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'; if (num >= 1000) return (num / 1000).toFixed(1) + 'K'; return num.toLocaleString('pt-BR'); };

  const loading = projectsLoading || (selectedProject ? (dataLoading || dailyLoading) : false);

  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[200px] sm:w-[400px] lg:w-[600px] h-[200px] sm:h-[400px] lg:h-[600px] bg-primary/3 rounded-full blur-[80px] sm:blur-[150px]" />
        </div>

        <div className="relative z-10 p-3 sm:p-6 lg:p-8 space-y-3 sm:space-y-6 lg:space-y-8 animate-fade-in overflow-x-hidden w-full">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center flex-shrink-0">
                  <img src={metaIcon} alt="Meta" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Meta Ads</h1>
                  <p className="text-muted-foreground text-[11px] sm:text-sm">{t('dashboard.overview')}</p>
                </div>
              </div>
              <div className="w-48 sm:w-56 flex-shrink-0">
                <ClientSelector />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="w-full sm:w-auto">
                <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} timezone={projectTimezone} onPresetChange={handlePresetChange} selectedPreset={selectedPreset} />
              </div>
              <div className="flex items-center gap-2">
                {hasSelectedProject && selectedProject && (
                  <PDFBuilderDialog projectId={selectedProject.id} projectName={selectedProject.name} businessModel={businessModel || null} currency={selectedProject.currency || 'BRL'} currentPeriod={getDateRangeFromPreset(selectedPreset, projectTimezone) || { since: format(new Date(), 'yyyy-MM-dd'), until: format(new Date(), 'yyyy-MM-dd') }} />
                )}
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

          {activeProjects.length === 0 && !loading ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t('dashboard.noProjectYet')}</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t('dashboard.createFirstProjectDesc')}</p>
              <Link to="/projects">
                <Button variant="gradient">{t('dashboard.createFirstProject')}</Button>
              </Link>
            </div>
          ) : loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {hasSelectedProject && <AccountBalanceCard projectId={selectedProject?.id || null} currency={selectedProject?.currency} />}

              <div className="flex items-center justify-end gap-2 flex-wrap">
                <MetricVisibilityConfig hiddenMetrics={hiddenMetrics} toggleMetric={toggleMetric} loading={hiddenMetricsLoading} />
                <Label htmlFor="comparison-toggle" className="text-[11px] sm:text-sm text-muted-foreground cursor-pointer">
                  <span className="hidden sm:inline">{t('dashboard.periodComparison')}</span>
                  <span className="sm:hidden">{t('comparison.compare')}</span>
                </Label>
                <Switch id="comparison-toggle" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90 sm:scale-100" />
              </div>

              {showComparison && hasSelectedProject && <PeriodComparison currentMetrics={metrics} previousMetrics={previousMetrics} businessModel={businessModel || null} currentPeriodLabel={selectedPreset === 'this_month' ? t('periods.thisMonth') : selectedPreset === 'last_7d' ? t('periods.last7Days') : selectedPreset === 'last_30d' ? t('periods.last30Days') : t('comparison.current')} previousPeriodLabel={t('dashboard.previous')} currency={selectedProject?.currency || 'BRL'} resultMetrics={metricConfig?.result_metrics} resultMetricsLabels={metricConfig?.result_metrics_labels} hiddenMetrics={hiddenMetrics} />}

              {/* General Metrics */}
              <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-4">
                  <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                  <h2 className="text-sm sm:text-lg font-semibold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{t('metrics.generalMetrics')}</h2>
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

              {/* Profile Visits */}
              {hasSelectedProject && profileVisitsData.hasProfileVisitCampaigns && !isMetricHidden('profile_visits') && (
                <div>
                  <div className="flex items-center gap-2 mb-2 sm:mb-4">
                    <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-pink-500 to-pink-500/50 rounded-full" />
                    <h2 className="text-sm sm:text-lg font-semibold text-foreground flex items-center gap-1 sm:gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      <Instagram className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" />
                      <span>{t('metrics.topOfFunnel')}</span>
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                    <SparklineCard title={t('metrics.profileVisits')} value={formatNumber(profileVisitsData.totalProfileVisits)} icon={Instagram} className="border-l-4 border-l-pink-500" />
                    <SparklineCard title={t('metrics.costPerVisit')} value={formatCurrency(profileVisitsData.costPerVisit)} icon={DollarSign} invertTrend />
                  </div>
                </div>
              )}

              {/* Result Metrics */}
              {hasSelectedProject && (
                <div>
                  <div className="flex items-center gap-2 mb-2 sm:mb-4">
                    <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-emerald-500 to-emerald-500/50 rounded-full" />
                    <h2 className="text-sm sm:text-lg font-semibold text-foreground flex items-center flex-wrap gap-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      <span>{t('metrics.results')}</span>
                      {!isCustom && <span className="text-[10px] sm:text-sm font-normal text-muted-foreground">({isEcommerce ? 'E-com' : isInsideSales ? 'Inside' : isPdv ? 'PDV' : isInfoproduto ? 'Info' : ''})</span>}
                    </h2>
                  </div>

                  {isEcommerce && <div className="metric-grid-results">
                    {!isMetricHidden('roas') && <SparklineCard title={t('metrics.roas')} value={`${metrics.roas.toFixed(2)}x`} change={changes?.roas} icon={TrendingUp} sparklineData={sparklineData.roas} className="border-l-4 border-l-metric-positive" />}
                    {!isMetricHidden('conversions') && !isMetricHidden('purchases') && <SparklineCard title={t('metrics.purchases')} value={formatNumber(metrics.totalSalesConversions || metrics.totalConversions)} change={changes?.conversions} icon={ShoppingCart} sparklineData={sparklineData.purchases.length > 0 ? sparklineData.purchases : sparklineData.conversions} tooltip={t('metrics.purchasesTooltip')} />}
                    {!isMetricHidden('conversion_value') && <SparklineCard title={t('metrics.revenue')} value={formatCurrency(metrics.totalConversionValue)} change={changes?.revenue} icon={Receipt} sparklineData={sparklineData.revenue} />}
                    {!isMetricHidden('cpa') && <SparklineCard title={t('metrics.cpa')} value={formatCurrency(metrics.cpa)} change={changes?.cpa} icon={Target} sparklineData={sparklineData.cpl} invertTrend />}
                  </div>}

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

                  {isInfoproduto && <div className="metric-grid-results">
                    {!isMetricHidden('conversions') && !isMetricHidden('purchases') && <SparklineCard title={t('metrics.sales')} value={formatNumber(metrics.totalSalesConversions || metrics.totalConversions)} change={changes?.conversions} icon={ShoppingCart} sparklineData={sparklineData.purchases} className="border-l-4 border-l-metric-positive" tooltip={t('metrics.purchasesTooltip')} />}
                    {!isMetricHidden('conversion_value') && <SparklineCard title={t('metrics.revenue')} value={formatCurrency(metrics.totalConversionValue)} change={changes?.revenue} icon={Receipt} sparklineData={sparklineData.revenue} />}
                    {!isMetricHidden('roas') && <SparklineCard title={t('metrics.roas')} value={`${metrics.roas.toFixed(2)}x`} change={changes?.roas} icon={TrendingUp} sparklineData={sparklineData.roas} className="border-l-4 border-l-metric-positive" />}
                    {!isMetricHidden('cpa') && <SparklineCard title={t('metrics.cpa')} value={formatCurrency(metrics.cpa)} change={changes?.cpa} icon={Target} sparklineData={sparklineData.cpl} invertTrend />}
                  </div>}

                  {isPdv && <div className="metric-grid-results">
                    {!isMetricHidden('conversions') && <SparklineCard title={t('metrics.visits')} value={formatNumber(metrics.totalConversions)} change={changes?.conversions} icon={Store} sparklineData={sparklineData.conversions} sparklineColor="hsl(var(--chart-2))" className="border-l-4 border-l-chart-2" />}
                    {!isMetricHidden('cpa') && <SparklineCard title={t('metrics.costPerVisit')} value={formatCurrency(metrics.cpa)} change={changes?.cpa} icon={DollarSign} sparklineData={sparklineData.cpl} sparklineColor="hsl(var(--chart-3))" invertTrend />}
                    {!isMetricHidden('reach') && <MetricCard title={t('metrics.reach')} value={formatNumber(metrics.totalReach)} icon={Users} trend="neutral" />}
                    {!isMetricHidden('frequency') && <MetricCard title={t('metrics.frequency')} value={metrics.avgFrequency.toFixed(2)} icon={Target} trend="neutral" />}
                  </div>}

                  {isCustom && metricConfig && <DynamicResultMetrics config={metricConfig} metrics={{
                    totalConversions: metrics.totalConversions, totalConversionValue: metrics.totalConversionValue, totalSpend: metrics.totalSpend,
                    totalClicks: metrics.totalClicks, totalImpressions: metrics.totalImpressions, totalReach: metrics.totalReach,
                    totalMessages: metrics.totalMessages, totalProfileVisits: metrics.totalProfileVisits, totalLeadsConversions: metrics.totalLeadsConversions,
                    totalSalesConversions: metrics.totalSalesConversions, totalInitiateCheckout: metrics.totalInitiateCheckout
                  }} previousMetrics={previousMetrics ? {
                    totalConversions: previousMetrics.totalConversions, totalMessages: previousMetrics.totalMessages,
                    totalLeadsConversions: previousMetrics.totalLeadsConversions, totalSalesConversions: previousMetrics.totalSalesConversions,
                    totalInitiateCheckout: previousMetrics.totalInitiateCheckout, totalSpend: previousMetrics.totalSpend
                  } : null} changes={changes} sparklineData={sparklineData} currency={selectedProject?.currency || 'BRL'} />}
                </div>
              )}

              {/* Charts */}
              <div className="space-y-4 sm:space-y-6">
                <div ref={chartRef}>
                  <CustomizableChart chartKey="dashboard-chart-1" data={dailyData} defaultTitle="Gráfico 1 - Performance" defaultPrimaryMetric="spend" defaultSecondaryMetric="conversions" defaultChartType="composed" currency={selectedProject?.currency || 'BRL'} className="chart-container-mobile" />
                </div>
                <CustomizableChart chartKey="dashboard-chart-2" data={dailyData} defaultTitle="Gráfico 2 - Alcance" defaultPrimaryMetric="impressions" defaultSecondaryMetric="ctr" defaultChartType="line" currency={selectedProject?.currency || 'BRL'} className="chart-container-mobile" />
                <CustomizableChart chartKey="dashboard-chart-3" data={dailyData} defaultTitle="Gráfico 3 - Custo" defaultPrimaryMetric="cpc" defaultSecondaryMetric="clicks" defaultChartType="bar" currency={selectedProject?.currency || 'BRL'} className="chart-container-mobile" />
              </div>

              {/* Funnel */}
              {hasSelectedProject && <FunnelChart impressions={metrics.totalImpressions} reach={metrics.totalReach} clicks={metrics.totalClicks} conversions={metrics.totalConversions} spend={metrics.totalSpend} ctr={metrics.ctr} cpc={metrics.cpc} cpl={metrics.cpa} cpm={metrics.cpm} frequency={metrics.avgFrequency} currency={selectedProject?.currency || 'BRL'} />}

              {/* Geographic */}
              <GeographicHeatMap countryData={demographicData?.country || []} regionData={demographicData?.region || []} isLoading={demographicLoading} currency={selectedProject?.currency || 'BRL'} />

              {/* Demographics */}
              <DemographicCharts data={demographicData} isLoading={demographicLoading} currency={selectedProject?.currency || 'BRL'} />

              {/* Campaigns with expandable Ad Sets & Ads */}
              {campaigns.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 sm:mb-4">
                    <div className="w-1 h-4 sm:h-6 bg-gradient-to-b from-blue-500 to-blue-500/50 rounded-full" />
                    <h2 className="text-sm sm:text-lg font-semibold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      Campanhas ({campaigns.length})
                    </h2>
                  </div>
                  <div className="glass-card overflow-hidden divide-y divide-border/30">
                    {campaigns.sort((a, b) => (b.spend || 0) - (a.spend || 0)).map((campaign) => {
                      const isExpanded = expandedCampaigns.has(campaign.id);
                      const campaignAdSets = adSets.filter(as => as.campaign_id === campaign.id);
                      return (
                        <div key={campaign.id}>
                          <button onClick={() => toggleCampaign(campaign.id)} className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-secondary/30 transition-colors text-left">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium truncate">{campaign.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0">
                                  {campaign.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{campaignAdSets.length} conjuntos</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs sm:text-sm font-semibold">{formatCurrency(campaign.spend || 0)}</p>
                              <p className="text-[10px] text-muted-foreground">{campaign.conversions || 0} conv.</p>
                            </div>
                          </button>
                          {/* Ad Sets */}
                          {isExpanded && campaignAdSets.length > 0 && (
                            <div className="bg-secondary/20 border-t border-border/20">
                              {campaignAdSets.sort((a, b) => (b.spend || 0) - (a.spend || 0)).map(adSet => {
                                const isAdSetExpanded = expandedAdSets.has(adSet.id);
                                const adSetAds = ads.filter(ad => ad.ad_set_id === adSet.id);
                                return (
                                  <div key={adSet.id}>
                                    <button onClick={() => toggleAdSet(adSet.id)} className="w-full flex items-center gap-2 pl-8 sm:pl-10 pr-3 py-2 hover:bg-secondary/40 transition-colors text-left">
                                      {isAdSetExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                                      <Layers className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] sm:text-xs font-medium truncate">{adSet.name}</p>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-[11px] sm:text-xs font-semibold">{formatCurrency(adSet.spend || 0)}</p>
                                        <p className="text-[9px] text-muted-foreground">{adSet.conversions || 0} conv.</p>
                                      </div>
                                    </button>
                                    {/* Ads */}
                                    {isAdSetExpanded && adSetAds.length > 0 && (
                                      <div className="bg-secondary/30">
                                        {adSetAds.sort((a, b) => (b.spend || 0) - (a.spend || 0)).map(ad => (
                                          <Link key={ad.id} to={`/creative/${ad.id}`} className="flex items-center gap-2 pl-14 sm:pl-16 pr-3 py-1.5 hover:bg-secondary/50 transition-colors">
                                            <div className="w-6 h-6 rounded bg-muted overflow-hidden flex-shrink-0">
                                              {(ad.creative_thumbnail || ad.cached_image_url) && (
                                                <img src={ad.cached_image_url || ad.creative_thumbnail || ''} className="w-full h-full object-cover" />
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-[10px] sm:text-[11px] truncate">{ad.name}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                              <p className="text-[10px] sm:text-[11px] font-semibold">{formatCurrency(ad.spend || 0)}</p>
                                            </div>
                                          </Link>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
