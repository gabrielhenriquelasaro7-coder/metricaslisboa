import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { DateRange } from 'react-day-picker';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange, calculateTimePeriods } from '@/utils/dateUtils';
import { 
  Layers, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronRight,
  ChevronLeft,
  Users,
  RefreshCw,
  AlertCircle,
  Target,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AdSet {
  id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  targeting: Record<string, unknown> | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  reach: number;
  frequency: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
}

export default function AdSets() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { projects } = useProjects();
  const [campaign, setCampaign] = useState<{ id: string; name: string; project_id: string } | null>(null);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  const [dataDateRange, setDataDateRange] = useState<{ from: string; to: string } | null>(null);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const selectedProject = projects.find(p => p.id === campaign?.project_id);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  // Calculate date range based on preset
  const getDateRangeFromPeriod = useCallback((preset: DatePresetKey) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];
    
    switch (preset) {
      case 'yesterday':
        return { since: yesterday, until: yesterday };
      case 'last_7d':
        return { since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday };
      case 'last_14d':
        return { since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday };
      case 'last_30d':
        return { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday };
      case 'last_60d':
        return { since: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday };
      case 'last_90d':
        return { since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: yesterday };
      case 'this_month':
        return { since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], until: today };
      case 'this_year':
        return { since: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0], until: today };
      default:
        return { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: today };
    }
  }, []);

  // Load ad sets with metrics from ads_daily_metrics
  const loadAdSetsByPeriod = useCallback(async (preset: DatePresetKey) => {
    if (!campaignId) return;
    setLoading(true);
    
    try {
      // First get campaign info
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('id, name, project_id')
        .eq('id', campaignId)
        .maybeSingle();
      if (campaignData) setCampaign(campaignData);
      
      if (!campaignData?.project_id) {
        setLoading(false);
        return;
      }

      const { since, until } = getDateRangeFromPeriod(preset);
      console.log(`[AdSets] Loading period: ${preset} (${since} to ${until})`);

      // Always check what dates we have data for (for display purposes)
      const { data: firstDateData } = await supabase
        .from('ads_daily_metrics')
        .select('date')
        .eq('project_id', campaignData.project_id)
        .eq('campaign_id', campaignId)
        .order('date', { ascending: true })
        .limit(1);
      
      const { data: lastDateData } = await supabase
        .from('ads_daily_metrics')
        .select('date')
        .eq('project_id', campaignData.project_id)
        .eq('campaign_id', campaignId)
        .order('date', { ascending: false })
        .limit(1);
      
      if (firstDateData?.length && lastDateData?.length) {
        setDataDateRange({
          from: new Date(firstDateData[0].date + 'T00:00:00').toLocaleDateString('pt-BR'),
          to: new Date(lastDateData[0].date + 'T00:00:00').toLocaleDateString('pt-BR'),
        });
      } else {
        setDataDateRange(null);
      }

      // Query ads_daily_metrics and aggregate by adset FOR THE SELECTED PERIOD
      const { data: dailyMetrics, error } = await supabase
        .from('ads_daily_metrics')
        .select('*')
        .eq('project_id', campaignData.project_id)
        .eq('campaign_id', campaignId)
        .gte('date', since)
        .lte('date', until);

      if (error) throw error;

      // If no data for selected period, show empty state with zeros
      if (!dailyMetrics || dailyMetrics.length === 0) {
        console.log(`[AdSets] No data for period ${preset} (${since} to ${until})`);
        setUsingFallbackData(true);
        setAdSets([]);
        setLoading(false);
        return;
      }
      
      setUsingFallbackData(false);

      // Aggregate by adset_id
      const adsetAgg = new Map<string, any>();
      for (const row of dailyMetrics) {
        if (!adsetAgg.has(row.adset_id)) {
          adsetAgg.set(row.adset_id, {
            id: row.adset_id,
            project_id: campaignData.project_id,
            campaign_id: row.campaign_id,
            name: row.adset_name,
            status: row.adset_status || 'UNKNOWN',
            spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0,
            daily_budget: null, lifetime_budget: null, targeting: null,
          });
        }
        const agg = adsetAgg.get(row.adset_id);
        agg.spend += Number(row.spend) || 0;
        agg.impressions += Number(row.impressions) || 0;
        agg.clicks += Number(row.clicks) || 0;
        agg.reach += Number(row.reach) || 0;
        agg.conversions += Number(row.conversions) || 0;
        agg.conversion_value += Number(row.conversion_value) || 0;
      }

      // Calculate derived metrics
      const adsetsResult = Array.from(adsetAgg.values()).map(agg => ({
        ...agg,
        ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
        cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
        roas: agg.spend > 0 ? agg.conversion_value / agg.spend : 0,
        cpa: agg.conversions > 0 ? agg.spend / agg.conversions : 0,
        frequency: agg.reach > 0 ? agg.impressions / agg.reach : 0,
      }));

      adsetsResult.sort((a, b) => b.spend - a.spend);
      setAdSets(adsetsResult as AdSet[]);
      console.log(`[AdSets] Loaded ${adsetsResult.length} ad sets for period ${preset} with ${dailyMetrics.length} daily records`);
    } catch (error) {
      console.error('Error loading ad sets:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignId, getDateRangeFromPeriod]);

  // Sort options based on business model
  const sortOptions = useMemo(() => [
    { value: 'spend', label: 'Gasto' },
    { value: 'conversions', label: isEcommerce ? 'Compras' : 'Leads' },
    { value: 'ctr', label: 'CTR' },
    { value: 'cpa', label: isEcommerce ? 'CPA' : 'CPL' },
    { value: 'name', label: 'Nome' },
    ...(isEcommerce ? [{ value: 'roas', label: 'ROAS' }] : []),
  ], [isEcommerce]);

  // Load data when preset or campaignId changes
  useEffect(() => {
    loadAdSetsByPeriod(selectedPreset);
  }, [selectedPreset, loadAdSetsByPeriod]);

  // Handle date range change
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, []);

  // Handle preset change - load data by period
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);

  const filteredAdSets = adSets
    .filter((a) => !filters.search || a.name.toLowerCase().includes(filters.search.toLowerCase()))
    .filter((a) => !filters.status?.length || filters.status.includes(a.status))
    .sort((a, b) => {
      const m = sort.direction === 'asc' ? 1 : -1;
      if (sort.field === 'name') return a.name.localeCompare(b.name) * m;
      return ((a[sort.field as keyof AdSet] as number) - (b[sort.field as keyof AdSet] as number)) * m;
    });

  const totals = filteredAdSets.reduce((acc, a) => ({
    spend: acc.spend + a.spend,
    impressions: acc.impressions + a.impressions,
    clicks: acc.clicks + a.clicks,
    conversions: acc.conversions + a.conversions,
    revenue: acc.revenue + a.conversion_value,
    reach: acc.reach + a.reach,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, reach: 0 });

  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCpl = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

  const formatNumber = (n: number) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString('pt-BR');
  const formatCurrency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      ACTIVE: { label: 'Ativo', className: 'bg-metric-positive/20 text-metric-positive border-metric-positive/30' },
      PAUSED: { label: 'Pausado', className: 'bg-metric-warning/20 text-metric-warning border-metric-warning/30' },
      DELETED: { label: 'Deletado', className: 'bg-muted text-muted-foreground' },
      ARCHIVED: { label: 'Arquivado', className: 'bg-muted text-muted-foreground' },
    };
    return statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              to="/campaigns" 
              className="p-2 rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Conjuntos de Anúncios</h1>
              <p className="text-muted-foreground mt-1">
                {campaign ? `Campanha: ${campaign.name}` : 'Carregando...'}
                {selectedProject && (
                  <Badge variant="outline" className="ml-3 text-xs">
                    {isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'}
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={selectedProject?.timezone}
              onPresetChange={handlePresetChange}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : usingFallbackData ? (
          <div className="glass-card p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-metric-warning mb-4" />
            <h3 className="text-xl font-semibold mb-2">Sem dados para o período selecionado</h3>
            <p className="text-muted-foreground mb-4">
              Não há métricas registradas para este período.
            </p>
            {dataDateRange && (
              <p className="text-sm text-muted-foreground">
                Os dados disponíveis são de <span className="font-medium text-foreground">{dataDateRange.from}</span> a <span className="font-medium text-foreground">{dataDateRange.to}</span>.
              </p>
            )}
          </div>
        ) : adSets.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum conjunto encontrado</h3>
            <p className="text-muted-foreground">Sincronize os dados na página de campanhas.</p>
          </div>
        ) : (
          <>
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard title="Gasto Total" value={formatCurrency(totals.spend)} icon={DollarSign} />
              <MetricCard title="Alcance" value={formatNumber(totals.reach)} icon={Users} />
              <MetricCard title="Impressões" value={formatNumber(totals.impressions)} icon={Eye} />
              <MetricCard title="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
              <MetricCard 
                title={isEcommerce ? "Compras" : "Leads"} 
                value={formatNumber(totals.conversions)} 
                icon={isEcommerce ? ShoppingCart : Target} 
              />
              {isEcommerce ? (
                <MetricCard 
                  title="ROAS Médio" 
                  value={`${avgRoas.toFixed(2)}x`} 
                  icon={TrendingUp} 
                  className="border-l-4 border-l-metric-positive" 
                />
              ) : (
                <MetricCard 
                  title="CPL Médio" 
                  value={formatCurrency(avgCpl)} 
                  icon={DollarSign} 
                  className="border-l-4 border-l-chart-1" 
                />
              )}
            </div>

            {/* Filters */}
            <AdvancedFilters 
              filters={filters} 
              onFiltersChange={setFilters} 
              sort={sort} 
              onSortChange={setSort} 
              sortOptions={sortOptions} 
            />

            {/* Ad Sets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAdSets.map((adSet) => {
                const statusBadge = getStatusBadge(adSet.status);
                
                return (
                  <Link 
                    key={adSet.id} 
                    to={`/adset/${adSet.id}`} 
                    className="glass-card group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-5 pb-4 border-b border-border/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                            adSet.status === 'ACTIVE' 
                              ? 'bg-metric-positive/10' 
                              : 'bg-secondary/50'
                          )}>
                            <Layers className={cn(
                              "w-5 h-5",
                              adSet.status === 'ACTIVE' ? 'text-metric-positive' : 'text-muted-foreground'
                            )} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                              {adSet.name}
                            </h3>
                            <Badge variant="outline" className={cn("text-xs mt-1", statusBadge.className)}>
                              {statusBadge.label}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                      </div>
                    </div>

                    {/* Main Metrics */}
                    <div className="p-5 pt-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-primary/5 rounded-lg">
                          <p className="text-2xl font-bold text-primary">{adSet.conversions}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{isEcommerce ? 'Compras' : 'Leads'}</p>
                        </div>
                        <div className="text-center p-3 bg-chart-1/10 rounded-lg">
                          <p className="text-2xl font-bold text-chart-1">
                            {adSet.conversions > 0 ? formatCurrency(adSet.spend / adSet.conversions) : 'R$ 0,00'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{isEcommerce ? 'CPA' : 'CPL'}</p>
                        </div>
                      </div>
                      
                      {/* Secondary metrics grid */}
                      <div className="grid grid-cols-4 gap-3 pt-3 border-t border-border/50">
                        <div className="text-center">
                          <p className="text-sm font-semibold">{adSet.ctr.toFixed(2)}%</p>
                          <p className="text-xs text-muted-foreground">CTR</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold">{formatNumber(adSet.impressions)}</p>
                          <p className="text-xs text-muted-foreground">Impr.</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold">{formatCurrency(adSet.spend)}</p>
                          <p className="text-xs text-muted-foreground">Gasto</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold">{formatCurrency(parseFloat((adSet.impressions > 0 ? (adSet.spend / adSet.impressions) * 1000 : 0).toFixed(2)))}</p>
                          <p className="text-xs text-muted-foreground">CPM</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}