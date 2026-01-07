import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import AdSetCharts from '@/components/dashboard/AdSetCharts';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { useAdSetDailyMetrics } from '@/hooks/useAdSetDailyMetrics';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { DateRange } from 'react-day-picker';
import { DatePresetKey, getDateRangeFromPreset, datePeriodToDateRange } from '@/utils/dateUtils';
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
  Play,
  Image as ImageIcon,
  ExternalLink,
  Calendar,
  Instagram
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Helper to clean image URLs - removes stp resize parameters to get HD images
const cleanImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  // Remove stp= parameter that forces resize (e.g., stp=dst-jpg_p64x64_q75_tt6)
  let clean = url.replace(/[&?]stp=[^&]*/g, '');
  
  // Remove size parameters in path
  clean = clean.replace(/\/p\d+x\d+\//g, '/');
  clean = clean.replace(/\/s\d+x\d+\//g, '/');
  
  // Remove width/height query params
  clean = clean.replace(/[&?]width=\d+/gi, '');
  clean = clean.replace(/[&?]height=\d+/gi, '');
  
  // Fix malformed URL: if & appears before any ?, replace first & with ?
  if (clean.includes('&') && !clean.includes('?')) {
    clean = clean.replace('&', '?');
  }
  
  // Clean trailing ? or &
  clean = clean.replace(/[&?]$/g, '');
  
  return clean;
};

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
  objective: string | null;
}

// List of objectives that are considered "traffic to Instagram profile"
const TRAFFIC_OBJECTIVES = [
  'OUTCOME_TRAFFIC',
  'LINK_CLICKS', 
  'POST_ENGAGEMENT',
  'REACH',
  'BRAND_AWARENESS',
  'VIDEO_VIEWS',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_AWARENESS',
];

