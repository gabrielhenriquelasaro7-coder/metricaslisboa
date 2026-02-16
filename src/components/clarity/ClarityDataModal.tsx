import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Eye, MousePointerClick, Clock, AlertTriangle, Globe, Monitor, Smartphone, Tablet, Chrome, ScrollText, Zap, MousePointer2, ArrowDownUp, FileWarning, RotateCcw, TrendingDown } from 'lucide-react';
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

const METRIC_TRANSLATIONS: Record<string, string> = {
  'Traffic': 'Tráfego',
  'Engagement Time': 'Tempo de Engajamento',
  'Dead Click Count': 'Cliques Mortos',
  'Rage Click Count': 'Cliques de Raiva',
  'Error Click Count': 'Cliques com Erro',
  'Script Error Count': 'Erros de Script',
  'Quickback Click': 'Retorno Rápido',
  'Excessive Scroll': 'Rolagem Excessiva',
  'Scroll Depth': 'Profundidade de Rolagem',
  'Popular Pages': 'Páginas Populares',
  'Referrer URL': 'URL de Referência',
};

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

function HealthCard({ icon, label, value, thresholds }: { icon: React.ReactNode; label: string; value: number; thresholds: [number, number] }) {
  const color = getHealthColor(value, thresholds);
  return (
    <div className={cn("rounded-lg p-3 text-center border", color)}>
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold">{value.toLocaleString()}</p>
      <p className="text-[10px] opacity-80">{label}</p>
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

function HorizontalBar({ label, value, total, icon }: { label: string; value: number; total: number; icon?: React.ReactNode }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-xs w-24 truncate text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="text-xs font-medium w-16 text-right">{value.toLocaleString()}</span>
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

export default function ClarityDataModal({ open, onOpenChange, label, data, loading, numOfDays, onChangeDays }: ClarityDataModalProps) {
  // Extract metrics from all 3 calls
  const trafficDevice = getMetricValue(data?.byDevice ?? null, 'Traffic');
  const engagementDevice = getMetricValue(data?.byDevice ?? null, 'Engagement Time');
  const deadClickDevice = getMetricValue(data?.byDevice ?? null, 'Dead Click Count');
  const rageClickDevice = getMetricValue(data?.byDevice ?? null, 'Rage Click Count');
  const errorClickDevice = getMetricValue(data?.byDevice ?? null, 'Error Click Count');
  const scriptErrorDevice = getMetricValue(data?.byDevice ?? null, 'Script Error Count');
  const quickbackDevice = getMetricValue(data?.byDevice ?? null, 'Quickback Click');
  const excessiveScrollDevice = getMetricValue(data?.byDevice ?? null, 'Excessive Scroll');
  const scrollDepthDevice = getMetricValue(data?.byDevice ?? null, 'Scroll Depth');

  const trafficSource = getMetricValue(data?.bySource ?? null, 'Traffic');
  const popularPages = getMetricValue(data?.bySource ?? null, 'Popular Pages');

  const trafficChannel = getMetricValue(data?.byChannel ?? null, 'Traffic');

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

  // Browser breakdown from byDevice
  const browserMetric = getMetricValue(data?.byDevice ?? null, 'Traffic');
  const browserBreakdown = useMemo(() => {
    if (!browserMetric) return [];
    const map = new Map<string, number>();
    browserMetric.forEach(item => {
      const browser = item.Browser || 'Outro';
      map.set(browser, (map.get(browser) || 0) + Number(item.totalSessionCount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [browserMetric]);

  const osBreakdown = useMemo(() => {
    if (!browserMetric) return [];
    const map = new Map<string, number>();
    browserMetric.forEach(item => {
      const os = item.OS || 'Outro';
      map.set(os, (map.get(os) || 0) + Number(item.totalSessionCount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [browserMetric]);

  const deviceBreakdown = useMemo(() => {
    if (!browserMetric) return [];
    const map = new Map<string, number>();
    browserMetric.forEach(item => {
      const device = item.Device || 'Outro';
      map.set(device, (map.get(device) || 0) + Number(item.totalSessionCount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [browserMetric]);

  // Source breakdown
  const sourceBreakdown = useMemo(() => {
    if (!trafficSource) return [];
    const map = new Map<string, number>();
    trafficSource.forEach(item => {
      const source = item.Source || 'Direto';
      map.set(source, (map.get(source) || 0) + Number(item.totalSessionCount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [trafficSource]);

  // Country breakdown
  const countryBreakdown = useMemo(() => {
    if (!trafficSource) return [];
    const map = new Map<string, number>();
    trafficSource.forEach(item => {
      const country = item.Country || 'Desconhecido';
      map.set(country, (map.get(country) || 0) + Number(item.totalSessionCount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [trafficSource]);

  // Channel breakdown
  const channelBreakdown = useMemo(() => {
    if (!trafficChannel) return [];
    const map = new Map<string, number>();
    trafficChannel.forEach(item => {
      const channel = item.Channel || 'Outro';
      map.set(channel, (map.get(channel) || 0) + Number(item.totalSessionCount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [trafficChannel]);

  // URL breakdown
  const urlBreakdown = useMemo(() => {
    if (!trafficSource) return [];
    const map = new Map<string, number>();
    trafficSource.forEach(item => {
      const url = item.URL || '/';
      map.set(url, (map.get(url) || 0) + Number(item.totalSessionCount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [trafficSource]);

  // Scroll depth
  const scrollDepthValue = useMemo(() => {
    if (!scrollDepthDevice?.length) return null;
    const total = scrollDepthDevice.reduce((s, i) => s + Number(i.value || i.scrollDepth || 0), 0);
    return Math.round(total / scrollDepthDevice.length);
  }, [scrollDepthDevice]);

  const hasData = data && (data.byDevice || data.bySource || data.byChannel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={clarityIcon} alt="" className="w-5 h-5" />
            {label} — Análise da LP
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
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Buscando dados do Clarity...</p>
            <p className="text-[10px] text-muted-foreground/60">3 chamadas paralelas em andamento</p>
          </div>
        ) : !hasData ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
            <p className="font-medium">Nenhum dado disponível</p>
            <p className="text-sm text-muted-foreground mt-1">Verifique se o token e o projeto estão corretos.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ═══ RESUMO GERAL ═══ */}
            <div>
              <SectionTitle icon={<BarChart3 className="w-4 h-4 text-primary" />} title="Resumo Geral" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard icon={<BarChart3 className="w-4 h-4" />} label="Sessões" value={totalSessions.toLocaleString()} />
                <SummaryCard icon={<Eye className="w-4 h-4" />} label="Usuários" value={totalUsers.toLocaleString()} />
                <SummaryCard icon={<ScrollText className="w-4 h-4" />} label="Págs/Sessão" value={avgPagesPerSession} />
                <SummaryCard icon={<Clock className="w-4 h-4" />} label="Tempo de Engajamento" value={`${engagementMinutes}m ${engagementSeconds}s`} />
              </div>
            </div>

            {/* ═══ SAÚDE DA LP ═══ */}
            <div>
              <SectionTitle icon={<Zap className="w-4 h-4 text-yellow-500" />} title="Saúde da Landing Page" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <HealthCard icon={<MousePointer2 className="w-4 h-4" />} label="Cliques Mortos" value={totalDeadClicks} thresholds={[10, 50]} />
                <HealthCard icon={<MousePointerClick className="w-4 h-4" />} label="Cliques de Raiva" value={totalRageClicks} thresholds={[5, 20]} />
                <HealthCard icon={<AlertTriangle className="w-4 h-4" />} label="Cliques com Erro" value={totalErrorClicks} thresholds={[5, 20]} />
                <HealthCard icon={<FileWarning className="w-4 h-4" />} label="Erros de Script" value={totalScriptErrors} thresholds={[3, 15]} />
                <HealthCard icon={<RotateCcw className="w-4 h-4" />} label="Retorno Rápido" value={totalQuickback} thresholds={[10, 40]} />
                <HealthCard icon={<ArrowDownUp className="w-4 h-4" />} label="Rolagem Excessiva" value={totalExcessiveScroll} thresholds={[10, 30]} />
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
                <SectionTitle icon={<ScrollText className="w-4 h-4 text-primary" />} title="Páginas Populares" />
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
