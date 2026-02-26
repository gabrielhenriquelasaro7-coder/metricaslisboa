import { useState, useEffect, useCallback, useMemo } from 'react';
import { SmoothLoader } from '@/components/layout/PageTransition';
import { PDFBuilderDialog } from '@/components/pdf/PDFBuilderDialog';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClientSelector } from '@/components/layout/ClientSelector';
import SparklineCard from '@/components/dashboard/SparklineCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { CustomizableChart } from '@/components/dashboard/CustomizableChart';
import { RevenueFlow } from '@/components/dashboard/RevenueFlow';
import PeriodComparison from '@/components/dashboard/PeriodComparison';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { useDemographicInsights } from '@/hooks/useDemographicInsights';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { DailyMetric } from '@/hooks/useDailyMetrics';
import { DateRange } from 'react-day-picker';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { DashboardSkeleton } from '@/components/skeletons';
import { format } from 'date-fns';
import {
  Megaphone, TrendingUp, DollarSign, MousePointerClick, Eye, ShoppingCart,
  RefreshCw, AlertCircle, Users, Search, Video, ShoppingBag, Globe,
  ChevronDown, ChevronRight, Key, BarChart3, MoreVertical, ExternalLink,
  ChevronLeft, ChevronRight as ChevronRightIcon, Filter, Wallet, Banknote,
  Crosshair, Zap, Receipt, Target, Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import googleAdsIcon from '@/assets/google-ads-icon.png';

const campaignTypeIcons: Record<string, React.ElementType> = {
  SEARCH: Search, DISPLAY: Globe, VIDEO: Video, SHOPPING: ShoppingBag, PERFORMANCE_MAX: TrendingUp,
};

const formatCampaignType = (type: string | null) => {
  if (!type) return 'Padrão';
  const types: Record<string, string> = {
    SEARCH: 'Pesquisa', DISPLAY: 'Display', VIDEO: 'Vídeo', SHOPPING: 'Shopping',
    PERFORMANCE_MAX: 'PMax', SMART: 'Smart', APP: 'App', LOCAL: 'Local', DISCOVERY: 'Discovery',
  };
  return types[type] || type;
};

const formatMatchType = (type: string | null) => {
  if (!type) return '-';
  return ({ EXACT: 'Exata', PHRASE: 'Frase', BROAD: 'Ampla' } as Record<string, string>)[type] || type;
};

const formatAdType = (type: string | null) => {
  if (!type) return 'Anúncio';
  const types: Record<string, string> = {
    RESPONSIVE_SEARCH_AD: 'Pesquisa Responsiva',
    RESPONSIVE_DISPLAY_AD: 'Display Responsivo',
    EXPANDED_TEXT_AD: 'Texto Expandido',
    CALL_AD: 'Anúncio de Chamada',
    EXPANDED_DYNAMIC_SEARCH_AD: 'Pesquisa Dinâmica',
    HOTEL_AD: 'Hotel',
    SHOPPING_PRODUCT_AD: 'Produto Shopping',
    SHOPPING_SMART_AD: 'Shopping Inteligente',
    VIDEO_AD: 'Vídeo',
    APP_AD: 'App',
    APP_ENGAGEMENT_AD: 'Engajamento App',
    LEGACY_RESPONSIVE_DISPLAY_AD: 'Display (Legado)',
    IMAGE_AD: 'Imagem',
    VIDEO_RESPONSIVE_AD: 'Vídeo Responsivo',
    DEMAND_GEN_MULTI_ASSET_AD: 'Demand Gen',
    DEMAND_GEN_CAROUSEL_AD: 'Carrossel Demand Gen',
    DEMAND_GEN_VIDEO_RESPONSIVE_AD: 'Vídeo Demand Gen',
    DEMAND_GEN_PRODUCT_AD: 'Produto Demand Gen',
    PERFORMANCE_MAX_AD: 'PMax',
  };
  return types[type] || type;
};

const formatAgeRange = (val: string) => ({
  AGE_RANGE_18_24: '18-24', AGE_RANGE_25_34: '25-34', AGE_RANGE_35_44: '35-44',
  AGE_RANGE_45_54: '45-54', AGE_RANGE_55_64: '55-64', AGE_RANGE_65_UP: '65+', AGE_RANGE_UNDETERMINED: 'N/D',
} as Record<string, string>)[val] || val;

const formatGender = (val: string) => ({ MALE: 'Masculino', FEMALE: 'Feminino', UNDETERMINED: 'N/D' } as Record<string, string>)[val] || val;

const formatDevice = (val: string) => ({ MOBILE: 'Mobile', DESKTOP: 'Desktop', TABLET: 'Tablet', CONNECTED_TV: 'TV', OTHER: 'Outro' } as Record<string, string>)[val] || val;

const KEYWORDS_PER_PAGE = 20;

function getPreviousPeriod(since: string, until: string, preset: DatePresetKey) {
  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  const days = Math.round((untilDate.getTime() - sinceDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (preset === 'this_month') {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevFirst = new Date(prevYear, prevMonth, 1);
    const prevLast = new Date(prevYear, prevMonth + 1, 0);
    const prevUntilDay = Math.min(now.getDate(), prevLast.getDate());
    return { since: format(prevFirst, 'yyyy-MM-dd'), until: format(new Date(prevYear, prevMonth, prevUntilDay), 'yyyy-MM-dd') };
  }
  if (preset === 'last_month') {
    const prevMonth = sinceDate.getMonth() === 0 ? 11 : sinceDate.getMonth() - 1;
    const prevYear = sinceDate.getMonth() === 0 ? sinceDate.getFullYear() - 1 : sinceDate.getFullYear();
    return { since: format(new Date(prevYear, prevMonth, 1), 'yyyy-MM-dd'), until: format(new Date(prevYear, prevMonth + 1, 0), 'yyyy-MM-dd') };
  }
  const prevUntil = new Date(sinceDate); prevUntil.setDate(prevUntil.getDate() - 1);
  const prevSince = new Date(prevUntil); prevSince.setDate(prevSince.getDate() - days + 1);
  return { since: format(prevSince, 'yyyy-MM-dd'), until: format(prevUntil, 'yyyy-MM-dd') };
}

export default function GoogleCampaigns() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdGroups, setExpandedAdGroups] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(true);

  const [kwPage, setKwPage] = useState(0);
  const [kwSearch, setKwSearch] = useState('');
  const [kwMatchFilter, setKwMatchFilter] = useState<string>('all');
  const [kwCampaignFilter, setKwCampaignFilter] = useState<string>('all');
  const [funnelFilter, setFunnelFilter] = useState<'all' | 'active' | 'paused'>('all');

  const { campaigns, adGroups, ads, keywords, demographics, dailyMetrics, loading, syncing, selectedProject, loadAllData, loadDailyMetrics, syncData, aggregateDailyMetrics, projectsLoading } = useGoogleAdsData();

  useEffect(() => {
    if (selectedProject?.id) {
      loadAllData(selectedProject.id);
      loadDailyMetrics(selectedProject.id, '2025-01-01');
    }
  }, [selectedProject?.id, loadAllData, loadDailyMetrics]);

  const handleSync = useCallback(() => syncData({ days: 420 }), [syncData]);

  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';
  const isPageLoading = loading && campaigns.length === 0;

  // Get current period bounds
  const periodBounds = useMemo(() => {
    if (selectedPreset === 'custom' && dateRange?.from && dateRange?.to) {
      return { since: format(dateRange.from, 'yyyy-MM-dd'), until: format(dateRange.to, 'yyyy-MM-dd') };
    }
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) return { since: period.since, until: period.until };
    return null;
  }, [selectedPreset, dateRange, selectedProject?.timezone]);

  // Period-filtered totals from dailyMetrics (not from campaigns aggregate)
  const totals = useMemo(() => {
    if (!periodBounds || !dailyMetrics.length) {
      // fallback to campaigns aggregate
      return campaigns.reduce((acc, c) => ({
        spend: acc.spend + c.spend, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
        conversions: acc.conversions + c.conversions, revenue: acc.revenue + c.conversion_value,
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
    }
    const filtered = dailyMetrics.filter(d => d.date >= periodBounds.since && d.date <= periodBounds.until);
    return filtered.reduce((acc, d) => ({
      spend: acc.spend + d.spend, impressions: acc.impressions + d.impressions, clicks: acc.clicks + d.clicks,
      conversions: acc.conversions + (d.conversions || 0), revenue: acc.revenue + (d.conversion_value || 0),
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
  }, [dailyMetrics, periodBounds, campaigns]);

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const avgCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const convRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

  // Budget summary - show accumulated spend & daily budget
  const budgetSummary = useMemo(() => {
    const activeCampaigns = campaigns.filter(c => c.status === 'ENABLED');
    const totalDailyBudget = activeCampaigns.reduce((s, c) => s + (c.budget_amount || 0), 0);
    // Monthly budget estimate (daily x 30.4)
    const monthlyBudget = totalDailyBudget * 30.4;
    // Remaining = monthly budget - current spend
    const remaining = monthlyBudget - totals.spend;
    return { totalDailyBudget, monthlyBudget, remaining, activeCampaigns: activeCampaigns.length, totalCampaigns: campaigns.length };
  }, [campaigns, totals.spend]);

  const formatCurrency = useCallback((num: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: selectedProject?.currency || 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num), [selectedProject?.currency]);
  const formatNumber = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'; if (num >= 1000) return (num / 1000).toFixed(1) + 'K'; return num.toLocaleString('pt-BR'); };
  const formatNumberCompact = formatNumber;

  // Chart data filtered by period
  const chartData = useMemo((): DailyMetric[] => {
    let filtered = dailyMetrics;
    if (periodBounds) {
      filtered = dailyMetrics.filter(d => d.date >= periodBounds.since && d.date <= periodBounds.until);
    }
    const agg = aggregateDailyMetrics(filtered);
    return agg.map(d => ({
      date: d.date, spend: d.spend, impressions: d.impressions, clicks: d.clicks, reach: 0,
      conversions: d.conversions, conversion_value: d.conversion_value, messaging_replies: 0, profile_visits: 0,
      leads_conversions: 0, sales_conversions: 0, initiate_checkout_conversions: 0,
      ctr: d.ctr, cpm: d.cpm, cpc: d.cpc, roas: d.roas, cpa: d.cpa,
      cvr_leads: 0, cvr_sales: 0,
    }));
  }, [dailyMetrics, aggregateDailyMetrics, periodBounds]);

  // Period comparison from daily metrics
  const periodComparison = useMemo(() => {
    if (!dailyMetrics.length || !periodBounds) return null;

    const { since, until } = periodBounds;
    const prev = getPreviousPeriod(since, until, selectedPreset);

    const currentData = dailyMetrics.filter(d => d.date >= since && d.date <= until);
    const previousData = dailyMetrics.filter(d => d.date >= prev.since && d.date <= prev.until);

    const sumMetrics = (data: typeof dailyMetrics) => data.reduce((acc, d) => ({
      spend: acc.spend + d.spend, impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks, conversions: acc.conversions + (d.conversions || 0),
      revenue: acc.revenue + (d.conversion_value || 0),
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

    const cur = sumMetrics(currentData);
    const pre = sumMetrics(previousData);

    const calcChange = (c: number, p: number) => p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0;

    const curCtr = cur.impressions > 0 ? (cur.clicks / cur.impressions) * 100 : 0;
    const preCtr = pre.impressions > 0 ? (pre.clicks / pre.impressions) * 100 : 0;
    const curCpm = cur.impressions > 0 ? (cur.spend / cur.impressions) * 1000 : 0;
    const preCpm = pre.impressions > 0 ? (pre.spend / pre.impressions) * 1000 : 0;
    const curCpc = cur.clicks > 0 ? cur.spend / cur.clicks : 0;
    const preCpc = pre.clicks > 0 ? pre.spend / pre.clicks : 0;
    const curCpa = cur.conversions > 0 ? cur.spend / cur.conversions : 0;
    const preCpa = pre.conversions > 0 ? pre.spend / pre.conversions : 0;
    const curRoas = cur.spend > 0 ? cur.revenue / cur.spend : 0;
    const preRoas = pre.spend > 0 ? pre.revenue / pre.spend : 0;

    return {
      currentMetrics: {
        totalSpend: cur.spend, totalImpressions: cur.impressions, totalClicks: cur.clicks,
        totalConversions: cur.conversions, totalConversionValue: cur.revenue,
        ctr: curCtr, cpm: curCpm, cpc: curCpc, cpa: curCpa, roas: curRoas,
      },
      previousMetrics: previousData.length > 0 ? {
        totalSpend: pre.spend, totalImpressions: pre.impressions, totalClicks: pre.clicks,
        totalConversions: pre.conversions, totalConversionValue: pre.revenue,
        ctr: preCtr, cpm: preCpm, cpc: preCpc, cpa: preCpa, roas: preRoas,
      } : null,
      changes: {
        spend: calcChange(cur.spend, pre.spend),
        impressions: calcChange(cur.impressions, pre.impressions),
        clicks: calcChange(cur.clicks, pre.clicks),
        conversions: calcChange(cur.conversions, pre.conversions),
        roas: calcChange(curRoas, preRoas),
        cpa: calcChange(curCpa, preCpa),
        ctr: calcChange(curCtr, preCtr),
        cpm: calcChange(curCpm, preCpm),
        cpc: calcChange(curCpc, preCpc),
        revenue: calcChange(cur.revenue, pre.revenue),
      },
    };
  }, [dailyMetrics, periodBounds, selectedPreset]);

  // Demographic data for Google via useDemographicInsights (from google_demographic_insights)
  const demographicDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) return { startDate: dateRange.from, endDate: dateRange.to };
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) return { startDate: new Date(period.since + 'T00:00:00'), endDate: new Date(period.until + 'T23:59:59') };
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30);
    return { startDate: start, endDate: end };
  }, [selectedPreset, selectedProject?.timezone, dateRange]);

  // Use the Google-specific demographics from the loaded data
  const demoAggregated = useMemo(() => {
    const agg = new Map<string, { type: string; value: string; spend: number; impressions: number; clicks: number; conversions: number }>();
    for (const d of demographics) {
      const key = `${d.breakdown_type}_${d.breakdown_value}`;
      const e = agg.get(key);
      if (e) { e.spend += d.spend; e.impressions += d.impressions; e.clicks += d.clicks; e.conversions += d.conversions; }
      else { agg.set(key, { type: d.breakdown_type, value: d.breakdown_value, spend: d.spend, impressions: d.impressions, clicks: d.clicks, conversions: d.conversions }); }
    }
    return Array.from(agg.values());
  }, [demographics]);

  const ageData = useMemo(() => demoAggregated.filter(d => d.type === 'age').sort((a, b) => b.spend - a.spend), [demoAggregated]);
  const genderData = useMemo(() => demoAggregated.filter(d => d.type === 'gender').sort((a, b) => b.spend - a.spend), [demoAggregated]);
  const deviceData = useMemo(() => demoAggregated.filter(d => d.type === 'device').sort((a, b) => b.spend - a.spend), [demoAggregated]);

  const filteredKeywords = useMemo(() => {
    let kws = [...keywords];
    if (kwSearch) {
      const s = kwSearch.toLowerCase();
      kws = kws.filter(k => k.keyword_text.toLowerCase().includes(s) || (k.campaign_name || '').toLowerCase().includes(s) || (k.ad_group_name || '').toLowerCase().includes(s));
    }
    if (kwMatchFilter !== 'all') kws = kws.filter(k => k.match_type === kwMatchFilter);
    if (kwCampaignFilter !== 'all') kws = kws.filter(k => k.campaign_id === kwCampaignFilter);
    return kws;
  }, [keywords, kwSearch, kwMatchFilter, kwCampaignFilter]);

  const kwTotalPages = Math.ceil(filteredKeywords.length / KEYWORDS_PER_PAGE);
  const pagedKeywords = filteredKeywords.slice(kwPage * KEYWORDS_PER_PAGE, (kwPage + 1) * KEYWORDS_PER_PAGE);

  useEffect(() => { setKwPage(0); }, [kwSearch, kwMatchFilter, kwCampaignFilter]);

  const funnelTotals = useMemo(() => {
    const filtered = funnelFilter === 'all' ? campaigns : campaigns.filter(c => funnelFilter === 'active' ? c.status === 'ENABLED' : c.status === 'PAUSED');
    return filtered.reduce((acc, c) => ({
      spend: acc.spend + c.spend, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
      conversions: acc.conversions + c.conversions, revenue: acc.revenue + c.conversion_value,
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
  }, [campaigns, funnelFilter]);

  if (!loading && !projectsLoading && !selectedProject) {
    navigate('/dashboard');
    return null;
  }

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAdGroup = (id: string) => {
    setExpandedAdGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        <div className="relative z-10 p-3 sm:p-6 lg:p-8 pb-16 space-y-4 sm:space-y-6 animate-fade-in w-full">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-red-500/20 flex items-center justify-center flex-shrink-0">
                  <img src={googleAdsIcon} alt="Google Ads" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Google Ads</h1>
                  <p className="text-muted-foreground text-[11px] sm:text-sm">Visão completa</p>
                </div>
              </div>
              <div className="w-48 sm:w-56 flex-shrink-0">
                <ClientSelector />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="w-full sm:w-auto">
                <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} timezone={selectedProject?.timezone} onPresetChange={(p: string) => setSelectedPreset(p as DatePresetKey)} selectedPreset={selectedPreset} />
              </div>
              <div className="flex items-center gap-2">
                {selectedProject && (
                  <PDFBuilderDialog
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    businessModel={selectedProject.business_model as any}
                    currency={selectedProject.currency || 'BRL'}
                    currentPeriod={periodBounds || { since: new Date().toISOString().split('T')[0], until: new Date().toISOString().split('T')[0] }}
                    source="google"
                  />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border z-50">
                    <DropdownMenuItem onClick={handleSync} disabled={syncing || !selectedProject}>
                      <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                      {syncing ? 'Sincronizando...' : 'Sincronizar Tudo (2025)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => syncData({ syncType: 'keywords', days: 420 })} disabled={syncing || !selectedProject}>
                      <Key className="w-4 h-4 mr-2" />
                      Palavras-chave
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => syncData({ syncType: 'demographics', days: 420 })} disabled={syncing || !selectedProject}>
                      <Users className="w-4 h-4 mr-2" />
                      Demográficos
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <SmoothLoader loading={isPageLoading || (!selectedProject?.google_customer_id && loading)} skeleton={<DashboardSkeleton />}>
            {!selectedProject?.google_customer_id && !loading && !projectsLoading ? (
              <div className="glass-card p-6 sm:p-8 lg:p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Configure o Google Ads</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">Adicione o <strong>ID do cliente</strong> nas configurações do projeto.</p>
                <Button onClick={() => navigate('/dashboard')} variant="gradient">Ir para Projetos</Button>
              </div>
            ) : campaigns.length === 0 && !loading ? (
              <div className="glass-card p-6 sm:p-8 lg:p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhuma campanha</h3>
                <p className="text-muted-foreground mb-6">Clique em sincronizar para importar dados de 2025.</p>
                <Button onClick={handleSync} disabled={syncing} variant="gradient">
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">

                {/* Saldo da Conta Google */}
                {budgetSummary.totalDailyBudget > 0 && (
                  <div className="glass-card p-3 sm:p-4 border-l-4 border-l-yellow-500">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Saldo Estimado (Mensal)</p>
                          <p className={cn("text-sm sm:text-lg font-bold", budgetSummary.remaining > 0 ? 'text-metric-positive' : 'text-metric-negative')}>
                            {formatCurrency(Math.max(0, budgetSummary.remaining))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6 text-right flex-wrap">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Orç. Mensal</p>
                          <p className="text-xs sm:text-sm font-semibold">{formatCurrency(budgetSummary.monthlyBudget)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Gasto no Período</p>
                          <p className="text-xs sm:text-sm font-semibold">{formatCurrency(totals.spend)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Campanhas Ativas</p>
                          <p className="text-xs sm:text-sm font-semibold text-metric-positive">{budgetSummary.activeCampaigns}/{budgetSummary.totalCampaigns}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comparison Toggle */}
                <div className="flex items-center justify-end gap-2">
                  <Label htmlFor="google-comparison-toggle" className="text-[11px] sm:text-sm text-muted-foreground cursor-pointer">
                    Comparação de Períodos
                  </Label>
                  <Switch id="google-comparison-toggle" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90 sm:scale-100" />
                </div>

                {/* Period Comparison */}
                {showComparison && periodComparison && (
                  <div className="origin-top">
                    <PeriodComparison
                      currentMetrics={periodComparison.currentMetrics}
                      previousMetrics={periodComparison.previousMetrics}
                      businessModel={selectedProject?.business_model || null}
                      currentPeriodLabel={selectedPreset === 'this_month' ? 'Este Mês' : selectedPreset === 'last_7d' ? 'Últimos 7 Dias' : selectedPreset === 'last_30d' ? 'Últimos 30 Dias' : selectedPreset === 'last_month' ? 'Mês Passado' : 'Período Atual'}
                      previousPeriodLabel="Período Anterior"
                      currency={selectedProject?.currency || 'BRL'}
                    />
                  </div>
                )}

                {/* Métricas Gerais */}
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                    <h2 className="text-xs sm:text-sm font-semibold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Métricas Gerais</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
                    <div className="glass-card p-2.5 sm:p-3 border-l-2 border-l-primary">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Banknote className="w-3 h-3 text-primary" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">Investimento</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(totals.spend)}</p>
                    </div>
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Eye className="w-3 h-3 text-primary" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">Impressões</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumberCompact(totals.impressions)}</p>
                    </div>
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <MousePointerClick className="w-3 h-3 text-primary" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">Cliques</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumberCompact(totals.clicks)}</p>
                    </div>
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Crosshair className="w-3 h-3 text-primary" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">CTR</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{avgCtr.toFixed(2)}%</p>
                    </div>
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <BarChart3 className="w-3 h-3 text-primary" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">CPM</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(avgCpm)}</p>
                    </div>
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">CPC</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(avgCpc)}</p>
                    </div>
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Users className="w-3 h-3 text-primary" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">Taxa Conv.</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{convRate.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>

                {/* Resultados */}
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-emerald-500/50 rounded-full" />
                    <h2 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      <span>Resultados</span>
                      <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
                        ({isEcommerce ? 'E-com' : isInsideSales ? 'Inside' : 'Google'})
                      </span>
                    </h2>
                  </div>
                  {isEcommerce ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                      <SparklineCard title="ROAS" value={`${avgRoas.toFixed(2)}x`} change={periodComparison?.changes?.roas} icon={TrendingUp} className="border-l-4 border-l-metric-positive" />
                      <SparklineCard title="Compras" value={formatNumber(totals.conversions)} change={periodComparison?.changes?.conversions} icon={ShoppingCart} />
                      <SparklineCard title="Receita" value={formatCurrency(totals.revenue)} change={periodComparison?.changes?.revenue} icon={Receipt} />
                      <SparklineCard title="CPA" value={formatCurrency(avgCpa)} change={periodComparison?.changes?.cpa} icon={Target} invertTrend />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                      <SparklineCard title={isInsideSales ? 'Leads' : 'Conversões'} value={formatNumber(totals.conversions)} change={periodComparison?.changes?.conversions} icon={Users} className="border-l-4 border-l-chart-1" />
                      <SparklineCard title={isInsideSales ? 'CPL' : 'CPA'} value={formatCurrency(avgCpa)} change={periodComparison?.changes?.cpa} icon={Receipt} invertTrend />
                      <SparklineCard title="Taxa de Conv." value={`${convRate.toFixed(2)}%`} icon={Activity} />
                      {totals.revenue > 0 && <SparklineCard title="ROAS" value={`${avgRoas.toFixed(2)}x`} change={periodComparison?.changes?.roas} icon={TrendingUp} />}
                    </div>
                  )}
                </div>

                {/* === CAMPANHAS === */}
                <div className="glass-card overflow-hidden border-t-2 border-t-primary/30">
                  <div className="px-4 py-3 bg-secondary/30 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2"><Megaphone className="w-4 h-4" /> Campanhas</h3>
                    <span className="text-xs text-muted-foreground">{campaigns.length} campanhas · {adGroups.length} grupos · {ads.length} anúncios</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left py-2.5 px-3 font-medium text-xs">Nome</th>
                          <th className="text-center py-2.5 px-2 font-medium text-xs hidden sm:table-cell">Status</th>
                          <th className="text-center py-2.5 px-2 font-medium text-xs hidden md:table-cell">Tipo</th>
                          <th className="text-right py-2.5 px-2 font-medium text-xs">Gasto</th>
                          <th className="text-right py-2.5 px-2 font-medium text-xs hidden sm:table-cell">Cliques</th>
                          <th className="text-right py-2.5 px-2 font-medium text-xs hidden md:table-cell">CTR</th>
                          <th className="text-right py-2.5 px-2 font-medium text-xs">Conv</th>
                          <th className="text-right py-2.5 px-2 font-medium text-xs hidden sm:table-cell">{isEcommerce ? 'ROAS' : 'CPA'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map(campaign => {
                          const CIcon = campaignTypeIcons[campaign.campaign_type || ''] || Megaphone;
                          const isExp = expandedCampaigns.has(campaign.id);
                          const cAdGroups = adGroups.filter(ag => ag.campaign_id === campaign.id);
                          return (
                            <CampaignRow key={campaign.id} campaign={campaign} icon={CIcon} isExpanded={isExp} adGroups={cAdGroups} ads={ads}
                              expandedAdGroups={expandedAdGroups} onToggleCampaign={toggleCampaign} onToggleAdGroup={toggleAdGroup}
                              formatCurrency={formatCurrency} formatNumber={formatNumber} isEcommerce={isEcommerce} />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 bg-secondary/30 border-t border-border flex items-center justify-end text-xs">
                    <span className="font-medium">Total: {formatCurrency(totals.spend)}</span>
                  </div>
                </div>

                {/* === PALAVRAS-CHAVE === */}
                <div className="glass-card overflow-hidden border-t-2 border-t-primary/30">
                  <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-medium flex items-center gap-2"><Key className="w-4 h-4" /> Palavras-chave</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input placeholder="Buscar palavra-chave..." value={kwSearch} onChange={e => setKwSearch(e.target.value)} className="h-8 pl-7 text-xs w-44 sm:w-56" />
                        </div>
                        <Select value={kwCampaignFilter} onValueChange={setKwCampaignFilter}>
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <Filter className="w-3 h-3 mr-1 flex-shrink-0" />
                            <SelectValue placeholder="Campanha" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas Campanhas</SelectItem>
                            {campaigns.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                <span className="truncate max-w-[180px] block">{c.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={kwMatchFilter} onValueChange={setKwMatchFilter}>
                          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tipo: Todos</SelectItem>
                            <SelectItem value="EXACT">Exata</SelectItem>
                            <SelectItem value="PHRASE">Frase</SelectItem>
                            <SelectItem value="BROAD">Ampla</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{filteredKeywords.length} palavras</span>
                      </div>
                    </div>
                  </div>
                  {filteredKeywords.length === 0 ? (
                    <div className="p-6 text-center">
                      <Key className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-xs">{keywords.length === 0 ? 'Nenhuma palavra-chave. Clique em sincronizar.' : 'Nenhum resultado para o filtro.'}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/50">
                            <th className="text-left py-2 px-3 font-medium text-xs">Palavra-chave</th>
                            <th className="text-center py-2 px-2 font-medium text-xs hidden sm:table-cell">Tipo</th>
                            <th className="text-center py-2 px-2 font-medium text-xs hidden md:table-cell">Qualidade</th>
                            <th className="text-right py-2 px-2 font-medium text-xs">Gasto</th>
                            <th className="text-right py-2 px-2 font-medium text-xs hidden sm:table-cell">Impr.</th>
                            <th className="text-right py-2 px-2 font-medium text-xs">Cliques</th>
                            <th className="text-right py-2 px-2 font-medium text-xs hidden md:table-cell">CTR</th>
                            <th className="text-right py-2 px-2 font-medium text-xs hidden sm:table-cell">CPC</th>
                            <th className="text-right py-2 px-2 font-medium text-xs">Conv</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedKeywords.map(kw => (
                            <tr key={kw.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                              <td className="py-2 px-3">
                                <span className="font-medium text-xs block">{kw.keyword_text}</span>
                                <span className="text-[10px] text-muted-foreground truncate block max-w-[200px]">{kw.campaign_name} › {kw.ad_group_name}</span>
                              </td>
                              <td className="py-2 px-2 text-center hidden sm:table-cell">
                                <Badge variant="outline" className="text-[10px]">{formatMatchType(kw.match_type)}</Badge>
                              </td>
                              <td className="py-2 px-2 text-center hidden md:table-cell">
                                {kw.quality_score ? (
                                  <span className={cn("text-xs font-medium", kw.quality_score >= 7 ? 'text-metric-positive' : kw.quality_score >= 4 ? 'text-metric-warning' : 'text-metric-negative')}>
                                    {kw.quality_score}/10
                                  </span>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 px-2 text-right text-xs">{formatCurrency(kw.spend)}</td>
                              <td className="py-2 px-2 text-right text-xs hidden sm:table-cell">{formatNumber(kw.impressions)}</td>
                              <td className="py-2 px-2 text-right text-xs">{formatNumber(kw.clicks)}</td>
                              <td className="py-2 px-2 text-right text-xs hidden md:table-cell">{kw.ctr.toFixed(2)}%</td>
                              <td className="py-2 px-2 text-right text-xs hidden sm:table-cell">{formatCurrency(kw.cpc)}</td>
                              <td className="py-2 px-2 text-right text-xs">{formatNumber(kw.conversions)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {kwTotalPages > 1 && (
                    <div className="px-4 py-2.5 bg-secondary/30 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pág. {kwPage + 1} de {kwTotalPages}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={kwPage === 0} onClick={() => setKwPage(p => p - 1)}>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={kwPage >= kwTotalPages - 1} onClick={() => setKwPage(p => p + 1)}>
                          <ChevronRightIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3 Gráficos */}
                {chartData.length > 0 && (
                  <div className="space-y-4 sm:space-y-6">
                    <CustomizableChart chartKey="google_invest_clicks" data={chartData} defaultTitle="Investimento vs Cliques" defaultPrimaryMetric="spend" defaultSecondaryMetric="clicks" defaultChartType="composed" currency={selectedProject?.currency || 'BRL'} />
                    <CustomizableChart chartKey="google_conv_cpa" data={chartData} defaultTitle="Conversões vs CPA" defaultPrimaryMetric="conversions" defaultSecondaryMetric="cpa" defaultChartType="composed" currency={selectedProject?.currency || 'BRL'} />
                    <CustomizableChart chartKey="google_ctr_cpc" data={chartData} defaultTitle="CTR vs CPC" defaultPrimaryMetric="ctr" defaultSecondaryMetric="cpc" defaultChartType="line" currency={selectedProject?.currency || 'BRL'} />
                  </div>
                )}

                {/* Funil */}
                <RevenueFlow
                  impressions={funnelTotals.impressions}
                  reach={funnelTotals.impressions * 0.8} // Estimativa para Google reach se não disponível
                  clicks={funnelTotals.clicks}
                  conversions={funnelTotals.conversions}
                  currency={selectedProject?.currency || 'BRL'}
                  campaignFilter={funnelFilter}
                  onCampaignFilterChange={setFunnelFilter}
                />

                {/* === DEMOGRÁFICOS === */}
                {demographics.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3"><Users className="w-4 h-4" /> Demográficos Google</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <DemoCard title="Faixa Etária" icon={Users} data={ageData} formatLabel={formatAgeRange} barColor="bg-primary" formatCurrency={formatCurrency} />
                      <DemoCard title="Gênero" icon={Users} data={genderData} formatLabel={formatGender} barColor="bg-accent" formatCurrency={formatCurrency} />
                      <DemoCard title="Dispositivo" icon={BarChart3} data={deviceData} formatLabel={formatDevice} barColor="bg-secondary-foreground/50" formatCurrency={formatCurrency} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </SmoothLoader>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Sub-components

function DemoCard({ title, icon: Icon, data, formatLabel, barColor, formatCurrency }: { title: string; icon: React.ElementType; data: { value: string; spend: number; clicks: number; conversions: number }[]; formatLabel: (v: string) => string; barColor: string; formatCurrency: (n: number) => string }) {
  const total = data.reduce((s, d) => s + d.spend, 0);
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 bg-secondary/30 border-b border-border">
        <h3 className="text-sm font-medium flex items-center gap-2"><Icon className="w-4 h-4" /> {title}</h3>
      </div>
      <div className="p-3 space-y-2.5">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.spend / total) * 100 : 0;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{formatLabel(d.value)}</span>
                <span className="text-[10px] text-muted-foreground">{formatCurrency(d.spend)} · {pct.toFixed(0)}%</span>
              </div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                <span>{d.clicks} cliques</span>
                <span>{d.conversions} conv.</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CampaignRow({ campaign, icon: CIcon, isExpanded, adGroups, ads, expandedAdGroups, onToggleCampaign, onToggleAdGroup, formatCurrency, formatNumber, isEcommerce }: any) {
  return (
    <>
      <tr className="border-b border-border/30 hover:bg-secondary/20 cursor-pointer transition-colors" onClick={() => onToggleCampaign(campaign.id)}>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <CIcon className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-medium text-xs truncate max-w-[200px]">{campaign.name}</span>
          </div>
        </td>
        <td className="py-2.5 px-2 text-center hidden sm:table-cell">
          <Badge className={cn("text-[10px]", campaign.status === 'ENABLED' ? "bg-metric-positive text-white" : campaign.status === 'PAUSED' ? "bg-metric-warning text-white" : "bg-secondary text-muted-foreground")}>
            {campaign.status === 'ENABLED' ? 'Ativo' : campaign.status === 'PAUSED' ? 'Pausado' : campaign.status}
          </Badge>
        </td>
        <td className="py-2.5 px-2 text-center text-xs text-muted-foreground hidden md:table-cell">{formatCampaignType(campaign.campaign_type)}</td>
        <td className="py-2.5 px-2 text-right font-medium text-xs">{formatCurrency(campaign.spend)}</td>
        <td className="py-2.5 px-2 text-right text-xs hidden sm:table-cell">{formatNumber(campaign.clicks)}</td>
        <td className="py-2.5 px-2 text-right text-xs hidden md:table-cell">{campaign.ctr.toFixed(2)}%</td>
        <td className="py-2.5 px-2 text-right text-xs">{formatNumber(campaign.conversions)}</td>
        <td className="py-2.5 px-2 text-right text-xs hidden sm:table-cell">{isEcommerce ? `${campaign.roas.toFixed(2)}x` : formatCurrency(campaign.cost_per_conversion)}</td>
      </tr>
      {isExpanded && adGroups.map((ag: any) => {
        const isAgExp = expandedAdGroups.has(ag.id);
        const agAds = ads.filter((a: any) => a.ad_group_id === ag.id);
        return <AdGroupRow key={ag.id} adGroup={ag} isExpanded={isAgExp} ads={agAds} onToggle={onToggleAdGroup} formatCurrency={formatCurrency} formatNumber={formatNumber} isEcommerce={isEcommerce} />;
      })}
    </>
  );
}

function AdGroupRow({ adGroup: ag, isExpanded, ads, onToggle, formatCurrency, formatNumber, isEcommerce }: any) {
  return (
    <>
      <tr className="border-b border-border/20 bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-colors" onClick={() => onToggle(ag.id)}>
        <td className="py-2 px-3 pl-10">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="text-xs font-medium truncate max-w-[180px]">{ag.name}</span>
          </div>
        </td>
        <td className="py-2 px-2 text-center hidden sm:table-cell">
          <Badge className={cn("text-[10px]", ag.status === 'ENABLED' ? "bg-metric-positive text-white" : "bg-secondary text-muted-foreground")}>
            {ag.status === 'ENABLED' ? 'Ativo' : ag.status === 'PAUSED' ? 'Pausado' : ag.status}
          </Badge>
        </td>
        <td className="py-2 px-2 hidden md:table-cell" />
        <td className="py-2 px-2 text-right text-xs">{formatCurrency(ag.spend)}</td>
        <td className="py-2 px-2 text-right text-xs hidden sm:table-cell">{formatNumber(ag.clicks)}</td>
        <td className="py-2 px-2 text-right text-xs hidden md:table-cell">{ag.ctr.toFixed(2)}%</td>
        <td className="py-2 px-2 text-right text-xs">{formatNumber(ag.conversions)}</td>
        <td className="py-2 px-2 text-right text-xs hidden sm:table-cell">{isEcommerce ? `${ag.roas.toFixed(2)}x` : formatCurrency(ag.cost_per_conversion)}</td>
      </tr>
      {isExpanded && ads.length > 0 && (
        <tr className="border-b border-border/10">
          <td colSpan={8} className="p-0">
            <div className="pl-14 pr-4 py-3 space-y-2 bg-secondary/5">
              {ads.map((ad: any) => (
                <div key={ad.id} className="glass-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className={cn("text-[9px] flex-shrink-0", ad.status === 'ENABLED' ? "bg-metric-positive text-white" : "bg-secondary text-muted-foreground")}>
                        {ad.status === 'ENABLED' ? 'Ativo' : 'Pausado'}
                      </Badge>
                      <span className="text-xs font-medium truncate">{ad.name}</span>
                      {ad.ad_type && <Badge variant="outline" className="text-[9px] flex-shrink-0">{formatAdType(ad.ad_type)}</Badge>}
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center flex-shrink-0">
                      <div><p className="text-[9px] text-muted-foreground">Gasto</p><p className="text-xs font-semibold">{formatCurrency(ad.spend)}</p></div>
                      <div><p className="text-[9px] text-muted-foreground">Cliques</p><p className="text-xs font-medium">{formatNumber(ad.clicks)}</p></div>
                      <div><p className="text-[9px] text-muted-foreground">CTR</p><p className="text-xs font-medium">{ad.ctr.toFixed(2)}%</p></div>
                      <div><p className="text-[9px] text-muted-foreground">Conv</p><p className="text-xs font-medium">{formatNumber(ad.conversions)}</p></div>
                    </div>
                  </div>
                  {/* Headlines as ad preview */}
                  {ad.headlines?.length > 0 && (
                    <div className="bg-secondary/30 rounded-lg p-2.5 space-y-1.5">
                      <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Títulos do Anúncio</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ad.headlines.map((h: string, i: number) => (
                          <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ad.descriptions?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Descrições</p>
                      {ad.descriptions.slice(0, 2).map((d: string, i: number) => (
                        <p key={i} className="text-[10px] text-muted-foreground leading-relaxed">{d}</p>
                      ))}
                    </div>
                  )}
                  {ad.final_urls?.length > 0 && (
                    <a href={ad.final_urls[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 truncate bg-primary/5 rounded px-2 py-1">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{ad.final_urls[0]}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
