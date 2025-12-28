import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { 
  Megaphone, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

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
  
  const { campaigns, loading, syncing, syncData, selectedProject } = useMetaAdsData();

  const filteredCampaigns = campaigns
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
      if (filters.objective?.length && campaign.objective) {
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
      revenue: acc.revenue + campaign.conversion_value,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: selectedProject?.currency || 'BRL',
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
              {selectedProject ? `Projeto: ${selectedProject.name}` : 'Selecione um projeto'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={syncData} 
              disabled={syncing || !selectedProject}
              variant="outline"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma campanha encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {selectedProject 
                ? 'Clique em "Sincronizar" para buscar campanhas da sua conta Meta Ads.'
                : 'Crie um projeto primeiro para sincronizar suas campanhas.'}
            </p>
            {selectedProject && (
              <Button onClick={syncData} disabled={syncing} variant="gradient">
                <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                Sincronizar Agora
              </Button>
            )}
          </div>
        ) : (
          <>
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
                          {campaign.objective || '-'}
                        </td>
                        <td className="py-4 px-6">
                          <Badge
                            variant="secondary"
                            className={cn(
                              campaign.status === 'ACTIVE' &&
                                'bg-metric-positive/20 text-metric-positive',
                              campaign.status === 'PAUSED' &&
                                'bg-metric-warning/20 text-metric-warning',
                              (campaign.status === 'DELETED' || campaign.status === 'ARCHIVED') && 
                                'bg-muted text-muted-foreground'
                            )}
                          >
                            {campaign.status === 'ACTIVE' && 'Ativo'}
                            {campaign.status === 'PAUSED' && 'Pausado'}
                            {campaign.status === 'DELETED' && 'Excluído'}
                            {campaign.status === 'ARCHIVED' && 'Arquivado'}
                            {!['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'].includes(campaign.status) && campaign.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {campaign.daily_budget 
                            ? `${formatCurrency(campaign.daily_budget)}/dia`
                            : campaign.lifetime_budget 
                              ? `${formatCurrency(campaign.lifetime_budget)}/total`
                              : '-'}
                        </td>
                        <td className="py-4 px-6 text-right">{formatCurrency(campaign.spend)}</td>
                        <td className="py-4 px-6 text-right">{formatNumber(campaign.impressions)}</td>
                        <td className="py-4 px-6 text-right">{campaign.ctr.toFixed(2)}%</td>
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
                            {campaign.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <Link
                            to={`/campaign/${campaign.id}/adsets`}
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
