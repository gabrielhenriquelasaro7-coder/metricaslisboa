import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClientSelector } from '@/components/layout/ClientSelector';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { CustomizableChart } from '@/components/dashboard/CustomizableChart';
import { useDemographicInsights } from '@/hooks/useDemographicInsights';
import { useProjects } from '@/hooks/useProjects';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { usePeriodContext } from '@/hooks/usePeriodContext';
import { DashboardSkeleton } from '@/components/skeletons';
import { SmoothLoader } from '@/components/layout/PageTransition';
import { getDateRangeFromPreset } from '@/utils/dateUtils';
import { DollarSign, TrendingUp, Users, Eye, MousePointerClick, Home, Plus, Crosshair, Zap, BarChart3, Target, Instagram, ArrowUpRight, ArrowDownRight, Layers, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreativeImage } from '@/components/ui/creative-image';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { translateCTA } from '@/utils/ctaTranslations';
import { cn } from '@/lib/utils';
import metaIcon from '@/assets/meta-icon.png';
import googleAdsIcon from '@/assets/google-ads-icon.png';
import CreateProjectDialog from '@/components/projects/CreateProjectDialog';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/PageTransition';

type CreativeSortKey = 'spend' | 'conversions' | 'ctr';

export default function Dashboard() {
  const { t } = useTranslation();
  const { projects, loading: projectsLoading } = useProjects();
  const { selectedPreset, dateRange } = usePeriodContext();
  const [creativeSortBy, setCreativeSortBy] = useState<CreativeSortKey>('spend');
  const [selectedCreative, setSelectedCreative] = useState<any>(null);

  const { campaigns: metaCampaigns, ads: metaAds, adSets: metaAdSets, loading: metaLoading, selectedProject, syncCreativesHD, syncing } = useMetaAdsData();
  const { campaigns: googleCampaigns, loading: googleLoading, loadAllData } = useGoogleAdsData();

  const { dailyData, comparison: periodComparison, loading: dailyLoading } = useDailyMetrics(selectedProject?.id, selectedPreset, selectedPreset === 'custom' ? dateRange : undefined);

  // Load Google data
  useMemo(() => {
    if (selectedProject?.id) loadAllData(selectedProject.id);
  }, [selectedProject?.id]);

  const demographicDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) return { startDate: dateRange.from, endDate: dateRange.to };
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) return { startDate: new Date(period.since + 'T00:00:00'), endDate: new Date(period.until + 'T23:59:59') };
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30);
    return { startDate: start, endDate: end };
  }, [selectedPreset, selectedProject?.timezone, dateRange]);

  const { data: demographicData, isLoading: demographicLoading } = useDemographicInsights({
    projectId: selectedProject?.id || null,
    startDate: demographicDateRange.startDate,
    endDate: demographicDateRange.endDate
  });

  // Combined metrics
  const metaTotalSpend = metaCampaigns.reduce((s, c) => s + (c.spend || 0), 0);
  const googleTotalSpend = googleCampaigns.reduce((s, c) => s + (c.spend || 0), 0);
  const totalSpend = metaTotalSpend + googleTotalSpend;

  const metaClicks = metaCampaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const googleClicks = googleCampaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const totalClicks = metaClicks + googleClicks;

  const metaImpressions = metaCampaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const googleImpressions = googleCampaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalImpressions = metaImpressions + googleImpressions;

  const metaConversions = metaCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const googleConversions = googleCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const totalConversions = metaConversions + googleConversions;

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const cpl = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Profile visit campaigns (Instagram focus)
  const profileVisitCampaigns = useMemo(() => {
    return metaCampaigns.filter(c => {
      const obj = (c as any).objective?.toLowerCase() || '';
      return obj.includes('profile_visit') || obj.includes('ig_') || obj.includes('instagram');
    });
  }, [metaCampaigns]);
  const totalProfileVisits = profileVisitCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);

  // Top 3 creatives sorted by selected metric
  const topCreatives = useMemo(() => {
    return [...metaAds]
      .filter(ad => ad.creative_image_url || ad.creative_thumbnail || ad.cached_image_url)
      .sort((a, b) => {
        if (creativeSortBy === 'spend') return (b.spend || 0) - (a.spend || 0);
        if (creativeSortBy === 'conversions') return (b.conversions || 0) - (a.conversions || 0);
        if (creativeSortBy === 'ctr') return (b.ctr || 0) - (a.ctr || 0);
        return 0;
      })
      .slice(0, 3);
  }, [metaAds, creativeSortBy]);

  // Top campaigns combined
  const allCampaigns = useMemo(() => {
    const meta = metaCampaigns.map(c => {
      const obj = ((c as any).objective || '').toLowerCase();
      const isProfileVisit = obj.includes('profile_visit') || obj.includes('ig_') || obj.includes('instagram');
      return { ...c, platform: 'meta' as const, isProfileVisit };
    });
    const google = googleCampaigns.map(c => ({ ...c, platform: 'google' as const, conversions: c.conversions || 0, isProfileVisit: false }));
    return [...meta, ...google].sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, 5);
  }, [metaCampaigns, googleCampaigns]);

  // Active campaign count
  const activeCampaignsMeta = metaCampaigns.filter(c => c.status === 'ACTIVE').length;
  const activeCampaignsGoogle = googleCampaigns.filter(c => c.status === 'ENABLED' || c.status === 'ACTIVE').length;

  // Build comparative daily data (Meta vs Google) for charts
  const comparativeData = useMemo(() => {
    if (!dailyData.length) return [];
    // dailyData is Meta only - we can overlay Google totals as a flat reference
    return dailyData.map(d => ({
      ...d,
      meta_spend: d.spend,
      google_spend: googleTotalSpend > 0 ? googleTotalSpend / dailyData.length : 0,
      meta_conversions: d.conversions,
      google_conversions: googleConversions > 0 ? googleConversions / dailyData.length : 0,
    }));
  }, [dailyData, googleTotalSpend, googleConversions]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: selectedProject?.currency || 'BRL', minimumFractionDigits: 2 }).format(value);
  const formatNumber = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'; if (num >= 1000) return (num / 1000).toFixed(1) + 'K'; return num.toLocaleString('pt-BR'); };
  const formatNumberCompact = formatNumber;
  const businessModel = selectedProject?.business_model;
  const isEcommerce = businessModel === 'ecommerce';
  const isInfoproduto = businessModel === 'infoproduto';

  const loading = projectsLoading || metaLoading;
  const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects]);

  // Top ad sets by spend
  const topAdSets = useMemo(() => {
    if (!metaAdSets || metaAdSets.length === 0) return [];
    return [...metaAdSets].sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, 5);
  }, [metaAdSets]);

  const PlatformBreakdown = ({ metaVal, googleVal, format: fmt }: { metaVal: number; googleVal: number; format: (n: number) => string }) => (
    <div className="flex items-center gap-4 mt-1 text-[9px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><img src={metaIcon} className="w-2.5 h-2.5" alt="Meta" />{fmt(metaVal)}</span>
      <span className="flex items-center gap-1.5"><img src={googleAdsIcon} className="w-2.5 h-2.5" alt="Google" />{fmt(googleVal)}</span>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[200px] sm:w-[400px] lg:w-[600px] h-[200px] sm:h-[400px] lg:h-[600px] bg-primary/3 rounded-full blur-[80px] sm:blur-[150px]" />
        </div>

        <div className="relative z-10 p-4 sm:p-6 lg:p-8 pb-16 sm:pb-20 space-y-8 sm:space-y-10 lg:space-y-12 w-full">
          {/* Header */}
          <FadeIn>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-base sm:text-xl lg:text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Home</h1>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">Visão geral de todas as plataformas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CreateProjectDialog />
                <ClientSelector />
              </div>
            </div>
          </FadeIn>

          <SmoothLoader loading={loading} skeleton={<DashboardSkeleton />}>
            {activeProjects.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Nenhum projeto ainda</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">Crie seu primeiro projeto para começar a acompanhar suas campanhas.</p>
                <CreateProjectDialog />
              </div>
            ) : (
              <StaggerContainer staggerDelay={0.04} className="space-y-8 sm:space-y-10">
                {/* Quick Stats Bar */}
                <StaggerItem>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] sm:text-xs text-muted-foreground">
                    <Badge variant="outline" className="gap-1 text-[10px] border-blue-500/30 text-blue-400">
                      <img src={metaIcon} className="w-3 h-3" alt="" /> {activeCampaignsMeta} ativas
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px] border-yellow-500/30 text-yellow-400">
                      <img src={googleAdsIcon} className="w-3 h-3" alt="" /> {activeCampaignsGoogle} ativas
                    </Badge>
                    {totalProfileVisits > 0 && (
                      <Badge variant="outline" className="gap-1 text-[10px] border-pink-500/30 text-pink-400">
                        <Instagram className="w-3 h-3" /> {formatNumber(totalProfileVisits)} visitas
                      </Badge>
                    )}
                  </div>
                </StaggerItem>

                {/* Metric Cards - compact grid with slightly more gap */}
                <StaggerItem>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 sm:gap-5">
                    {/* Investimento */}
                    <div className="glass-card p-2.5 sm:p-3 border-l-2 border-l-primary">
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">Investimento</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(totalSpend)}</p>
                      <PlatformBreakdown metaVal={metaTotalSpend} googleVal={googleTotalSpend} format={formatCurrency} />
                    </div>
                    {/* Impressões */}
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Eye className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">Impressões</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumber(totalImpressions)}</p>
                      <PlatformBreakdown metaVal={metaImpressions} googleVal={googleImpressions} format={formatNumber} />
                    </div>
                    {/* Cliques */}
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <MousePointerClick className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">Cliques</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumber(totalClicks)}</p>
                      <PlatformBreakdown metaVal={metaClicks} googleVal={googleClicks} format={formatNumber} />
                    </div>
                    {/* Conversões */}
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Users className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">Conversões</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumber(totalConversions)}</p>
                      <PlatformBreakdown metaVal={metaConversions} googleVal={googleConversions} format={formatNumber} />
                    </div>
                    {/* CTR */}
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Crosshair className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">CTR</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{ctr.toFixed(2)}%</p>
                    </div>
                    {/* CPC */}
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">CPC</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(cpc)}</p>
                    </div>
                    {/* CPM */}
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <BarChart3 className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">CPM</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(cpm)}</p>
                    </div>
                    {/* CPL */}
                    <div className="glass-card p-2.5 sm:p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Target className="w-3 h-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground font-medium">CPL</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(cpl)}</p>
                    </div>
                  </div>
                </StaggerItem>

                {/* Top 3 Creatives */}
                {topCreatives.length > 0 && (
                  <StaggerItem>
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                        <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 3 Criativos</h2>
                        <Tabs value={creativeSortBy} onValueChange={(v) => setCreativeSortBy(v as CreativeSortKey)} className="ml-auto">
                          <TabsList className="h-6 p-0.5">
                            <TabsTrigger value="spend" className="text-[9px] h-5 px-2">Gasto</TabsTrigger>
                            <TabsTrigger value="conversions" className="text-[9px] h-5 px-2">Conv.</TabsTrigger>
                            <TabsTrigger value="ctr" className="text-[9px] h-5 px-2">CTR</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <Link to="/creatives" className="text-[10px] sm:text-xs text-primary hover:underline">Ver todos →</Link>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {topCreatives.map((ad, idx) => (
                          <button key={ad.id} onClick={() => setSelectedCreative(ad)} className="glass-card overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all group text-left">
                            <div className="aspect-[3/4] relative bg-muted">
                              <CreativeImage
                                projectId={selectedProject?.id}
                                adId={ad.id}
                                cachedImageUrl={ad.cached_image_url}
                                creativeImageUrl={ad.creative_image_url}
                                creativeThumbnail={ad.creative_thumbnail}
                                alt={ad.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1.5 left-1.5 bg-background/80 backdrop-blur-sm text-[10px] font-bold px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </div>
                            </div>
                            <div className="p-2.5">
                              <p className="text-[10px] sm:text-xs font-medium truncate mb-1">{ad.name}</p>
                              <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground">
                                <span>{formatCurrency(ad.spend || 0)}</span>
                                <span>{ad.conversions || 0} conv.</span>
                                <span>CTR {(ad.ctr || 0).toFixed(2)}%</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </StaggerItem>
                )}

                {/* Top Campaigns */}
                {allCampaigns.length > 0 && (
                  <StaggerItem>
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-emerald-500/50 rounded-full" />
                        <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 5 Campanhas</h2>
                      </div>
                      <div className="glass-card overflow-hidden">
                        <div className="divide-y divide-border/50">
                          {allCampaigns.map((c) => {
                            const convLabel = c.isProfileVisit ? 'visitas ao perfil' : 'conv.';
                            return (
                              <div key={c.id} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-secondary/30 transition-colors">
                                <img src={c.platform === 'meta' ? metaIcon : googleAdsIcon} className="w-4 h-4 flex-shrink-0" alt="" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] sm:text-xs font-medium truncate">{c.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`text-[8px] sm:text-[9px] ${c.status === 'ACTIVE' || c.status === 'ENABLED' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                      {c.status === 'ACTIVE' || c.status === 'ENABLED' ? '● Ativo' : '○ Pausado'}
                                    </span>
                                    {c.isProfileVisit && (
                                      <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 border-pink-500/30 text-pink-400">
                                        <Instagram className="w-2 h-2 mr-0.5" /> Perfil
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[10px] sm:text-xs font-semibold">{formatCurrency(c.spend || 0)}</p>
                                  <p className="text-[9px] text-muted-foreground">{c.conversions || 0} {convLabel}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                )}

                {/* Top Ad Sets */}
                {topAdSets.length > 0 && (
                  <StaggerItem>
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-500/50 rounded-full" />
                        <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 5 Conjuntos de Anúncio</h2>
                        <Badge variant="outline" className="text-[9px] gap-1 border-blue-500/30 text-blue-400 ml-auto">
                          <img src={metaIcon} className="w-3 h-3" alt="" /> Meta
                        </Badge>
                      </div>
                      <div className="glass-card overflow-hidden">
                        <div className="divide-y divide-border/50">
                          {topAdSets.map((as) => (
                            <div key={as.id} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-secondary/30 transition-colors">
                              <Layers className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] sm:text-xs font-medium truncate">{as.name}</p>
                                <span className={`text-[8px] sm:text-[9px] ${as.status === 'ACTIVE' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                  {as.status === 'ACTIVE' ? '● Ativo' : '○ Pausado'}
                                </span>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[10px] sm:text-xs font-semibold">{formatCurrency(as.spend || 0)}</p>
                                <p className="text-[9px] text-muted-foreground">{as.conversions || 0} conv.</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                )}

                {/* Comparative Charts - Meta vs Google */}
                <StaggerItem>
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-500/50 rounded-full" />
                      <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Gráficos de Performance</h2>
                    </div>
                    <div className="space-y-6">
                      <CustomizableChart
                        chartKey="home-chart-1"
                        data={dailyData}
                        defaultTitle="Performance Geral"
                        defaultPrimaryMetric="spend"
                        defaultSecondaryMetric="conversions"
                        defaultChartType="composed"
                        currency={selectedProject?.currency || 'BRL'}
                        className="chart-container-mobile"
                      />
                      <CustomizableChart
                        chartKey="home-chart-2"
                        data={dailyData}
                        defaultTitle="Alcance & Engajamento"
                        defaultPrimaryMetric="impressions"
                        defaultSecondaryMetric="ctr"
                        defaultChartType="line"
                        currency={selectedProject?.currency || 'BRL'}
                        className="chart-container-mobile"
                      />
                    </div>
                  </div>
                </StaggerItem>

                {/* Demographics - separated by channel */}
                <StaggerItem>
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-purple-500/50 rounded-full" />
                      <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Dados Demográficos</h2>
                      <Badge variant="outline" className="text-[9px] gap-1 border-blue-500/30 text-blue-400 ml-auto">
                        <img src={metaIcon} className="w-3 h-3" alt="" /> Meta Ads
                      </Badge>
                    </div>
                    <DemographicCharts data={demographicData} isLoading={demographicLoading} currency={selectedProject?.currency || 'BRL'} />
                  </div>
                </StaggerItem>
              </StaggerContainer>
            )}
          </SmoothLoader>

          {/* Creative Detail Modal - same as MetaAds */}
          <Dialog open={!!selectedCreative} onOpenChange={(open) => !open && setSelectedCreative(null)}>
            <DialogContent className="max-w-[95vw] md:max-w-5xl h-[85vh] border-red-500/30 bg-background/95 backdrop-blur-xl p-4 pt-10 flex flex-col overflow-hidden">
              {selectedCreative && (
                <>
                  <DialogHeader className="flex-shrink-0 pb-2">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-sm font-bold truncate text-red-400 flex-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {selectedCreative.name}
                      </DialogTitle>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] text-muted-foreground font-mono">ID: {selectedCreative.id}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={async () => {
                          const result = await syncCreativesHD(selectedCreative.id);
                          if (result?.updatedAd) setSelectedCreative({ ...selectedCreative, ...result.updatedAd });
                        }}
                        disabled={syncing}
                      >
                        <ImageIcon className={cn("w-3 h-3", syncing && "animate-spin")} />
                        Sync HD
                      </Button>
                    </div>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-3 flex-1 min-h-0 overflow-hidden">
                    <div className="rounded-lg overflow-hidden border border-red-500/20 min-h-0 bg-black">
                      <CreativeImage
                        projectId={selectedProject?.id}
                        adId={selectedCreative.id}
                        cachedImageUrl={selectedCreative.cached_image_url}
                        creativeImageUrl={selectedCreative.creative_image_url}
                        creativeThumbnail={selectedCreative.creative_thumbnail}
                        alt={selectedCreative.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="overflow-y-auto space-y-2 min-h-0 pr-1">
                      <div className="grid grid-cols-4 gap-1.5">
                        <div className="glass-card p-2 border-l-2 border-l-red-500">
                          <p className="text-[8px] text-red-400/80">Gasto</p>
                          <p className="text-[11px] font-bold">{formatCurrency(selectedCreative.spend || 0)}</p>
                        </div>
                        <div className="glass-card p-2 border-l-2 border-l-red-500/60">
                          <p className="text-[8px] text-red-400/80">Conv.</p>
                          <p className="text-[11px] font-bold">{selectedCreative.conversions || 0}</p>
                        </div>
                        <div className="glass-card p-2">
                          <p className="text-[8px] text-muted-foreground">CTR</p>
                          <p className="text-[11px] font-bold">{(selectedCreative.ctr || 0).toFixed(2)}%</p>
                        </div>
                        <div className="glass-card p-2">
                          <p className="text-[8px] text-muted-foreground">CPC</p>
                          <p className="text-[11px] font-bold">{formatCurrency(selectedCreative.cpc || 0)}</p>
                        </div>
                        <div className="glass-card p-2">
                          <p className="text-[8px] text-muted-foreground">CPM</p>
                          <p className="text-[11px] font-bold">{formatCurrency(selectedCreative.cpm || 0)}</p>
                        </div>
                        <div className="glass-card p-2">
                          <p className="text-[8px] text-muted-foreground">Impr.</p>
                          <p className="text-[11px] font-bold">{formatNumberCompact(selectedCreative.impressions || 0)}</p>
                        </div>
                        <div className="glass-card p-2">
                          <p className="text-[8px] text-muted-foreground">Cliques</p>
                          <p className="text-[11px] font-bold">{formatNumber(selectedCreative.clicks || 0)}</p>
                        </div>
                        <div className="glass-card p-2">
                          <p className="text-[8px] text-muted-foreground">Alcance</p>
                          <p className="text-[11px] font-bold">{formatNumberCompact(selectedCreative.reach || 0)}</p>
                        </div>
                      </div>
                      <div className={cn("grid gap-1.5", (isEcommerce || isInfoproduto) ? "grid-cols-2" : "grid-cols-1")}>
                        <div className="glass-card p-2 border-l-2 border-l-red-500/40">
                          <p className="text-[8px] text-red-400/80">CPA</p>
                          <p className="text-[11px] font-bold">{formatCurrency(selectedCreative.cpa || 0)}</p>
                        </div>
                        {(isEcommerce || isInfoproduto) && (
                          <div className="glass-card p-2 border-l-2 border-l-red-500/40">
                            <p className="text-[8px] text-red-400/80">ROAS</p>
                            <p className="text-[11px] font-bold">{(selectedCreative.roas || 0).toFixed(2)}x</p>
                          </div>
                        )}
                      </div>
                      {selectedCreative.headline && (
                        <div className="glass-card p-2 border-l-2 border-l-red-500/30">
                          <p className="text-[8px] text-red-400/70">Headline</p>
                          <p className="text-[11px] font-medium">{selectedCreative.headline}</p>
                        </div>
                      )}
                      {selectedCreative.primary_text && (
                        <div className="glass-card p-2">
                          <p className="text-[8px] text-muted-foreground mb-1">Texto Principal</p>
                          <p className="text-[10px] whitespace-pre-line">{selectedCreative.primary_text}</p>
                        </div>
                      )}
                      {selectedCreative.cta && (
                        <div className="glass-card p-2 border-l-2 border-l-red-500/30">
                          <p className="text-[8px] text-red-400/70">CTA</p>
                          <p className="text-[11px] font-medium">{translateCTA(selectedCreative.cta)}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="glass-card p-1.5">
                          <p className="text-[7px] text-muted-foreground/70">Status</p>
                          <p className="text-[10px]">{selectedCreative.status === 'ACTIVE' ? '● Ativo' : '○ Pausado'}</p>
                        </div>
                        <div className="glass-card p-1.5">
                          <p className="text-[7px] text-muted-foreground/70">Frequência</p>
                          <p className="text-[10px]">{(selectedCreative.frequency || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}
