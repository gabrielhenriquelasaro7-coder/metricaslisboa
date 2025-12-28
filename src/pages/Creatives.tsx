import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { 
  Search, 
  RefreshCw,
  Loader2,
  ImageOff,
  Play,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Target,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaAdsData, clearAllCache } from '@/hooks/useMetaAdsData';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
  const { ads, campaigns, adSets, loading, syncing, selectedProject, projectsLoading, syncData, loadDataFromDatabase } = useMetaAdsData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [adSetFilter, setAdSetFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('status');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('last_7_days', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const lastSyncedRange = useRef<string | null>(null);

  const projectTimezone = selectedProject?.timezone || 'America/Sao_Paulo';

  // Sync when date range changes
  useEffect(() => {
    if (!selectedProject || !dateRange?.from || !dateRange?.to || syncing) return;
    
    const rangeKey = `${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (lastSyncedRange.current === rangeKey) return;
    
    lastSyncedRange.current = rangeKey;
    syncData({
      since: format(dateRange.from, 'yyyy-MM-dd'),
      until: format(dateRange.to, 'yyyy-MM-dd')
    });
  }, [dateRange, selectedProject, syncData, syncing]);

  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    lastSyncedRange.current = null;
    setDateRange(range);
    setCurrentPage(1);
  }, []);

  const handleManualSync = useCallback(() => {
    lastSyncedRange.current = null;
    if (dateRange?.from && dateRange?.to) {
      clearAllCache();
      syncData({
        since: format(dateRange.from, 'yyyy-MM-dd'),
        until: format(dateRange.to, 'yyyy-MM-dd')
      }, true);
    }
  }, [dateRange, syncData]);

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
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
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

  // E-commerce metrics calculations
  const totalSpend = filteredCreatives.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalConversions = filteredCreatives.reduce((sum, c) => sum + (c.conversions || 0), 0);
  const totalConversionValue = filteredCreatives.reduce((sum, c) => sum + (c.conversion_value || 0), 0);
  const avgRoas = totalSpend > 0 ? totalConversionValue / totalSpend : 0;
  const avgTicket = totalConversions > 0 ? totalConversionValue / totalConversions : 0;

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
              Análise de performance dos seus criativos de e-commerce
              {dateRange?.from && dateRange?.to && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {dateRange.from.toLocaleDateString('pt-BR')} - {dateRange.to.toLocaleDateString('pt-BR')}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              timezone={projectTimezone}
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
              <SelectItem value="conversions">Mais Compras</SelectItem>
              <SelectItem value="roas">Maior ROAS</SelectItem>
              <SelectItem value="ticket">Maior Ticket</SelectItem>
              <SelectItem value="ctr">Maior CTR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* E-commerce Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <p className="text-xs text-muted-foreground">Total Compras</p>
            </div>
            <p className="text-2xl font-bold text-metric-positive">{formatNumber(totalConversions)}</p>
          </div>
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
        </div>

        {/* Empty State */}
        {filteredCreatives.length === 0 && (
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

        {/* Creative List - E-commerce focused */}
        {paginatedCreatives.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Criativo</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Campanha</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Conjunto</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gasto</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Compras</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ticket</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">CPA</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {paginatedCreatives.map((creative) => {
                    const statusBadge = getStatusBadge(creative.status);
                    const videoUrl = (creative as any).creative_video_url;
                    const hasVideo = !!videoUrl;
                    // Clean image URL on frontend as fallback
                    const imageUrl = cleanImageUrl(creative.creative_image_url) || cleanImageUrl(creative.creative_thumbnail);
                    const hasImage = !!imageUrl;
                    const ticket = creative.conversions && creative.conversions > 0 
                      ? (creative.conversion_value || 0) / creative.conversions 
                      : 0;
                    
                    return (
                      <tr key={creative.id} className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => navigate(`/creative/${creative.id}`)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {/* Larger thumbnail - 48x48 */}
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-secondary/50 border border-border/50">
                              {hasImage ? (
                                <img
                                  src={imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    img.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageOff className="w-5 h-5 text-muted-foreground/50" />
                                </div>
                              )}
                              {hasVideo && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <Play className="w-4 h-4 text-foreground" />
                                </div>
                              )}
                            </div>
                            
                            {/* Name and status */}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate max-w-[200px] lg:max-w-[300px]" title={creative.name}>
                                {creative.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                                  statusBadge.className
                                )}>
                                  {statusBadge.label}
                                </span>
                                {hasVideo && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary">
                                    <Play className="w-2 h-2 mr-0.5" />
                                    Vídeo
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground truncate block max-w-[180px]" title={getCampaignName(creative.campaign_id)}>
                            {getCampaignName(creative.campaign_id)}
                          </span>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground truncate block max-w-[150px]" title={getAdSetName(creative.ad_set_id)}>
                            {getAdSetName(creative.ad_set_id)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-primary">{formatCurrency(creative.spend || 0)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-medium text-metric-positive">{creative.conversions || 0}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm">{formatCurrency(ticket)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm">{formatCurrency(creative.cpa || 0)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
                            (creative.roas || 0) >= 3
                              ? 'bg-metric-positive/20 text-metric-positive'
                              : (creative.roas || 0) >= 1
                              ? 'bg-metric-warning/20 text-metric-warning'
                              : 'bg-metric-negative/20 text-metric-negative'
                          )}>
                            {(creative.roas || 0).toFixed(2)}x
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
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
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      className={cn("w-9", currentPage === page && "bg-primary hover:bg-primary/90")}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
