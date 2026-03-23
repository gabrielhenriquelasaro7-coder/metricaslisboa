import React from 'react';
import { DiagnosticProject, AIAnalysisResult } from '@/types/diagnostic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import {
  ChevronLeft,
  Download,
  AlertTriangle,
  Zap,
  Target,
  TrendingUp,
  GitBranch,
  ListChecks,
  ShieldCheck,
  Lightbulb,
  ArrowDown,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultsProps {
  project: DiagnosticProject;
  onBack: () => void;
  onEdit: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  critico: 'CRÍTICO',
  na_media: 'NA MÉDIA',
  bom: 'BOM',
  sem_dados: 'SEM DADOS',
};

// Mapeamento oficial das travas
const TRAVA_NAMES: Record<string, string> = {
  '01': 'Volume de Impressão',
  '02': 'CRT',
  '03': 'Lead, CPL',
  '04': 'Taxa de Qualificação',
  '05': 'Reunião',
  '06': 'Fechamento de Proposta',
  '07': 'Churn, Recompra',
  '00': 'Cegueira',
};

const normalizeTravaId = (trava: string) => (trava === 'cegueira' ? '00' : trava);

// Bowtie stages: 07 (churn/recompra) → 01 (volume de impressão)
const BOWTIE_STAGES = [
  { trava: '07', clipPath: 'polygon(100% 10%, 100% 90%, 0px 100%, 0px 0px)', leftBar: '0%', rightBar: '10%' },
  { trava: '06', clipPath: 'polygon(100% 20%, 100% 80%, 0% 90%, 0% 10%)', leftBar: '10%', rightBar: '20%' },
  { trava: '05', clipPath: 'polygon(100% 30%, 100% 70%, 0% 80%, 0% 20%)', leftBar: '20%', rightBar: '30%' },
  { trava: '04', clipPath: 'polygon(100% 30%, 100% 70%, 0% 70%, 0% 30%)', leftBar: '30%', rightBar: '30%' },
  { trava: '03', clipPath: 'polygon(100% 20%, 100% 80%, 0% 70%, 0% 30%)', leftBar: '30%', rightBar: '20%' },
  { trava: '02', clipPath: 'polygon(100% 10%, 100% 90%, 0% 80%, 0% 20%)', leftBar: '20%', rightBar: '10%' },
  { trava: '01', clipPath: 'polygon(100% 0%, 100% 100%, 0% 90%, 0% 10%)', leftBar: '10%', rightBar: '0%' },
];

function getStageColor(status: string, isBottleneck: boolean) {
  if (isBottleneck) return { text: 'text-red-500', glow: 'rgba(239, 68, 68, 0.4)', bg: 'from-red-600/20', border: 'border-red-500/50', barColor: 'bg-red-600', dotColor: 'bg-red-500' };
  switch (status) {
    case 'bom': return { text: 'text-emerald-500', glow: 'rgba(16, 185, 129, 0.2)', bg: 'from-emerald-500/10', border: 'border-emerald-500/20', barColor: 'bg-emerald-500', dotColor: 'bg-emerald-400' };
    case 'na_media': return { text: 'text-amber-500', glow: 'rgba(245, 158, 11, 0.2)', bg: 'from-amber-500/10', border: 'border-amber-500/20', barColor: 'bg-amber-500', dotColor: 'bg-amber-400' };
    default: return { text: 'text-yellow-500', glow: 'rgba(234, 179, 8, 0.2)', bg: 'from-yellow-500/10', border: 'border-white/5 dark:border-white/5', barColor: 'bg-yellow-500', dotColor: 'bg-yellow-400' };
  }
}

function getStatusPercent(status: string): number {
  switch (status) {
    case 'bom': return 85;
    case 'na_media': return 55;
    case 'critico': return 20;
    default: return 5;
  }
}

const BENCHMARK_DEFAULTS: Record<string, string> = {
  '07': '18.00%',
  '06': '5.65%',
  '05': '6.60%',
  '04': '25.00%',
  '03': '28.00%',
  '02': '25.00%',
  '01': '3.00%',
  '00': '1.00%',
};

