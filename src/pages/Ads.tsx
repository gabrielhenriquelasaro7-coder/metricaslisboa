import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { supabase } from '@/integrations/supabase/client';
import { 
  ImageIcon, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronLeft,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Ad {
  id: string;
  ad_set_id: string;
  campaign_id: string;
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

const sortOptions = [
  { value: 'roas', label: 'ROAS' },
  { value: 'spend', label: 'Gasto' },
  { value: 'conversions', label: 'Conversões' },
  { value: 'ctr', label: 'CTR' },
  { value: 'name', label: 'Nome' },
];

export default function Ads() {
  const { adSetId } = useParams<{ adSetId: string }>();
  const [adSet, setAdSet] = useState<{ id: string; name: string; campaign_id: string } | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'roas', direction: 'desc' });

  useEffect(() => {
    const fetchData = async () => {
      if (!adSetId) return;
      setLoading(true);
      try {
        const { data: adSetData } = await supabase.from('ad_sets').select('id, name, campaign_id').eq('id', adSetId).single();
        if (adSetData) setAdSet(adSetData);
        const { data: adsData } = await supabase.from('ads').select('*').eq('ad_set_id', adSetId).order('spend', { ascending: false });
        setAds((adsData as Ad[]) || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [adSetId]);

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
  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const formatNumber = (n: number) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString();
  const formatCurrency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <Link to={adSet ? `/campaign/${adSet.campaign_id}/adsets` : '/campaigns'} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="text-3xl font-bold">Anúncios</h1>
        </div>
        <p className="text-muted-foreground">{adSet ? `Conjunto: ${adSet.name}` : 'Carregando...'}</p>

        {loading ? (
          <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : ads.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum anúncio encontrado</h3>
            <p className="text-muted-foreground">Sincronize os dados na página de campanhas.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard title="Gasto Total" value={formatCurrency(totals.spend)} icon={DollarSign} />
              <MetricCard title="Impressões" value={formatNumber(totals.impressions)} icon={Eye} />
              <MetricCard title="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
              <MetricCard title="CTR Médio" value={`${avgCtr.toFixed(2)}%`} icon={TrendingUp} />
              <MetricCard title="Conversões" value={formatNumber(totals.conversions)} icon={ShoppingCart} />
              <MetricCard title="ROAS Médio" value={`${avgRoas.toFixed(2)}x`} icon={TrendingUp} className="border-l-4 border-l-metric-positive" />
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
                    <div className="absolute bottom-3 right-3">
                      <Badge className={cn('text-lg font-bold', ad.roas >= 5 ? 'bg-metric-positive text-white' : ad.roas >= 3 ? 'bg-metric-warning text-white' : 'bg-metric-negative text-white')}>{ad.roas.toFixed(2)}x</Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <h3 className="font-semibold truncate">{ad.name}</h3>
                    {ad.cta && <Badge variant="outline">{ad.cta}</Badge>}
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                      <div className="text-center"><p className="text-lg font-semibold">{formatNumber(ad.impressions)}</p><p className="text-xs text-muted-foreground">Impressões</p></div>
                      <div className="text-center"><p className="text-lg font-semibold">{ad.ctr.toFixed(2)}%</p><p className="text-xs text-muted-foreground">CTR</p></div>
                      <div className="text-center"><p className="text-lg font-semibold">{ad.conversions}</p><p className="text-xs text-muted-foreground">Conversões</p></div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Gasto</p><p className="text-xl font-bold">{formatCurrency(selectedAd.spend)}</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">ROAS</p><p className={cn("text-xl font-bold", selectedAd.roas >= 5 ? 'text-metric-positive' : selectedAd.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative')}>{selectedAd.roas.toFixed(2)}x</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Impressões</p><p className="text-xl font-bold">{formatNumber(selectedAd.impressions)}</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Cliques</p><p className="text-xl font-bold">{formatNumber(selectedAd.clicks)}</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">CTR</p><p className="text-xl font-bold">{selectedAd.ctr.toFixed(2)}%</p></div>
                    <div className="glass-card p-4"><p className="text-sm text-muted-foreground">Conversões</p><p className="text-xl font-bold">{selectedAd.conversions}</p></div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}
