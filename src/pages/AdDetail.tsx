import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { LoadingCard } from '@/components/ui/loading-screen';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import AdSetCharts from '@/components/dashboard/AdSetCharts';
import { useAdDailyMetrics } from '@/hooks/useAdDailyMetrics';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
import { translateCTA } from '@/utils/ctaTranslations';
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
  Play,
  ExternalLink,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Build Storage URL for cached creative images
const getStorageImageUrl = (projectId: string | undefined, adId: string): string | null => {
  if (!projectId) return null;
  const { data } = supabase.storage.from('creative-images').getPublicUrl(`${projectId}/${adId}.jpg`);
  return data?.publicUrl || null;
};

// Helper to clean image URLs - removes stp resize parameters to get HD images
const cleanImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  // AGGRESSIVE CLEANING: Remove ALL stp parameters (including complex ones like c0.5000x0.5000f_dst-emg0_p64x64_q75_tt6)
  let clean = url;
  
  // Remove stp= parameter completely (handles all variations)
  clean = clean.replace(/[&?]stp=[^&]*/gi, '');
  
  // Remove size parameters in path
  clean = clean.replace(/\/p\d+x\d+\//g, '/');
  clean = clean.replace(/\/s\d+x\d+\//g, '/');
  
  // Remove width/height query params
  clean = clean.replace(/[&?]width=\d+/gi, '');
  clean = clean.replace(/[&?]height=\d+/gi, '');
  
  // Remove ur= parameter (often forces small size)
  clean = clean.replace(/[&?]ur=[^&]*/gi, '');
  
  // Convert thumbnail indicators to full-size
  clean = clean.replace('_t.', '_n.');
  clean = clean.replace('_s.', '_n.');
  
  // Fix malformed URL
  if (clean.includes('&') && !clean.includes('?')) {
    clean = clean.replace('&', '?');
  }
  
  // Clean trailing ? or &
  clean = clean.replace(/[&?]$/g, '');
  
  return clean;
};
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
  cached_image_url: string | null;
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
  const [syncing, setSyncing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');

  const selectedProject = projects.find(p => p.id === projectId);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  // Fetch real daily metrics for this ad - pass date range for custom period
  const { dailyData: adDailyData, totals: adMetricsTotals } = useAdDailyMetrics(adId, projectId, dateRange);

  const fetchAd = useCallback(async () => {
    if (!adId) return;
    setLoading(true);
    try {
      // Always get the freshest thumbnail from ads_daily_metrics first (most recently synced)
      const { data: latestMetric } = await supabase
        .from('ads_daily_metrics')
        .select('creative_thumbnail, cached_creative_thumbnail, creative_id')
        .eq('ad_id', adId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Get main ad data from ads table
      const { data: adData } = await supabase
        .from('ads')
        .select('*')
        .eq('id', adId)
        .maybeSingle();
      
      if (adData) {
        // Set project_id FIRST so charts can start loading
        setProjectId(adData.project_id);
        
        // Merge freshest thumbnail from daily metrics if available
        const freshThumbnail = latestMetric?.cached_creative_thumbnail || latestMetric?.creative_thumbnail;
        setAd({
          ...adData,
          // Prioritize: cached_image_url > fresh daily thumbnail > existing thumbnails
          cached_image_url: adData.cached_image_url || latestMetric?.cached_creative_thumbnail || null,
          creative_thumbnail: freshThumbnail || adData.creative_thumbnail,
          creative_image_url: adData.creative_image_url || freshThumbnail || null,
        } as Ad);
        
        const { data: adSetData } = await supabase
          .from('ad_sets')
          .select('id, name')
          .eq('id', adData.ad_set_id)
          .maybeSingle();
        if (adSetData) setAdSet(adSetData);

        const { data: campaignData } = await supabase
          .from('campaigns')
          .select('id, name')
          .eq('id', adData.campaign_id)
          .maybeSingle();
        if (campaignData) setCampaign(campaignData);
      } else if (latestMetric) {
        // Fallback: get ad info from ads_daily_metrics
        const { data: metricsData } = await supabase
          .from('ads_daily_metrics')
          .select('ad_id, ad_name, ad_status, adset_id, adset_name, campaign_id, campaign_name, project_id, creative_thumbnail, cached_creative_thumbnail, creative_id')
          .eq('ad_id', adId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (metricsData) {
          setProjectId(metricsData.project_id);
          const thumbnail = metricsData.cached_creative_thumbnail || metricsData.creative_thumbnail || null;
          setAd({
            id: metricsData.ad_id,
            ad_set_id: metricsData.adset_id,
            campaign_id: metricsData.campaign_id,
            project_id: metricsData.project_id,
            name: metricsData.ad_name,
            status: metricsData.ad_status || 'ACTIVE',
            spend: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            cpm: 0,
            cpc: 0,
            reach: 0,
            frequency: 0,
            conversions: 0,
            conversion_value: 0,
            roas: 0,
            cpa: 0,
            creative_id: metricsData.creative_id || null,
            creative_thumbnail: thumbnail,
            creative_image_url: thumbnail,
            creative_video_url: null,
            cached_image_url: metricsData.cached_creative_thumbnail || null,
            headline: null,
            primary_text: null,
            cta: null,
            synced_at: null,
          });
          setAdSet({
            id: metricsData.adset_id,
            name: metricsData.adset_name,
          });
          setCampaign({
            id: metricsData.campaign_id,
            name: metricsData.campaign_name,
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [adId]);

  // Sync data with date range - ONLY for manual use
  const syncData = useCallback(async (timeRange?: { since: string; until: string }) => {
    if (!ad || !selectedProject) return;
    
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: selectedProject.id,
          ad_account_id: selectedProject.ad_account_id,
          time_range: timeRange,
        },
      });
      
      if (error) throw error;
      
      await fetchAd();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [ad, selectedProject, fetchAd]);

  // Initial fetch - load from database only
  useEffect(() => {
    fetchAd();
  }, [fetchAd]);

  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, []);

  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);

  const handleManualSync = useCallback(() => {
    if (dateRange?.from && dateRange?.to) {
      syncData({
        since: format(dateRange.from, 'yyyy-MM-dd'),
        until: format(dateRange.to, 'yyyy-MM-dd'),
      });
    } else {
      syncData();
    }
  }, [dateRange, syncData]);

  const formatNumber = (n: number) => 
    n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString('pt-BR');
  
  const currency = selectedProject?.currency || 'BRL';
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  const formatCurrency = (n: number) => 
    new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const hasVideo = ad?.creative_video_url;
  const hasImage = ad?.creative_image_url || ad?.creative_thumbnail || ad?.cached_image_url;
  // Try Storage URL first (permanent), then cached_image_url, then Facebook URLs
  const storageUrl = ad?.id ? getStorageImageUrl(selectedProject?.id, ad.id) : null;
  const creativeUrl = storageUrl || ad?.cached_image_url || cleanImageUrl(ad?.creative_image_url || ad?.creative_thumbnail) || '';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingCard message="Carregando anúncio..." />
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
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
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
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleManualSync} 
              disabled={syncing || !selectedProject}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
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
              ) : hasImage ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted cursor-zoom-in hover:opacity-90 transition-opacity relative">
                      {!imageError && (
                        <img 
                          src={creativeUrl} 
                          alt={ad.name}
                          className="w-full h-full object-contain"
                          onError={() => setImageError(true)}
                        />
                      )}
                      {imageError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <ImageIcon className="w-16 h-16 text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground">Imagem expirada</p>
                          <p className="text-xs text-muted-foreground">Sincronize para atualizar</p>
                        </div>
                      )}
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
                      <Badge variant="secondary">{translateCTA(ad.cta)}</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Model Specific Metrics - First */}
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
                        <p className="text-2xl font-bold">{adMetricsTotals.conversions}</p>
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
                          adMetricsTotals.roas >= 5 ? 'text-metric-positive' : adMetricsTotals.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative'
                        )}>
                          {adMetricsTotals.roas.toFixed(2)}x
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
                        <p className="text-2xl font-bold">{formatCurrency(adMetricsTotals.cpa)}</p>
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
                        <p className="text-2xl font-bold">{adMetricsTotals.conversions}</p>
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
                        <p className="text-2xl font-bold">{formatCurrency(adMetricsTotals.cpa)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-chart-3/10 flex items-center justify-center">
                        <Percent className="w-5 h-5 text-chart-3" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                        <p className="text-2xl font-bold">{adMetricsTotals.impressions > 0 ? ((adMetricsTotals.conversions / adMetricsTotals.impressions) * 100).toFixed(3) : 0}%</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard 
                title="CTR" 
                value={`${adMetricsTotals.ctr.toFixed(2)}%`} 
                icon={Percent} 
                tooltip="Click-Through Rate: Taxa de cliques"
              />
              <MetricCard 
                title="Impressões" 
                value={formatNumber(adMetricsTotals.impressions)} 
                icon={Eye} 
                tooltip="Número total de vezes que este anúncio foi exibido"
              />
              <MetricCard 
                title="Gasto" 
                value={formatCurrency(adMetricsTotals.spend)} 
                icon={DollarSign} 
                tooltip="Total investido neste anúncio"
              />
              <MetricCard 
                title="CPM" 
                value={formatCurrency(adMetricsTotals.cpm)} 
                icon={BarChart3} 
                tooltip="Custo por Mil: Custo para cada 1.000 impressões"
              />
              <MetricCard 
                title="Alcance" 
                value={formatNumber(adMetricsTotals.reach)} 
                icon={Users} 
                tooltip="Número de pessoas únicas que viram este anúncio"
              />
              <MetricCard 
                title="Cliques" 
                value={formatNumber(adMetricsTotals.clicks)} 
                icon={MousePointerClick} 
                tooltip="Total de cliques neste anúncio"
              />
              <MetricCard 
                title="CPC" 
                value={formatCurrency(adMetricsTotals.cpc)} 
                icon={Target} 
                tooltip="Custo Por Clique: Valor médio pago por cada clique"
              />
              {isEcommerce && (
                <MetricCard 
                  title="Receita" 
                  value={formatCurrency(adMetricsTotals.conversion_value)} 
                  icon={TrendingUp} 
                  tooltip="Receita gerada por este anúncio"
                />
              )}
            </div>

            {/* Performance Chart */}
            <AdSetCharts
              data={adDailyData}
              businessModel={selectedProject?.business_model || null}
            />

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
                  <p className="text-muted-foreground">Modelo de Negócio</p>
                  <p className="font-medium mt-1">{isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'}</p>
                </div>
                {ad.synced_at && (
                  <div>
                    <p className="text-muted-foreground">Última Atualização</p>
                    <p className="font-medium mt-1 text-xs">{new Date(ad.synced_at).toLocaleString('pt-BR')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}