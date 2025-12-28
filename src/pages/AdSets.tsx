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
  Users,
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronRight,
  Target,
  Smartphone,
  Monitor,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface AdSet {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  targeting: {
    ageMin: number;
    ageMax: number;
    genders: string[];
    locations: string[];
    interests: string[];
  };
  placements: string[];
  devices: string[];
  bidStrategy: string;
  budget: number;
  budgetType: 'daily' | 'lifetime';
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
}

const mockAdSets: AdSet[] = [
  {
    id: '1',
    name: 'Remarketing - Carrinho Abandonado',
    status: 'ACTIVE',
    targeting: {
      ageMin: 25,
      ageMax: 54,
      genders: ['Todos'],
      locations: ['Brasil'],
      interests: ['E-commerce', 'Compras online'],
    },
    placements: ['Feed', 'Stories', 'Reels'],
    devices: ['Mobile', 'Desktop'],
    bidStrategy: 'Menor custo',
    budget: 50,
    budgetType: 'daily',
    spend: 1500,
    impressions: 85000,
    clicks: 3400,
    ctr: 4.0,
    cpm: 17.65,
    cpc: 0.44,
    conversions: 145,
    revenue: 14500,
    roas: 9.67,
    cpa: 10.34,
    reach: 42000,
    frequency: 2.02,
  },
  {
    id: '2',
    name: 'Lookalike 1% - Compradores',
    status: 'ACTIVE',
    targeting: {
      ageMin: 18,
      ageMax: 65,
      genders: ['Todos'],
      locations: ['Brasil'],
      interests: ['Lookalike de compradores'],
    },
    placements: ['Feed', 'Stories'],
    devices: ['Mobile'],
    bidStrategy: 'Custo por resultado',
    budget: 100,
    budgetType: 'daily',
    spend: 3000,
    impressions: 145000,
    clicks: 4350,
    ctr: 3.0,
    cpm: 20.69,
    cpc: 0.69,
    conversions: 167,
    revenue: 18370,
    roas: 6.12,
    cpa: 17.96,
    reach: 98000,
    frequency: 1.48,
  },
  {
    id: '3',
    name: 'Interesse - Moda Feminina',
    status: 'ACTIVE',
    targeting: {
      ageMin: 22,
      ageMax: 45,
      genders: ['Feminino'],
      locations: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais'],
      interests: ['Moda feminina', 'Roupas', 'Acessórios'],
    },
    placements: ['Feed', 'Reels', 'Explore'],
    devices: ['Mobile'],
    bidStrategy: 'Menor custo',
    budget: 80,
    budgetType: 'daily',
    spend: 2400,
    impressions: 120000,
    clicks: 3600,
    ctr: 3.0,
    cpm: 20.0,
    cpc: 0.67,
    conversions: 89,
    revenue: 8900,
    roas: 3.71,
    cpa: 26.97,
    reach: 78000,
    frequency: 1.54,
  },
  {
    id: '4',
    name: 'Broad - 25-44',
    status: 'PAUSED',
    targeting: {
      ageMin: 25,
      ageMax: 44,
      genders: ['Todos'],
      locations: ['Brasil'],
      interests: [],
    },
    placements: ['Feed', 'Stories', 'Reels', 'Marketplace'],
    devices: ['Mobile', 'Desktop'],
    bidStrategy: 'Menor custo',
    budget: 150,
    budgetType: 'daily',
    spend: 4500,
    impressions: 225000,
    clicks: 4500,
    ctr: 2.0,
    cpm: 20.0,
    cpc: 1.0,
    conversions: 112,
    revenue: 11200,
    roas: 2.49,
    cpa: 40.18,
    reach: 156000,
    frequency: 1.44,
  },
];

const sortOptions = [
  { value: 'roas', label: 'ROAS' },
  { value: 'spend', label: 'Gasto' },
  { value: 'conversions', label: 'Conversões' },
  { value: 'ctr', label: 'CTR' },
  { value: 'cpa', label: 'CPA' },
  { value: 'name', label: 'Nome' },
];

export default function AdSets() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'roas', direction: 'desc' });

  const filteredAdSets = mockAdSets
    .filter((adSet) => {
      if (filters.search) {
        return adSet.name.toLowerCase().includes(filters.search.toLowerCase());
      }
      return true;
    })
    .filter((adSet) => {
      if (filters.status?.length) {
        return filters.status.includes(adSet.status);
      }
      return true;
    })
    .filter((adSet) => {
      if (filters.minSpend !== undefined && adSet.spend < filters.minSpend) return false;
      if (filters.maxSpend !== undefined && adSet.spend > filters.maxSpend) return false;
      return true;
    })
    .filter((adSet) => {
      if (filters.minRoas !== undefined && adSet.roas < filters.minRoas) return false;
      if (filters.maxRoas !== undefined && adSet.roas > filters.maxRoas) return false;
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

  const totals = filteredAdSets.reduce(
    (acc, adSet) => ({
      spend: acc.spend + adSet.spend,
      impressions: acc.impressions + adSet.impressions,
      clicks: acc.clicks + adSet.clicks,
      conversions: acc.conversions + adSet.conversions,
      revenue: acc.revenue + adSet.revenue,
      reach: acc.reach + adSet.reach,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, reach: 0 }
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
              <h1 className="text-3xl font-bold mb-1">Conjuntos de Anúncios</h1>
              <p className="text-muted-foreground">
                Black Friday - Remarketing • {filteredAdSets.length} conjuntos
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
            title="Alcance"
            value={formatNumber(totals.reach)}
            icon={Users}
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

        {/* Ad Sets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAdSets.map((adSet) => (
            <Link key={adSet.id} to={`/adset/${adSet.id}/ads`}>
              <div className="glass-card-hover p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{adSet.name}</h3>
                      <Badge
                        variant="secondary"
                        className={cn(
                          adSet.status === 'ACTIVE' &&
                            'bg-metric-positive/20 text-metric-positive',
                          adSet.status === 'PAUSED' &&
                            'bg-metric-warning/20 text-metric-warning'
                        )}
                      >
                        {adSet.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-2xl font-bold',
                      adSet.roas >= 5 ? 'text-metric-positive' : 
                      adSet.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative'
                    )}>
                      {adSet.roas}x
                    </p>
                    <p className="text-xs text-muted-foreground">ROAS</p>
                  </div>
                </div>

                {/* Targeting Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="w-4 h-4" />
                    <span>{adSet.targeting.ageMin}-{adSet.targeting.ageMax} anos</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{adSet.targeting.locations.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Smartphone className="w-4 h-4" />
                    <span>{adSet.devices.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Monitor className="w-4 h-4" />
                    <span>{adSet.placements.slice(0, 2).join(', ')}</span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-lg font-semibold">{formatCurrency(adSet.spend)}</p>
                    <p className="text-xs text-muted-foreground">Gasto</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{adSet.ctr}%</p>
                    <p className="text-xs text-muted-foreground">CTR</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{adSet.conversions}</p>
                    <p className="text-xs text-muted-foreground">Conversões</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{formatCurrency(adSet.cpa)}</p>
                    <p className="text-xs text-muted-foreground">CPA</p>
                  </div>
                </div>

                {/* Budget Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Orçamento: {formatCurrency(adSet.budget)}/dia</span>
                    <span className="text-muted-foreground">{((adSet.spend / (adSet.budget * 30)) * 100).toFixed(0)}% utilizado</span>
                  </div>
                  <Progress value={(adSet.spend / (adSet.budget * 30)) * 100} className="h-2" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
                  <span>Alcance: {formatNumber(adSet.reach)} • Freq: {adSet.frequency.toFixed(2)}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
