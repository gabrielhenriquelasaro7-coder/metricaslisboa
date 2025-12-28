import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Grid3X3, 
  List, 
  Play, 
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointerClick,
  DollarSign,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Creative {
  id: string;
  type: 'image' | 'video';
  thumbnail: string;
  headline: string;
  primaryText: string;
  cta: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
    conversions: number;
    roas: number;
  };
  status: 'active' | 'paused' | 'ended';
}

// Mock data
const mockCreatives: Creative[] = [
  {
    id: '1',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop',
    headline: 'Aproveite 50% OFF',
    primaryText: 'Promoção imperdível de fim de ano! Compre agora e economize.',
    cta: 'Comprar Agora',
    campaignName: 'Black Friday 2024',
    adSetName: 'Remarketing - Carrinho',
    adName: 'Promo 50% - Imagem 1',
    metrics: {
      impressions: 245000,
      clicks: 7840,
      ctr: 3.2,
      spend: 4500,
      conversions: 312,
      roas: 8.42,
    },
    status: 'active',
  },
  {
    id: '2',
    type: 'video',
    thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop',
    headline: 'Nova Coleção Verão',
    primaryText: 'Descubra as novidades que vão transformar seu guarda-roupa.',
    cta: 'Ver Coleção',
    campaignName: 'Lançamento Verão',
    adSetName: 'Lookalike 1%',
    adName: 'Video Coleção - 15s',
    metrics: {
      impressions: 520000,
      clicks: 12480,
      ctr: 2.4,
      spend: 8200,
      conversions: 428,
      roas: 5.21,
    },
    status: 'active',
  },
  {
    id: '3',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop',
    headline: 'Frete Grátis',
    primaryText: 'Compras acima de R$99 têm frete grátis para todo o Brasil!',
    cta: 'Aproveitar',
    campaignName: 'Always On',
    adSetName: 'Interesse - Moda',
    adName: 'Frete Grátis - Banner',
    metrics: {
      impressions: 180000,
      clicks: 4320,
      ctr: 2.4,
      spend: 2100,
      conversions: 145,
      roas: 6.85,
    },
    status: 'paused',
  },
  {
    id: '4',
    type: 'video',
    thumbnail: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=400&fit=crop',
    headline: 'Estilo Único',
    primaryText: 'Peças exclusivas para você se destacar em qualquer ocasião.',
    cta: 'Explorar',
    campaignName: 'Branding Q4',
    adSetName: 'Broad - 18-45',
    adName: 'Lifestyle Video - 30s',
    metrics: {
      impressions: 890000,
      clicks: 17800,
      ctr: 2.0,
      spend: 12500,
      conversions: 387,
      roas: 3.94,
    },
    status: 'active',
  },
  {
    id: '5',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&fit=crop',
    headline: 'Últimas Unidades',
    primaryText: 'Corra! Estoque limitado nos tamanhos mais procurados.',
    cta: 'Garantir o Meu',
    campaignName: 'Urgency Campaign',
    adSetName: 'Reengajamento 30d',
    adName: 'Urgência - Estoque',
    metrics: {
      impressions: 95000,
      clicks: 3800,
      ctr: 4.0,
      spend: 3200,
      conversions: 98,
      roas: 4.12,
    },
    status: 'ended',
  },
  {
    id: '6',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=400&fit=crop',
    headline: 'Outlet Online',
    primaryText: 'Descontos de até 70% em peças selecionadas do outlet.',
    cta: 'Ver Outlet',
    campaignName: 'Outlet Permanente',
    adSetName: 'Visitantes Site',
    adName: 'Outlet - Desconto 70%',
    metrics: {
      impressions: 156000,
      clicks: 4992,
      ctr: 3.2,
      spend: 1800,
      conversions: 89,
      roas: 5.8,
    },
    status: 'active',
  },
];

