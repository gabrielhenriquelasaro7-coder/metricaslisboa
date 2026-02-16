import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, BarChart3, Eye, MousePointerClick, Clock, AlertTriangle, Globe, Monitor, Smartphone, Tablet, Chrome, ScrollText, Zap, MousePointer2, ArrowDownUp, FileWarning, RotateCcw, TrendingDown, Link2, Tag, MessageSquareText, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import clarityIcon from '@/assets/clarity-icon.png';

interface ClarityMetric {
  metricName: string;
  information: Record<string, any>[];
}

interface ClarityFullData {
  byDevice: ClarityMetric[] | null;
  bySource: ClarityMetric[] | null;
  byChannel: ClarityMetric[] | null;
  byUtm: ClarityMetric[] | null;
  byEngagement: ClarityMetric[] | null;
}

interface ClarityDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  data: ClarityFullData | null;
  loading: boolean;
  numOfDays: number;
  onChangeDays: (days: number) => void;
}

function getMetricValue(metrics: ClarityMetric[] | null, name: string) {
  if (!metrics) return null;
  const m = metrics.find(m => m.metricName === name);
  if (!m || !m.information?.length) return null;
  return m.information;
}

function sumMetricField(info: Record<string, any>[] | null, ...fields: string[]): number {
  if (!info) return 0;
  return info.reduce((sum, item) => {
    for (const f of fields) {
      if (item[f] !== undefined) return sum + Number(item[f] || 0);
    }
    return sum;
  }, 0);
}

function getHealthColor(value: number, thresholds: [number, number]): string {
  if (value <= thresholds[0]) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  if (value <= thresholds[1]) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
  return 'text-red-500 bg-red-500/10 border-red-500/30';
}

function getHealthLabel(value: number, thresholds: [number, number]): string {
  if (value <= thresholds[0]) return 'Saudável';
  if (value <= thresholds[1]) return 'Atenção';
  return 'Crítico';
}

