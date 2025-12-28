import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { SyncProgressIndicator } from '@/components/sync/SyncProgressIndicator';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { useSyncWithProgress } from '@/hooks/useSyncWithProgress';
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
  Users,
  Layers,
  AlertTriangle,
  Settings,
  MoreVertical
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
  const lastSyncedRange = useRef<string | null>(null);
  const { campaigns, adSets, ads, loading, fetchCampaigns, fetchAdSets, fetchAds, selectedProject, projectsLoading, loadDataFromDatabase } = useMetaAdsData();

  // Use the new sync hook - for manual sync only
  const { syncing, progress, syncData } = useSyncWithProgress({
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

  // Sync when date range changes - fetches data for selected period
  useEffect(() => {
    if (!selectedProject || !dateRange?.from || !dateRange?.to || syncing) return;
    
    const rangeKey = `${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}`;
    
    // Skip if already synced this range
    if (lastSyncedRange.current === rangeKey) return;
    
    lastSyncedRange.current = rangeKey;
    syncData({
      since: format(dateRange.from, 'yyyy-MM-dd'),
      until: format(dateRange.to, 'yyyy-MM-dd')
    });
  }, [dateRange, selectedProject, syncData, syncing]);

  // Handle date range change
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    lastSyncedRange.current = null; // Reset to force sync
    setDateRange(newRange);
  }, []);

  // Handle preset change
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);
  
  // Manual sync with current date range
  const handleManualSync = useCallback(() => {
    lastSyncedRange.current = null; // Reset to force sync
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
              message={progress.message} 
              syncing={syncing} 
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
                <DropdownMenuItem onClick={handleManualSync} disabled={syncing || !selectedProject}>
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                  {syncing ? 'Sincronizando...' : 'Forçar Sincronização'}
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
                          <TooltipContent>{isEcommerce ? 'Número de compras realizadas' : 'Número de leads gerados (cadastros, formulários)'}</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">{isEcommerce ? 'CPA' : 'CPL'}</span>
                          </TooltipTrigger>
                          <TooltipContent>{isEcommerce ? 'Custo Por Aquisição: quanto custou cada compra (Gasto ÷ Compras)' : 'Custo Por Lead: quanto custou cada lead (Gasto ÷ Leads)'}</TooltipContent>
                        </Tooltip>
                      </th>
                      {isEcommerce && (
                        <th className="text-right py-4 px-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dashed border-muted-foreground/50">ROAS</span>
                            </TooltipTrigger>
                            <TooltipContent>Return On Ad Spend: retorno sobre investimento (Receita ÷ Gasto)</TooltipContent>
                          </Tooltip>
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
                        <td className="py-4 px-3 text-center">
                          {(() => {
                            const adSetsCount = adSetsCountByCampaign[campaign.id] || 0;
                            const adsCount = adsCountByCampaign[campaign.id] || 0;
                            const hasNoData = adSetsCount === 0 && adsCount === 0;
                            const isActive = campaign.status === 'ACTIVE';
                            
                            return (
                              <div className="flex items-center justify-center gap-2">
                                {hasNoData && isActive && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="w-4 h-4 text-metric-warning" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Campanha sem conjuntos ou anúncios sincronizados
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                <div className="flex items-center gap-1 text-xs">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={cn(
                                        "flex items-center gap-0.5 cursor-help",
                                        hasNoData ? "text-muted-foreground" : "text-foreground"
                                      )}>
                                        <Layers className="w-3 h-3" />
                                        {adSetsCount}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{adSetsCount} conjunto{adSetsCount !== 1 ? 's' : ''} de anúncios</TooltipContent>
                                  </Tooltip>
                                  <span className="text-muted-foreground">/</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={cn(
                                        "flex items-center gap-0.5 cursor-help",
                                        hasNoData ? "text-muted-foreground" : "text-foreground"
                                      )}>
                                        <Megaphone className="w-3 h-3" />
                                        {adsCount}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{adsCount} anúncio{adsCount !== 1 ? 's' : ''}</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            );
                          })()}
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
                        <td className="py-4 px-3 text-right">
                          <span className="text-sm font-semibold">
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
                        <td className="py-4 px-3 text-right">
                          <span className="text-sm font-semibold">
                            {campaign.conversions}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <span className="text-sm font-semibold">
                            {campaign.cpa > 0 ? formatCurrency(campaign.cpa) : '-'}
                          </span>
                        </td>
                        {isEcommerce && (
                          <td className="py-4 px-3 text-right">
                            <span className="text-sm font-semibold">
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
                      Total gasto: <strong className="text-foreground">{formatCurrency(totals.spend)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Total {isEcommerce ? 'compras' : 'leads'}: <strong className="text-foreground">{totals.conversions}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      {isEcommerce ? 'CPA' : 'CPL'} médio: <strong className="text-foreground">{formatCurrency(avgCpa)}</strong>
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