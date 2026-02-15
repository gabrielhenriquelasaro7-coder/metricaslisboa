import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClientSelector } from '@/components/layout/ClientSelector';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { useDemographicInsights } from '@/hooks/useDemographicInsights';
import { useProjects } from '@/hooks/useProjects';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { usePeriodContext } from '@/hooks/usePeriodContext';
import { DashboardSkeleton } from '@/components/skeletons';
import { getDateRangeFromPreset } from '@/utils/dateUtils';
import { DollarSign, TrendingUp, Users, Eye, MousePointerClick, Home, ImageIcon, Plus, Crosshair, Zap, BarChart3, Target, Instagram, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreativeImage } from '@/components/ui/creative-image';
import { Badge } from '@/components/ui/badge';
import metaIcon from '@/assets/meta-icon.png';
import googleAdsIcon from '@/assets/google-ads-icon.png';
import CreateProjectDialog from '@/components/projects/CreateProjectDialog';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/PageTransition';

export default function Dashboard() {
  const { t } = useTranslation();
  const { projects, loading: projectsLoading } = useProjects();
  const { selectedPreset, dateRange } = usePeriodContext();

  const { campaigns: metaCampaigns, ads: metaAds, loading: metaLoading, selectedProject } = useMetaAdsData();
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

  const metaReach = metaCampaigns.reduce((s, c) => s + (c.reach || 0), 0);

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

  // Top 3 creatives by spend
  const topCreatives = useMemo(() => {
    return [...metaAds]
      .filter(ad => ad.creative_image_url || ad.creative_thumbnail || ad.cached_image_url)
      .sort((a, b) => (b.spend || 0) - (a.spend || 0))
      .slice(0, 3);
  }, [metaAds]);

  // Top campaigns combined - with conversion label logic
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

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: selectedProject?.currency || 'BRL', minimumFractionDigits: 2 }).format(value);
  const formatNumber = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'; if (num >= 1000) return (num / 1000).toFixed(1) + 'K'; return num.toLocaleString('pt-BR'); };

  const loading = projectsLoading || metaLoading;
  const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects]);

  const PlatformBreakdown = ({ metaVal, googleVal, format: fmt }: { metaVal: number; googleVal: number; format: (n: number) => string }) => (
    <div className="flex items-center gap-1.5 mt-0.5 text-[8px] sm:text-[9px] text-muted-foreground">
      <span className="flex items-center gap-0.5"><img src={metaIcon} className="w-2.5 h-2.5" />{fmt(metaVal)}</span>
      <span className="flex items-center gap-0.5"><img src={googleAdsIcon} className="w-2.5 h-2.5" />{fmt(googleVal)}</span>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[200px] sm:w-[400px] lg:w-[600px] h-[200px] sm:h-[400px] lg:h-[600px] bg-primary/3 rounded-full blur-[80px] sm:blur-[150px]" />
        </div>

        <div className="relative z-10 p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 w-full">
          {/* Header */}
          <FadeIn>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-base sm:text-xl lg:text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Home</h1>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">Visão geral de todas as plataformas</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CreateProjectDialog />
                <ClientSelector />
              </div>
            </div>
          </FadeIn>

          {loading ? <DashboardSkeleton /> : activeProjects.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Nenhum projeto ainda</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">Crie seu primeiro projeto para começar a acompanhar suas campanhas.</p>
              <CreateProjectDialog />
            </div>
          ) : (
            <StaggerContainer staggerDelay={0.04}>
              {/* Quick Stats Bar */}
              <StaggerItem>
                <div className="flex items-center gap-2 flex-wrap text-[10px] sm:text-xs text-muted-foreground mb-1">
                  <Badge variant="outline" className="gap-1 text-[10px] border-blue-500/30 text-blue-400">
                    <img src={metaIcon} className="w-3 h-3" /> {activeCampaignsMeta} ativas
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[10px] border-yellow-500/30 text-yellow-400">
                    <img src={googleAdsIcon} className="w-3 h-3" /> {activeCampaignsGoogle} ativas
                  </Badge>
                  {totalProfileVisits > 0 && (
                    <Badge variant="outline" className="gap-1 text-[10px] border-pink-500/30 text-pink-400">
                      <Instagram className="w-3 h-3" /> {formatNumber(totalProfileVisits)} visitas
                    </Badge>
                  )}
                </div>
              </StaggerItem>

              {/* Metric Cards - compact 2 rows of 4 */}
              <StaggerItem>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
                  {/* Investimento */}
                  <div className="glass-card p-2 sm:p-2.5 border-l-3 border-l-primary">
                    <div className="flex items-center gap-1 mb-0.5">
                      <DollarSign className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">Investimento</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(totalSpend)}</p>
                    <PlatformBreakdown metaVal={metaTotalSpend} googleVal={googleTotalSpend} format={formatCurrency} />
                  </div>
                  {/* Impressões */}
                  <div className="glass-card p-2 sm:p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Eye className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">Impressões</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumber(totalImpressions)}</p>
                    <PlatformBreakdown metaVal={metaImpressions} googleVal={googleImpressions} format={formatNumber} />
                  </div>
                  {/* Cliques */}
                  <div className="glass-card p-2 sm:p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <MousePointerClick className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">Cliques</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumber(totalClicks)}</p>
                    <PlatformBreakdown metaVal={metaClicks} googleVal={googleClicks} format={formatNumber} />
                  </div>
                  {/* Conversões */}
                  <div className="glass-card p-2 sm:p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Users className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">Conversões</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{formatNumber(totalConversions)}</p>
                    <PlatformBreakdown metaVal={metaConversions} googleVal={googleConversions} format={formatNumber} />
                  </div>
                  {/* CTR */}
                  <div className="glass-card p-2 sm:p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Crosshair className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">CTR</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{ctr.toFixed(2)}%</p>
                  </div>
                  {/* CPC */}
                  <div className="glass-card p-2 sm:p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">CPC</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(cpc)}</p>
                  </div>
                  {/* CPM */}
                  <div className="glass-card p-2 sm:p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <BarChart3 className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">CPM</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(cpm)}</p>
                  </div>
                  {/* CPL */}
                  <div className="glass-card p-2 sm:p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Target className="w-3 h-3 text-primary" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground font-medium">CPL</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">{formatCurrency(cpl)}</p>
                  </div>
                </div>
              </StaggerItem>

              {/* Top 3 Creatives */}
              {topCreatives.length > 0 && (
                <StaggerItem>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                      <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 3 Criativos</h2>
                      <Link to="/creatives" className="ml-auto text-[10px] sm:text-xs text-primary hover:underline">Ver todos →</Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      {topCreatives.map((ad, idx) => (
                        <Link key={ad.id} to={`/creative/${ad.id}`} className="glass-card overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all group">
                          <div className="aspect-square relative bg-muted">
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
                          <div className="p-2 sm:p-2.5">
                            <p className="text-[10px] sm:text-xs font-medium truncate mb-1">{ad.name}</p>
                            <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground">
                              <span>{formatCurrency(ad.spend || 0)}</span>
                              <span>{ad.conversions || 0} conv.</span>
                              <span>CTR {(ad.ctr || 0).toFixed(2)}%</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </StaggerItem>
              )}

              {/* Top Campaigns */}
              {allCampaigns.length > 0 && (
                <StaggerItem>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-emerald-500/50 rounded-full" />
                      <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 5 Campanhas</h2>
                    </div>
                    <div className="glass-card overflow-hidden">
                      <div className="divide-y divide-border/50">
                        {allCampaigns.map((c) => {
                          const convLabel = c.isProfileVisit ? 'visitas' : 'conv.';
                          return (
                            <div key={c.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 hover:bg-secondary/30 transition-colors">
                              <img src={c.platform === 'meta' ? metaIcon : googleAdsIcon} className="w-4 h-4 flex-shrink-0" />
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

              {/* Demographics */}
              <StaggerItem>
                <DemographicCharts data={demographicData} isLoading={demographicLoading} currency={selectedProject?.currency || 'BRL'} />
              </StaggerItem>
            </StaggerContainer>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
