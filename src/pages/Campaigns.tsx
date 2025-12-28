import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { 
  Megaphone, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  budgetType: 'daily' | 'lifetime';
  budget: number;
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
}

const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Black Friday - Remarketing',
    objective: 'CONVERSIONS',
    status: 'ACTIVE',
    budgetType: 'daily',
    budget: 150,
    spend: 4500,
    impressions: 243000,
    clicks: 7776,
    ctr: 3.2,
    cpm: 18.52,
    cpc: 0.58,
    conversions: 312,
    revenue: 37890,
    roas: 8.42,
    cpa: 14.42,
  },
  {
    id: '2',
    name: 'Prospecção - Lookalike 1%',
    objective: 'CONVERSIONS',
    status: 'ACTIVE',
    budgetType: 'daily',
    budget: 300,
    spend: 8200,
    impressions: 367700,
    clicks: 10295,
    ctr: 2.8,
    cpm: 22.30,
    cpc: 0.80,
    conversions: 428,
    revenue: 42722,
    roas: 5.21,
    cpa: 19.16,
  },
  {
    id: '3',
    name: 'Carrinho Abandonado',
    objective: 'CONVERSIONS',
    status: 'ACTIVE',
    budgetType: 'daily',
    budget: 80,
    spend: 2100,
    impressions: 98000,
    clicks: 3920,
    ctr: 4.0,
    cpm: 21.43,
    cpc: 0.54,
    conversions: 145,
    revenue: 14385,
    roas: 6.85,
    cpa: 14.48,
  },
  {
    id: '4',
    name: 'Coleção Verão 2024',
    objective: 'CONVERSIONS',
    status: 'ACTIVE',
    budgetType: 'daily',
    budget: 500,
    spend: 12500,
    impressions: 560000,
    clicks: 11200,
    ctr: 2.0,
    cpm: 22.32,
    cpc: 1.12,
    conversions: 387,
    revenue: 49250,
    roas: 3.94,
    cpa: 32.30,
  },
  {
    id: '5',
    name: 'Reengajamento 30 dias',
    objective: 'CONVERSIONS',
    status: 'PAUSED',
    budgetType: 'daily',
    budget: 120,
    spend: 3200,
    impressions: 145000,
    clicks: 4350,
    ctr: 3.0,
    cpm: 22.07,
    cpc: 0.74,
    conversions: 98,
    revenue: 13184,
    roas: 4.12,
    cpa: 32.65,
  },
  {
    id: '6',
    name: 'Branding - Awareness',
    objective: 'REACH',
    status: 'ACTIVE',
    budgetType: 'daily',
    budget: 200,
    spend: 5600,
    impressions: 890000,
    clicks: 8900,
    ctr: 1.0,
    cpm: 6.29,
    cpc: 0.63,
    conversions: 45,
    revenue: 5400,
    roas: 0.96,
    cpa: 124.44,
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

export default function Campaigns() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'roas', direction: 'desc' });

  const filteredCampaigns = mockCampaigns
    .filter((campaign) => {
      if (filters.search) {
        return campaign.name.toLowerCase().includes(filters.search.toLowerCase());
      }
      return true;
    })
    .filter((campaign) => {
      if (filters.status?.length) {
        return filters.status.includes(campaign.status);
      }
      return true;
    })
    .filter((campaign) => {
      if (filters.objective?.length) {
        return filters.objective.includes(campaign.objective);
      }
      return true;
    })
    .filter((campaign) => {
      if (filters.minSpend !== undefined && campaign.spend < filters.minSpend) return false;
      if (filters.maxSpend !== undefined && campaign.spend > filters.maxSpend) return false;
      return true;
    })
    .filter((campaign) => {
      if (filters.minRoas !== undefined && campaign.roas < filters.minRoas) return false;
      if (filters.maxRoas !== undefined && campaign.roas > filters.maxRoas) return false;
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

  const totals = filteredCampaigns.reduce(
    (acc, campaign) => ({
      spend: acc.spend + campaign.spend,
      impressions: acc.impressions + campaign.impressions,
      clicks: acc.clicks + campaign.clicks,
      conversions: acc.conversions + campaign.conversions,
      revenue: acc.revenue + campaign.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

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
          <div>
            <h1 className="text-3xl font-bold mb-2">Campanhas</h1>
            <p className="text-muted-foreground">
              Análise detalhada de todas as campanhas
            </p>
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
            value={`${avgCtr.toFixed(2)}%`}
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

        {/* Campaigns Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                    Campanha
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                    Objetivo
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    Orçamento
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    Gasto
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    Impressões
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    CTR
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    Conversões
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    CPA
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    ROAS
                  </th>
                  <th className="py-4 px-6"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Megaphone className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium">{campaign.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground text-sm">
                      {campaign.objective}
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        variant="secondary"
                        className={cn(
                          campaign.status === 'ACTIVE' &&
                            'bg-metric-positive/20 text-metric-positive',
                          campaign.status === 'PAUSED' &&
                            'bg-metric-warning/20 text-metric-warning',
                          campaign.status === 'DELETED' && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {campaign.status === 'ACTIVE' && 'Ativo'}
                        {campaign.status === 'PAUSED' && 'Pausado'}
                        {campaign.status === 'DELETED' && 'Excluído'}
                        {campaign.status === 'ARCHIVED' && 'Arquivado'}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {formatCurrency(campaign.budget)}/
                      {campaign.budgetType === 'daily' ? 'dia' : 'total'}
                    </td>
                    <td className="py-4 px-6 text-right">{formatCurrency(campaign.spend)}</td>
                    <td className="py-4 px-6 text-right">{formatNumber(campaign.impressions)}</td>
                    <td className="py-4 px-6 text-right">{campaign.ctr}%</td>
                    <td className="py-4 px-6 text-right">{campaign.conversions}</td>
                    <td className="py-4 px-6 text-right">{formatCurrency(campaign.cpa)}</td>
                    <td className="py-4 px-6 text-right">
                      <span
                        className={cn(
                          'font-semibold',
                          campaign.roas >= 5
                            ? 'text-metric-positive'
                            : campaign.roas >= 3
                            ? 'text-metric-warning'
                            : 'text-metric-negative'
                        )}
                      >
                        {campaign.roas}x
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <Link
                        to={`/campaign/${campaign.id}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
