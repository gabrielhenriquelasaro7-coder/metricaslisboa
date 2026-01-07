import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CreativeImage } from '@/components/ui/creative-image';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { 
  Search, 
  Loader2,
  ImageOff,
  Play,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Target,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';

const ITEMS_PER_PAGE = 25;

// Helper to clean image URLs - ONLY removes stp resize parameter, keeps auth params
const cleanImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  // Remove ONLY stp= parameter that forces resize (e.g., stp=dst-jpg_p64x64_q75_tt6)
  let clean = url.replace(/[&?]stp=[^&]*/g, '');
  
  // Fix malformed URL: if & appears before any ?, replace first & with ?
  if (clean.includes('&') && !clean.includes('?')) {
    clean = clean.replace('&', '?');
  }
  
  // Clean trailing ? or &
  clean = clean.replace(/[&?]$/g, '');
  
  return clean;
};

export default function Creatives() {
  const navigate = useNavigate();
  const { ads, campaigns, adSets, loading, syncing, selectedProject, projectsLoading, syncData, loadMetricsByPeriod, usingFallbackData, dataDateRange } = useMetaAdsData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [adSetFilter, setAdSetFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('status');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Business model detection
  const businessModel = selectedProject?.business_model;
  const isEcommerce = businessModel === 'ecommerce';
  const isInsideSales = businessModel === 'inside_sales';
  const isPdv = businessModel === 'pdv';
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');

  const projectTimezone = selectedProject?.timezone || 'America/Sao_Paulo';

  // Load metrics when preset changes - INSTANT from local database
  useEffect(() => {
    if (!selectedProject) return;
    console.log(`[Creatives] Loading period: ${selectedPreset}`);
    loadMetricsByPeriod(selectedPreset);
  }, [selectedPreset, selectedProject, loadMetricsByPeriod]);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
    setCurrentPage(1);
  }, []);

  // Handle preset change - load data by period
  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);


  // Redirect if no project selected
  if (!selectedProject && !projectsLoading && !loading) {
    navigate('/projects');
    return null;
  }

  const getCampaignName = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || 'Campanha Desconhecida';
  };

  const getAdSetName = (adSetId: string) => {
    const adSet = adSets.find(a => a.id === adSetId);
    return adSet?.name || 'Conjunto Desconhecido';
  };

  const filteredAdSets = useMemo(() => {
    if (campaignFilter === 'all') return adSets;
    return adSets.filter(a => a.campaign_id === campaignFilter);
  }, [adSets, campaignFilter]);

  // Filter and sort creatives
  const filteredCreatives = useMemo(() => {
    return ads
      .filter((ad) => {
        if (search) {
          const searchLower = search.toLowerCase();
          return (
            ad.name.toLowerCase().includes(searchLower) ||
            (ad.headline?.toLowerCase().includes(searchLower) || false) ||
            (ad.primary_text?.toLowerCase().includes(searchLower) || false) ||
            getCampaignName(ad.campaign_id).toLowerCase().includes(searchLower) ||
            getAdSetName(ad.ad_set_id).toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .filter((ad) => {
        if (statusFilter !== 'all') return ad.status === statusFilter;
        return true;
      })
      .filter((ad) => {
        if (campaignFilter !== 'all') return ad.campaign_id === campaignFilter;
        return true;
      })
      .filter((ad) => {
        if (adSetFilter !== 'all') return ad.ad_set_id === adSetFilter;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'status':
            const statusOrder: Record<string, number> = { 'ACTIVE': 0, 'PAUSED': 1, 'DELETED': 2, 'ARCHIVED': 3 };
            const orderA = statusOrder[a.status] ?? 4;
            const orderB = statusOrder[b.status] ?? 4;
            if (orderA !== orderB) return orderA - orderB;
            return (b.spend || 0) - (a.spend || 0);
          case 'roas':
            return (b.roas || 0) - (a.roas || 0);
          case 'spend':
            return (b.spend || 0) - (a.spend || 0);
          case 'ctr':
            return (b.ctr || 0) - (a.ctr || 0);
          case 'conversions':
            return (b.conversions || 0) - (a.conversions || 0);
          case 'ticket':
            const ticketA = a.conversions && a.conversions > 0 ? (a.conversion_value || 0) / a.conversions : 0;
            const ticketB = b.conversions && b.conversions > 0 ? (b.conversion_value || 0) / b.conversions : 0;
            return ticketB - ticketA;
          default:
            return 0;
        }
      });
  }, [ads, search, statusFilter, campaignFilter, adSetFilter, sortBy, campaigns, adSets]);

  // Pagination
  const totalPages = Math.ceil(filteredCreatives.length / ITEMS_PER_PAGE);
  const paginatedCreatives = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCreatives.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCreatives, currentPage]);

  const handleCampaignChange = (value: string) => {
    setCampaignFilter(value);
    setAdSetFilter('all');
    setCurrentPage(1);
  };

  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (num: number) => {
    const currency = selectedProject?.currency || 'BRL';
    const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      ACTIVE: { label: 'Ativo', className: 'bg-metric-positive/20 text-metric-positive' },
      PAUSED: { label: 'Pausado', className: 'bg-metric-warning/20 text-metric-warning' },
      DELETED: { label: 'Deletado', className: 'bg-muted text-muted-foreground' },
      ARCHIVED: { label: 'Arquivado', className: 'bg-muted text-muted-foreground' },
    };
    return statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  };

  // Metrics calculations
  const totalSpend = filteredCreatives.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalConversions = filteredCreatives.reduce((sum, c) => sum + (c.conversions || 0), 0);
  const totalConversionValue = filteredCreatives.reduce((sum, c) => sum + (c.conversion_value || 0), 0);
  const avgRoas = totalSpend > 0 ? totalConversionValue / totalSpend : 0;
  const avgTicket = totalConversions > 0 ? totalConversionValue / totalConversions : 0;
  const avgCpl = totalConversions > 0 ? totalSpend / totalConversions : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 gradient-text">Galeria de Criativos</h1>
            <p className="text-muted-foreground">
              Análise de performance dos seus criativos
              {selectedProject && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'}
                </Badge>
              )}
              {dateRange?.from && dateRange?.to && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {dateRange.from.toLocaleDateString('pt-BR')} - {dateRange.to.toLocaleDateString('pt-BR')}
                </span>
              )}
            </p>
          </div>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            timezone={projectTimezone}
            onPresetChange={handlePresetChange}
            selectedPreset={selectedPreset}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar criativos..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>

          <Select value={campaignFilter} onValueChange={handleCampaignChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Campanha" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas Campanhas</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name.length > 30 ? campaign.name.substring(0, 30) + '...' : campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={adSetFilter} onValueChange={handleFilterChange(setAdSetFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Conjunto de Anúncios" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos Conjuntos</SelectItem>
              {filteredAdSets.map((adSet) => (
                <SelectItem key={adSet.id} value={adSet.id}>
                  {adSet.name.length > 30 ? adSet.name.substring(0, 30) + '...' : adSet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="PAUSED">Pausados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={handleFilterChange(setSortBy)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="status">Ativos Primeiro</SelectItem>
              <SelectItem value="spend">Maior Gasto</SelectItem>
              <SelectItem value="conversions">{isEcommerce ? 'Mais Compras' : 'Mais Leads'}</SelectItem>
              {isEcommerce && <SelectItem value="roas">Maior ROAS</SelectItem>}
              {isEcommerce && <SelectItem value="ticket">Maior Ticket</SelectItem>}
              <SelectItem value="ctr">Maior CTR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats - Dynamic based on business model */}
        <div className={cn("grid gap-4", isEcommerce ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-4")}>
          <div className="glass-card p-4 v4-accent">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">Total Criativos</p>
            </div>
            <p className="text-2xl font-bold">{filteredCreatives.length}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">Gasto Total</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-metric-positive" />
              <p className="text-xs text-muted-foreground">{isEcommerce ? 'Total Compras' : 'Total Leads'}</p>
            </div>
            <p className="text-2xl font-bold text-metric-positive">{formatNumber(totalConversions)}</p>
          </div>
          
          {/* E-commerce specific metrics */}
          {isEcommerce && (
            <>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-metric-positive" />
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(totalConversionValue)}</p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-metric-positive" />
                  <p className="text-xs text-muted-foreground">ROAS Médio</p>
                </div>
                <p className={cn("text-2xl font-bold", avgRoas >= 3 ? "text-metric-positive" : avgRoas >= 1 ? "text-metric-warning" : "text-metric-negative")}>
                  {avgRoas.toFixed(2)}x
                </p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(avgTicket)}</p>
              </div>
            </>
          )}
          
          {/* Inside Sales specific metrics */}
          {isInsideSales && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-chart-1" />
                <p className="text-xs text-muted-foreground">CPL Médio</p>
              </div>
              <p className="text-2xl font-bold text-chart-1">{formatCurrency(avgCpl)}</p>
            </div>
          )}
          
          {/* PDV specific metrics */}
          {isPdv && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-chart-2" />
                <p className="text-xs text-muted-foreground">Custo por Visita</p>
              </div>
              <p className="text-2xl font-bold text-chart-2">{formatCurrency(avgCpl)}</p>
            </div>
          )}
        </div>

        {/* Empty State - Period without data */}
        {usingFallbackData && filteredCreatives.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-metric-warning mb-4" />
            <h3 className="text-xl font-semibold mb-2">Sem dados para o período selecionado</h3>
            <p className="text-muted-foreground mb-4">
              Não há métricas registradas para este período.
            </p>
            {dataDateRange && (
              <p className="text-sm text-muted-foreground">
                Os dados disponíveis são de <span className="font-medium text-foreground">{dataDateRange.from}</span> a <span className="font-medium text-foreground">{dataDateRange.to}</span>.
              </p>
            )}
          </div>
        )}

        {/* Empty State - No data at all */}
        {!usingFallbackData && filteredCreatives.length === 0 && (
          <div className="glass-card p-12 text-center">
            <ImageOff className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum criativo encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {campaignFilter !== 'all' || adSetFilter !== 'all' 
                ? 'Tente ajustar os filtros para ver mais criativos.'
                : 'Sincronize seus dados para ver os criativos das suas campanhas.'}
            </p>
            {campaignFilter === 'all' && adSetFilter === 'all' && (
              <Button onClick={() => syncData()} disabled={syncing} className="bg-primary hover:bg-primary/90">
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar Dados
              </Button>
            )}
          </div>
        )}

        {/* Creative List - Dynamic based on business model */}
        {paginatedCreatives.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Anúncio</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Campanha</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Conjunto</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gasto</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{isEcommerce ? 'Compras' : 'Leads'}</th>
                    {isEcommerce && (
                      <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">ROAS</th>
                    )}
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{isEcommerce ? 'CPA' : 'CPL'}</th>
                    {isEcommerce && (
                      <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Ticket</th>
                    )}
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCreatives.map((ad, index) => {
                    const statusBadge = getStatusBadge(ad.status);
                    const ticket = ad.conversions > 0 ? ad.conversion_value / ad.conversions : 0;
                    const cpa = ad.conversions > 0 ? ad.spend / ad.conversions : 0;

                    return (
                      <tr 
                        key={ad.id} 
                        className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer transition-colors"
                        onClick={() => navigate(`/ad/${ad.id}`)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Creative Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-secondary/50 flex-shrink-0 overflow-hidden border border-border/50">
                              <CreativeImage
                                projectId={selectedProject?.id}
                                adId={ad.id}
                                cachedImageUrl={ad.cached_image_url}
                                creativeImageUrl={ad.creative_image_url}
                                creativeThumbnail={ad.creative_thumbnail}
                                alt={ad.name}
                                className="w-full h-full object-cover"
                                fallbackClassName="bg-secondary/50"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[200px]">{ad.name}</p>
                              {ad.headline && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{ad.headline}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          <p className="text-sm truncate max-w-[150px]">{getCampaignName(ad.campaign_id)}</p>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <p className="text-sm truncate max-w-[150px]">{getAdSetName(ad.ad_set_id)}</p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className={cn("text-xs", statusBadge.className)}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {formatCurrency(ad.spend)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn("font-semibold", ad.conversions > 0 ? "text-primary" : "text-muted-foreground")}>
                            {ad.conversions}
                          </span>
                        </td>
                        {isEcommerce && (
                          <td className="py-3 px-4 text-right">
                            <Badge 
                              variant="outline"
                              className={cn(
                                "font-semibold",
                                ad.roas >= 5 && "bg-metric-positive/20 text-metric-positive border-metric-positive/30",
                                ad.roas >= 3 && ad.roas < 5 && "bg-metric-warning/20 text-metric-warning border-metric-warning/30",
                                ad.roas < 3 && ad.roas > 0 && "bg-metric-negative/20 text-metric-negative border-metric-negative/30"
                              )}
                            >
                              {ad.roas.toFixed(2)}x
                            </Badge>
                          </td>
                        )}
                        <td className="py-3 px-4 text-right hidden sm:table-cell">
                          {ad.conversions > 0 ? formatCurrency(cpa) : '-'}
                        </td>
                        {isEcommerce && (
                          <td className="py-3 px-4 text-right hidden xl:table-cell">
                            {ad.conversions > 0 ? formatCurrency(ticket) : '-'}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right hidden lg:table-cell">
                          {ad.ctr.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/10">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredCreatives.length)} de {filteredCreatives.length} criativos
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-3">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
