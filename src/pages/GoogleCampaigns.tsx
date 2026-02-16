import { useState, useEffect, useCallback, useMemo } from 'react';
import { SmoothLoader } from '@/components/layout/PageTransition';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClientSelector } from '@/components/layout/ClientSelector';
import SparklineCard from '@/components/dashboard/SparklineCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { CustomizableChart } from '@/components/dashboard/CustomizableChart';
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { DailyMetric } from '@/hooks/useDailyMetrics';
import { DateRange } from 'react-day-picker';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { DashboardSkeleton } from '@/components/skeletons';
import {
  Megaphone, TrendingUp, DollarSign, MousePointerClick, Eye, ShoppingCart,
  RefreshCw, AlertCircle, Users, Search, Video, ShoppingBag, Globe,
  ChevronDown, ChevronRight, Key, BarChart3, MoreVertical, ExternalLink,
  ChevronLeft, ChevronRight as ChevronRightIcon, Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const formatAgeRange = (val: string) => ({
  AGE_RANGE_18_24: '18-24', AGE_RANGE_25_34: '25-34', AGE_RANGE_35_44: '35-44',
  AGE_RANGE_45_54: '45-54', AGE_RANGE_55_64: '55-64', AGE_RANGE_65_UP: '65+', AGE_RANGE_UNDETERMINED: 'N/D',
} as Record<string, string>)[val] || val;

const formatGender = (val: string) => ({ MALE: 'Masculino', FEMALE: 'Feminino', UNDETERMINED: 'N/D' } as Record<string, string>)[val] || val;

const formatDevice = (val: string) => ({ MOBILE: 'Mobile', DESKTOP: 'Desktop', TABLET: 'Tablet', CONNECTED_TV: 'TV', OTHER: 'Outro' } as Record<string, string>)[val] || val;

const KEYWORDS_PER_PAGE = 20;

export default function GoogleCampaigns() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdGroups, setExpandedAdGroups] = useState<Set<string>>(new Set());

  // Keywords state
  const [kwPage, setKwPage] = useState(0);
  const [kwSearch, setKwSearch] = useState('');
  const [kwMatchFilter, setKwMatchFilter] = useState<string>('all');
  const [funnelFilter, setFunnelFilter] = useState<'all' | 'active' | 'paused'>('all');

  const { campaigns, adGroups, ads, keywords, demographics, dailyMetrics, loading, syncing, selectedProject, loadAllData, loadDailyMetrics, syncData, aggregateDailyMetrics, projectsLoading } = useGoogleAdsData();

  useEffect(() => {
    if (selectedProject?.id) {
      loadAllData(selectedProject.id);
      // Load daily metrics for charts - all of 2025
      loadDailyMetrics(selectedProject.id, '2025-01-01');
    }
  }, [selectedProject?.id, loadAllData, loadDailyMetrics]);

  const handleSync = useCallback(() => syncData({ days: 420 }), [syncData]); // All of 2025+

  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isPageLoading = loading && campaigns.length === 0;

  const totals = useMemo(() => campaigns.reduce((acc, c) => ({
    spend: acc.spend + c.spend, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
    conversions: acc.conversions + c.conversions, revenue: acc.revenue + c.conversion_value,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }), [campaigns]);

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const avgCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const convRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

  const formatCurrency = useCallback((num: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: selectedProject?.currency || 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num), [selectedProject?.currency]);
  const formatNumber = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'; if (num >= 1000) return (num / 1000).toFixed(1) + 'K'; return num.toLocaleString('pt-BR'); };

  // Convert Google daily metrics to DailyMetric format for charts
  const chartData = useMemo((): DailyMetric[] => {
    const agg = aggregateDailyMetrics(dailyMetrics);
    return agg.map(d => ({
      date: d.date,
      spend: d.spend,
      impressions: d.impressions,
      clicks: d.clicks,
      reach: 0,
      conversions: d.conversions,
      conversion_value: d.conversion_value,
      messaging_replies: 0,
      profile_visits: 0,
      leads_conversions: 0,
      sales_conversions: 0,
      initiate_checkout_conversions: 0,
      ctr: d.ctr,
      cpm: d.cpm,
      cpc: d.cpc,
      roas: d.roas,
      cpa: d.cpa,
    }));
  }, [dailyMetrics, aggregateDailyMetrics]);

  // Demographics
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

  // Filtered keywords
  const filteredKeywords = useMemo(() => {
    let kws = [...keywords];
    if (kwSearch) {
      const s = kwSearch.toLowerCase();
      kws = kws.filter(k => k.keyword_text.toLowerCase().includes(s) || (k.campaign_name || '').toLowerCase().includes(s) || (k.ad_group_name || '').toLowerCase().includes(s));
    }
    if (kwMatchFilter !== 'all') {
      kws = kws.filter(k => k.match_type === kwMatchFilter);
    }
    return kws;
  }, [keywords, kwSearch, kwMatchFilter]);

  const kwTotalPages = Math.ceil(filteredKeywords.length / KEYWORDS_PER_PAGE);
  const pagedKeywords = filteredKeywords.slice(kwPage * KEYWORDS_PER_PAGE, (kwPage + 1) * KEYWORDS_PER_PAGE);

  // Reset page on filter change
  useEffect(() => { setKwPage(0); }, [kwSearch, kwMatchFilter]);

  // Funnel data filtered by campaign status
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

          <SmoothLoader loading={isPageLoading} skeleton={<DashboardSkeleton />}>
            {!selectedProject?.google_customer_id ? (
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
                {/* Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
                  <SparklineCard title="Gasto Total" value={formatCurrency(totals.spend)} icon={DollarSign} />
                  <SparklineCard title="Impressões" value={formatNumber(totals.impressions)} icon={Eye} />
                  <SparklineCard title="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
                  <SparklineCard title="CTR" value={`${avgCtr.toFixed(2)}%`} icon={TrendingUp} />
                  <SparklineCard title={isEcommerce ? 'Compras' : 'Conversões'} value={formatNumber(totals.conversions)} icon={isEcommerce ? ShoppingCart : Users} />
                  <SparklineCard title={isEcommerce ? 'ROAS' : 'Custo/Conv'} value={isEcommerce ? `${avgRoas.toFixed(2)}x` : formatCurrency(avgCpa)} icon={TrendingUp} />
                </div>

                {/* Funil de Vendas */}
                <FunnelChart
                  impressions={funnelTotals.impressions}
                  clicks={funnelTotals.clicks}
                  conversions={funnelTotals.conversions}
                  spend={funnelTotals.spend}
                  ctr={funnelTotals.impressions > 0 ? (funnelTotals.clicks / funnelTotals.impressions) * 100 : 0}
                  cpc={funnelTotals.clicks > 0 ? funnelTotals.spend / funnelTotals.clicks : 0}
                  cpl={funnelTotals.conversions > 0 ? funnelTotals.spend / funnelTotals.conversions : 0}
                  cpm={funnelTotals.impressions > 0 ? (funnelTotals.spend / funnelTotals.impressions) * 1000 : 0}
                  conversionRate={funnelTotals.clicks > 0 ? (funnelTotals.conversions / funnelTotals.clicks) * 100 : 0}
                  currency={selectedProject?.currency || 'BRL'}
                  campaignFilter={funnelFilter}
                  onCampaignFilterChange={setFunnelFilter}
                />

                {/* 3 Gráficos Google Ads */}
                {chartData.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <CustomizableChart
                      chartKey="google_invest_clicks"
                      data={chartData}
                      defaultTitle="Investimento vs Cliques"
                      defaultPrimaryMetric="spend"
                      defaultSecondaryMetric="clicks"
                      defaultChartType="composed"
                      currency={selectedProject?.currency || 'BRL'}
                    />
                    <CustomizableChart
                      chartKey="google_conv_cpa"
                      data={chartData}
                      defaultTitle="Conversões vs CPA"
                      defaultPrimaryMetric="conversions"
                      defaultSecondaryMetric="cpa"
                      defaultChartType="composed"
                      currency={selectedProject?.currency || 'BRL'}
                    />
                    <CustomizableChart
                      chartKey="google_ctr_cpc"
                      data={chartData}
                      defaultTitle="CTR vs CPC"
                      defaultPrimaryMetric="ctr"
                      defaultSecondaryMetric="cpc"
                      defaultChartType="line"
                      currency={selectedProject?.currency || 'BRL'}
                    />
                  </div>
                )}

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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="text-sm font-medium flex items-center gap-2"><Key className="w-4 h-4" /> Palavras-chave</h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Buscar..."
                            value={kwSearch}
                            onChange={e => setKwSearch(e.target.value)}
                            className="h-8 pl-7 text-xs w-40 sm:w-52"
                          />
                        </div>
                        <Select value={kwMatchFilter} onValueChange={setKwMatchFilter}>
                          <SelectTrigger className="h-8 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
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
                            <th className="text-center py-2 px-2 font-medium text-xs hidden md:table-cell">QS</th>
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
                  {/* Pagination */}
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

                {/* === DEMOGRÁFICOS === */}
                {demographics.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3"><Users className="w-4 h-4" /> Demográficos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <DemoCard title="Faixa Etária" icon={Users} data={ageData} formatLabel={formatAgeRange} barColor="bg-primary" />
                      <DemoCard title="Gênero" icon={Users} data={genderData} formatLabel={formatGender} barColor="bg-accent" />
                      <DemoCard title="Dispositivo" icon={BarChart3} data={deviceData} formatLabel={formatDevice} barColor="bg-secondary-foreground/50" />
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

function DemoCard({ title, icon: Icon, data, formatLabel, barColor }: { title: string; icon: React.ElementType; data: { value: string; spend: number }[]; formatLabel: (v: string) => string; barColor: string }) {
  const total = data.reduce((s, d) => s + d.spend, 0);
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 bg-secondary/30 border-b border-border">
        <h3 className="text-sm font-medium flex items-center gap-2"><Icon className="w-4 h-4" /> {title}</h3>
      </div>
      <div className="p-3 space-y-2">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.spend / total) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-20 text-muted-foreground truncate">{formatLabel(d.value)}</span>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium w-10 text-right">{pct.toFixed(0)}%</span>
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
        return (
          <AdGroupRow key={ag.id} adGroup={ag} isExpanded={isAgExp} ads={agAds} onToggle={onToggleAdGroup}
            formatCurrency={formatCurrency} formatNumber={formatNumber} isEcommerce={isEcommerce} />
        );
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
          <Badge className={cn(
            "text-[10px]",
            ag.status === 'ENABLED' ? "bg-metric-positive text-white" : "bg-secondary text-muted-foreground"
          )}>
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
                <div key={ad.id} className="glass-card p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "text-[9px]",
                        ad.status === 'ENABLED' ? "bg-metric-positive text-white" : "bg-secondary text-muted-foreground"
                      )}>
                        {ad.status === 'ENABLED' ? 'Ativo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status}
                      </Badge>
                      <span className="text-xs font-medium truncate">{ad.name}</span>
                      {ad.ad_type && <span className="text-[9px] text-muted-foreground">{ad.ad_type}</span>}
                    </div>
                    {ad.headlines && ad.headlines.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ad.headlines.map((h: string, i: number) => (
                          <span key={i} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{h}</span>
                        ))}
                      </div>
                    )}
                    {ad.descriptions && ad.descriptions.length > 0 && (
                      <div className="space-y-0.5">
                        {ad.descriptions.slice(0, 2).map((d: string, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground">{d}</p>
                        ))}
                      </div>
                    )}
                    {ad.final_urls && ad.final_urls.length > 0 && (
                      <a href={ad.final_urls[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 truncate">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{ad.final_urls[0]}</span>
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center flex-shrink-0">
                    <div>
                      <p className="text-[9px] text-muted-foreground">Gasto</p>
                      <p className="text-xs font-medium">{formatCurrency(ad.spend)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Cliques</p>
                      <p className="text-xs font-medium">{formatNumber(ad.clicks)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">CTR</p>
                      <p className="text-xs font-medium">{ad.ctr.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Conv</p>
                      <p className="text-xs font-medium">{formatNumber(ad.conversions)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
