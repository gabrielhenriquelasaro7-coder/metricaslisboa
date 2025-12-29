import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { 
  ArrowLeft,
  Loader2,
  ImageOff,
  Play,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Target,
  MousePointer,
  Eye,
  Users,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to clean image URLs - ONLY removes stp resize parameter, keeps auth params
const cleanImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  let clean = url.replace(/[&?]stp=[^&]*/g, '');
  
  if (clean.includes('&') && !clean.includes('?')) {
    clean = clean.replace('&', '?');
  }
  
  clean = clean.replace(/[&?]$/g, '');
  
  return clean;
};

export default function CreativeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ads, campaigns, adSets, loading, selectedProject, projectsLoading } = useMetaAdsData();

  // Redirect if no project selected
  if (!selectedProject && !projectsLoading && !loading) {
    navigate('/projects');
    return null;
  }

  const creative = ads.find(ad => ad.id === id);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: selectedProject?.currency || 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(2)}%`;
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

  if (loading || projectsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!creative) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Button variant="ghost" onClick={() => navigate('/creatives')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Criativos
          </Button>
          <div className="glass-card p-12 text-center">
            <ImageOff className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Criativo não encontrado</h3>
            <p className="text-muted-foreground">O criativo solicitado não existe ou foi removido.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const campaign = campaigns.find(c => c.id === creative.campaign_id);
  const adSet = adSets.find(a => a.id === creative.ad_set_id);
  const statusBadge = getStatusBadge(creative.status);
  const videoUrl = (creative as any).creative_video_url;
  const hasVideo = !!videoUrl;
  const imageUrl = cleanImageUrl(creative.creative_image_url) || cleanImageUrl(creative.creative_thumbnail);
  const ticket = creative.conversions && creative.conversions > 0 
    ? (creative.conversion_value || 0) / creative.conversions 
    : 0;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => navigate('/creatives')} className="mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Criativos
            </Button>
            <h1 className="text-2xl font-bold mb-2">{creative.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-xs', statusBadge.className)}>
                {statusBadge.label}
              </Badge>
              {hasVideo && (
                <Badge className="bg-primary/20 text-primary text-xs">
                  <Play className="w-3 h-3 mr-1" />
                  Vídeo
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Creative Preview */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Preview do Criativo</h2>
              <div className="relative aspect-square max-w-[500px] mx-auto rounded-xl overflow-hidden bg-secondary/30 border border-border">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt={creative.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent) {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'w-full h-full flex items-center justify-center';
                          placeholder.innerHTML = '<span class="text-muted-foreground">Imagem não disponível</span>';
                          parent.appendChild(placeholder);
                        }
                      }}
                    />
                    {hasVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                          <Play className="w-8 h-8 text-primary-foreground ml-1" />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="w-16 h-16 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              
              {hasVideo && videoUrl && (
                <div className="mt-4 text-center">
                  <Button variant="outline" asChild>
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Assistir Vídeo no Facebook
                    </a>
                  </Button>
                </div>
              )}
            </div>

            {/* Creative Info */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Informações do Criativo</h2>
              <div className="space-y-4">
                {creative.headline && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Título</p>
                    <p className="text-sm">{creative.headline}</p>
                  </div>
                )}
                {creative.primary_text && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Texto Principal</p>
                    <p className="text-sm whitespace-pre-wrap">{creative.primary_text}</p>
                  </div>
                )}
                {creative.cta && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Call to Action</p>
                    <Badge variant="outline">{creative.cta.replace(/_/g, ' ')}</Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Hierarchy */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Hierarquia</h2>
              <div className="space-y-3">
                {campaign && (
                  <div 
                    className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(`/campaigns`)}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Target className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Campanha</p>
                      <p className="text-sm font-medium truncate">{campaign.name}</p>
                    </div>
                  </div>
                )}
                {adSet && (
                  <div 
                    className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(`/adset/${adSet.id}`)}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Conjunto de Anúncios</p>
                      <p className="text-sm font-medium truncate">{adSet.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-6">
            {/* Main E-commerce Metrics */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Métricas de E-commerce</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Gasto</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(creative.spend || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4 text-metric-positive" />
                    <p className="text-xs text-muted-foreground">Compras</p>
                  </div>
                  <p className="text-2xl font-bold text-metric-positive">{formatNumber(creative.conversions || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-metric-positive" />
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(creative.conversion_value || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(ticket)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">CPA</p>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(creative.cpa || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-metric-positive" />
                    <p className="text-xs text-muted-foreground">ROAS</p>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    (creative.roas || 0) >= 3 ? "text-metric-positive" : (creative.roas || 0) >= 1 ? "text-metric-warning" : "text-metric-negative"
                  )}>
                    {(creative.roas || 0).toFixed(2)}x
                  </p>
                </div>
              </div>
            </div>

            {/* Engagement Metrics */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Métricas de Engajamento</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Impressões</p>
                  </div>
                  <p className="text-xl font-bold">{formatNumber(creative.impressions || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MousePointer className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Cliques</p>
                  </div>
                  <p className="text-xl font-bold">{formatNumber(creative.clicks || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">CTR</p>
                  </div>
                  <p className="text-xl font-bold">{formatPercent(creative.ctr || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">CPC</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(creative.cpc || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">CPM</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(creative.cpm || 0)}</p>
                </div>
                
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Alcance</p>
                  </div>
                  <p className="text-xl font-bold">{formatNumber(creative.reach || 0)}</p>
                </div>
              </div>
            </div>

            {/* Frequency */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">Frequência</h2>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        (creative.frequency || 0) <= 2 ? "bg-metric-positive" : 
                        (creative.frequency || 0) <= 4 ? "bg-metric-warning" : "bg-metric-negative"
                      )}
                      style={{ width: `${Math.min(100, ((creative.frequency || 0) / 6) * 100)}%` }}
                    />
                  </div>
                </div>
                <p className={cn(
                  "text-2xl font-bold min-w-[60px] text-right",
                  (creative.frequency || 0) <= 2 ? "text-metric-positive" : 
                  (creative.frequency || 0) <= 4 ? "text-metric-warning" : "text-metric-negative"
                )}>
                  {(creative.frequency || 0).toFixed(2)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {(creative.frequency || 0) <= 2 
                  ? "Frequência saudável - Público ainda não saturado" 
                  : (creative.frequency || 0) <= 4 
                  ? "Frequência moderada - Monitore a performance"
                  : "Frequência alta - Considere renovar o criativo"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

