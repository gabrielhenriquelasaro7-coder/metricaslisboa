import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { SyncProgressIndicator } from '@/components/sync/SyncProgressIndicator';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { useSyncWithProgress } from '@/hooks/useSyncWithProgress';
import { DateRange } from 'react-day-picker';
import { format, differenceInDays } from 'date-fns';
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
  Users,
  Layers,
  AlertTriangle,
  Settings,
  MoreVertical,
  History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function Campaigns() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('last_7_days', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('last_7_days');
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });
  const { campaigns, adSets, ads, loading, fetchCampaigns, fetchAdSets, fetchAds, selectedProject, projectsLoading, loadMetricsByPeriod, getPeriodKeyFromDays } = useMetaAdsData();

  // Use the new sync hook - for manual sync only
  const { syncing, syncingAllPeriods, progress, allPeriodsProgress, syncData, syncAllPeriods } = useSyncWithProgress({
    projectId: selectedProject?.id || '',
    adAccountId: selectedProject?.ad_account_id || '',
    onSuccess: () => {
      fetchCampaigns();
      fetchAdSets();
      fetchAds();
    },
  });

  // Create lookup maps for ad sets and ads count per campaign
  const adSetsCountByCampaign = adSets.reduce((acc, adSet) => {
    acc[adSet.campaign_id] = (acc[adSet.campaign_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const adsCountByCampaign = ads.reduce((acc, ad) => {
    acc[ad.campaign_id] = (acc[ad.campaign_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Load metrics when date range changes - INSTANT from local database
  useEffect(() => {
    if (!selectedProject || !dateRange?.from || !dateRange?.to) return;
    
    const diffDays = differenceInDays(dateRange.to, dateRange.from);
    const periodKey = getPeriodKeyFromDays(diffDays);
    
    console.log(`[Campaigns] Loading period: ${periodKey}`);
    loadMetricsByPeriod(periodKey);
  }, [dateRange, selectedProject, loadMetricsByPeriod, getPeriodKeyFromDays]);

  // Handle date range change - NO sync, just load from database
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, []);

  // Handle preset change
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);
  
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
            <SyncProgressIndicator 
              step={progress.step} 
              message={allPeriodsProgress 
                ? `Período ${allPeriodsProgress.currentPeriod}/${allPeriodsProgress.totalPeriods}: ${allPeriodsProgress.periodKey}` 
                : progress.message
              } 
              syncing={syncing || syncingAllPeriods} 
            />
            <DateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={selectedProject?.timezone}
              onPresetChange={handlePresetChange}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleManualSync} disabled={syncing || syncingAllPeriods || !selectedProject}>
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                  {syncing ? 'Sincronizando...' : 'Forçar Sincronização (Período Atual)'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={syncAllPeriods} disabled={syncing || syncingAllPeriods || !selectedProject}>
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncingAllPeriods && "animate-spin")} />
                  {syncingAllPeriods ? `Sincronizando ${allPeriodsProgress?.currentPeriod || 0}/5...` : 'Sincronizar Todos os Períodos'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/sync-history')}>
                  <History className="w-4 h-4 mr-2" />
                  Ver Histórico de Sync
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <div className={cn(
              "grid gap-4",
              isEcommerce ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-8" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">Gasto</span>
                          </TooltipTrigger>
                          <TooltipContent>Valor total investido na campanha</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">Alcance</span>
                          </TooltipTrigger>
                          <TooltipContent>Número de pessoas únicas que viram o anúncio</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">Impressões</span>
                          </TooltipTrigger>
                          <TooltipContent>Número total de vezes que o anúncio foi exibido</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">Cliques</span>
                          </TooltipTrigger>
                          <TooltipContent>Número de cliques no anúncio</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">CTR</span>
                          </TooltipTrigger>
                          <TooltipContent>Click-Through Rate: % de pessoas que clicaram após ver o anúncio (Cliques ÷ Impressões × 100)</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">{isEcommerce ? 'Compras' : 'Leads'}</span>
                          </TooltipTrigger>
                          <TooltipContent>{isEcommerce ? 'Número de compras realizadas' : 'Número de leads gerados'}</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">{isEcommerce ? 'CPA' : 'CPL'}</span>
                          </TooltipTrigger>
                          <TooltipContent>{isEcommerce ? 'Custo por Aquisição (Gasto ÷ Compras)' : 'Custo por Lead (Gasto ÷ Leads)'}</TooltipContent>
                        </Tooltip>
                      </th>
                      {isEcommerce && (
                        <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dashed border-muted-foreground/50">ROAS</span>
                            </TooltipTrigger>
                            <TooltipContent>Return on Ad Spend: Receita gerada para cada real investido (Receita ÷ Gasto)</TooltipContent>
                          </Tooltip>
                        </th>
                      )}
                      <th className="text-right py-4 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((campaign, index) => {
                      const adSetsCount = adSetsCountByCampaign[campaign.id] || 0;
                      const adsCount = adsCountByCampaign[campaign.id] || 0;
                      const cpa = campaign.conversions > 0 ? campaign.spend / campaign.conversions : 0;
                      
                      return (
                        <tr
                          key={campaign.id}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/campaign/${campaign.id}/adsets`)}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                campaign.status === 'ACTIVE' 
                                  ? 'bg-metric-positive/10' 
                                  : 'bg-secondary'
                              )}>
                                <Megaphone className={cn(
                                  "w-5 h-5",
                                  campaign.status === 'ACTIVE' 
                                    ? 'text-metric-positive' 
                                    : 'text-muted-foreground'
                                )} />
                              </div>
                              <div className="max-w-[200px]">
                                <p className="font-medium truncate group-hover:text-primary transition-colors">
                                  {campaign.name}
                                </p>
                                {campaign.objective && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {campaign.objective}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                campaign.status === 'ACTIVE' && 'bg-metric-positive/20 text-metric-positive border-metric-positive/30',
                                campaign.status === 'PAUSED' && 'bg-metric-warning/20 text-metric-warning border-metric-warning/30',
                                (campaign.status === 'DELETED' || campaign.status === 'ARCHIVED') && 'bg-muted text-muted-foreground'
                              )}
                            >
                              {campaign.status === 'ACTIVE' ? 'Ativo' : 
                               campaign.status === 'PAUSED' ? 'Pausado' : 
                               campaign.status === 'DELETED' ? 'Deletado' : 
                               campaign.status === 'ARCHIVED' ? 'Arquivado' : campaign.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                              <Layers className="w-3.5 h-3.5" />
                              <span>{adSetsCount}</span>
                              <span className="mx-1">/</span>
                              <Megaphone className="w-3.5 h-3.5" />
                              <span>{adsCount}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <span className="text-sm">
                              {campaign.daily_budget 
                                ? `${formatCurrency(campaign.daily_budget)}/dia`
                                : campaign.lifetime_budget 
                                  ? `${formatCurrency(campaign.lifetime_budget)} total`
                                  : '-'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right font-medium">
                            {formatCurrency(campaign.spend)}
                          </td>
                          <td className="py-4 px-3 text-right text-sm">
                            {formatNumber(campaign.reach)}
                          </td>
                          <td className="py-4 px-3 text-right text-sm">
                            {formatNumber(campaign.impressions)}
                          </td>
                          <td className="py-4 px-3 text-right text-sm">
                            {formatNumber(campaign.clicks)}
                          </td>
                          <td className="py-4 px-3 text-right text-sm">
                            {campaign.ctr.toFixed(2)}%
                          </td>
                          <td className="py-4 px-3 text-right">
                            <span className={cn(
                              "font-semibold",
                              campaign.conversions > 0 ? "text-primary" : "text-muted-foreground"
                            )}>
                              {campaign.conversions}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right text-sm">
                            {campaign.conversions > 0 ? formatCurrency(cpa) : '-'}
                          </td>
                          {isEcommerce && (
                            <td className="py-4 px-3 text-right">
                              <Badge 
                                variant="outline"
                                className={cn(
                                  "font-semibold",
                                  campaign.roas >= 5 && "bg-metric-positive/20 text-metric-positive border-metric-positive/30",
                                  campaign.roas >= 3 && campaign.roas < 5 && "bg-metric-warning/20 text-metric-warning border-metric-warning/30",
                                  campaign.roas < 3 && campaign.roas > 0 && "bg-metric-negative/20 text-metric-negative border-metric-negative/30"
                                )}
                              >
                                {campaign.roas.toFixed(2)}x
                              </Badge>
                            </td>
                          )}
                          <td className="py-4 px-3 text-right">
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/30 font-medium">
                      <td className="py-4 px-4">
                        Total: {filteredCampaigns.length} campanhas
                      </td>
                      <td colSpan={3}></td>
                      <td className="py-4 px-3 text-right">{formatCurrency(totals.spend)}</td>
                      <td colSpan={3}></td>
                      <td className="py-4 px-3 text-right">{avgCtr.toFixed(2)}%</td>
                      <td className="py-4 px-3 text-right text-primary font-semibold">{totals.conversions}</td>
                      <td className="py-4 px-3 text-right">{totals.conversions > 0 ? formatCurrency(avgCpa) : '-'}</td>
                      {isEcommerce && (
                        <td className="py-4 px-3 text-right">
                          <Badge variant="outline" className="font-semibold">
                            {avgRoas.toFixed(2)}x
                          </Badge>
                        </td>
                      )}
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}