import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { usePeriodContext } from '@/hooks/usePeriodContext';
import { DateRange } from 'react-day-picker';
import { DatePresetKey } from '@/utils/dateUtils';
import { 
  ImageIcon, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronLeft,
  RefreshCw,
  AlertCircle,
  Target,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Ad {
  id: string;
  ad_set_id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  creative_thumbnail: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
}

interface AdSet {
  id: string;
  name: string;
  campaign_id: string;
  project_id: string;
}

export default function Ads() {
  const { adSetId } = useParams<{ adSetId: string }>();
  const { projects } = useProjects();
  const { selectedPreset, dateRange, setSelectedPreset, setDateRange } = usePeriodContext();
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });
  const [dataDateRange, setDataDateRange] = useState<{ from: string; to: string } | null>(null);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const selectedProject = projects.find(p => p.id === adSet?.project_id);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  // Calculate date range based on preset or custom range
  const getDateRangeFromPeriod = useCallback((preset: DatePresetKey, customRange?: DateRange) => {
    // If custom and we have a range, use it
    if (preset === 'custom' && customRange?.from && customRange?.to) {
      const since = customRange.from.toISOString().split('T')[0];
      const until = customRange.to.toISOString().split('T')[0];
      console.log(`[Ads] Using custom range: ${since} to ${until}`);
      return { since, until };
    }
    
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

  // Load ads with metrics from ads_daily_metrics
  const loadAdsByPeriod = useCallback(async (preset: DatePresetKey, customRange?: DateRange) => {
    if (!adSetId) return;
    setLoading(true);
    
    try {
      // First get adset info
      const { data: adSetData } = await supabase
        .from('ad_sets')
        .select('id, name, campaign_id, project_id')
        .eq('id', adSetId)
        .maybeSingle();
      if (adSetData) setAdSet(adSetData as AdSet);
      
      if (!adSetData?.project_id) {
        setLoading(false);
        return;
      }

      const { since, until } = getDateRangeFromPeriod(preset, customRange);
      console.log(`[Ads] Loading period: ${preset} (${since} to ${until})`);


      // Check what dates we have data for
      const { data: firstDateData } = await supabase
        .from('ads_daily_metrics')
        .select('date')
        .eq('project_id', adSetData.project_id)
        .eq('adset_id', adSetId)
        .order('date', { ascending: true })
        .limit(1);
      
      const { data: lastDateData } = await supabase
        .from('ads_daily_metrics')
        .select('date')
        .eq('project_id', adSetData.project_id)
        .eq('adset_id', adSetId)
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

      // Query ads_daily_metrics and aggregate by ad
      const { data: dailyMetrics, error } = await supabase
        .from('ads_daily_metrics')
        .select('*')
        .eq('project_id', adSetData.project_id)
        .eq('adset_id', adSetId)
        .gte('date', since)
        .lte('date', until);

      if (error) throw error;

      // If no data for selected period, show empty state
      if (!dailyMetrics || dailyMetrics.length === 0) {
        console.log(`[Ads] No data for period ${preset} (${since} to ${until})`);
        setUsingFallbackData(true);
        setAds([]);
        setLoading(false);
        return;
      }
      
      setUsingFallbackData(false);

      // Aggregate by ad_id
      const adAgg = new Map<string, any>();
      for (const row of dailyMetrics) {
        if (!adAgg.has(row.ad_id)) {
          adAgg.set(row.ad_id, {
            id: row.ad_id,
            project_id: adSetData.project_id,
            campaign_id: row.campaign_id,
            ad_set_id: row.adset_id,
            name: row.ad_name,
            status: row.ad_status || 'UNKNOWN',
            creative_thumbnail: row.creative_thumbnail || null,
            headline: null, primary_text: null, cta: null,
            spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0,
          });
        }
        const agg = adAgg.get(row.ad_id);
        agg.spend += Number(row.spend) || 0;
        agg.impressions += Number(row.impressions) || 0;
        agg.clicks += Number(row.clicks) || 0;
        agg.conversions += Number(row.conversions) || 0;
        agg.conversion_value += Number(row.conversion_value) || 0;
      }

      // Calculate derived metrics
      const adsResult = Array.from(adAgg.values()).map(agg => ({
        ...agg,
        ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
        roas: agg.spend > 0 ? agg.conversion_value / agg.spend : 0,
        cpa: agg.conversions > 0 ? agg.spend / agg.conversions : 0,
      }));

      adsResult.sort((a, b) => b.spend - a.spend);
      setAds(adsResult as Ad[]);
      console.log(`[Ads] Loaded ${adsResult.length} ads for period ${preset} with ${dailyMetrics.length} daily records`);
    } catch (error) {
      console.error('Error loading ads:', error);
    } finally {
      setLoading(false);
    }
  }, [adSetId, getDateRangeFromPeriod]);

  // Sort options based on business model
  const sortOptions = [
    { value: 'spend', label: 'Gasto' },
    { value: 'conversions', label: isEcommerce ? 'Compras' : 'Leads' },
    { value: 'ctr', label: 'CTR' },
    { value: 'cpa', label: isEcommerce ? 'CPA' : 'CPL' },
    { value: 'name', label: 'Nome' },
    ...(isEcommerce ? [{ value: 'roas', label: 'ROAS' }] : []),
  ];

  // Load data when preset or date range changes
  useEffect(() => {
    loadAdsByPeriod(selectedPreset, selectedPreset === 'custom' ? dateRange : undefined);
  }, [selectedPreset, dateRange, loadAdsByPeriod]);

  // Handle date range change
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, [setDateRange]);

  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset as any);
  }, [setSelectedPreset]);

  const filteredAds = ads
    .filter((a) => !filters.search || a.name.toLowerCase().includes(filters.search.toLowerCase()))
    .filter((a) => !filters.status?.length || filters.status.includes(a.status))
    .sort((a, b) => {
      const m = sort.direction === 'asc' ? 1 : -1;
      if (sort.field === 'name') return a.name.localeCompare(b.name) * m;
      return ((a[sort.field as keyof Ad] as number) - (b[sort.field as keyof Ad] as number)) * m;
    });

  const totals = filteredAds.reduce((acc, a) => ({
    spend: acc.spend + a.spend,
    impressions: acc.impressions + a.impressions,
    clicks: acc.clicks + a.clicks,
    conversions: acc.conversions + a.conversions,
    revenue: acc.revenue + a.conversion_value,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCpl = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  
  const formatNumber = (n: number) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString('pt-BR');
  const currency = selectedProject?.currency || 'BRL';
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  const formatCurrency = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              to={adSet ? `/campaign/${adSet.campaign_id}/adsets` : '/campaigns'} 
              className="p-2 rounded-lg hover:bg-secondary/80 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Anúncios</h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1 flex items-center flex-wrap gap-2">
                <span className="truncate max-w-[200px] sm:max-w-none">{adSet ? `Conjunto: ${adSet.name}` : 'Carregando...'}</span>
                {selectedProject && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'}
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <DateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={selectedProject?.timezone}
              onPresetChange={handlePresetChange}
              selectedPreset={selectedPreset}
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
        ) : ads.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum anúncio encontrado</h3>
            <p className="text-muted-foreground">Sincronize os dados para carregar os anúncios.</p>
          </div>
        ) : (
          <>
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
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
              <MetricCard title="CTR Médio" value={`${avgCtr.toFixed(2)}%`} icon={TrendingUp} />
              <MetricCard title="Impressões" value={formatNumber(totals.impressions)} icon={Eye} />
              <MetricCard title="Gasto Total" value={formatCurrency(totals.spend)} icon={DollarSign} />
              <MetricCard title="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
            </div>

            <AdvancedFilters filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} sortOptions={sortOptions} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredAds.map((ad) => (
                <div key={ad.id} className="glass-card-hover overflow-hidden cursor-pointer" onClick={() => setSelectedAd(ad)}>
                  <div className="relative aspect-square bg-secondary/30 flex items-center justify-center">
                    {ad.creative_thumbnail ? <img src={ad.creative_thumbnail} alt={ad.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-16 h-16 text-muted-foreground" />}
                    <div className="absolute top-3 left-3">
                      <Badge variant="secondary" className={cn(ad.status === 'ACTIVE' && 'bg-metric-positive/20 text-metric-positive', ad.status === 'PAUSED' && 'bg-metric-warning/20 text-metric-warning')}>
                        {ad.status === 'ACTIVE' ? 'Ativo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status}
                      </Badge>
                    </div>
                    {isEcommerce && (
                      <div className="absolute bottom-3 right-3">
                        <Badge className={cn('text-lg font-bold', ad.roas >= 5 ? 'bg-metric-positive text-white' : ad.roas >= 3 ? 'bg-metric-warning text-white' : 'bg-metric-negative text-white')}>{ad.roas.toFixed(2)}x</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    <h3 className="font-semibold truncate">{ad.name}</h3>
                    {ad.cta && <Badge variant="outline">{ad.cta}</Badge>}
                    
                    {/* Main Metrics */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                      <div className="text-center p-2 bg-primary/5 rounded-lg">
                        <p className="text-lg font-bold text-primary">{ad.conversions}</p>
                        <p className="text-xs text-muted-foreground">{isEcommerce ? 'Compras' : 'Leads'}</p>
                      </div>
                      <div className="text-center p-2 bg-chart-1/10 rounded-lg">
                        <p className="text-lg font-bold text-chart-1">
                          {ad.conversions > 0 ? formatCurrency(ad.spend / ad.conversions) : 'R$ 0,00'}
                        </p>
                        <p className="text-xs text-muted-foreground">{isEcommerce ? 'CPA' : 'CPL'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center"><p className="text-sm font-semibold">{formatNumber(ad.impressions)}</p><p className="text-xs text-muted-foreground">Impr.</p></div>
                      <div className="text-center"><p className="text-sm font-semibold">{ad.ctr.toFixed(2)}%</p><p className="text-xs text-muted-foreground">CTR</p></div>
                      <div className="text-center"><p className="text-sm font-semibold">{formatCurrency(ad.spend)}</p><p className="text-xs text-muted-foreground">Gasto</p></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Sheet open={!!selectedAd} onOpenChange={() => setSelectedAd(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedAd && (
              <>
                <SheetHeader><SheetTitle>{selectedAd.name}</SheetTitle></SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="aspect-square bg-secondary/30 rounded-lg flex items-center justify-center overflow-hidden">
                    {selectedAd.creative_thumbnail ? <img src={selectedAd.creative_thumbnail} alt={selectedAd.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-16 h-16 text-muted-foreground" />}
                  </div>
                  
                  {/* Main metrics first */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4 text-center bg-primary/5">
                      <p className="text-2xl font-bold text-primary">{selectedAd.conversions}</p>
                      <p className="text-sm text-muted-foreground">{isEcommerce ? 'Compras' : 'Leads'}</p>
                    </div>
                    <div className="glass-card p-4 text-center bg-chart-1/10">
                      <p className="text-2xl font-bold text-chart-1">
                        {selectedAd.conversions > 0 ? formatCurrency(selectedAd.spend / selectedAd.conversions) : 'R$ 0,00'}
                      </p>
                      <p className="text-sm text-muted-foreground">{isEcommerce ? 'CPA' : 'CPL'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">CTR</p><p className="text-xl font-bold">{selectedAd.ctr.toFixed(2)}%</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Impressões</p><p className="text-xl font-bold">{formatNumber(selectedAd.impressions)}</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Gasto</p><p className="text-xl font-bold">{formatCurrency(selectedAd.spend)}</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Cliques</p><p className="text-xl font-bold">{formatNumber(selectedAd.clicks)}</p></div>
                  </div>
                  
                  {isEcommerce && (
                    <div className="glass-card p-4">
                      <p className="text-sm text-muted-foreground">ROAS</p>
                      <p className={cn("text-xl font-bold", selectedAd.roas >= 5 ? 'text-metric-positive' : selectedAd.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative')}>
                        {selectedAd.roas.toFixed(2)}x
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}