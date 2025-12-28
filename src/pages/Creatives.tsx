import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Grid3X3, 
  List, 
  RefreshCw,
  Loader2,
  ImageOff,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';

export default function Creatives() {
  const navigate = useNavigate();
  const { ads, campaigns, loading, syncing, selectedProject, projectsLoading, syncData } = useMetaAdsData();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('spend');

  // Check if project is ecommerce to show ROAS
  const isEcommerce = selectedProject?.business_model === 'ecommerce';

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

  // Filter and sort creatives (ads with creative info)
  const filteredCreatives = ads
    .filter((ad) => {
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          ad.name.toLowerCase().includes(searchLower) ||
          (ad.headline?.toLowerCase().includes(searchLower) || false) ||
          (ad.primary_text?.toLowerCase().includes(searchLower) || false) ||
          getCampaignName(ad.campaign_id).toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter((ad) => {
      if (statusFilter !== 'all') return ad.status === statusFilter;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
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
            </p>
          </div>
          <Button onClick={syncData} disabled={syncing}>
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar criativos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="PAUSED">Pausados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spend">Maior Gasto</SelectItem>
              <SelectItem value="ctr">Maior CTR</SelectItem>
              <SelectItem value="conversions">Mais Conversões</SelectItem>
              {isEcommerce && <SelectItem value="roas">Maior ROAS</SelectItem>}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className={cn("grid gap-4", isEcommerce ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Total de Criativos</p>
            <p className="text-2xl font-bold">{filteredCreatives.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold">
              {filteredCreatives.filter((c) => c.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Pausados</p>
            <p className="text-2xl font-bold">
              {filteredCreatives.filter((c) => c.status === 'PAUSED').length}
            </p>
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
              Sincronize seus dados para ver os criativos das suas campanhas.
            </p>
            <Button onClick={syncData} disabled={syncing}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sincronizar Dados
            </Button>
          </div>
        )}

        {/* Creative Grid/List */}
        {viewMode === 'grid' && filteredCreatives.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCreatives.map((creative) => {
              const statusBadge = getStatusBadge(creative.status);
              return (
                <div key={creative.id} className="glass-card-hover overflow-hidden group">
                  {/* Thumbnail - usando resolução maior */}
                  <div className="relative aspect-square overflow-hidden bg-secondary/30">
                    {creative.creative_thumbnail ? (
                      <>
                        <img
                          src={creative.creative_thumbnail.replace(/\/s\d+x\d+\//, '/')}
                          alt={creative.headline || creative.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            // Try original URL if high-res fails
                            const img = e.target as HTMLImageElement;
                            if (!img.dataset.fallback) {
                              img.dataset.fallback = 'true';
                              img.src = creative.creative_thumbnail || '';
                            } else {
                              img.style.display = 'none';
                            }
                          }}
                        />
                        <a
                          href={creative.creative_thumbnail.replace(/\/s\d+x\d+\//, '/')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-3 right-3 p-2 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <Badge variant="secondary" className={statusBadge.className}>
                        {statusBadge.label}
                      </Badge>
                    </div>
                    {isEcommerce && (
                      <div className="absolute bottom-3 right-3">
                        <Badge
                          className={cn(
                            'text-lg font-bold',
                            (creative.roas || 0) >= 5
                              ? 'bg-metric-positive text-metric-positive-foreground'
                              : (creative.roas || 0) >= 3
                              ? 'bg-metric-warning text-metric-warning-foreground'
                              : 'bg-metric-negative text-metric-negative-foreground'
                          )}
                        >
                          {(creative.roas || 0).toFixed(2)}x ROAS
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                        {creative.headline || creative.name}
                      </h3>
                      {creative.primary_text && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {creative.primary_text}
                        </p>
                      )}
                    </div>

                    {creative.cta && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{creative.cta.replace(/_/g, ' ')}</Badge>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="truncate">
                        <span className="text-foreground">{getCampaignName(creative.campaign_id)}</span>
                      </p>
                    </div>

                    {/* Metrics */}
                    <div className={cn("grid gap-3 pt-3 border-t border-border", isEcommerce ? "grid-cols-3" : "grid-cols-3")}>
                      <div className="text-center">
                        <p className="text-lg font-semibold">{formatNumber(creative.impressions || 0)}</p>
                        <p className="text-xs text-muted-foreground">Impressões</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold">{(creative.ctr || 0).toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">CTR</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold">{creative.conversions || 0}</p>
                        <p className="text-xs text-muted-foreground">Conversões</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'list' && filteredCreatives.length > 0 ? (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                    Criativo
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                    Campanha
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    Impressões
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    CTR
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    Gasto
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    Conversões
                  </th>
                  {isEcommerce && (
                    <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                      ROAS
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCreatives.map((creative) => {
                  const statusBadge = getStatusBadge(creative.status);
                  return (
                    <tr
                      key={creative.id}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-secondary/30">
                            {creative.creative_thumbnail ? (
                              <img
                                src={creative.creative_thumbnail.replace(/\/s\d+x\d+\//, '/s300x300/')}
                                alt={creative.headline || creative.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (!img.dataset.fallback) {
                                    img.dataset.fallback = 'true';
                                    img.src = creative.creative_thumbnail || '';
                                  } else {
                                    img.style.display = 'none';
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageOff className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium line-clamp-1">
                              {creative.headline || creative.name}
                            </p>
                            <Badge variant="secondary" className={cn('mt-1', statusBadge.className)}>
                              {statusBadge.label}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm">{getCampaignName(creative.campaign_id)}</p>
                      </td>
                      <td className="py-4 px-6 text-right font-medium">
                        {formatNumber(creative.impressions || 0)}
                      </td>
                      <td className="py-4 px-6 text-right font-medium">
                        {(creative.ctr || 0).toFixed(2)}%
                      </td>
                      <td className="py-4 px-6 text-right font-medium">
                        {formatCurrency(creative.spend || 0)}
                      </td>
                      <td className="py-4 px-6 text-right font-medium">
                        {creative.conversions || 0}
                      </td>
                      {isEcommerce && (
                        <td className="py-4 px-6 text-right">
                          <Badge
                            className={cn(
                              'font-bold',
                              (creative.roas || 0) >= 5
                                ? 'bg-metric-positive text-metric-positive-foreground'
                                : (creative.roas || 0) >= 3
                                ? 'bg-metric-warning text-metric-warning-foreground'
                                : 'bg-metric-negative text-metric-negative-foreground'
                            )}
                          >
                            {(creative.roas || 0).toFixed(2)}x
                          </Badge>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}