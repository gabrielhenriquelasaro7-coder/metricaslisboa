import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { SkeletonMetricCard, SkeletonTableRow } from '@/components/ui/skeleton-card';
import { 
  Megaphone, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  RefreshCw,
  AlertCircle,
  Users,
  Clock,
  Search,
  Video,
  ShoppingBag,
  Globe
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Google Ads campaign type icons
const campaignTypeIcons: Record<string, React.ElementType> = {
  SEARCH: Search,
  DISPLAY: Globe,
  VIDEO: Video,
  SHOPPING: ShoppingBag,
  PERFORMANCE_MAX: TrendingUp,
};

export default function GoogleCampaigns() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });
  const { campaigns, loading, syncing, selectedProject, loadAllData, syncData } = useGoogleAdsData();

  // Load data when project changes
  useEffect(() => {
    if (selectedProject?.id) {
      loadAllData(selectedProject.id);
    }
  }, [selectedProject?.id, loadAllData]);

  // Handle date range change
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, []);

  // Handle preset change
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);

  // Handle sync
  const handleSync = useCallback(() => {
    syncData({ days: 30 });
  }, [syncData]);

  // Business model
  const isEcommerce = selectedProject?.business_model === 'ecommerce';

  // Sort options
  const sortOptions = [
    { value: 'spend', label: 'Gasto' },
    { value: 'conversions', label: isEcommerce ? 'Compras' : 'Conversões' },
    { value: 'ctr', label: 'CTR' },
    { value: 'cost_per_conversion', label: isEcommerce ? 'CPA' : 'Custo/Conv' },
    { value: 'name', label: 'Nome' },
    ...(isEcommerce ? [{ value: 'roas', label: 'ROAS' }] : []),
  ];

  // Redirect to project selector if no project selected
  useEffect(() => {
    const projectId = localStorage.getItem('selectedProjectId');
    if (!loading && !projectId && !selectedProject) {
      navigate('/projects');
    }
  }, [loading, selectedProject, navigate]);

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
        case 'cost_per_conversion':
          return (a.cost_per_conversion - b.cost_per_conversion) * multiplier;
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

  const getCampaignTypeIcon = (type: string | null) => {
    if (!type) return Megaphone;
    return campaignTypeIcons[type] || Megaphone;
  };

  const formatCampaignType = (type: string | null) => {
    if (!type) return 'Padrão';
    const types: Record<string, string> = {
      SEARCH: 'Pesquisa',
      DISPLAY: 'Display',
      VIDEO: 'Vídeo',
      SHOPPING: 'Shopping',
      PERFORMANCE_MAX: 'Performance Max',
      SMART: 'Smart',
      APP: 'App',
      LOCAL: 'Local',
      DISCOVERY: 'Discovery',
    };
    return types[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            {/* Google Ads Icon */}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">Google Ads</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {selectedProject ? `Projeto: ${selectedProject.name}` : 'Selecione um projeto'}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <Button
              onClick={handleSync}
              disabled={syncing || !selectedProject}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
            <DateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={selectedProject?.timezone}
              onPresetChange={handlePresetChange}
              selectedPreset={selectedPreset}
            />
          </div>
        </div>

        {loading ? (
          <>
            {/* Skeleton Metrics */}
            <div className={cn(
              "grid gap-3 sm:gap-4 stagger-fade-in",
              "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonMetricCard key={i} />
              ))}
            </div>
            
            {/* Skeleton Table */}
            <div className="glass-card overflow-hidden border-t-2 border-t-yellow-500/50">
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
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <SkeletonTableRow key={i} columns={6} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : !selectedProject?.google_customer_id ? (
          <div className="glass-card p-6 sm:p-8 lg:p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Configure o Google Ads</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-md mx-auto">
              Para sincronizar campanhas do Google Ads, adicione o <strong>ID do cliente</strong> (ex: 123-456-7890) nas configurações do projeto.
            </p>
            <Button onClick={() => navigate('/projects')} variant="gradient">
              Ir para Projetos
            </Button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card p-6 sm:p-8 lg:p-12 text-center">
            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Nenhuma campanha do Google Ads</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
              Clique em "Sincronizar" para importar suas campanhas do Google Ads.
            </p>
            <Button onClick={handleSync} disabled={syncing} variant="gradient">
              <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          </div>
        ) : (
          <>
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 stagger-fade-in">
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
                title={isEcommerce ? 'Compras' : 'Conversões'}
                value={formatNumber(totals.conversions)}
                icon={isEcommerce ? ShoppingCart : Users}
              />
              <MetricCard
                title={isEcommerce ? 'ROAS' : 'Custo/Conv'}
                value={isEcommerce ? `${avgRoas.toFixed(2)}x` : formatCurrency(avgCpa)}
                icon={TrendingUp}
                className="border-l-4 border-l-yellow-500"
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
            <div className="glass-card overflow-hidden border-t-2 border-t-yellow-500/50">
              {/* Mobile: Card View */}
              <div className="block lg:hidden divide-y divide-border/50">
                {filteredCampaigns.map((campaign) => {
                  const CampaignIcon = getCampaignTypeIcon(campaign.campaign_type);
                  
                  return (
                    <div 
                      key={campaign.id}
                      className="p-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-red-500/10 flex items-center justify-center flex-shrink-0">
                            <CampaignIcon className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {formatCampaignType(campaign.campaign_type)}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={campaign.status === 'ENABLED' ? 'default' : 'secondary'}
                          className={cn(
                            "text-xs flex-shrink-0",
                            campaign.status === 'ENABLED' && "bg-metric-positive text-white",
                            campaign.status === 'PAUSED' && "bg-metric-warning text-white"
                          )}
                        >
                          {campaign.status === 'ENABLED' ? 'Ativo' : campaign.status === 'PAUSED' ? 'Pausado' : campaign.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Gasto:</span>
                          <span className="ml-1 font-medium">{formatCurrency(campaign.spend)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliques:</span>
                          <span className="ml-1 font-medium">{formatNumber(campaign.clicks)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Conversões:</span>
                          <span className="ml-1 font-medium">{formatNumber(campaign.conversions)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{isEcommerce ? 'ROAS:' : 'Custo/Conv:'}</span>
                          <span className="ml-1 font-medium">
                            {isEcommerce ? `${campaign.roas.toFixed(2)}x` : formatCurrency(campaign.cost_per_conversion)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left py-4 px-4 font-medium text-sm">Campanha</th>
                      <th className="text-center py-4 px-3 font-medium text-sm">Status</th>
                      <th className="text-center py-4 px-3 font-medium text-sm">Tipo</th>
                      <th className="text-right py-4 px-3 font-medium text-sm">Gasto</th>
                      <th className="text-right py-4 px-3 font-medium text-sm">Impressões</th>
                      <th className="text-right py-4 px-3 font-medium text-sm">Cliques</th>
                      <th className="text-right py-4 px-3 font-medium text-sm">CTR</th>
                      <th className="text-right py-4 px-3 font-medium text-sm">Conversões</th>
                      <th className="text-right py-4 px-3 font-medium text-sm">{isEcommerce ? 'ROAS' : 'Custo/Conv'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((campaign, index) => {
                      const CampaignIcon = getCampaignTypeIcon(campaign.campaign_type);
                      
                      return (
                        <tr 
                          key={campaign.id}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500/20 to-red-500/10 flex items-center justify-center flex-shrink-0">
                                <CampaignIcon className="w-4 h-4 text-yellow-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate max-w-[250px]">{campaign.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <Badge 
                              variant={campaign.status === 'ENABLED' ? 'default' : 'secondary'}
                              className={cn(
                                "text-xs",
                                campaign.status === 'ENABLED' && "bg-metric-positive text-white",
                                campaign.status === 'PAUSED' && "bg-metric-warning text-white"
                              )}
                            >
                              {campaign.status === 'ENABLED' ? 'Ativo' : campaign.status === 'PAUSED' ? 'Pausado' : campaign.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className="text-xs text-muted-foreground">
                              {formatCampaignType(campaign.campaign_type)}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right font-medium">
                            {formatCurrency(campaign.spend)}
                          </td>
                          <td className="py-4 px-3 text-right">
                            {formatNumber(campaign.impressions)}
                          </td>
                          <td className="py-4 px-3 text-right">
                            {formatNumber(campaign.clicks)}
                          </td>
                          <td className="py-4 px-3 text-right">
                            {campaign.ctr.toFixed(2)}%
                          </td>
                          <td className="py-4 px-3 text-right">
                            {formatNumber(campaign.conversions)}
                          </td>
                          <td className="py-4 px-3 text-right font-medium">
                            {isEcommerce 
                              ? `${campaign.roas.toFixed(2)}x` 
                              : formatCurrency(campaign.cost_per_conversion)
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary Footer */}
              <div className="px-4 py-3 bg-secondary/30 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {filteredCampaigns.length} campanhas
                </span>
                <span className="font-medium">
                  Total: {formatCurrency(totals.spend)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
