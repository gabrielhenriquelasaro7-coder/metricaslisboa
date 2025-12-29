import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { DateRange } from 'react-day-picker';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
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
  Target
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
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  const selectedProject = projects.find(p => p.id === adSet?.project_id);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  const fetchAds = useCallback(async () => {
    if (!adSetId) return;
    setLoading(true);
    try {
      const { data: adSetData } = await supabase
        .from('ad_sets')
        .select('id, name, campaign_id, project_id')
        .eq('id', adSetId)
        .maybeSingle();
      if (adSetData) setAdSet(adSetData as AdSet);

      const { data: adsData } = await supabase
        .from('ads')
        .select('*')
        .eq('ad_set_id', adSetId)
        .order('spend', { ascending: false });
      setAds((adsData as Ad[]) || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [adSetId]);

  // Sort options based on business model
  const sortOptions = [
    { value: 'spend', label: 'Gasto' },
    { value: 'conversions', label: isEcommerce ? 'Compras' : 'Leads' },
    { value: 'ctr', label: 'CTR' },
    { value: 'cpa', label: isEcommerce ? 'CPA' : 'CPL' },
    { value: 'name', label: 'Nome' },
    ...(isEcommerce ? [{ value: 'roas', label: 'ROAS' }] : []),
  ];

  // Load data from database on mount and when adSetId changes
  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Handle date range change - NO sync, just load from database
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
    // Reload data from database (data is already filtered by ad set)
    fetchAds();
  }, [fetchAds]);

  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);

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
  
  const formatNumber = (n: number) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString();
  const formatCurrency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              to={adSet ? `/campaign/${adSet.campaign_id}/adsets` : '/campaigns'} 
              className="p-2 rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Anúncios</h1>
              <p className="text-muted-foreground mt-1">
                {adSet ? `Conjunto: ${adSet.name}` : 'Carregando...'}
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
        ) : ads.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum anúncio encontrado</h3>
            <p className="text-muted-foreground">Sincronize os dados para carregar os anúncios.</p>
          </div>
        ) : (
          <>
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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