const MARKET_BENCHMARKS: Record<string, { label: string; value: string }> = {
  '07': { label: 'Mercado Global', value: 'Churn mensal: 3-7%' },
  '06': { label: 'Mercado Global', value: 'Close Rate: 20-35%' },
  '05': { label: 'Mercado Global', value: 'Show Rate: 60-80%' },
  '04': { label: 'Mercado Global', value: 'MQL Rate: 15-30%' },
  '03': { label: 'Mercado Global', value: 'Conv. Lead: 2-5%' },
  '02': { label: 'Mercado Global', value: 'CTR médio: 1.5-3.5%' },
  '01': { label: 'Mercado Global', value: 'CPM médio: $5-15' },
  '00': { label: 'Mercado Global', value: 'Cobertura de dados: 80%+' },
};

interface TravaSliderCardProps {
  trava: string;
  nome: string;
  status: string;
  isBottleneck: boolean;
  pct: number;
  benchVal: string;
  isRestriction: boolean;
  isSemiManual?: boolean;
  marketBench?: { label: string; value: string };
}

function TravaSliderCard({ trava, nome, status, isBottleneck, pct, benchVal, isRestriction, isSemiManual, marketBench }: TravaSliderCardProps) {
  return (
    <div className={cn(
      "relative space-y-4 p-5 rounded-[1.5rem] transition-all duration-500 border shadow-xl",
      isRestriction
        ? "bg-red-50/50 dark:bg-zinc-900/40 border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.1)]"
        : "bg-white dark:bg-black/30 border-border dark:border-white/5"
    )}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">TRAVA {trava}</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-foreground tracking-tight">{nome}</span>
            {isRestriction && <AlertTriangle className="w-4 h-4 text-red-500 ml-1" />}
          </div>
          {isRestriction && (
            <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3" /> Esta é sua restrição ativa
            </p>
          )}
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-muted/50",
          isSemiManual ? "text-amber-500 border-amber-500/20" :
          status === 'critico' ? "text-red-500 border-red-500/20" :
          status === 'bom' ? "text-emerald-500 border-emerald-500/20" :
          status === 'na_media' ? "text-amber-500 border-amber-500/20" : "text-muted-foreground border-border"
        )}>
          {isSemiManual ? 'Semi-Manual' : STATUS_LABELS[status] || 'Sem Dados'}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
        <div className="relative h-3 flex-1 rounded-full flex items-center bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 shadow-inner cursor-pointer" style={{ touchAction: 'none' }}>
          <div
            className="absolute w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_12px_rgba(59,130,246,0.8)] z-10 -translate-x-1/2 cursor-grab pointer-events-none transition-transform"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="flex flex-col items-end min-w-[100px]">
          <span className="text-foreground font-black whitespace-nowrap text-sm text-right">{pct}% Real</span>
          <span className="text-muted-foreground font-bold whitespace-nowrap text-xs text-right mt-0.5">{benchVal} Bench</span>
        </div>
      </div>

      {marketBench && (
        <div className="flex items-center gap-1.5 pt-1">
          <Globe className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground font-bold">{marketBench.label}: <span className="text-foreground/60">{marketBench.value}</span></span>
        </div>
      )}
    </div>
  );
}

