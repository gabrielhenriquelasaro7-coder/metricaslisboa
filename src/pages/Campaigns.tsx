import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { DateRange } from 'react-day-picker';
import { differenceInDays, format } from 'date-fns';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { SkeletonMetricCard, SkeletonTableRow } from '@/components/ui/skeleton-card';
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
  Users,
  Layers,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function Campaigns() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });
  const { campaigns, adSets, ads, loading, selectedProject, projectsLoading, loadMetricsByPeriod, usingFallbackData } = useMetaAdsData();

  // Create lookup maps for ad sets and ads count per campaign
  const adSetsCountByCampaign = adSets.reduce((acc, adSet) => {
    acc[adSet.campaign_id] = (acc[adSet.campaign_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const adsCountByCampaign = ads.reduce((acc, ad) => {
    acc[ad.campaign_id] = (acc[ad.campaign_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Load metrics when preset changes - INSTANT from local database
  useEffect(() => {
    if (!selectedProject) return;
    
    console.log(`[Campaigns] Loading period: ${selectedPreset}`);
    loadMetricsByPeriod(selectedPreset);
  }, [selectedPreset, selectedProject, loadMetricsByPeriod]);

  // Handle date range change - NO sync, just load from database
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, []);

  // Handle preset change
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);

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
  const avgTicket = totals.conversions > 0 ? totals.revenue / totals.conversions : 0;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: selectedProject?.currency || 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Format last sync time
  const lastSyncDisplay = selectedProject?.last_sync_at 
    ? format(new Date(selectedProject.last_sync_at), 'dd/MM HH:mm')
    : 'Nunca';

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Info Banner - Sync automático */}
        {usingFallbackData && !loading && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3 red-gradient-card">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Dados sincronizados automaticamente às 2h</p>
              <p className="text-sm text-muted-foreground">
                O sync automático roda diariamente às 2AM (horário de Brasília) atualizando todos os períodos.
                Último sync: {lastSyncDisplay}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 gradient-text inline-block">Campanhas</h1>
            <p className="text-muted-foreground">
              {selectedProject ? `Projeto: ${selectedProject.name}` : 'Selecione um projeto'}
              {selectedProject && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedProject?.last_sync_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-2 rounded-lg border border-border/50">
                <div className="w-2 h-2 rounded-full bg-metric-positive animate-pulse" />
                <Clock className="w-3.5 h-3.5" />
                <span>Sync: {lastSyncDisplay}</span>
              </div>
            )}
            <DateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={selectedProject?.timezone}
              onPresetChange={handlePresetChange}
            />
          </div>
        </div>

        {loading ? (
          <>
            {/* Skeleton Metrics */}
            <div className={cn(
              "grid gap-4 stagger-fade-in",
              "grid-cols-2 md:grid-cols-4 lg:grid-cols-8"
            )}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonMetricCard key={i} />
              ))}
            </div>
            
            {/* Skeleton Table */}
            <div className="glass-card overflow-hidden border-t-2 border-t-primary/50">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="py-4 px-4"><div className="h-3 w-20 bg-muted rounded animate-pulse" /></th>
                      <th className="py-4 px-3"><div className="h-3 w-12 bg-muted rounded animate-pulse mx-auto" /></th>
                      <th className="py-4 px-3"><div className="h-3 w-14 bg-muted rounded animate-pulse mx-auto" /></th>
                      <th className="py-4 px-3"><div className="h-3 w-16 bg-muted rounded animate-pulse ml-auto" /></th>
                      <th className="py-4 px-3"><div className="h-3 w-12 bg-muted rounded animate-pulse ml-auto" /></th>
                      <th className="py-4 px-3"><div className="h-3 w-14 bg-muted rounded animate-pulse ml-auto" /></th>
                      <th className="py-4 px-3"><div className="h-3 w-16 bg-muted rounded animate-pulse ml-auto" /></th>
                      <th className="py-4 px-3"><div className="h-3 w-12 bg-muted rounded animate-pulse ml-auto" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <SkeletonTableRow key={i} columns={8} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : campaigns.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma campanha encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {selectedProject 
                ? 'As campanhas serão sincronizadas automaticamente às 2AM (horário de Brasília).'
                : 'Crie um projeto primeiro para sincronizar suas campanhas.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Último sync: {lastSyncDisplay}
            </p>
          </div>
        ) : (
          <>
            {/* Summary Metrics */}
            <div className={cn(
              "grid gap-3 stagger-fade-in",
              isEcommerce 
                ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8" 
                : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            )}>
              <MetricCard
                title="Gasto Total"
                value={formatCurrency(totals.spend)}
                icon={DollarSign}
              />
              {isEcommerce && (
                <MetricCard
                  title="Receita Total"
                  value={formatCurrency(totals.revenue)}
                  icon={TrendingUp}
                  className="border-l-4 border-l-metric-positive"
                />
              )}
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
                <>
                  <MetricCard
                    title="Ticket Médio"
                    value={formatCurrency(avgTicket)}
                    icon={ShoppingCart}
                    className="border-l-4 border-l-chart-1"
                  />
                  <MetricCard
                    title="ROAS Médio"
                    value={`${avgRoas.toFixed(2)}x`}
                    icon={TrendingUp}
                    className="border-l-4 border-l-metric-positive"
                  />
                </>
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

            {/* Campaigns Table */}
            <div className="glass-card overflow-hidden border-t-2 border-t-primary/50">
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
                      <th className="text-center py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">Conj/Anún</span>
                          </TooltipTrigger>
                          <TooltipContent>Quantidade de conjuntos e anúncios sincronizados</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        Orçamento
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
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
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        {isEcommerce ? 'Compras' : 'Leads'}
                      </th>
                      {isEcommerce && (
                        <>
                          <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                            Receita
                          </th>
                          <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                            ROAS
                          </th>
                        </>
                      )}
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        {isEcommerce ? 'CPA' : 'CPL'}
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((campaign, index) => {
                      const budget = campaign.daily_budget || campaign.lifetime_budget || 0;
                      const budgetType = campaign.daily_budget ? '/dia' : campaign.lifetime_budget ? 'vitalício' : '';
                      const adSetsCount = adSetsCountByCampaign[campaign.id] || 0;
                      const adsCount = adsCountByCampaign[campaign.id] || 0;
                      
                      return (
                        <tr 
                          key={campaign.id}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/campaign/${campaign.id}/adsets`)}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                                <Megaphone className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">
                                  {campaign.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {campaign.objective?.replace(/_/g, ' ') || 'Sem objetivo'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <Badge 
                              variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}
                              className={cn(
                                "text-xs",
                                campaign.status === 'ACTIVE' && "bg-metric-positive text-white",
                                campaign.status === 'PAUSED' && "bg-metric-warning text-white"
                              )}
                            >
                              {campaign.status === 'ACTIVE' ? 'Ativo' : campaign.status === 'PAUSED' ? 'Pausado' : campaign.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <Layers className="w-3 h-3" />
                              <span>{adSetsCount}</span>
                              <span>/</span>
                              <span>{adsCount}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <div>
                              <span className="font-medium text-sm">{formatCurrency(budget)}</span>
                              <span className="text-xs text-muted-foreground ml-1">{budgetType}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-right font-medium text-sm">
                            {formatCurrency(campaign.spend)}
                          </td>
                          <td className="py-4 px-3 text-right text-sm text-muted-foreground">
                            {formatNumber(campaign.reach)}
                          </td>
                          <td className="py-4 px-3 text-right text-sm text-muted-foreground">
                            {formatNumber(campaign.impressions)}
                          </td>
                          <td className="py-4 px-3 text-right text-sm">
                            {formatNumber(campaign.clicks)}
                          </td>
                          <td className="py-4 px-3 text-right">
                            <span className={cn(
                              "text-sm font-medium",
                              campaign.ctr >= 2 && "text-metric-positive",
                              campaign.ctr < 1 && "text-metric-negative"
                            )}>
                              {campaign.ctr.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right font-medium text-sm">
                            {campaign.conversions}
                          </td>
                          {isEcommerce && (
                            <>
                              <td className="py-4 px-3 text-right font-medium text-sm text-metric-positive">
                                {formatCurrency(campaign.conversion_value)}
                              </td>
                              <td className="py-4 px-3 text-right">
                                <span className={cn(
                                  "text-sm font-bold",
                                  campaign.roas >= 3 && "text-metric-positive",
                                  campaign.roas < 1 && "text-metric-negative"
                                )}>
                                  {campaign.roas.toFixed(2)}x
                                </span>
                              </td>
                            </>
                          )}
                          <td className="py-4 px-3 text-right">
                            <span className={cn(
                              "text-sm font-medium",
                              campaign.cpa > 0 && campaign.cpa < 50 && "text-metric-positive",
                              campaign.cpa > 100 && "text-metric-negative"
                            )}>
                              {formatCurrency(campaign.cpa)}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Footer */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{filteredCampaigns.length} campanhas encontradas</span>
              <span>Total investido: {formatCurrency(totals.spend)}</span>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}