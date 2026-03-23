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
  ArrowRight,
  ArrowDown,
  Gauge,
  BarChart3,
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

// Proper TOC naming for travas
const TRAVA_NAMES: Record<string, string> = {
  '01': 'Exposição',
  '02': 'Atenção',
  '03': 'Interesse',
  '04': 'Qualificação',
  '05': 'Compromisso',
  '06': 'Decisão',
  '07': 'Retenção',
  '00': 'Cegueira',
};

// Bowtie stages: Retenção (07, left/wide) → Exposição (01, right/wide) — funnel perspective
const BOWTIE_STAGES = [
  { trava: '07', clipPath: 'polygon(100% 10%, 100% 90%, 0px 100%, 0px 0px)',           leftBar: '0%',  rightBar: '10%' },
  { trava: '06', clipPath: 'polygon(100% 20%, 100% 80%, 0% 90%, 0% 10%)',             leftBar: '10%', rightBar: '20%' },
  { trava: '05', clipPath: 'polygon(100% 30%, 100% 70%, 0% 80%, 0% 20%)',             leftBar: '20%', rightBar: '30%' },
  { trava: '04', clipPath: 'polygon(100% 30%, 100% 70%, 0% 70%, 0% 30%)',             leftBar: '30%', rightBar: '30%' },
  { trava: '03', clipPath: 'polygon(100% 20%, 100% 80%, 0% 70%, 0% 30%)',             leftBar: '30%', rightBar: '20%' },
  { trava: '02', clipPath: 'polygon(100% 10%, 100% 90%, 0% 80%, 0% 20%)',             leftBar: '20%', rightBar: '10%' },
  { trava: '01', clipPath: 'polygon(100% 0%, 100% 100%, 0% 90%, 0% 10%)',             leftBar: '10%', rightBar: '0%' },
];

function getStageColor(status: string, isBottleneck: boolean) {
  if (isBottleneck) return { text: 'text-red-500', glow: 'rgba(239, 68, 68, 0.4)', bg: 'from-red-600/20', border: 'border-red-500/50', barColor: 'bg-red-600', dotColor: 'bg-red-500' };
  switch (status) {
    case 'bom': return { text: 'text-emerald-500', glow: 'rgba(16, 185, 129, 0.2)', bg: 'from-emerald-500/10', border: 'border-emerald-500/20', barColor: 'bg-emerald-500', dotColor: 'bg-emerald-400' };
    case 'na_media': return { text: 'text-amber-500', glow: 'rgba(245, 158, 11, 0.2)', bg: 'from-amber-500/10', border: 'border-amber-500/20', barColor: 'bg-amber-500', dotColor: 'bg-amber-400' };
    default: return { text: 'text-yellow-500', glow: 'rgba(234, 179, 8, 0.2)', bg: 'from-yellow-500/10', border: 'border-white/5', barColor: 'bg-yellow-500', dotColor: 'bg-yellow-400' };
  }
}

function formatDisplayValue(val: string | null | undefined): string {
  if (!val || val === 'null' || val === 'undefined' || val === '0.00' || val === '0') return 'Sem dados';
  // Extract only percentage if the value contains raw data like "impressions: 210000, ctr: 2.23"
  // We want to show only the status percentage, not raw metric strings
  return val;
}

