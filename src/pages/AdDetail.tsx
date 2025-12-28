import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { 
  ChevronLeft,
  Image as ImageIcon,
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  TrendingUp,
  ShoppingCart,
  RefreshCw,
  Target,
  Percent,
  BarChart3,
  Zap,
  Play,
  ExternalLink,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Ad {
  id: string;
  ad_set_id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  reach: number;
  frequency: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
  creative_id: string | null;
  creative_thumbnail: string | null;
  creative_image_url: string | null;
  creative_video_url: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  synced_at: string | null;
}

interface AdSet {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
}

export default function AdDetail() {
  const { adId } = useParams<{ adId: string }>();
  const { projects } = useProjects();
  const [ad, setAd] = useState<Ad | null>(null);
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const selectedProject = projects.find(p => p.id === ad?.project_id);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  useEffect(() => {
    const fetchData = async () => {
      if (!adId) return;
      setLoading(true);
      try {
        const { data: adData } = await supabase
          .from('ads')
          .select('*')
          .eq('id', adId)
          .maybeSingle();
        
        if (adData) {
          setAd(adData as Ad);
          
          // Fetch ad set
          const { data: adSetData } = await supabase
            .from('ad_sets')
            .select('id, name')
            .eq('id', adData.ad_set_id)
            .maybeSingle();
          if (adSetData) setAdSet(adSetData);

          // Fetch campaign
          const { data: campaignData } = await supabase
            .from('campaigns')
            .select('id, name')
            .eq('id', adData.campaign_id)
            .maybeSingle();
          if (campaignData) setCampaign(campaignData);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [adId]);

  const formatNumber = (n: number) => 
    n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString();
  
  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  const hasVideo = ad?.creative_video_url;
  const hasImage = ad?.creative_image_url || ad?.creative_thumbnail;
  const creativeUrl = ad?.creative_image_url || ad?.creative_thumbnail || '';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!ad) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Anúncio não encontrado</h2>
          <Link to="/campaigns" className="text-primary hover:underline mt-2 inline-block">
            Voltar para campanhas
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to={adSet ? `/adset/${adSet.id}` : '/campaigns'} 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{ad.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    ad.status === 'ACTIVE' && 'bg-metric-positive/20 text-metric-positive',
                    ad.status === 'PAUSED' && 'bg-metric-warning/20 text-metric-warning'
                  )}
                >
                  {ad.status === 'ACTIVE' ? 'Ativo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status}
                </Badge>
                {adSet && (
                  <Link to={`/adset/${adSet.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Conjunto: {adSet.name}
                  </Link>
                )}
                {campaign && (
                  <span className="text-sm text-muted-foreground">
                    • Campanha: {campaign.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {ad.synced_at && (
              <p className="text-xs">
                Atualizado: {new Date(ad.synced_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Creative Preview */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                {hasVideo ? <Play className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                Criativo
              </h3>
              
              {hasVideo ? (
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <video 
                    src={ad.creative_video_url || ''} 
                    controls 
                    className="w-full h-full object-contain"
                    poster={ad.creative_thumbnail || undefined}
                  />
                </div>
              ) : hasImage && !imageError ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted cursor-zoom-in hover:opacity-90 transition-opacity">
                      <img 
                        src={creativeUrl} 
                        alt={ad.name}
                        className="w-full h-full object-contain"
                        onError={() => setImageError(true)}
                      />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-2">
                    <img 
                      src={creativeUrl} 
                      alt={ad.name}
                      className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                    />
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                  <ImageIcon className="w-16 h-16 text-muted-foreground/50" />
                </div>
              )}

              {/* Open original */}
              {(hasVideo || hasImage) && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => window.open(hasVideo ? ad.creative_video_url! : creativeUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir original
                </Button>
              )}
            </div>

            {/* Ad Copy */}
            {(ad.headline || ad.primary_text || ad.cta) && (
              <div className="glass-card p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Textos do Anúncio
                </h3>
                <div className="space-y-4">
                  {ad.headline && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Título</p>
                      <p className="font-medium">{ad.headline}</p>
                    </div>
                  )}
                  {ad.primary_text && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Texto Principal</p>
                      <p className="text-sm whitespace-pre-wrap">{ad.primary_text}</p>
                    </div>
                  )}
                  {ad.cta && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CTA</p>
                      <Badge variant="secondary">{ad.cta}</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Gasto" value={formatCurrency(ad.spend)} icon={DollarSign} />
              <MetricCard title="Alcance" value={formatNumber(ad.reach)} icon={Users} />
              <MetricCard title="Impressões" value={formatNumber(ad.impressions)} icon={Eye} />
              <MetricCard title="Cliques" value={formatNumber(ad.clicks)} icon={MousePointerClick} />
              <MetricCard title="CTR" value={`${ad.ctr.toFixed(2)}%`} icon={Percent} />
              <MetricCard title="CPM" value={formatCurrency(ad.cpm)} icon={BarChart3} />
              <MetricCard title="CPC" value={formatCurrency(ad.cpc)} icon={Target} />
              <MetricCard title="Frequência" value={ad.frequency.toFixed(1)} icon={Zap} />
            </div>

            {/* Business Model Specific Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isEcommerce ? (
                <>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-metric-positive/10 flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-metric-positive" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Compras</p>
                        <p className="text-2xl font-bold">{ad.conversions}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ROAS</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          ad.roas >= 5 ? 'text-metric-positive' : ad.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative'
                        )}>
                          {ad.roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-chart-2/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-chart-2" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CPA</p>
                        <p className="text-2xl font-bold">{formatCurrency(ad.cpa)}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-chart-1/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-chart-1" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Leads</p>
                        <p className="text-2xl font-bold">{ad.conversions}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CPL</p>
                        <p className="text-2xl font-bold">{formatCurrency(ad.cpa)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-chart-3/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-chart-3" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Conversão</p>
                        <p className="text-2xl font-bold">{formatCurrency(ad.conversion_value)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Additional Info */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold mb-4">Informações Adicionais</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ID do Anúncio</p>
                  <p className="font-mono text-xs mt-1 truncate">{ad.id}</p>
                </div>
                {ad.creative_id && (
                  <div>
                    <p className="text-muted-foreground">ID do Criativo</p>
                    <p className="font-mono text-xs mt-1 truncate">{ad.creative_id}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Receita Gerada</p>
                  <p className="font-medium mt-1">{formatCurrency(ad.conversion_value)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modelo de Negócio</p>
                  <p className="font-medium mt-1">{isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
