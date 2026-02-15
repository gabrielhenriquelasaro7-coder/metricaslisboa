import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClientSelector } from '@/components/layout/ClientSelector';
import { TopCampaignsCard } from '@/components/dashboard/TopCampaignsCard';
import { DemographicCharts } from '@/components/dashboard/DemographicCharts';
import { useDemographicInsights } from '@/hooks/useDemographicInsights';
import { useProjects } from '@/hooks/useProjects';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { usePeriodContext } from '@/hooks/usePeriodContext';
import { DashboardSkeleton } from '@/components/skeletons';
import { DatePresetKey, getDateRangeFromPreset } from '@/utils/dateUtils';
import { DollarSign, TrendingUp, Users, Eye, MousePointerClick, Home, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreativeImage } from '@/components/ui/creative-image';
import metaIcon from '@/assets/meta-icon.png';
import googleAdsIcon from '@/assets/google-ads-icon.png';

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

  const metaImpressions = metaCampaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const googleImpressions = googleCampaigns.reduce((s, c) => s + (c.impressions || 0), 0);

  const metaConversions = metaCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const googleConversions = googleCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);

  // Top 3 creatives by spend
  const topCreatives = useMemo(() => {
    return [...metaAds]
      .filter(ad => ad.creative_image_url || ad.creative_thumbnail || ad.cached_image_url)
      .sort((a, b) => (b.spend || 0) - (a.spend || 0))
      .slice(0, 3);
  }, [metaAds]);

  // Top campaigns combined
  const allCampaigns = useMemo(() => {
    const meta = metaCampaigns.map(c => ({ ...c, platform: 'meta' as const }));
    const google = googleCampaigns.map(c => ({ ...c, platform: 'google' as const, conversions: c.conversions || 0 }));
    return [...meta, ...google].sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, 5);
  }, [metaCampaigns, googleCampaigns]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: selectedProject?.currency || 'BRL', minimumFractionDigits: 2 }).format(value);
  const formatNumber = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'; if (num >= 1000) return (num / 1000).toFixed(1) + 'K'; return num.toLocaleString('pt-BR'); };

  const loading = projectsLoading || metaLoading;

  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-x-hidden w-full max-w-full">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[200px] sm:w-[400px] lg:w-[600px] h-[200px] sm:h-[400px] lg:h-[600px] bg-primary/3 rounded-full blur-[80px] sm:blur-[150px]" />
        </div>

        <div className="relative z-10 p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in w-full">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Home className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Home</h1>
                <p className="text-muted-foreground text-[11px] sm:text-sm">Visão geral de todas as plataformas</p>
              </div>
            </div>
            <div className="w-48 sm:w-56 flex-shrink-0">
              <ClientSelector />
            </div>
          </div>

          {loading ? <DashboardSkeleton /> : (
            <>
              {/* Quick Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="glass-card p-3 sm:p-4 border-l-4 border-l-primary">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Investimento Total</span>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold">{formatCurrency(totalSpend)}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><img src={metaIcon} className="w-3 h-3" />{formatCurrency(metaTotalSpend)}</span>
                    <span className="flex items-center gap-1"><img src={googleAdsIcon} className="w-3 h-3" />{formatCurrency(googleTotalSpend)}</span>
                  </div>
                </div>
                <div className="glass-card p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4 text-primary" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Impressões</span>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold">{formatNumber(metaImpressions + googleImpressions)}</p>
                </div>
                <div className="glass-card p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MousePointerClick className="w-4 h-4 text-primary" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Cliques</span>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold">{formatNumber(metaClicks + googleClicks)}</p>
                </div>
                <div className="glass-card p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Conversões</span>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold">{formatNumber(metaConversions + googleConversions)}</p>
                </div>
              </div>

              {/* Top 3 Creatives */}
              {topCreatives.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                    <h2 className="text-sm sm:text-lg font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 3 Criativos</h2>
                    <Link to="/creatives" className="ml-auto text-xs text-primary hover:underline">Ver todos →</Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
                          <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-xs font-bold px-2 py-1 rounded-md">
                            #{idx + 1}
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-medium truncate mb-2">{ad.name}</p>
                          <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                            <span>{formatCurrency(ad.spend || 0)}</span>
                            <span>{ad.conversions || 0} conv.</span>
                            <span>CTR {(ad.ctr || 0).toFixed(2)}%</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Campaigns */}
              {allCampaigns.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-gradient-to-b from-emerald-500 to-emerald-500/50 rounded-full" />
                    <h2 className="text-sm sm:text-lg font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top Campanhas</h2>
                  </div>
                  <div className="glass-card overflow-hidden">
                    <div className="divide-y divide-border/50">
                      {allCampaigns.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
                          <img src={c.platform === 'meta' ? metaIcon : googleAdsIcon} className="w-5 h-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium truncate">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground">{c.status === 'ACTIVE' || c.status === 'ENABLED' ? '● Ativo' : '○ Pausado'}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs sm:text-sm font-semibold">{formatCurrency(c.spend || 0)}</p>
                            <p className="text-[10px] text-muted-foreground">{c.conversions || 0} conv.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Demographics */}
              <DemographicCharts data={demographicData} isLoading={demographicLoading} currency={selectedProject?.currency || 'BRL'} />
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
