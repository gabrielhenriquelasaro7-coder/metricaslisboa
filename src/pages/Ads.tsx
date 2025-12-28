import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { 
  ArrowLeft,
  Image as ImageIcon,
  Play,
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Eye,
  ShoppingCart,
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import PerformanceChart from '@/components/dashboard/PerformanceChart';

interface Ad {
  id: string;
  name: string;
  type: 'image' | 'video' | 'carousel';
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  thumbnail: string;
  headline: string;
  primaryText: string;
  cta: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  reach: number;
  frequency: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
}

const mockAds: Ad[] = [
  {
    id: '1',
    name: 'Promo 50% - Imagem Principal',
    type: 'image',
    status: 'ACTIVE',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop',
    headline: 'Aproveite 50% OFF',
    primaryText: 'Promoção imperdível de fim de ano! Compre agora e economize em todas as categorias.',
    cta: 'Comprar Agora',
    spend: 450,
    impressions: 25000,
    clicks: 1000,
    ctr: 4.0,
    cpm: 18.0,
    cpc: 0.45,
    conversions: 45,
    revenue: 4500,
    roas: 10.0,
    cpa: 10.0,
    reach: 18000,
    frequency: 1.39,
    engagement: {
      likes: 342,
      comments: 28,
      shares: 56,
      saves: 89,
    },
  },
  {
    id: '2',
    name: 'Video Lifestyle - 15s',
    type: 'video',
    status: 'ACTIVE',
    thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop',
    headline: 'Estilo que Inspira',
    primaryText: 'Descubra as novidades que vão transformar seu dia a dia com muito estilo.',
    cta: 'Ver Mais',
    spend: 680,
    impressions: 38000,
    clicks: 1140,
    ctr: 3.0,
    cpm: 17.89,
    cpc: 0.60,
    conversions: 52,
    revenue: 5720,
    roas: 8.41,
    cpa: 13.08,
    reach: 28000,
    frequency: 1.36,
    engagement: {
      likes: 567,
      comments: 45,
      shares: 123,
      saves: 156,
    },
  },
  {
    id: '3',
    name: 'Carrossel - Top Produtos',
    type: 'carousel',
    status: 'ACTIVE',
    thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop',
    headline: 'Os Mais Vendidos',
    primaryText: 'Conheça os produtos favoritos dos nossos clientes. Qualidade garantida!',
    cta: 'Comprar',
    spend: 520,
    impressions: 29000,
    clicks: 870,
    ctr: 3.0,
    cpm: 17.93,
    cpc: 0.60,
    conversions: 38,
    revenue: 3800,
    roas: 7.31,
    cpa: 13.68,
    reach: 21000,
    frequency: 1.38,
    engagement: {
      likes: 234,
      comments: 19,
      shares: 45,
      saves: 78,
    },
  },
  {
    id: '4',
    name: 'Urgência - Últimas Unidades',
    type: 'image',
    status: 'PAUSED',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&fit=crop',
    headline: 'Últimas Unidades!',
    primaryText: 'Corra! Estoque limitado nos tamanhos mais procurados. Não perca!',
    cta: 'Garantir o Meu',
    spend: 280,
    impressions: 15000,
    clicks: 600,
    ctr: 4.0,
    cpm: 18.67,
    cpc: 0.47,
    conversions: 22,
    revenue: 2200,
    roas: 7.86,
    cpa: 12.73,
    reach: 11000,
    frequency: 1.36,
    engagement: {
      likes: 156,
      comments: 12,
      shares: 34,
      saves: 45,
    },
  },
];

const chartData = [
  { date: '01/12', value: 120, value2: 8.2 },
  { date: '05/12', value: 180, value2: 9.1 },
  { date: '10/12', value: 150, value2: 7.8 },
  { date: '15/12', value: 220, value2: 10.5 },
  { date: '20/12', value: 280, value2: 9.2 },
  { date: '25/12', value: 310, value2: 11.1 },
  { date: '28/12', value: 350, value2: 10.0 },
];

const sortOptions = [
  { value: 'roas', label: 'ROAS' },
  { value: 'spend', label: 'Gasto' },
  { value: 'conversions', label: 'Conversões' },
  { value: 'ctr', label: 'CTR' },
  { value: 'cpa', label: 'CPA' },
  { value: 'name', label: 'Nome' },
];

export default function Ads() {
  const { adSetId } = useParams<{ adSetId: string }>();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'roas', direction: 'desc' });
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  const filteredAds = mockAds
    .filter((ad) => {
      if (filters.search) {
        return ad.name.toLowerCase().includes(filters.search.toLowerCase());
      }
      return true;
    })
    .filter((ad) => {
      if (filters.status?.length) {
        return filters.status.includes(ad.status);
      }
      return true;
    })
    .sort((a, b) => {
      const multiplier = sort.direction === 'asc' ? 1 : -1;
      switch (sort.field) {
        case 'roas':
          return (a.roas - b.roas) * multiplier;
        case 'spend':
          return (a.spend - b.spend) * multiplier;
        case 'conversions':
          return (a.conversions - b.conversions) * multiplier;
        case 'ctr':
          return (a.ctr - b.ctr) * multiplier;
        case 'cpa':
          return (a.cpa - b.cpa) * multiplier;
        case 'name':
          return a.name.localeCompare(b.name) * multiplier;
        default:
          return 0;
      }
    });

  const totals = filteredAds.reduce(
    (acc, ad) => ({
      spend: acc.spend + ad.spend,
      impressions: acc.impressions + ad.impressions,
      clicks: acc.clicks + ad.clicks,
      conversions: acc.conversions + ad.conversions,
      revenue: acc.revenue + ad.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/campaigns">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-1">Anúncios</h1>
              <p className="text-muted-foreground">
                Remarketing - Carrinho Abandonado • {filteredAds.length} anúncios
              </p>
            </div>
          </div>
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            title="Gasto Total"
            value={formatCurrency(totals.spend)}
            icon={DollarSign}
          />
          <MetricCard
            title="Impressões"
            value={formatNumber(totals.impressions)}
            icon={Eye}
          />
          <MetricCard
            title="Cliques"
            value={formatNumber(totals.clicks)}
            icon={MousePointerClick}
          />
          <MetricCard
            title="CTR Médio"
            value={`${((totals.clicks / totals.impressions) * 100).toFixed(2)}%`}
            icon={TrendingUp}
          />
          <MetricCard
            title="Conversões"
            value={formatNumber(totals.conversions)}
            icon={ShoppingCart}
          />
          <MetricCard
            title="ROAS Médio"
            value={`${avgRoas.toFixed(2)}x`}
            icon={TrendingUp}
            className="border-l-4 border-l-metric-positive"
          />
        </div>

        {/* Filters */}
        <AdvancedFilters
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          sortOptions={sortOptions}
        />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Ads List */}
          <div className="xl:col-span-2 space-y-4">
            {filteredAds.map((ad) => (
              <div
                key={ad.id}
                onClick={() => setSelectedAd(ad)}
                className={cn(
                  'glass-card-hover p-4 cursor-pointer transition-all',
                  selectedAd?.id === ad.id && 'ring-2 ring-primary'
                )}
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={ad.thumbnail}
                      alt={ad.name}
                      className="w-full h-full object-cover"
                    />
                    {ad.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <Play className="w-8 h-8 text-foreground" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                        {ad.type === 'image' && <ImageIcon className="w-3 h-3" />}
                        {ad.type === 'video' && <Play className="w-3 h-3" />}
                        {ad.type === 'carousel' && '⊞'}
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold truncate">{ad.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{ad.headline}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          ad.status === 'ACTIVE' &&
                            'bg-metric-positive/20 text-metric-positive',
                          ad.status === 'PAUSED' &&
                            'bg-metric-warning/20 text-metric-warning'
                        )}
                      >
                        {ad.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                      </Badge>
                    </div>

                    {/* Quick Metrics */}
                    <div className="grid grid-cols-5 gap-2 mt-3">
                      <div>
                        <p className="text-sm font-semibold">{formatCurrency(ad.spend)}</p>
                        <p className="text-xs text-muted-foreground">Gasto</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{ad.ctr}%</p>
                        <p className="text-xs text-muted-foreground">CTR</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{ad.conversions}</p>
                        <p className="text-xs text-muted-foreground">Conv.</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{formatCurrency(ad.cpa)}</p>
                        <p className="text-xs text-muted-foreground">CPA</p>
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-semibold',
                          ad.roas >= 5 ? 'text-metric-positive' : 
                          ad.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative'
                        )}>
                          {ad.roas}x
                        </p>
                        <p className="text-xs text-muted-foreground">ROAS</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ad Detail Panel */}
          <div className="space-y-6">
            {selectedAd ? (
              <>
                {/* Ad Preview */}
                <div className="glass-card p-4 space-y-4">
                  <h3 className="font-semibold">Preview do Anúncio</h3>
                  <div className="aspect-square rounded-lg overflow-hidden">
                    <img
                      src={selectedAd.thumbnail}
                      alt={selectedAd.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">{selectedAd.headline}</h4>
                    <p className="text-sm text-muted-foreground">{selectedAd.primaryText}</p>
                    <Badge variant="outline">{selectedAd.cta}</Badge>
                  </div>
                </div>

                {/* Engagement */}
                <div className="glass-card p-4 space-y-4">
                  <h3 className="font-semibold">Engajamento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <ThumbsUp className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedAd.engagement.likes}</p>
                        <p className="text-xs text-muted-foreground">Curtidas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedAd.engagement.comments}</p>
                        <p className="text-xs text-muted-foreground">Comentários</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Share2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedAd.engagement.shares}</p>
                        <p className="text-xs text-muted-foreground">Compartilhamentos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bookmark className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedAd.engagement.saves}</p>
                        <p className="text-xs text-muted-foreground">Salvos</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Chart */}
                <PerformanceChart
                  data={chartData}
                  title="Performance ao longo do tempo"
                  dataKey="value"
                  dataKey2="value2"
                />
              </>
            ) : (
              <div className="glass-card p-12 text-center">
                <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Selecione um anúncio</h3>
                <p className="text-sm text-muted-foreground">
                  Clique em um anúncio para ver detalhes e métricas de engajamento.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
