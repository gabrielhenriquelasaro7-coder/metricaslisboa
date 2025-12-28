import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { 
  Search, 
  RefreshCw,
  Loader2,
  ImageOff,
  Play,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';

const ITEMS_PER_PAGE = 25;

export default function Creatives() {
  const navigate = useNavigate();
  const { ads, campaigns, adSets, loading, syncing, selectedProject, projectsLoading, syncData } = useMetaAdsData();
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
  const isInitialMount = useRef(true);
  const lastSyncedRange = useRef<string | null>(null);

  // Check if project is ecommerce to show ROAS
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const projectTimezone = selectedProject?.timezone || 'America/Sao_Paulo';

  // Auto-sync when date range changes
  useEffect(() => {
    if (!selectedProject || !dateRange?.from || !dateRange?.to) return;
    
    const rangeKey = `${dateRange.from.toISOString()}-${dateRange.to.toISOString()}`;
    
    // Skip if already synced this range or if syncing
    if (lastSyncedRange.current === rangeKey || syncing) return;
    
    // Skip initial mount - don't auto-sync on first load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Do initial sync
      lastSyncedRange.current = rangeKey;
      syncData({
        since: dateRange.from.toISOString().split('T')[0],
        until: dateRange.to.toISOString().split('T')[0]
      });
      return;
    }
    
    // Auto-sync when range changes
    lastSyncedRange.current = rangeKey;
    syncData({
      since: dateRange.from.toISOString().split('T')[0],
      until: dateRange.to.toISOString().split('T')[0]
    });
  }, [dateRange, selectedProject, syncData, syncing]);

  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
    setCurrentPage(1);
  }, []);

  // Redirect if no project selected (only after projects have loaded)
  if (!selectedProject && !projectsLoading && !loading) {
    navigate('/projects');
    return null;
  }

  // Get campaign name by ID
  const getCampaignName = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || 'Campanha Desconhecida';
  };

  // Get ad set name by ID
  const getAdSetName = (adSetId: string) => {
    const adSet = adSets.find(a => a.id === adSetId);
    return adSet?.name || 'Conjunto Desconhecido';
  };

  // Get filtered ad sets based on selected campaign
  const filteredAdSets = useMemo(() => {
    if (campaignFilter === 'all') return adSets;
    return adSets.filter(a => a.campaign_id === campaignFilter);
  }, [adSets, campaignFilter]);

  // Filter and sort creatives (ads with creative info)
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

  // Reset page when filters change
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

  const avgRoas = filteredCreatives.length > 0 && isEcommerce
    ? filteredCreatives.reduce((sum, c) => sum + (c.roas || 0), 0) / filteredCreatives.length
    : 0;

  const totalSpend = filteredCreatives.reduce((sum, c) => sum + (c.spend || 0), 0);

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
            <h1 className="text-3xl font-bold mb-2">Galeria de Criativos</h1>
            <p className="text-muted-foreground">
              Visualize e analise o desempenho dos seus criativos
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
            <Button onClick={() => dateRange?.from && dateRange?.to && syncData({
              since: dateRange.from.toISOString().split('T')[0],
              until: dateRange.to.toISOString().split('T')[0]
            })} disabled={syncing} size="sm">
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
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
              <SelectItem value="ctr">Maior CTR</SelectItem>
              <SelectItem value="conversions">Mais Conversões</SelectItem>
              {isEcommerce && <SelectItem value="roas">Maior ROAS</SelectItem>}
            </SelectContent>
          </Select>

        </div>

        {/* Stats */}
        <div className={cn("grid gap-4", isEcommerce ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4")}>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Total de Criativos</p>
            <p className="text-2xl font-bold">{filteredCreatives.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-metric-positive">
              {filteredCreatives.filter((c) => c.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Pausados</p>
            <p className="text-2xl font-bold text-metric-warning">
              {filteredCreatives.filter((c) => c.status === 'PAUSED').length}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Gasto Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
          </div>
          {isEcommerce && (
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">ROAS Médio</p>
              <p className="text-2xl font-bold text-metric-positive">
                {avgRoas.toFixed(2)}x
              </p>
            </div>
          )}
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
              <Button onClick={() => syncData()} disabled={syncing}>
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

        {/* Creative List */}
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
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Leads</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">CPL</th>
                    {isEcommerce && (
                      <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">ROAS</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {paginatedCreatives.map((creative) => {
                    const statusBadge = getStatusBadge(creative.status);
                    const videoUrl = (creative as any).creative_video_url;
                    const hasVideo = !!videoUrl;
                    const hasImage = creative.creative_image_url || creative.creative_thumbnail;
                    
                    return (
                      <tr key={creative.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {/* Small thumbnail */}
                            <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-secondary/50 border border-border/50">
                              {hasImage ? (
                                <img
                                  src={creative.creative_image_url || creative.creative_thumbnail || ''}
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
                                  <ImageOff className="w-4 h-4 text-muted-foreground/50" />
                                </div>
                              )}
                              {hasVideo && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <Play className="w-3 h-3 text-white" />
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
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/20 text-chart-1">
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
                          <span className="text-sm font-medium">{creative.conversions || 0}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm">{formatCurrency(creative.cpa || 0)}</span>
                        </td>
                        {isEcommerce && (
                          <td className="py-3 px-4 text-right">
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
                              (creative.roas || 0) >= 5
                                ? 'bg-metric-positive/20 text-metric-positive'
                                : (creative.roas || 0) >= 3
                                ? 'bg-metric-warning/20 text-metric-warning'
                                : 'bg-metric-negative/20 text-metric-negative'
                            )}>
                              {(creative.roas || 0).toFixed(2)}x
                            </span>
                          </td>
                        )}
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
                      className="w-9"
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