export default function Creatives() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('roas');

  const filteredCreatives = mockCreatives
    .filter((creative) => {
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          creative.headline.toLowerCase().includes(searchLower) ||
          creative.primaryText.toLowerCase().includes(searchLower) ||
          creative.campaignName.toLowerCase().includes(searchLower) ||
          creative.adName.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter((creative) => {
      if (typeFilter !== 'all') return creative.type === typeFilter;
      return true;
    })
    .filter((creative) => {
      if (statusFilter !== 'all') return creative.status === statusFilter;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'roas':
          return b.metrics.roas - a.metrics.roas;
        case 'spend':
          return b.metrics.spend - a.metrics.spend;
        case 'ctr':
          return b.metrics.ctr - a.metrics.ctr;
        case 'conversions':
          return b.metrics.conversions - a.metrics.conversions;
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

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="image">Imagens</SelectItem>
              <SelectItem value="video">Vídeos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="paused">Pausados</SelectItem>
              <SelectItem value="ended">Finalizados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="roas">Maior ROAS</SelectItem>
              <SelectItem value="spend">Maior Gasto</SelectItem>
              <SelectItem value="ctr">Maior CTR</SelectItem>
              <SelectItem value="conversions">Mais Conversões</SelectItem>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Total de Criativos</p>
            <p className="text-2xl font-bold">{filteredCreatives.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Imagens</p>
            <p className="text-2xl font-bold">
              {filteredCreatives.filter((c) => c.type === 'image').length}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">Vídeos</p>
            <p className="text-2xl font-bold">
              {filteredCreatives.filter((c) => c.type === 'video').length}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground">ROAS Médio</p>
            <p className="text-2xl font-bold text-metric-positive">
              {(
                filteredCreatives.reduce((sum, c) => sum + c.metrics.roas, 0) /
                filteredCreatives.length
              ).toFixed(2)}
              x
            </p>
          </div>
        </div>

        {/* Creative Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCreatives.map((creative) => (
              <div key={creative.id} className="glass-card-hover overflow-hidden group">
                {/* Thumbnail */}
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={creative.thumbnail}
                    alt={creative.headline}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {creative.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                      <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                        <Play className="w-8 h-8 text-primary-foreground ml-1" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        creative.status === 'active' && 'bg-metric-positive/20 text-metric-positive',
                        creative.status === 'paused' && 'bg-metric-warning/20 text-metric-warning',
                        creative.status === 'ended' && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {creative.status === 'active' && 'Ativo'}
                      {creative.status === 'paused' && 'Pausado'}
                      {creative.status === 'ended' && 'Finalizado'}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      {creative.type === 'image' ? (
                        <ImageIcon className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      {creative.type === 'image' ? 'Imagem' : 'Vídeo'}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <Badge
                      className={cn(
                        'text-lg font-bold',
                        creative.metrics.roas >= 5
                          ? 'bg-metric-positive text-metric-positive-foreground'
                          : creative.metrics.roas >= 3
                          ? 'bg-metric-warning text-metric-warning-foreground'
                          : 'bg-metric-negative text-metric-negative-foreground'
                      )}
                    >
                      {creative.metrics.roas}x ROAS
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{creative.headline}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {creative.primaryText}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{creative.cta}</Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="truncate">
                      <span className="text-foreground">{creative.campaignName}</span> → {creative.adSetName}
                    </p>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                    <div className="text-center">
                      <p className="text-lg font-semibold">{formatNumber(creative.metrics.impressions)}</p>
                      <p className="text-xs text-muted-foreground">Impressões</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">{creative.metrics.ctr}%</p>
                      <p className="text-xs text-muted-foreground">CTR</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">{creative.metrics.conversions}</p>
                      <p className="text-xs text-muted-foreground">Conversões</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                    Criativo
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                    Campanha / Conjunto
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
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">
                    ROAS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCreatives.map((creative) => (
                  <tr
                    key={creative.id}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={creative.thumbnail}
                            alt={creative.headline}
                            className="w-full h-full object-cover"
                          />
                          {creative.type === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                              <Play className="w-6 h-6 text-foreground" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{creative.headline}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {creative.primaryText}
                          </p>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'mt-1',
                              creative.status === 'active' && 'bg-metric-positive/20 text-metric-positive',
                              creative.status === 'paused' && 'bg-metric-warning/20 text-metric-warning'
                            )}
                          >
                            {creative.status === 'active' && 'Ativo'}
                            {creative.status === 'paused' && 'Pausado'}
                            {creative.status === 'ended' && 'Finalizado'}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm">{creative.campaignName}</p>
                      <p className="text-xs text-muted-foreground">{creative.adSetName}</p>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {formatNumber(creative.metrics.impressions)}
                    </td>
                    <td className="py-4 px-6 text-right">{creative.metrics.ctr}%</td>
                    <td className="py-4 px-6 text-right">
                      {formatCurrency(creative.metrics.spend)}
                    </td>
                    <td className="py-4 px-6 text-right">{creative.metrics.conversions}</td>
                    <td className="py-4 px-6 text-right">
                      <span
                        className={cn(
                          'font-semibold',
                          creative.metrics.roas >= 5
                            ? 'text-metric-positive'
                            : creative.metrics.roas >= 3
                            ? 'text-metric-warning'
                            : 'text-metric-negative'
                        )}
                      >
                        {creative.metrics.roas}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
