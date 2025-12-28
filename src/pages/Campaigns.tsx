import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { 
  Megaphone, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function Campaigns() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('last_30_days');
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });
  
  const { campaigns, loading, syncing, syncData, selectedProject, projectsLoading } = useMetaAdsData();

  // Initialize date range based on project timezone
  useEffect(() => {
    if (selectedProject) {
      const period = getDateRangeFromPreset('last_30_days', selectedProject.timezone);
      if (period) {
        setDateRange(datePeriodToDateRange(period));
      }
    }
  }, [selectedProject]);

  // Handle date range change - NO auto-sync, just filter locally
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
    // No sync - data is filtered locally for instant response
  }, []);

  // Handle preset change - NO auto-sync, just filter locally  
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
    if (preset !== 'custom' && selectedProject) {
      const period = getDateRangeFromPreset(preset, selectedProject.timezone);
      if (period) {
        const range = datePeriodToDateRange(period);
        setDateRange(range);
        // No sync - data is filtered locally for instant response
      }
    }
  }, [selectedProject]);
  
  // Manual sync with current date range
  const handleManualSync = useCallback(() => {
    if (dateRange?.from && dateRange?.to) {
      syncData({
        since: format(dateRange.from, 'yyyy-MM-dd'),
        until: format(dateRange.to, 'yyyy-MM-dd'),
      });
    } else {
      syncData();
    }
  }, [dateRange, syncData]);

  // Business model
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  // Sort options based on business model
  const sortOptions = [
    { value: 'spend', label: 'Gasto' },
    { value: 'conversions', label: isEcommerce ? 'Compras' : 'Leads' },
    { value: 'ctr', label: 'CTR' },
    { value: 'cpa', label: isEcommerce ? 'CPA' : 'CPL' },
    { value: 'name', label: 'Nome' },
    ...(isEcommerce ? [{ value: 'roas', label: 'ROAS' }] : []),
  ];

  // Redirect to project selector if no project selected (only after projects have loaded)
  useEffect(() => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!loading && !projectsLoading && !projectId && !selectedProject) {
      navigate('/projects');
    }
  }, [loading, selectedProject, navigate, projectsLoading]);

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
  const avgCpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

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
              {selectedProject && (
                <span className="ml-2 text-xs">
                  ({isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleManualSync} 
              disabled={syncing || !selectedProject}
              variant="outline"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
            <DateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={selectedProject?.timezone}
              onPresetChange={handlePresetChange}
            />
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
              <Button onClick={handleManualSync} disabled={syncing} variant="gradient">
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
                title={isEcommerce ? "Compras" : "Leads"}
                value={formatNumber(totals.conversions)}
                icon={isEcommerce ? ShoppingCart : Users}
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
                  value={formatCurrency(avgCpa)}
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

            {/* Campaigns Table - Enhanced */}
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left py-4 px-4 text-xs font-semibold text-foreground uppercase tracking-wide">
                        Campanha
                      </th>
                      <th className="text-center py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        Orçamento
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide bg-primary/5">
                        Gasto
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        Alcance
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        Impressões
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        Cliques
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        CTR
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide bg-chart-1/10">
                        {isEcommerce ? 'Compras' : 'Leads'}
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide bg-chart-2/10">
                        {isEcommerce ? 'CPA' : 'CPL'}
                      </th>
                      {isEcommerce && (
                        <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide bg-metric-positive/10">
                          ROAS
                        </th>
                      )}
                      <th className="py-4 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((campaign, index) => (
                      <tr
                        key={campaign.id}
                        className={cn(
                          "border-b border-border/30 hover:bg-secondary/40 transition-all duration-200 cursor-pointer",
                          index % 2 === 0 ? "bg-background/50" : "bg-secondary/10"
                        )}
                        onClick={() => navigate(`/campaign/${campaign.id}/adsets`)}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                              campaign.status === 'ACTIVE' ? "bg-metric-positive/10" : "bg-muted/50"
                            )}>
                              <Megaphone className={cn(
                                "w-5 h-5",
                                campaign.status === 'ACTIVE' ? "text-metric-positive" : "text-muted-foreground"
                              )} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate max-w-[280px]" title={campaign.name}>
                                {campaign.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {campaign.objective?.replace('OUTCOME_', '') || 'Sem objetivo'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs font-medium px-2 py-0.5",
                              campaign.status === 'ACTIVE' &&
                                'bg-metric-positive/20 text-metric-positive border border-metric-positive/30',
                              campaign.status === 'PAUSED' &&
                                'bg-metric-warning/20 text-metric-warning border border-metric-warning/30',
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
                        <td className="py-4 px-3 text-right">
                          <span className="text-sm font-medium">
                            {campaign.daily_budget 
                              ? `${formatCurrency(campaign.daily_budget)}`
                              : campaign.lifetime_budget 
                                ? `${formatCurrency(campaign.lifetime_budget)}`
                                : '-'}
                          </span>
                          {(campaign.daily_budget || campaign.lifetime_budget) && (
                            <span className="text-xs text-muted-foreground block">
                              {campaign.daily_budget ? '/dia' : '/total'}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-right bg-primary/5">
                          <span className="text-sm font-bold text-primary">
                            {formatCurrency(campaign.spend)}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <span className="text-sm font-medium">{formatNumber(campaign.reach)}</span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <span className="text-sm font-medium">{formatNumber(campaign.impressions)}</span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <span className="text-sm font-medium">{formatNumber(campaign.clicks)}</span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <span className={cn(
                            "text-sm font-semibold",
                            campaign.ctr >= 2 ? "text-metric-positive" : 
                            campaign.ctr >= 1 ? "text-metric-warning" : "text-muted-foreground"
                          )}>
                            {campaign.ctr.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right bg-chart-1/5">
                          <span className={cn(
                            "text-sm font-bold",
                            campaign.conversions > 0 ? "text-chart-1" : "text-muted-foreground"
                          )}>
                            {campaign.conversions}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right bg-chart-2/5">
                          <span className={cn(
                            "text-sm font-bold",
                            campaign.cpa > 0 ? "text-chart-2" : "text-muted-foreground"
                          )}>
                            {campaign.cpa > 0 ? formatCurrency(campaign.cpa) : '-'}
                          </span>
                        </td>
                        {isEcommerce && (
                          <td className="py-4 px-3 text-right bg-metric-positive/5">
                            <span
                              className={cn(
                                'text-sm font-bold',
                                campaign.roas >= 5
                                  ? 'text-metric-positive'
                                  : campaign.roas >= 3
                                  ? 'text-metric-warning'
                                  : campaign.roas > 0 
                                  ? 'text-metric-negative'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {campaign.roas > 0 ? `${campaign.roas.toFixed(2)}x` : '-'}
                            </span>
                          </td>
                        )}
                        <td className="py-4 px-2">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Table footer with totals */}
              <div className="border-t border-border bg-secondary/30 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {filteredCampaigns.length} campanha{filteredCampaigns.length !== 1 ? 's' : ''} 
                    {campaigns.length !== filteredCampaigns.length && ` (de ${campaigns.length} total)`}
                  </span>
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground">
                      Total gasto: <strong className="text-primary">{formatCurrency(totals.spend)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Total {isEcommerce ? 'compras' : 'leads'}: <strong className="text-chart-1">{totals.conversions}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      {isEcommerce ? 'CPA' : 'CPL'} médio: <strong className="text-chart-2">{formatCurrency(avgCpa)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}