function formatAsPercent(status: string): string {
  const pct = getStatusPercent(status);
  return `${pct}%`;
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'critico': return 'text-red-500 bg-red-500/10 border-red-500/20';
    case 'na_media': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    case 'bom': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
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

function getBowtieBarColor(status: string) {
  switch (status) {
    case 'critico': return 'bg-red-500';
    case 'na_media': return 'bg-amber-500';
    case 'bom': return 'bg-emerald-500';
    default: return 'bg-zinc-700';
  }
}

function getBowtieTextColor(status: string) {
  switch (status) {
    case 'critico': return 'text-red-400';
    case 'bom': return 'text-emerald-400';
    case 'na_media': return 'text-amber-400';
    default: return 'text-zinc-600';
  }
}

const BENCHMARK_DEFAULTS: Record<string, string> = {
  '07': '3.00%',
  '06': '25.00%',
  '05': '28.00%',
  '04': '25.00%',
  '03': '6.60%',
  '02': '5.65%',
  '01': '18.00',
  '00': '1.00%',
};

function getBenchmarkValue(trava: string): string {
  return BENCHMARK_DEFAULTS[trava] || '—';
}

interface TravaSliderCardProps {
  trava: string;
  nome: string;
  status: string;
  isBottleneck: boolean;
  pct: number;
  displayVal: string;
  benchVal: string;
  isRestriction: boolean;
  isSemiManual?: boolean;
}

function TravaSliderCard({ trava, nome, status, isBottleneck, pct, displayVal, benchVal, isRestriction, isSemiManual }: TravaSliderCardProps) {
  return (
    <div className={cn(
      "relative space-y-4 p-5 rounded-[1.5rem] transition-all duration-500 border shadow-xl",
      isRestriction ? "bg-zinc-900/40 border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.1)]" : "border-white/5 bg-black/30"
    )}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">TRAVA {trava}</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white tracking-tight">{nome}</span>
            {isRestriction && <AlertTriangle className="w-4 h-4 text-red-500 ml-1" />}
          </div>
          {isRestriction && (
            <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3" /> Esta é sua restrição ativa
            </p>
          )}
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 bg-black/50",
          isSemiManual ? "text-amber-500" :
          status === 'critico' ? "text-red-500" :
          status === 'bom' ? "text-emerald-500" :
          status === 'na_media' ? "text-amber-500" : "text-zinc-500"
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
          <span className="text-white font-black whitespace-nowrap text-sm text-right">{displayVal} Real</span>
          <span className="text-zinc-500 font-bold whitespace-nowrap text-xs text-right mt-0.5">{benchVal} Bench</span>
        </div>
      </div>
    </div>
  );
}

export function DiagnosticResults({ project, onBack, onEdit }: ResultsProps) {
  const ai = project.aiAnalysis;

  if (!ai) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-zinc-700" />
        <h3 className="text-lg font-black text-white">Análise não disponível</h3>
        <p className="text-sm text-zinc-500">Execute a análise IA no wizard para ver os resultados.</p>
        <Button onClick={onEdit} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Editar Diagnóstico</Button>
      </div>
    );
  }

  const scoreMap = new Map(ai.stage_scores.map(s => [s.trava, s]));

  // Find bottleneck score for efficiency/gap cards
  const bottleneckScore = ai.stage_scores.find(s => s.trava === ai.trava_identificada);
  const bottleneckPercent = getStatusPercent(bottleneckScore?.status || 'sem_dados');

  // Split travas for the panel
  const marketingTravas = ai.stage_scores.filter(s => ['07', '06', '05'].includes(s.trava));
  const vendasTravas = ai.stage_scores.filter(s => ['04', '03', '02', '01'].includes(s.trava));

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
      doc.text(`TRAVA IDENTIFICADA: ${ai.trava_nome.toUpperCase()}`, 20, y);
      doc.setTextColor(0, 0, 0); y += 8; doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      const synLines = doc.splitTextToSize(ai.sintese, w - 40);
      doc.text(synLines, 20, y); y += synLines.length * 5 + 8;
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('Core Problem:', 20, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const rpLines = doc.splitTextToSize(ai.razao_core_problem, w - 40);
      doc.text(rpLines, 20, y); y += rpLines.length * 5 + 6;
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('Injeção:', 20, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const ijLines = doc.splitTextToSize(ai.injecao_recomendada, w - 40);
      doc.text(ijLines, 20, y);
      doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, w / 2, 290, { align: 'center' });
      doc.save(`diagnostico-${project.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast.success('PDF exportado!');
    } catch { toast.error('Erro ao gerar PDF'); }
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 mb-1 text-zinc-500 hover:text-red-500 pl-0 text-[10px] font-black uppercase tracking-widest h-auto py-0">
            <ChevronLeft className="w-3.5 h-3.5" /> Projetos
          </Button>
          <h2 className="text-xl font-black text-white uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Relatório de <span className="text-red-600">Diagnóstico</span>
          </h2>
          <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">{project.name} · {project.segment}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="rounded-xl h-8 gap-2 text-[9px] font-black uppercase tracking-widest bg-zinc-950 border-white/5 text-white hover:bg-white/10" onClick={onEdit}>Editar</Button>
          <Button variant="outline" size="sm" className="rounded-xl h-8 gap-2 text-[9px] font-black uppercase tracking-widest bg-zinc-950 border-white/5 text-white hover:bg-white/10" onClick={handleExportPDF}>
            <Download className="w-3.5 h-3.5" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* ═══ SECTION 1: RESTRIÇÃO ATIVA + EFICIÊNCIA + GAP ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main restriction card */}
        <Card className="lg:col-span-2 relative overflow-hidden border border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.15)] bg-zinc-950 p-8 rounded-[2.5rem]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 blur-[120px] pointer-events-none" />
          <div className="relative z-10 space-y-5">
            <Badge className="bg-red-600 text-white border-red-600 text-[10px] font-black tracking-widest uppercase px-3 py-1 animate-pulse shadow-lg shadow-red-600/20">
              Restrição Ativa Identificada
            </Badge>
            <h3 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {ai.trava_nome} <span className="text-zinc-800 text-xl">({ai.trava_identificada})</span>
            </h3>
            <p className="text-red-500/80 font-black uppercase tracking-[0.3em] flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4" /> Confiança: {ai.confianca}
            </p>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl font-medium">{ai.razao_core_problem}</p>
            <div className="bg-black/50 backdrop-blur-md border border-white/5 p-5 rounded-2xl space-y-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Injeção Recomendada</p>
              <p className="text-sm font-bold text-white leading-relaxed">{ai.injecao_recomendada}</p>
            </div>
          </div>
        </Card>

        {/* Side cards: Efficiency + Gap */}
        <div className="flex flex-col gap-4">
          <Card className="flex-1 border border-white/5 bg-zinc-950 p-6 rounded-[2rem] space-y-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Eficiência Atual Real</span>
            </div>
            <div className="text-4xl font-black text-white">{bottleneckPercent}%</div>
            <div className="h-3 rounded-full bg-zinc-900 overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${bottleneckPercent}%`,
                background: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)',
              }} />
            </div>
            <p className="text-[10px] text-zinc-600">Eficiência da trava <span className="text-white font-bold">{ai.trava_nome}</span> em relação ao benchmark do segmento</p>
          </Card>

          <Card className="flex-1 border border-red-600/20 bg-zinc-950 p-6 rounded-[2rem] space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-red-500" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Gap vs Benchmark</span>
            </div>
            <div className="text-4xl font-black text-red-500">{100 - bottleneckPercent}%</div>
            <p className="text-[10px] text-zinc-600">
              Gap de performance que precisa ser fechado para destravar o funil
            </p>
            <div className="flex items-center gap-2 text-[9px] text-red-500/80 font-bold">
              <AlertTriangle className="w-3 h-3" /> Prioridade máxima de atuação
            </div>
          </Card>
        </div>
      </div>

      {/* ═══ SECTION 2: PAINEL DE TRAVAS (Sliders) ═══ */}
      <Card className="p-4 sm:p-5 lg:p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] relative overflow-hidden flex flex-col shadow-2xl w-full">
        <div className="absolute top-0 left-0 w-80 h-80 bg-red-600/5 blur-[120px] pointer-events-none" />
        <div className="flex justify-between items-start mb-8 relative z-10 mt-2">
          <div className="space-y-1">
            <h4 className="text-xl font-black uppercase tracking-tight text-white italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Painel de Travas</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Arraste os sliders para simular cenários · Tudo está linkado</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-black/50 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5">Ajustar Benchmarks</Button>
            <Badge variant="outline" className="text-[9px] border-white/10 text-zinc-400 font-black px-4 py-1.5 rounded-full uppercase">{`Bench: ${project.segment}`}</Badge>
          </div>
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
              .map((score) => {
                const isBottleneck = score.trava === ai.trava_identificada;
                const pct = getStatusPercent(score.status);
                const displayVal = formatDisplayValue(score.valor_informado);
                const benchVal = getBenchmarkValue(score.trava);
                return (
                  <TravaSliderCard
                    key={score.trava}
                    trava={score.trava}
                    nome={score.nome}
                    status={score.status}
                    isBottleneck={isBottleneck}
                    pct={pct}
                    displayVal={displayVal}
                    benchVal={benchVal}
                    isRestriction={false}
                  />
                );
              })}
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
              .map((score) => {
                const isBottleneck = score.trava === ai.trava_identificada;
                const pct = getStatusPercent(score.status);
                const displayVal = formatDisplayValue(score.valor_informado);
                const benchVal = getBenchmarkValue(score.trava);
                return (
                  <TravaSliderCard
                    key={score.trava}
                    trava={score.trava}
                    nome={score.nome}
                    status={score.status}
                    isBottleneck={isBottleneck}
                    pct={pct}
                    displayVal={displayVal}
                    benchVal={benchVal}
                    isRestriction={false}
                  />
                );
              })}
          </div>
        </div>

        {/* Bottom: Topo de Funil (01, 00) */}
        <div className="mt-8 pt-6 border-t border-white/10 relative z-10 space-y-5">
          <div className="flex items-center gap-2 text-white mb-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-white">Topo de Funil</span>
          </div>
          {ai.stage_scores
            .filter(s => ['01'].includes(s.trava))
            .map((score) => {
              const isBottleneck = score.trava === ai.trava_identificada;
              const pct = getStatusPercent(score.status);
              const displayVal = formatDisplayValue(score.valor_informado);
              const benchVal = getBenchmarkValue(score.trava);
              return (
                <TravaSliderCard
                  key={score.trava}
                  trava={score.trava}
                  nome={score.nome}
                  status={score.status}
                  isBottleneck={isBottleneck}
                  pct={pct}
                  displayVal={displayVal}
                  benchVal={benchVal}
                  isRestriction={isBottleneck}
                />
              );
            })}
          {/* Cegueira (00) */}
          {ai.stage_scores
            .filter(s => s.trava === 'cegueira' || s.trava === '00')
            .map((score) => {
              const pct = getStatusPercent(score.status);
              const displayVal = formatDisplayValue(score.valor_informado);
              return (
                <TravaSliderCard
                  key={score.trava}
                  trava="00"
                  nome="Cegueira"
                  status={score.status}
                  isBottleneck={false}
                  pct={pct}
                  displayVal={displayVal}
                  benchVal="1.00%"
                  isRestriction={false}
                  isSemiManual
                />
              );
            })}
        </div>
      </Card>

      {/* ═══ SECTION 3: BOWTIE FUNNEL (clip-path trapezoids) ═══ */}
      <div className="bg-zinc-950/50 backdrop-blur-sm border border-white/5 rounded-xl p-4 md:p-6 shadow-2xl md:px-8 md:py-8 w-full">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex flex-col">
            <h5 className="text-[12px] font-black text-white uppercase tracking-widest italic">Fluxo de RECEITA</h5>
            <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Modelagem Dinâmica Bowtie</p>
          </div>
          <div className="hidden sm:flex gap-4">
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[8px] font-black text-zinc-400 uppercase">Eficiente</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-[8px] font-black text-zinc-400 uppercase">Na Média</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /><span className="text-[8px] font-black text-zinc-400 uppercase">Gargalo</span></div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 py-4 px-2 overflow-x-auto">
          {BOWTIE_STAGES.map((stage, idx) => {
            const score = scoreMap.get(stage.trava);
            const status = score?.status || 'sem_dados';
            const isBottleneck = stage.trava === ai.trava_identificada;
            const displayVal = formatDisplayValue(score?.valor_informado);
            const colors = getStageColor(status, isBottleneck);

            return (
              <div key={stage.trava} className="flex items-center">
                <div className="flex flex-col items-center relative gap-2">
                  <span className="text-white/70 text-[10px] text-center font-bold uppercase tracking-tighter">{stage.label}</span>

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
                          ? `bg-gradient-to-br ${colors.bg} to-transparent shadow-[0_0_25px_${colors.glow}] scale-105 z-20 animate-pulse ${colors.border}`
                          : `border-white/5 bg-gradient-to-br ${colors.bg} to-transparent shadow-[0_0_15px_${colors.glow}]`
                      )}
                      style={{ clipPath: stage.clipPath }}
                    >
                      <div className="absolute inset-0 z-0" style={{ background: `radial-gradient(circle, ${isBottleneck ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.05)'}, transparent)`, transform: 'scale(1.2)' }} />
                      <div className="flex flex-col items-center z-10">
                        <span className={cn(
                          "text-lg font-black drop-shadow-lg leading-none",
                          colors.text,
                          isBottleneck && "scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                        )}>
                          {displayVal === 'Sem dados' ? '—' : displayVal.split(',')[0]?.trim() || '—'}
                        </span>
                        <span className="text-white/40 text-[9px] font-bold mt-1">
                          {score ? `${getStatusPercent(score.status)}%` : '—'}
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

      {/* ═══ SECTION 4: SÍNTESE EXECUTIVA ═══ */}
      <Card className="p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <Target className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight italic">Síntese Executiva</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Visão geral do diagnóstico</p>
          </div>
        </div>
        <div className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{ai.sintese}</div>

        {/* UDEs */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h5 className="text-xs font-black text-zinc-500 uppercase tracking-widest">UDEs — Efeitos Indesejáveis Identificados</h5>
          <div className="space-y-2">
            {ai.udes.map((ude, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-red-600/5 border border-red-600/10 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-300 font-medium">{ude}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Métricas Foco */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h5 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Métricas Prioritárias para Monitorar</h5>
          <div className="flex flex-wrap gap-2">
            {ai.metricas_foco.map((m, idx) => (
              <Badge key={idx} variant="outline" className="text-[9px] border-white/10 text-zinc-300 font-bold px-3 py-1 rounded-full">{m}</Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 5: LTP — EVAPORATING CLOUD (Visual Diagram) ═══ */}
      <Card className="p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <GitBranch className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight italic">LTP — Logical Thinking Process</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Baseado na restrição de {ai.trava_nome}</p>
          </div>
        </div>

        {/* CRT — Current Reality Tree (vertical nodes) */}
        <div className="space-y-4">
          <Badge className="bg-red-600/10 text-red-600 border-red-600/20 text-[8px] font-black uppercase">CRT — Cadeia de Realidade Atual</Badge>
          <div className="relative pl-6 space-y-0">
            {ai.ltp_analysis.crt_nodes.map((node, idx) => (
              <div key={idx} className="relative">
                {/* Vertical connector line */}
                {idx < ai.ltp_analysis.crt_nodes.length - 1 && (
                  <div className="absolute left-[-12px] top-8 bottom-0 w-px bg-red-600/30" />
                )}
                {/* Node dot */}
                <div className="absolute left-[-16px] top-3 w-2 h-2 rounded-full bg-red-600 ring-2 ring-red-600/20" />
                <div className={cn(
                  "p-3 mb-2 rounded-xl border text-[11px] text-zinc-300",
                  idx === ai.ltp_analysis.crt_nodes.length - 1 ? "border-red-600/30 bg-red-600/5 font-bold text-white" : "border-white/5 bg-black/30"
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

        {/* EVAPORATING CLOUD — Visual Conflict Diagram */}
        <div className="space-y-4">
          <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/20 text-[8px] font-black uppercase">Evaporating Cloud — Diagrama de Conflito</Badge>

          <div className="relative bg-black/40 border border-white/5 p-8 rounded-2xl">
            {/* Top: Objective */}
            <div className="flex justify-center mb-8">
              <div className="bg-blue-600/10 border border-blue-600/20 px-6 py-3 rounded-2xl text-center max-w-md">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Objetivo Comum</p>
                <p className="text-sm text-white font-bold">{ai.ltp_analysis.evaporating_cloud.objetivo}</p>
              </div>
            </div>

            {/* Middle: Two Needs */}
            <div className="grid grid-cols-2 gap-8 mb-4">
              <div className="flex flex-col items-center gap-2">
                <ArrowDown className="w-4 h-4 text-zinc-600" />
                <div className="bg-emerald-600/10 border border-emerald-600/20 p-4 rounded-2xl text-center w-full">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Necessidade A</p>
                  <p className="text-[11px] text-zinc-300">{ai.ltp_analysis.evaporating_cloud.necessidade_a}</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ArrowDown className="w-4 h-4 text-zinc-600" />
                <div className="bg-purple-600/10 border border-purple-600/20 p-4 rounded-2xl text-center w-full">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Necessidade B</p>
                  <p className="text-[11px] text-zinc-300">{ai.ltp_analysis.evaporating_cloud.necessidade_b}</p>
                </div>
              </div>
            </div>

            {/* Bottom: Two Actions in conflict */}
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div className="flex flex-col items-center gap-2">
                <ArrowDown className="w-4 h-4 text-zinc-600" />
                <div className="bg-emerald-600/5 border border-emerald-600/10 p-4 rounded-2xl text-center w-full">
                  <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">Ação A</p>
                  <p className="text-[11px] text-zinc-400">{ai.ltp_analysis.evaporating_cloud.acao_a}</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ArrowDown className="w-4 h-4 text-zinc-600" />
                <div className="bg-purple-600/5 border border-purple-600/10 p-4 rounded-2xl text-center w-full">
                  <p className="text-[9px] font-black text-purple-500/60 uppercase tracking-widest mb-1">Ação B</p>
                  <p className="text-[11px] text-zinc-400">{ai.ltp_analysis.evaporating_cloud.acao_b}</p>
                </div>
              </div>
            </div>

            {/* Conflict line */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px flex-1 bg-red-500/30" />
              <span className="text-red-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">⚡ CONFLITO</span>
              <div className="h-px flex-1 bg-red-500/30" />
            </div>

            {/* Invalid assumption */}
            <div className="bg-amber-600/5 border border-amber-600/20 p-4 rounded-2xl mb-4">
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Pressuposto Inválido</p>
              <p className="text-[11px] text-zinc-300 italic">"{ai.ltp_analysis.evaporating_cloud.pressuposto_invalido}"</p>
            </div>

            {/* Injection */}
            <div className="bg-emerald-600/10 border border-emerald-600/30 p-5 rounded-2xl shadow-lg shadow-emerald-600/5">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-emerald-500" />
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Injeção que Evapora o Conflito</p>
              </div>
              <p className="text-sm text-white font-bold">{ai.ltp_analysis.evaporating_cloud.injecao}</p>
            </div>
          </div>
        </div>

        {/* FRT Effects */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Efeitos Desejáveis — Future Reality Tree
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ai.ltp_analysis.frt_effects.map((effect, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-xl">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-300">{effect}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Negative Branches */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" /> Riscos Potenciais — Negative Branches
          </h5>
          <div className="space-y-2">
            {ai.ltp_analysis.negative_branches.map((nb, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 bg-amber-600/5 border border-amber-600/10 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-300">{nb}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisite Tree */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-500" /> Pré-Requisitos — Prerequisite Tree
          </h5>
          <div className="relative pl-6 space-y-0">
            {ai.ltp_analysis.prerequisite_tree.map((prt, idx) => (
              <div key={idx} className="relative">
                {idx < ai.ltp_analysis.prerequisite_tree.length - 1 && (
                  <div className="absolute left-[-12px] top-8 bottom-0 w-px bg-blue-600/30" />
                )}
                <div className="absolute left-[-16px] top-3 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                <div className="p-3 mb-2 rounded-xl border border-blue-600/10 bg-blue-600/5 text-[11px] text-zinc-300">
                  {prt}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 6: PLANO 90 DIAS ═══ */}
      <Card className="p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <Zap className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight italic">Plano Estratégico de 90 Dias</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Foco em quebrar a restrição de {ai.trava_nome}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { phase: 'Mês 01', data: ai.plano_90_dias.mes_1 },
            { phase: 'Mês 02', data: ai.plano_90_dias.mes_2 },
            { phase: 'Mês 03', data: ai.plano_90_dias.mes_3 },
          ].map((p, i) => (
            <div key={i} className="bg-black/30 border border-white/5 p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden group hover:border-red-600/20 transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/5 rounded-full blur-3xl group-hover:bg-red-600/10 transition-all" />
              <Badge className="bg-zinc-900 border-white/5 text-zinc-400 text-[9px] font-black uppercase tracking-widest">{p.phase}</Badge>
              <h5 className="text-lg font-black text-white uppercase tracking-tighter italic">{p.data.titulo}</h5>
              <ul className="space-y-3">
                {p.data.acoes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-zinc-500 text-xs font-medium">
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