function HealthCard({ icon, label, value, thresholds, description }: { icon: React.ReactNode; label: string; value: number; thresholds: [number, number]; description: string }) {
  const color = getHealthColor(value, thresholds);
  const status = getHealthLabel(value, thresholds);
  return (
    <div className={cn("rounded-lg p-3 text-center border", color)}>
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold">{value.toLocaleString()}</p>
      <p className="text-[10px] font-semibold opacity-90">{label}</p>
      <p className="text-[9px] opacity-60 mt-0.5">{status}</p>
      <p className="text-[8px] opacity-50 mt-0.5 leading-tight">{description}</p>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center mb-1 text-primary">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}

function HorizontalBar({ label, value, total, icon, suffix }: { label: string; value: number; total: number; icon?: React.ReactNode; suffix?: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-xs w-28 truncate text-muted-foreground" title={label}>{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="text-xs font-medium w-16 text-right">{value.toLocaleString()}{suffix || ''}</span>
      <span className="text-[10px] text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
      {icon} {title}
    </h4>
  );
}

const deviceIcons: Record<string, React.ReactNode> = {
  'Desktop': <Monitor className="w-3.5 h-3.5" />,
  'Mobile': <Smartphone className="w-3.5 h-3.5" />,
  'Tablet': <Tablet className="w-3.5 h-3.5" />,
};

function buildBreakdown(metrics: Record<string, any>[] | null, field: string): [string, number][] {
  if (!metrics) return [];
  const map = new Map<string, number>();
  metrics.forEach(item => {
    const key = item[field] || 'Outro';
    map.set(key, (map.get(key) || 0) + Number(item.totalSessionCount || 0));
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

// Generate written analysis
function generateAnalysis(
  totalSessions: number,
  totalUsers: number,
  totalDeadClicks: number,
  totalRageClicks: number,
  totalErrorClicks: number,
  totalScriptErrors: number,
  totalQuickback: number,
  totalExcessiveScroll: number,
  scrollDepthValue: number | null,
  avgEngagementSeconds: number,
  topDevice: string,
  topSource: string,
  topCountry: string,
  numOfDays: number,
): string[] {
  const insights: string[] = [];

  // Traffic
  const sessionsPerDay = Math.round(totalSessions / numOfDays);
  insights.push(`📊 Nos últimos ${numOfDays} dia${numOfDays > 1 ? 's' : ''}, a LP recebeu ${totalSessions.toLocaleString()} sessões (${sessionsPerDay.toLocaleString()}/dia) de ${totalUsers.toLocaleString()} usuários únicos.`);

  // Device
  if (topDevice) {
    insights.push(`📱 O dispositivo principal de acesso é ${topDevice}, indicando que a LP deve ser otimizada prioritariamente para esse formato.`);
  }

  // Source
  if (topSource && topSource !== 'Outro' && topSource !== 'Direto') {
    insights.push(`🔗 A principal fonte de tráfego é "${topSource}". Campanhas nessa origem estão gerando o maior volume de visitas.`);
  }

  // Engagement
  if (avgEngagementSeconds > 0) {
    const mins = Math.floor(avgEngagementSeconds / 60);
    const secs = avgEngagementSeconds % 60;
    if (avgEngagementSeconds < 30) {
      insights.push(`⏱️ Tempo médio de engajamento é baixo (${mins}m ${secs}s). Considere revisar o conteúdo acima da dobra para reter mais os visitantes.`);
    } else if (avgEngagementSeconds < 120) {
      insights.push(`⏱️ Tempo médio de engajamento de ${mins}m ${secs}s está dentro do esperado para uma LP.`);
    } else {
      insights.push(`⏱️ Excelente! Tempo médio de engajamento de ${mins}m ${secs}s indica alto interesse no conteúdo.`);
    }
  }

  // Scroll
  if (scrollDepthValue !== null) {
    if (scrollDepthValue < 30) {
      insights.push(`📜 Profundidade de rolagem de apenas ${scrollDepthValue}% — a maioria dos visitantes não passa do topo. O CTA principal deve estar visível sem rolagem.`);
    } else if (scrollDepthValue < 60) {
      insights.push(`📜 Profundidade de rolagem de ${scrollDepthValue}% — os visitantes exploram metade da página. Posicione elementos importantes na primeira metade.`);
    } else {
      insights.push(`📜 Ótima profundidade de rolagem (${scrollDepthValue}%) — os visitantes estão explorando a maior parte do conteúdo.`);
    }
  }

  // Health issues
  const issues: string[] = [];
  if (totalDeadClicks > 10) issues.push(`${totalDeadClicks} cliques mortos (elementos não clicáveis que parecem ser)`);
  if (totalRageClicks > 5) issues.push(`${totalRageClicks} cliques de raiva (frustração do usuário)`);
  if (totalErrorClicks > 5) issues.push(`${totalErrorClicks} cliques com erro`);
  if (totalScriptErrors > 3) issues.push(`${totalScriptErrors} erros de script na página`);
  if (totalQuickback > 10) issues.push(`${totalQuickback} retornos rápidos (usuários saem logo após chegar)`);

  if (issues.length > 0) {
    insights.push(`⚠️ Problemas detectados: ${issues.join('; ')}. Esses indicadores sugerem que a LP precisa de revisão na experiência do usuário.`);
  } else {
    insights.push(`✅ Nenhum problema crítico de UX detectado! A LP está saudável em termos de cliques, erros e comportamento de navegação.`);
  }

  // Country
  if (topCountry && topCountry !== 'Desconhecido') {
    insights.push(`🌍 A maioria dos visitantes vem de ${topCountry}.`);
  }

  return insights;
}

export default function ClarityDataModal({ open, onOpenChange, label, data, loading, numOfDays, onChangeDays }: ClarityDataModalProps) {
  // Metrics from byDevice (call 1)
  const trafficDevice = getMetricValue(data?.byDevice ?? null, 'Traffic');
  const engagementDevice = getMetricValue(data?.byDevice ?? null, 'Engagement Time');
  const deadClickDevice = getMetricValue(data?.byDevice ?? null, 'Dead Click Count');
  const rageClickDevice = getMetricValue(data?.byDevice ?? null, 'Rage Click Count');
  const errorClickDevice = getMetricValue(data?.byDevice ?? null, 'Error Click Count');
  const scriptErrorDevice = getMetricValue(data?.byDevice ?? null, 'Script Error Count');
  const quickbackDevice = getMetricValue(data?.byDevice ?? null, 'Quickback Click');
  const excessiveScrollDevice = getMetricValue(data?.byDevice ?? null, 'Excessive Scroll');
  const scrollDepthDevice = getMetricValue(data?.byDevice ?? null, 'Scroll Depth');

  // Metrics from bySource (call 2)
  const trafficSource = getMetricValue(data?.bySource ?? null, 'Traffic');

  // Metrics from byChannel (call 3)
  const trafficChannel = getMetricValue(data?.byChannel ?? null, 'Traffic');

  // Metrics from byUtm (call 4)
  const trafficUtm = getMetricValue(data?.byUtm ?? null, 'Traffic');

  // Metrics from byEngagement (call 5) - URL + Device
  const engagementByPage = getMetricValue(data?.byEngagement ?? null, 'Engagement Time');
  const trafficByPage = getMetricValue(data?.byEngagement ?? null, 'Traffic');
  const deadClickByPage = getMetricValue(data?.byEngagement ?? null, 'Dead Click Count');
  const rageClickByPage = getMetricValue(data?.byEngagement ?? null, 'Rage Click Count');
  const scrollDepthByPage = getMetricValue(data?.byEngagement ?? null, 'Scroll Depth');

  // Aggregates
  const totalSessions = sumMetricField(trafficDevice, 'totalSessionCount');
  const totalUsers = sumMetricField(trafficDevice, 'distantUserCount');
  const totalPages = sumMetricField(trafficDevice, 'pagesPerSession');
  const avgPagesPerSession = trafficDevice?.length ? (totalPages / trafficDevice.length).toFixed(1) : '0';

  const totalEngagement = sumMetricField(engagementDevice, 'value', 'engagementTime');
  const avgEngagement = engagementDevice?.length ? Math.round(totalEngagement / engagementDevice.length) : 0;
  const engagementMinutes = Math.floor(avgEngagement / 60);
  const engagementSeconds = avgEngagement % 60;

  const totalDeadClicks = sumMetricField(deadClickDevice, 'value', 'deadClickCount');
  const totalRageClicks = sumMetricField(rageClickDevice, 'value', 'rageClickCount');
  const totalErrorClicks = sumMetricField(errorClickDevice, 'value', 'errorClickCount');
  const totalScriptErrors = sumMetricField(scriptErrorDevice, 'value', 'scriptErrorCount');
  const totalQuickback = sumMetricField(quickbackDevice, 'value', 'quickbackCount');
  const totalExcessiveScroll = sumMetricField(excessiveScrollDevice, 'value', 'excessiveScrollCount');

  // Breakdowns
  const deviceBreakdown = useMemo(() => buildBreakdown(trafficDevice, 'Device'), [trafficDevice]);
  const browserBreakdown = useMemo(() => buildBreakdown(trafficDevice, 'Browser'), [trafficDevice]);
  const osBreakdown = useMemo(() => buildBreakdown(trafficDevice, 'OS'), [trafficDevice]);
  const sourceBreakdown = useMemo(() => buildBreakdown(trafficSource, 'Source').slice(0, 10), [trafficSource]);
  const countryBreakdown = useMemo(() => buildBreakdown(trafficSource, 'Country').slice(0, 10), [trafficSource]);
  const channelBreakdown = useMemo(() => buildBreakdown(trafficChannel, 'Channel'), [trafficChannel]);
  const urlBreakdown = useMemo(() => buildBreakdown(trafficSource, 'URL').slice(0, 10), [trafficSource]);

  // UTM breakdowns
  const utmCampaignBreakdown = useMemo(() => buildBreakdown(trafficUtm, 'Campaign').slice(0, 10), [trafficUtm]);
  const utmMediumBreakdown = useMemo(() => buildBreakdown(trafficUtm, 'Medium').slice(0, 10), [trafficUtm]);
  const utmSourceBreakdown = useMemo(() => buildBreakdown(trafficUtm, 'Source').slice(0, 10), [trafficUtm]);

  // Engagement per page
  const pageEngagement = useMemo(() => {
    if (!trafficByPage) return [];
    const map = new Map<string, { sessions: number; engagement: number; deadClicks: number; rageClicks: number; scrollDepth: number; count: number }>();
    
    trafficByPage.forEach(item => {
      const url = item.URL || '/';
      const existing = map.get(url) || { sessions: 0, engagement: 0, deadClicks: 0, rageClicks: 0, scrollDepth: 0, count: 0 };
      existing.sessions += Number(item.totalSessionCount || 0);
      existing.count += 1;
      map.set(url, existing);
    });

    // Add engagement data
    engagementByPage?.forEach(item => {
      const url = item.URL || '/';
      const existing = map.get(url);
      if (existing) {
        existing.engagement += Number(item.value || item.engagementTime || 0);
      }
    });

    // Add dead clicks per page
    deadClickByPage?.forEach(item => {
      const url = item.URL || '/';
      const existing = map.get(url);
      if (existing) {
        existing.deadClicks += Number(item.value || item.deadClickCount || 0);
      }
    });

    // Add rage clicks per page
    rageClickByPage?.forEach(item => {
      const url = item.URL || '/';
      const existing = map.get(url);
      if (existing) {
        existing.rageClicks += Number(item.value || item.rageClickCount || 0);
      }
    });

    // Add scroll depth per page
    scrollDepthByPage?.forEach(item => {
      const url = item.URL || '/';
      const existing = map.get(url);
      if (existing) {
        existing.scrollDepth += Number(item.value || item.scrollDepth || 0);
      }
    });

    return Array.from(map.entries())
      .map(([url, data]) => ({
        url,
        sessions: data.sessions,
        avgEngagement: data.count > 0 ? Math.round(data.engagement / data.count) : 0,
        deadClicks: data.deadClicks,
        rageClicks: data.rageClicks,
        scrollDepth: data.count > 0 ? Math.round(data.scrollDepth / data.count) : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);
  }, [trafficByPage, engagementByPage, deadClickByPage, rageClickByPage, scrollDepthByPage]);

  // Scroll depth
  const scrollDepthValue = useMemo(() => {
    if (!scrollDepthDevice?.length) return null;
    const total = scrollDepthDevice.reduce((s, i) => s + Number(i.value || i.scrollDepth || 0), 0);
    return Math.round(total / scrollDepthDevice.length);
  }, [scrollDepthDevice]);

  // Analysis text
  const analysisInsights = useMemo(() => {
    return generateAnalysis(
      totalSessions, totalUsers, totalDeadClicks, totalRageClicks,
      totalErrorClicks, totalScriptErrors, totalQuickback, totalExcessiveScroll,
      scrollDepthValue, avgEngagement,
      deviceBreakdown[0]?.[0] || '',
      sourceBreakdown[0]?.[0] || '',
      countryBreakdown[0]?.[0] || '',
      numOfDays
    );
  }, [totalSessions, totalUsers, totalDeadClicks, totalRageClicks, totalErrorClicks, totalScriptErrors, totalQuickback, totalExcessiveScroll, scrollDepthValue, avgEngagement, deviceBreakdown, sourceBreakdown, countryBreakdown, numOfDays]);

  const hasData = data && (data.byDevice || data.bySource || data.byChannel);
  const totalSessionsUtm = sumMetricField(trafficUtm, 'totalSessionCount');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={clarityIcon} alt="" className="w-5 h-5" />
            {label} — Análise Completa da LP
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            <span>Período:</span>
            <div className="flex gap-1">
              {[1, 2, 3].map(d => (
                <button
                  key={d}
                  onClick={() => onChangeDays(d)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors",
                    numOfDays === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  {d} dia{d > 1 ? 's' : ''}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/50 ml-auto">5 de 10 chamadas/dia</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Buscando dados do Clarity...</p>
            <p className="text-[10px] text-muted-foreground/60">5 chamadas paralelas em andamento</p>
          </div>
        ) : !hasData ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
            <p className="font-medium">Nenhum dado disponível</p>
            <p className="text-sm text-muted-foreground mt-1">Verifique se o token e o projeto estão corretos.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ═══ ANÁLISE ESCRITA ═══ */}
            {analysisInsights.length > 0 && (
              <div className="glass-card p-4 border-l-4 border-l-primary">
                <SectionTitle icon={<MessageSquareText className="w-4 h-4 text-primary" />} title="Análise Automática" />
                <div className="space-y-2">
                  {analysisInsights.map((insight, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ RESUMO GERAL ═══ */}
            <div>
              <SectionTitle icon={<BarChart3 className="w-4 h-4 text-primary" />} title="Resumo Geral" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard icon={<BarChart3 className="w-4 h-4" />} label="Sessões" value={totalSessions.toLocaleString()} sub={`${Math.round(totalSessions / numOfDays).toLocaleString()}/dia`} />
                <SummaryCard icon={<Eye className="w-4 h-4" />} label="Usuários Únicos" value={totalUsers.toLocaleString()} />
                <SummaryCard icon={<ScrollText className="w-4 h-4" />} label="Págs/Sessão" value={avgPagesPerSession} />
                <SummaryCard icon={<Clock className="w-4 h-4" />} label="Tempo de Engajamento" value={`${engagementMinutes}m ${engagementSeconds}s`} sub="média por sessão" />
              </div>
            </div>

            {/* ═══ SAÚDE DA LP ═══ */}
            <div>
              <SectionTitle icon={<Zap className="w-4 h-4 text-yellow-500" />} title="Saúde da Landing Page" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <HealthCard icon={<MousePointer2 className="w-4 h-4" />} label="Cliques Mortos" value={totalDeadClicks} thresholds={[10, 50]} description="Cliques em elementos não interativos" />
                <HealthCard icon={<MousePointerClick className="w-4 h-4" />} label="Cliques de Raiva" value={totalRageClicks} thresholds={[5, 20]} description="Cliques repetidos por frustração" />
                <HealthCard icon={<AlertTriangle className="w-4 h-4" />} label="Cliques com Erro" value={totalErrorClicks} thresholds={[5, 20]} description="Cliques que geraram erros JS" />
                <HealthCard icon={<FileWarning className="w-4 h-4" />} label="Erros de Script" value={totalScriptErrors} thresholds={[3, 15]} description="Erros JavaScript na página" />
                <HealthCard icon={<RotateCcw className="w-4 h-4" />} label="Retorno Rápido" value={totalQuickback} thresholds={[10, 40]} description="Saíram em menos de 5s" />
                <HealthCard icon={<ArrowDownUp className="w-4 h-4" />} label="Rolagem Excessiva" value={totalExcessiveScroll} thresholds={[10, 30]} description="Rolaram demais sem interagir" />
              </div>
            </div>

            {/* ═══ PROFUNDIDADE DE ROLAGEM ═══ */}
            {scrollDepthValue !== null && (
              <div className="glass-card p-4">
                <SectionTitle icon={<TrendingDown className="w-4 h-4 text-primary" />} title="Profundidade de Rolagem" />
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all bg-gradient-to-r from-primary to-primary/60"
                      style={{ width: `${Math.min(scrollDepthValue, 100)}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-primary">{scrollDepthValue}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Os usuários rolam em média até {scrollDepthValue}% da página
                </p>
              </div>
            )}

            {/* ═══ ENGAJAMENTO POR PÁGINA ═══ */}
            {pageEngagement.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Activity className="w-4 h-4 text-primary" />} title="Visualização e Engajamento por Página" />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Página</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Sessões</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Engajamento</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Rolagem</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Dead Clicks</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Rage Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageEngagement.map((page, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 max-w-[200px] truncate" title={page.url}>{page.url}</td>
                          <td className="text-right py-2 font-medium">{page.sessions.toLocaleString()}</td>
                          <td className="text-right py-2">{Math.floor(page.avgEngagement / 60)}m {page.avgEngagement % 60}s</td>
                          <td className="text-right py-2">{page.scrollDepth > 0 ? `${page.scrollDepth}%` : '—'}</td>
                          <td className={cn("text-right py-2", page.deadClicks > 10 ? "text-yellow-500 font-medium" : "")}>{page.deadClicks}</td>
                          <td className={cn("text-right py-2", page.rageClicks > 5 ? "text-red-500 font-medium" : "")}>{page.rageClicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ UTM / CAMPANHAS ═══ */}
            {(utmCampaignBreakdown.length > 0 || utmSourceBreakdown.length > 0 || utmMediumBreakdown.length > 0) && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Tag className="w-4 h-4 text-primary" />} title="UTM — Rastreamento de Campanhas" />
                <div className="space-y-4">
                  {utmCampaignBreakdown.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wider">utm_campaign</p>
                      <div className="space-y-1.5">
                        {utmCampaignBreakdown.map(([campaign, sessions]) => (
                          <HorizontalBar key={campaign} label={campaign} value={sessions} total={totalSessionsUtm || totalSessions} />
                        ))}
                      </div>
                    </div>
                  )}
                  {utmSourceBreakdown.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wider">utm_source</p>
                      <div className="space-y-1.5">
                        {utmSourceBreakdown.map(([source, sessions]) => (
                          <HorizontalBar key={source} label={source} value={sessions} total={totalSessionsUtm || totalSessions} />
                        ))}
                      </div>
                    </div>
                  )}
                  {utmMediumBreakdown.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wider">utm_medium</p>
                      <div className="space-y-1.5">
                        {utmMediumBreakdown.map(([medium, sessions]) => (
                          <HorizontalBar key={medium} label={medium} value={sessions} total={totalSessionsUtm || totalSessions} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ DISPOSITIVOS ═══ */}
            {deviceBreakdown.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Monitor className="w-4 h-4 text-primary" />} title="Análise por Dispositivo" />
                <div className="space-y-2">
                  {deviceBreakdown.map(([device, sessions]) => (
                    <HorizontalBar key={device} label={device} value={sessions} total={totalSessions} icon={deviceIcons[device]} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ NAVEGADORES ═══ */}
            {browserBreakdown.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Chrome className="w-4 h-4 text-primary" />} title="Navegadores" />
                <div className="space-y-2">
                  {browserBreakdown.slice(0, 6).map(([browser, sessions]) => (
                    <HorizontalBar key={browser} label={browser} value={sessions} total={totalSessions} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ SISTEMAS OPERACIONAIS ═══ */}
            {osBreakdown.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Monitor className="w-4 h-4 text-primary" />} title="Sistemas Operacionais" />
                <div className="space-y-2">
                  {osBreakdown.slice(0, 6).map(([os, sessions]) => (
                    <HorizontalBar key={os} label={os} value={sessions} total={totalSessions} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ PÁGINAS POPULARES ═══ */}
            {urlBreakdown.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Link2 className="w-4 h-4 text-primary" />} title="Páginas Populares" />
                <div className="space-y-2">
                  {urlBreakdown.map(([url, sessions]) => (
                    <HorizontalBar key={url} label={url} value={sessions} total={totalSessions} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ ORIGENS DE TRÁFEGO ═══ */}
            {sourceBreakdown.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Globe className="w-4 h-4 text-primary" />} title="Origens de Tráfego" />
                <div className="space-y-2">
                  {sourceBreakdown.map(([source, sessions]) => (
                    <HorizontalBar key={source} label={source} value={sessions} total={totalSessions} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ CANAIS ═══ */}
            {channelBreakdown.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Zap className="w-4 h-4 text-primary" />} title="Canais" />
                <div className="space-y-2">
                  {channelBreakdown.map(([channel, sessions]) => (
                    <HorizontalBar key={channel} label={channel} value={sessions} total={totalSessions} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ PAÍSES ═══ */}
            {countryBreakdown.length > 0 && (
              <div className="glass-card p-4">
                <SectionTitle icon={<Globe className="w-4 h-4 text-primary" />} title="Países" />
                <div className="space-y-2">
                  {countryBreakdown.map(([country, sessions]) => (
                    <HorizontalBar key={country} label={country} value={sessions} total={totalSessions} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