export function DiagnosticResults({ project, onBack, onEdit }: ResultsProps) {
  const ai = project.aiAnalysis;

  if (!ai) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-muted-foreground" />
        <h3 className="text-lg font-black text-foreground">Análise não disponível</h3>
        <p className="text-sm text-muted-foreground">Execute a análise IA no wizard para ver os resultados.</p>
        <Button onClick={onEdit} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Editar Diagnóstico</Button>
      </div>
    );
  }

  const scoreMap = new Map(ai.stage_scores.map(s => [normalizeTravaId(s.trava), s]));
  const activeTrava = normalizeTravaId(ai.trava_identificada);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = doc.internal.pageSize.getWidth();
      let y = 20;
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Diagnóstico — TOC', w / 2, y, { align: 'center' });
      y += 10; doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Empresa: ${project.name} · Segmento: ${project.segment}`, w / 2, y, { align: 'center' });
      y += 12; doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38);
      doc.text(`TRAVA IDENTIFICADA: ${(TRAVA_NAMES[activeTrava] || ai.trava_nome).toUpperCase()}`, 20, y);
      doc.setTextColor(0, 0, 0); y += 8; doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      const synLines = doc.splitTextToSize(ai.sintese, w - 40);
      doc.text(synLines, 20, y); y += synLines.length * 5 + 8;
      doc.save(`diagnostico-${project.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast.success('PDF exportado!');
    } catch { toast.error('Erro ao gerar PDF'); }
  };

  const getTravaName = (trava: string): string => TRAVA_NAMES[normalizeTravaId(trava)] || trava;

  const renderTravaSlider = (score: { trava: string; nome: string; status: string }) => {
    const normalizedTrava = normalizeTravaId(score.trava);
    const isBottleneck = normalizedTrava === activeTrava;
    const pct = getStatusPercent(score.status);
    const benchVal = BENCHMARK_DEFAULTS[normalizedTrava] || '—';

    return (
      <TravaSliderCard
        key={score.trava}
        trava={normalizedTrava}
        nome={getTravaName(normalizedTrava)}
        status={score.status}
        isBottleneck={isBottleneck}
        pct={pct}
        benchVal={benchVal}
        isRestriction={isBottleneck}
        marketBench={MARKET_BENCHMARKS[normalizedTrava]}
      />
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 mb-1 text-muted-foreground hover:text-red-500 pl-0 text-[10px] font-black uppercase tracking-widest h-auto py-0">
            <ChevronLeft className="w-3.5 h-3.5" /> Projetos
          </Button>
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Relatório de <span className="text-red-600">Restrição</span>
          </h2>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Benchmark: {project.segment} · {project.name}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="rounded-xl h-8 gap-2 text-[9px] font-black uppercase tracking-widest" onClick={onEdit}>Editar</Button>
          <Button variant="outline" size="sm" className="rounded-xl h-8 gap-2 text-[9px] font-black uppercase tracking-widest" onClick={handleExportPDF}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* ═══ SECTION 1: RESTRIÇÃO ATIVA ═══ */}
      <Card className="relative overflow-hidden border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.15)] dark:bg-zinc-950 bg-white p-10 flex flex-col justify-center rounded-[2.5rem] group w-full">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 blur-[120px] pointer-events-none group-hover:bg-red-600/10 transition-all duration-700" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="flex-1 space-y-6">
            <div className="flex flex-col gap-2">
              <Badge className="w-fit bg-red-600 text-white border-red-600 text-[10px] font-black tracking-widest uppercase px-3 py-1 animate-pulse shadow-lg shadow-red-600/20">
                Restrição Ativa Identificada
              </Badge>
              <h3 className="text-5xl md:text-6xl font-black text-foreground uppercase tracking-tighter italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {getTravaName(activeTrava)} <span className="text-muted-foreground/30 text-2xl">({activeTrava})</span>
              </h3>
              <p className="text-red-500/80 font-black uppercase tracking-[0.3em] flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4" /> Confiança: {ai.confianca?.toUpperCase()}
              </p>
            </div>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-2xl font-medium">
              {ai.razao_core_problem}
            </p>
          </div>

          {/* Side: Market context only */}
          <div className="flex flex-col gap-4 min-w-[280px]">
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Benchmark de Mercado</p>
              </div>
              <p className="text-sm text-foreground font-bold">
                {getTravaName(activeTrava)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Segmento <span className="text-foreground font-bold">{project.segment}</span> · {MARKET_BENCHMARKS[activeTrava]?.value || 'N/A'}
              </p>
            </div>

            <div className="bg-red-600/5 dark:bg-red-950/20 border border-red-600/20 p-5 rounded-3xl space-y-1">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Injeção Recomendada</p>
              <p className="text-[11px] text-foreground font-semibold leading-relaxed line-clamp-3">{ai.injecao_recomendada}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 2: PAINEL DE TRAVAS ═══ */}
      <Card className="p-4 sm:p-5 lg:p-6 dark:bg-zinc-950 bg-white rounded-[2.5rem] relative overflow-hidden flex flex-col shadow-2xl w-full">
        <div className="absolute top-0 left-0 w-80 h-80 bg-red-600/5 blur-[120px] pointer-events-none" />
        <div className="flex justify-between items-start mb-8 relative z-10 mt-2">
          <div className="space-y-1">
            <h4 className="text-xl font-black uppercase tracking-tight text-foreground italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Painel de Travas</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Arraste os sliders para simular cenários · Tudo está linkado</p>
          </div>
          <Badge variant="outline" className="text-[9px] text-muted-foreground font-black px-4 py-1.5 rounded-full uppercase">{`Bench: ${project.segment}`}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 flex-1 relative z-10">
          {/* Vendas / CS Column */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-red-600 mb-4 px-1">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.25em]">Vendas / CS</span>
            </div>
            {ai.stage_scores
              .filter(s => ['07', '06', '05'].includes(s.trava))
              .sort((a, b) => parseInt(b.trava) - parseInt(a.trava))
              .map(score => renderTravaSlider(score))}
          </div>

          {/* Marketing Column */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-amber-500 mb-4 px-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.25em]">Marketing</span>
            </div>
            {ai.stage_scores
              .filter(s => ['04', '03', '02'].includes(s.trava))
              .sort((a, b) => parseInt(b.trava) - parseInt(a.trava))
              .map(score => renderTravaSlider(score))}
          </div>
        </div>

        {/* Bottom: Topo de Funil (01, 00) */}
        <div className="mt-8 pt-6 border-t border-border relative z-10 space-y-5">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground">Topo de Funil</span>
          </div>
          {ai.stage_scores
            .filter(s => s.trava === '01')
            .map(score => renderTravaSlider(score))}
          {ai.stage_scores
            .filter(s => s.trava === 'cegueira' || s.trava === '00')
            .map(score => (
              <TravaSliderCard
                key={score.trava}
                trava="00"
                nome="Cegueira"
                status={score.status}
                isBottleneck={false}
                pct={getStatusPercent(score.status)}
                benchVal="1.00%"
                isRestriction={false}
                isSemiManual
                marketBench={MARKET_BENCHMARKS['00']}
              />
            ))}
        </div>
      </Card>

      {/* ═══ SECTION 3: BOWTIE FUNNEL ═══ */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 md:p-6 shadow-2xl md:px-8 md:py-8 w-full">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex flex-col">
            <h5 className="text-[12px] font-black text-foreground uppercase tracking-widest italic">Fluxo de RECEITA</h5>
            <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Modelagem Dinâmica Bowtie</p>
          </div>
          <div className="hidden sm:flex gap-4">
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[8px] font-black text-muted-foreground uppercase">Eficiente</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-[8px] font-black text-muted-foreground uppercase">Na Média</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /><span className="text-[8px] font-black text-muted-foreground uppercase">Gargalo</span></div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 py-4 px-2 overflow-x-auto">
          {BOWTIE_STAGES.map((stage, idx) => {
            const score = scoreMap.get(stage.trava);
            const status = score?.status || 'sem_dados';
            const isBottleneck = stage.trava === activeTrava;
            const colors = getStageColor(status, isBottleneck);
            const pct = score ? getStatusPercent(score.status) : 0;
            const label = getTravaName(stage.trava);

            return (
              <div key={stage.trava} className="flex items-center">
                <div className="flex flex-col items-center relative gap-2">
                  <span className="text-foreground/70 text-[10px] text-center font-bold uppercase tracking-tighter">{label}</span>

                  <div className="relative group/stage">
                    <div
                      className={cn("absolute left-0 z-30 w-[4px] transition-all duration-500", colors.barColor, isBottleneck && "shadow-[0_0_12px_#ef4444]")}
                      style={{ top: stage.leftBar, bottom: stage.leftBar }}
                    />
                    <div
                      className={cn("absolute right-0 z-30 w-[4px] transition-all duration-500", colors.barColor, isBottleneck && "shadow-[0_0_12px_#ef4444]")}
                      style={{ top: stage.rightBar, bottom: stage.rightBar }}
                    />

                    <div
                      className={cn(
                        "flex items-center justify-center transition-all h-[120px] w-[90px] relative z-10 border-y",
                        isBottleneck
                          ? `bg-gradient-to-br ${colors.bg} to-transparent scale-105 z-20 animate-pulse ${colors.border}`
                          : `border-border bg-gradient-to-br ${colors.bg} to-transparent`
                      )}
                      style={{
                        clipPath: stage.clipPath,
                        boxShadow: isBottleneck ? `0 0 25px ${colors.glow}` : `0 0 15px ${colors.glow}`,
                      }}
                    >
                      <div className="absolute inset-0 z-0" style={{ background: `radial-gradient(circle, ${isBottleneck ? 'rgba(239, 68, 68, 0.4)' : 'rgba(128, 128, 128, 0.05)'}, transparent)`, transform: 'scale(1.2)' }} />
                      <div className="flex flex-col items-center z-10">
                        <span className={cn(
                          "text-lg font-black drop-shadow-lg leading-none",
                          colors.text,
                          isBottleneck && "scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                        )}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                    isBottleneck ? "bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]" : colors.text
                  )}>
                    {isBottleneck ? 'GARGALO' : STATUS_LABELS[status] || 'SEM DADOS'}
                  </div>
                </div>

                {idx < BOWTIE_STAGES.length - 1 && (
                  <div className="flex items-center justify-center relative mx-4">
                    <svg width="24" height="20" viewBox="0 0 24 20" className="relative z-10">
                      <line x1="20" y1="10" x2="4" y2="10" stroke="#eab308" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                      <polygon points="4,10 10,7 10,13" fill="#eab308" opacity="0.6" />
                    </svg>
                    <div className="absolute -left-1 w-1.5 h-1.5 rounded-full animate-pulse z-20 bg-yellow-400" style={{ boxShadow: 'rgb(234, 179, 8) 0px 0px 10px' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SECTION 4: SÍNTESE + ECONOMICS ═══ */}
      <Card className="p-6 dark:bg-zinc-950 bg-white rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <Target className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-black text-foreground uppercase tracking-tight italic">Síntese Executiva</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Visão geral do diagnóstico</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{ai.sintese}</div>

        {/* Economics Grid — simplified: only Ticket + Margem */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-border">
          <div className="space-y-4">
            <h4 className="text-sm font-black text-foreground uppercase tracking-widest italic ml-2">Economics</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/30 border border-border p-6 rounded-[2rem] space-y-1 hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1 group-hover:text-red-500">
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Ticket Médio</span>
                </div>
                <p className="text-xl font-black text-foreground">R$ {project.economics?.averageTicket?.toLocaleString('pt-BR') || '—'}</p>
              </div>
              <div className="bg-muted/30 border border-border p-6 rounded-[2rem] space-y-1 hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1 group-hover:text-red-500">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Margem</span>
                </div>
                <p className="text-xl font-black text-foreground">{project.economics?.contributionMargin || '—'}%</p>
              </div>
            </div>
          </div>

          {/* Benchmarks vs Real Table */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-foreground uppercase tracking-widest italic ml-2">Benchmarks vs Real</h4>
            <div className="bg-muted/30 border border-border rounded-[2rem] overflow-hidden">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest">Trava</th>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest text-center">Status</th>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest text-right">Bench</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ai.stage_scores.map(score => {
                    const isGargalo = normalizeTravaId(score.trava) === activeTrava;
                    return (
                      <tr key={score.trava} className={cn("hover:bg-muted/30 transition-colors", isGargalo && "bg-red-600/5")}>
                        <td className="px-5 py-4 font-black text-foreground uppercase">{getTravaName(score.trava)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                            score.status === 'critico' ? "text-red-500 bg-red-500/10" :
                            score.status === 'bom' ? "text-emerald-500 bg-emerald-500/10" :
                            score.status === 'na_media' ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground bg-muted"
                          )}>
                            {isGargalo ? 'Gargalo' : STATUS_LABELS[score.status] || 'Sem Dados'}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-muted-foreground text-right">{BENCHMARK_DEFAULTS[score.trava] || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* UDEs */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h5 className="text-xs font-black text-muted-foreground uppercase tracking-widest">UDEs — Efeitos Indesejáveis Identificados</h5>
          <div className="space-y-2">
            {ai.udes.map((ude, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-red-600/5 border border-red-600/10 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-foreground/80 font-medium">{ude}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Métricas Foco */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h5 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Métricas Prioritárias</h5>
          <div className="flex flex-wrap gap-2">
            {ai.metricas_foco.map((m, idx) => (
              <Badge key={idx} variant="outline" className="text-[9px] text-foreground/70 font-bold px-3 py-1 rounded-full">{m}</Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 5: LTP — EVAPORATING CLOUD ═══ */}
      <Card className="p-6 dark:bg-zinc-950 bg-white rounded-[2.5rem] space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <GitBranch className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-black text-foreground uppercase tracking-tight italic">LTP — Logical Thinking Process</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Baseado na restrição de {getTravaName(activeTrava)}</p>
          </div>
        </div>

        {/* CRT */}
        <div className="space-y-4">
          <Badge className="bg-red-600/10 text-red-600 border-red-600/20 text-[8px] font-black uppercase">CRT — Cadeia de Realidade Atual</Badge>
          <div className="relative pl-6 space-y-0">
            {ai.ltp_analysis.crt_nodes.map((node, idx) => (
              <div key={idx} className="relative">
                {idx < ai.ltp_analysis.crt_nodes.length - 1 && (
                  <div className="absolute left-[-12px] top-8 bottom-0 w-px bg-red-600/30" />
                )}
                <div className="absolute left-[-16px] top-3 w-2 h-2 rounded-full bg-red-600 ring-2 ring-red-600/20" />
                <div className={cn(
                  "p-3 mb-2 rounded-xl border text-[11px]",
                  idx === ai.ltp_analysis.crt_nodes.length - 1 ? "border-red-600/30 bg-red-600/5 font-bold text-foreground" : "border-border bg-muted/30 text-foreground/80"
                )}>
                  {node}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CORE PROBLEM */}
        <Card className="bg-red-600 border-red-600 p-6 rounded-[2rem] space-y-3 shadow-xl shadow-red-600/20">
          <Badge className="bg-white text-red-600 text-[8px] font-black uppercase">CORE PROBLEM</Badge>
          <p className="text-[13px] font-black text-white uppercase tracking-tighter italic leading-tight">{ai.ltp_analysis.core_problem}</p>
        </Card>

        {/* EVAPORATING CLOUD */}
        <div className="space-y-4">
          <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/20 text-[8px] font-black uppercase">Evaporating Cloud — Diagrama de Conflito</Badge>

          <div className="relative bg-muted/30 border border-border p-6 md:p-8 rounded-2xl space-y-6">
            {/* Objective */}
            <div className="flex justify-center">
              <div className="bg-blue-600/10 border-2 border-blue-600/30 px-8 py-4 rounded-2xl text-center max-w-lg shadow-lg shadow-blue-600/5">
                <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2">🎯 Objetivo Comum</p>
                <p className="text-sm text-foreground font-bold leading-relaxed">{ai.ltp_analysis.evaporating_cloud.objetivo}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex items-center gap-8">
                <div className="h-8 w-px bg-emerald-600/40" />
                <div className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Para atingir o objetivo precisamos de...</div>
                <div className="h-8 w-px bg-purple-600/40" />
              </div>
            </div>

            {/* Two Needs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="bg-emerald-600/10 border-2 border-emerald-600/20 p-5 rounded-2xl">
                  <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">Necessidade A</p>
                  <p className="text-[12px] text-foreground font-semibold leading-relaxed">{ai.ltp_analysis.evaporating_cloud.necessidade_a}</p>
                </div>
                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-emerald-600/40" /></div>
                <div className="bg-emerald-600/5 border border-emerald-600/10 p-5 rounded-2xl">
                  <p className="text-[8px] font-black text-emerald-500/50 uppercase tracking-[0.3em] mb-2">Ação A — O que exige</p>
                  <p className="text-[11px] text-foreground/70 leading-relaxed">{ai.ltp_analysis.evaporating_cloud.acao_a}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-purple-600/10 border-2 border-purple-600/20 p-5 rounded-2xl">
                  <p className="text-[8px] font-black text-purple-500 uppercase tracking-[0.3em] mb-2">Necessidade B</p>
                  <p className="text-[12px] text-foreground font-semibold leading-relaxed">{ai.ltp_analysis.evaporating_cloud.necessidade_b}</p>
                </div>
                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-purple-600/40" /></div>
                <div className="bg-purple-600/5 border border-purple-600/10 p-5 rounded-2xl">
                  <p className="text-[8px] font-black text-purple-500/50 uppercase tracking-[0.3em] mb-2">Ação B — O que exige</p>
                  <p className="text-[11px] text-foreground/70 leading-relaxed">{ai.ltp_analysis.evaporating_cloud.acao_b}</p>
                </div>
              </div>
            </div>

            {/* Conflict */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed border-red-500/30" />
              </div>
              <div className="relative flex justify-center">
                <span className="text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-red-500/10 border-2 border-red-500/30 rounded-full shadow-lg shadow-red-500/10">
                  ⚡ CONFLITO — Ação A e B são mutuamente exclusivas
                </span>
              </div>
            </div>

            {/* Invalid assumption */}
            <div className="bg-amber-600/5 dark:bg-amber-950/30 border-2 border-amber-600/30 p-6 rounded-2xl shadow-lg shadow-amber-600/5">
              <p className="text-[8px] font-black text-amber-500 uppercase tracking-[0.3em] mb-3">🔍 Pressuposto Inválido — A crença que sustenta o conflito</p>
              <p className="text-[13px] text-amber-700 dark:text-amber-200 italic font-semibold leading-relaxed">"{ai.ltp_analysis.evaporating_cloud.pressuposto_invalido}"</p>
              <p className="text-[9px] text-amber-600/60 mt-3 font-bold uppercase tracking-widest">Este pressuposto é falso. Ao invalidá-lo, o conflito evapora.</p>
            </div>

            {/* Injection */}
            <div className="bg-emerald-600/10 border-2 border-emerald-600/30 p-6 rounded-2xl shadow-xl shadow-emerald-600/10">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-emerald-500" />
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em]">💡 Injeção — A solução que evapora o conflito</p>
              </div>
              <p className="text-sm text-foreground font-bold leading-relaxed">{ai.ltp_analysis.evaporating_cloud.injecao}</p>
            </div>
          </div>
        </div>

        {/* FRT Effects */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Efeitos Desejáveis — Future Reality Tree
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ai.ltp_analysis.frt_effects.map((effect, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-xl">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-foreground/70">{effect}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Negative Branches */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" /> Riscos Potenciais — Negative Branches
          </h5>
          <div className="space-y-2">
            {ai.ltp_analysis.negative_branches.map((nb, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 bg-amber-600/5 border border-amber-600/10 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-foreground/70">{nb}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisite Tree */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-500" /> Pré-Requisitos — Prerequisite Tree
          </h5>
          <div className="relative pl-6 space-y-0">
            {ai.ltp_analysis.prerequisite_tree.map((prt, idx) => (
              <div key={idx} className="relative">
                {idx < ai.ltp_analysis.prerequisite_tree.length - 1 && (
                  <div className="absolute left-[-12px] top-8 bottom-0 w-px bg-blue-600/30" />
                )}
                <div className="absolute left-[-16px] top-3 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                <div className="p-3 mb-2 rounded-xl border border-blue-600/10 bg-blue-600/5 text-[11px] text-foreground/70">
                  {prt}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 6: PLANO 90 DIAS ═══ */}
      <Card className="p-6 dark:bg-zinc-950 bg-white rounded-[2.5rem] space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <Zap className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-black text-foreground uppercase tracking-tight italic">Plano Estratégico de 90 Dias</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Foco em quebrar a restrição de {getTravaName(activeTrava)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { phase: 'Mês 01', data: ai.plano_90_dias.mes_1 },
            { phase: 'Mês 02', data: ai.plano_90_dias.mes_2 },
            { phase: 'Mês 03', data: ai.plano_90_dias.mes_3 },
          ].map((p, i) => (
            <div key={i} className="bg-muted/30 border border-border p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden group hover:border-red-600/20 transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/5 rounded-full blur-3xl group-hover:bg-red-600/10 transition-all" />
              <Badge className="bg-muted border-border text-muted-foreground text-[9px] font-black uppercase tracking-widest">{p.phase}</Badge>
              <h5 className="text-lg font-black text-foreground uppercase tracking-tighter italic">{p.data.titulo}</h5>
              <ul className="space-y-3">
                {p.data.acoes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-muted-foreground text-xs font-medium">
                    <div className="w-1 h-1 rounded-full bg-red-600 mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
