import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import PerformanceChart from '@/components/dashboard/PerformanceChart';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { 
  ChevronLeft,
  Layers,
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
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AdSet {
  id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  targeting: Record<string, unknown> | null;
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
  synced_at: string | null;
}

interface Ad {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  conversions: number;
  roas: number;
  cpa: number;
  creative_thumbnail: string | null;
  creative_image_url: string | null;
  creative_video_url: string | null;
  headline: string | null;
}

interface Campaign {
  id: string;
  name: string;
  project_id: string;
}

export default function AdSetDetail() {
  const { adSetId } = useParams<{ adSetId: string }>();
  const { projects } = useProjects();
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedProject = projects.find(p => p.id === adSet?.project_id);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  useEffect(() => {
    const fetchData = async () => {
      if (!adSetId) return;
      setLoading(true);
      try {
        // Fetch ad set
        const { data: adSetData } = await supabase
          .from('ad_sets')
          .select('*')
          .eq('id', adSetId)
          .maybeSingle();
        
        if (adSetData) {
          setAdSet(adSetData as AdSet);
          
          // Fetch campaign
          const { data: campaignData } = await supabase
            .from('campaigns')
            .select('id, name, project_id')
            .eq('id', adSetData.campaign_id)
            .maybeSingle();
          if (campaignData) setCampaign(campaignData);
        }

        // Fetch ads for this ad set
        const { data: adsData } = await supabase
          .from('ads')
          .select('*')
          .eq('ad_set_id', adSetId)
          .order('spend', { ascending: false });
        setAds((adsData as Ad[]) || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [adSetId]);

  const formatNumber = (n: number) => 
    n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString();
  
  const formatCurrency = (n: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  // Sort ads: active first
  const sortedAds = [...ads].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return b.spend - a.spend;
  });

  // Generate mock chart data based on ad set metrics
  const chartData = adSet ? [
    { date: 'Sem 1', value: adSet.spend * 0.15, value2: adSet.conversions * 0.12 },
    { date: 'Sem 2', value: adSet.spend * 0.22, value2: adSet.conversions * 0.20 },
    { date: 'Sem 3', value: adSet.spend * 0.28, value2: adSet.conversions * 0.30 },
    { date: 'Sem 4', value: adSet.spend * 0.35, value2: adSet.conversions * 0.38 },
  ] : [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!adSet) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Conjunto de anúncios não encontrado</h2>
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
              to={campaign ? `/campaign/${campaign.id}/adsets` : '/campaigns'} 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{adSet.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    adSet.status === 'ACTIVE' && 'bg-metric-positive/20 text-metric-positive',
                    adSet.status === 'PAUSED' && 'bg-metric-warning/20 text-metric-warning'
                  )}
                >
                  {adSet.status === 'ACTIVE' ? 'Ativo' : adSet.status === 'PAUSED' ? 'Pausado' : adSet.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {campaign && `Campanha: ${campaign.name}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'})
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Orçamento: {formatCurrency(adSet.daily_budget || adSet.lifetime_budget || 0)}</p>
            {adSet.synced_at && (
              <p className="text-xs mt-1">
                Atualizado: {new Date(adSet.synced_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <MetricCard title="Gasto" value={formatCurrency(adSet.spend)} icon={DollarSign} />
          <MetricCard title="Alcance" value={formatNumber(adSet.reach)} icon={Users} />
          <MetricCard title="Impressões" value={formatNumber(adSet.impressions)} icon={Eye} />
          <MetricCard title="Cliques" value={formatNumber(adSet.clicks)} icon={MousePointerClick} />
          <MetricCard title="CTR" value={`${adSet.ctr.toFixed(2)}%`} icon={Percent} />
          <MetricCard title="CPM" value={formatCurrency(adSet.cpm)} icon={BarChart3} />
          <MetricCard title="CPC" value={formatCurrency(adSet.cpc)} icon={Target} />
          <MetricCard title="Frequência" value={adSet.frequency.toFixed(1)} icon={Zap} />
        </div>

        {/* Business Model Specific Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isEcommerce ? (
            <>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-metric-positive/10 flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-metric-positive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Compras</p>
                    <p className="text-3xl font-bold">{adSet.conversions}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {adSet.impressions > 0 ? ((adSet.conversions / adSet.impressions) * 100).toFixed(3) : 0}% taxa de conversão
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ROAS</p>
                    <p className={cn(
                      "text-3xl font-bold",
                      adSet.roas >= 5 ? 'text-metric-positive' : adSet.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative'
                    )}>
                      {adSet.roas.toFixed(2)}x
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receita: {formatCurrency(adSet.conversion_value)}
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-chart-2" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPA</p>
                    <p className="text-3xl font-bold">{formatCurrency(adSet.cpa)}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Custo por aquisição
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-chart-1/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-chart-1" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Leads</p>
                    <p className="text-3xl font-bold">{adSet.conversions}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {adSet.impressions > 0 ? ((adSet.conversions / adSet.impressions) * 100).toFixed(3) : 0}% taxa de conversão
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPL</p>
                    <p className="text-3xl font-bold">{formatCurrency(adSet.cpa)}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Custo por lead
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-chart-3/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Custo/Clique</p>
                    <p className="text-3xl font-bold">{formatCurrency(adSet.cpc)}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Média por clique
                </p>
              </div>
            </>
          )}
        </div>

        {/* Performance Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Evolução de Performance</h3>
          <PerformanceChart 
            data={chartData} 
            title=""
            dataKey="value"
            dataKey2="value2"
            color="hsl(var(--primary))"
            color2="hsl(var(--chart-1))"
          />
        </div>

        {/* Ads in this Ad Set */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Anúncios ({ads.length})</h3>
          {ads.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground">Nenhum anúncio encontrado neste conjunto</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedAds.map((ad) => {
                const hasVideo = ad.creative_video_url;
                const hasImage = ad.creative_image_url || ad.creative_thumbnail;
                const creativeUrl = ad.creative_image_url || ad.creative_thumbnail || '';
                
                return (
                  <Link 
                    key={ad.id} 
                    to={`/ad/${ad.id}`}
                    className="glass-card-hover group block overflow-hidden"
                  >
                    {/* Creative Preview */}
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {hasVideo ? (
                        <div className="relative w-full h-full">
                          <video 
                            src={ad.creative_video_url || ''} 
                            className="w-full h-full object-cover"
                            muted
                            poster={ad.creative_thumbnail || undefined}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                              <Play className="w-6 h-6 text-foreground ml-1" />
                            </div>
                          </div>
                        </div>
                      ) : hasImage ? (
                        <img 
                          src={creativeUrl} 
                          alt={ad.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Status Badge Overlay */}
                      <div className="absolute top-3 left-3">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs shadow-lg",
                            ad.status === 'ACTIVE' && 'bg-metric-positive text-white',
                            ad.status === 'PAUSED' && 'bg-metric-warning text-white'
                          )}
                        >
                          {ad.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                        </Badge>
                      </div>
                      
                      {/* View Detail Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="bg-white/90 rounded-full p-3">
                          <ExternalLink className="w-5 h-5 text-foreground" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <h4 className="font-semibold truncate mb-1 group-hover:text-primary transition-colors">
                        {ad.name}
                      </h4>
                      {ad.headline && (
                        <p className="text-sm text-muted-foreground truncate mb-3">{ad.headline}</p>
                      )}
                      
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-xs text-muted-foreground">Gasto</p>
                          <p className="font-semibold text-sm">{formatCurrency(ad.spend)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-xs text-muted-foreground">Conversões</p>
                          <p className="font-semibold text-sm">{formatNumber(ad.conversions)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-xs text-muted-foreground">CTR</p>
                          <p className="font-semibold text-sm">{ad.ctr.toFixed(2)}%</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-xs text-muted-foreground">{isEcommerce ? 'ROAS' : 'CPL'}</p>
                          <p className={cn(
                            "font-semibold text-sm",
                            isEcommerce && ad.roas >= 5 && 'text-metric-positive',
                            isEcommerce && ad.roas < 3 && 'text-metric-negative'
                          )}>
                            {isEcommerce ? `${ad.roas.toFixed(2)}x` : formatCurrency(ad.cpa)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