export default function AdSetDetail() {
  const { adSetId } = useParams<{ adSetId: string }>();
  const { projects } = useProjects();
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const period = getDateRangeFromPreset('this_month', 'America/Sao_Paulo');
    return period ? datePeriodToDateRange(period) : undefined;
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');

  const selectedProject = projects.find(p => p.id === projectId);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';
  
  // Check if this is a traffic campaign (top of funnel - profile visits instead of leads)
  const isTrafficCampaign = campaign?.objective ? TRAFFIC_OBJECTIVES.includes(campaign.objective) : false;
  
  // Fetch daily metrics for this ad set - now filtered by date range
  const { dailyData: adSetDailyData, aggregated: periodMetrics, loading: metricsLoading } = useAdSetDailyMetrics(adSetId, projectId, dateRange);

  // Handle date range change
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
  }, []);

  const handlePresetChange = useCallback((preset: DatePresetKey) => {
    setSelectedPreset(preset);
  }, []);

  // Calculate date range from daily data for display
  const dataDateRange = useMemo(() => {
    if (adSetDailyData.length === 0) return null;
    const firstDate = adSetDailyData[0].date;
    const lastDate = adSetDailyData[adSetDailyData.length - 1].date;
    return {
      from: new Date(firstDate + 'T00:00:00').toLocaleDateString('pt-BR'),
      to: new Date(lastDate + 'T00:00:00').toLocaleDateString('pt-BR'),
    };
  }, [adSetDailyData]);

  useEffect(() => {
    const fetchData = async () => {
      if (!adSetId) return;
      setLoading(true);
      try {
        // First try to get from ad_sets table
        const { data: adSetData } = await supabase
          .from('ad_sets')
          .select('*')
          .eq('id', adSetId)
          .maybeSingle();
        
        if (adSetData) {
          setProjectId(adSetData.project_id);
          setAdSet(adSetData as AdSet);
          
          const { data: campaignData } = await supabase
            .from('campaigns')
            .select('id, name, project_id, objective')
            .eq('id', adSetData.campaign_id)
            .maybeSingle();
          if (campaignData) setCampaign(campaignData as Campaign);
        } else {
          // Fallback: try to get ad set info from ads_daily_metrics
          const { data: metricsData } = await supabase
            .from('ads_daily_metrics')
            .select('adset_id, adset_name, adset_status, campaign_id, campaign_name, campaign_objective, project_id')
            .eq('adset_id', adSetId)
            .limit(1)
            .maybeSingle();
          
          if (metricsData) {
            setProjectId(metricsData.project_id);
            // Create a minimal AdSet object from metrics data
            setAdSet({
              id: metricsData.adset_id,
              campaign_id: metricsData.campaign_id,
              project_id: metricsData.project_id,
              name: metricsData.adset_name,
              status: metricsData.adset_status || 'ACTIVE',
              daily_budget: null,
              lifetime_budget: null,
              targeting: null,
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
              synced_at: null,
            });
            setCampaign({
              id: metricsData.campaign_id,
              name: metricsData.campaign_name,
              project_id: metricsData.project_id,
              objective: metricsData.campaign_objective,
            });
          }
        }

        // First try to get ads from ads table
        const { data: adsData } = await supabase
          .from('ads')
          .select('*')
          .eq('ad_set_id', adSetId)
          .order('spend', { ascending: false });
        
        if (adsData && adsData.length > 0) {
          setAds((adsData as Ad[]) || []);
        } else {
          // Fallback: aggregate ads from ads_daily_metrics
          const { data: metricsAds } = await supabase
            .from('ads_daily_metrics')
            .select('ad_id, ad_name, ad_status, spend, impressions, clicks, conversions, conversion_value, ctr, cpm, cpc, roas, cpa, creative_thumbnail, cached_creative_thumbnail')
            .eq('adset_id', adSetId);
          
          if (metricsAds && metricsAds.length > 0) {
            // Group and aggregate by ad_id
            const adMap = new Map<string, Ad>();
            metricsAds.forEach(m => {
              const existing = adMap.get(m.ad_id);
              if (existing) {
                existing.spend += m.spend || 0;
                existing.impressions += m.impressions || 0;
                existing.clicks += m.clicks || 0;
                existing.conversions += m.conversions || 0;
              } else {
                adMap.set(m.ad_id, {
                  id: m.ad_id,
                  name: m.ad_name,
                  status: m.ad_status || 'ACTIVE',
                  spend: m.spend || 0,
                  impressions: m.impressions || 0,
                  clicks: m.clicks || 0,
                  ctr: 0,
                  cpm: 0,
                  cpc: 0,
                  conversions: m.conversions || 0,
                  roas: 0,
                  cpa: 0,
                  creative_thumbnail: m.cached_creative_thumbnail || m.creative_thumbnail || null,
                  creative_image_url: null,
                  creative_video_url: null,
                  headline: null,
                });
              }
            });
            // Calculate derived metrics
            const aggregatedAds = Array.from(adMap.values()).map(ad => ({
              ...ad,
              ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
              cpm: ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0,
              cpc: ad.clicks > 0 ? ad.spend / ad.clicks : 0,
              roas: ad.spend > 0 ? (ad.conversions * 100) / ad.spend : 0, // Approximation
              cpa: ad.conversions > 0 ? ad.spend / ad.conversions : 0,
            }));
            setAds(aggregatedAds.sort((a, b) => b.spend - a.spend));
          } else {
            setAds([]);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [adSetId]);

  const formatNumber = (n: number) => 
    n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString('pt-BR');
  
  const currency = selectedProject?.currency || 'BRL';
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  const formatCurrency = (n: number) => 
    new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const sortedAds = [...ads].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return b.spend - a.spend;
  });

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
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
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
          <div className="flex items-center gap-3">
            <DateRangePicker 
              dateRange={dateRange} 
              onDateRangeChange={handleDateRangeChange}
              timezone={selectedProject?.timezone}
              onPresetChange={handlePresetChange}
              selectedPreset={selectedPreset}
            />
          </div>
        </div>

        {/* Period Info */}
        {dataDateRange && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Dados disponíveis: {dataDateRange.from} - {dataDateRange.to}</span>
            {metricsLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </div>
        )}


        {/* Main Metrics - Using period aggregated data */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <MetricCard 
            title="Gasto" 
            value={formatCurrency(periodMetrics.spend)} 
            icon={DollarSign} 
            tooltip="Total investido neste conjunto de anúncios no período"
          />
          <MetricCard 
            title="Alcance" 
            value={formatNumber(periodMetrics.reach)} 
            icon={Users} 
            tooltip="Número de pessoas únicas que viram seus anúncios"
          />
          <MetricCard 
            title="Impressões" 
            value={formatNumber(periodMetrics.impressions)} 
            icon={Eye} 
            tooltip="Número total de vezes que seus anúncios foram exibidos"
          />
          <MetricCard 
            title="Cliques" 
            value={formatNumber(periodMetrics.clicks)} 
            icon={MousePointerClick} 
            tooltip="Total de cliques nos anúncios"
          />
          <MetricCard 
            title="CTR" 
            value={`${periodMetrics.ctr.toFixed(2)}%`} 
            icon={Percent} 
            tooltip="Click-Through Rate: Taxa de cliques"
          />
          <MetricCard 
            title="CPM" 
            value={formatCurrency(periodMetrics.cpm)} 
            icon={BarChart3} 
            tooltip="Custo por Mil impressões"
          />
          <MetricCard 
            title="CPC" 
            value={formatCurrency(periodMetrics.cpc)} 
            icon={Target} 
            tooltip="Custo Por Clique"
          />
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
                    <p className="text-3xl font-bold">{periodMetrics.conversions}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {periodMetrics.impressions > 0 ? ((periodMetrics.conversions / periodMetrics.impressions) * 100).toFixed(3) : 0}% taxa de conversão
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
                      periodMetrics.roas >= 5 ? 'text-metric-positive' : periodMetrics.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative'
                    )}>
                      {periodMetrics.roas.toFixed(2)}x
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receita: {formatCurrency(periodMetrics.conversion_value)}
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-chart-2" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPA</p>
                    <p className="text-3xl font-bold">{formatCurrency(periodMetrics.cpa)}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Custo por aquisição
                </p>
              </div>
            </>
          ) : isTrafficCampaign ? (
            /* Traffic Campaign Metrics - Profile Visits instead of Leads */
            <>
              <div className="glass-card p-6 border-l-4 border-l-pink-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center">
                    <Instagram className="w-6 h-6 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Visitas ao Perfil</p>
                    <p className="text-3xl font-bold">{periodMetrics.profile_visits || 0}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Instagram className="w-3 h-3" /> Topo de Funil
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Custo por Visita</p>
                    <p className="text-3xl font-bold">
                      {(periodMetrics.profile_visits || 0) > 0 
                        ? formatCurrency(periodMetrics.spend / periodMetrics.profile_visits) 
                        : formatCurrency(0)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Custo por visita ao perfil
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-chart-3/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Custo/Clique</p>
                    <p className="text-3xl font-bold">{formatCurrency(periodMetrics.cpc)}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Média por clique
                </p>
              </div>
            </>
          ) : (
            /* Inside Sales / PDV - Leads */
            <>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-chart-1/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-chart-1" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Leads</p>
                    <p className="text-3xl font-bold">{periodMetrics.conversions}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {periodMetrics.impressions > 0 ? ((periodMetrics.conversions / periodMetrics.impressions) * 100).toFixed(3) : 0}% taxa de conversão
                </p>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPL</p>
                    <p className="text-3xl font-bold">{formatCurrency(periodMetrics.cpa)}</p>
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
                    <p className="text-3xl font-bold">{formatCurrency(periodMetrics.cpc)}</p>
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
        <AdSetCharts
          data={adSetDailyData}
          businessModel={selectedProject?.business_model || null}
        />

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
                const hasImage = ad.creative_image_url || ad.creative_thumbnail || (ad as any).cached_image_url;
                // Prefer cached URL (permanent, never expires), then fallback to Facebook URLs
                const creativeUrl = (ad as any).cached_image_url || cleanImageUrl(ad.creative_image_url || ad.creative_thumbnail) || '';
                
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
                            poster={cleanImageUrl(ad.creative_thumbnail) || undefined}
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
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            if (target.nextElementSibling) {
                              target.nextElementSibling.classList.remove('hidden');
                            }
                          }}
                        />
                      ) : null}
                      <div className={cn("w-full h-full flex items-center justify-center", hasImage && "hidden")}>
                        <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                      
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
