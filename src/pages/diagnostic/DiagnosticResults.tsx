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

const BOWTIE_STAGES = [
  { trava: '07', label: 'EXPOSIÇÃO' },
  { trava: '06', label: 'ATENÇÃO' },
  { trava: '05', label: 'INTERESSE' },
  { trava: '04', label: 'QUALIFICAÇÃO' },
  { trava: '03', label: 'COMPROMISSO' },
  { trava: '02', label: 'DECISÃO' },
  { trava: '01', label: 'RETENÇÃO' },
];

function formatDisplayValue(val: string | null | undefined): string {
  if (!val || val === 'null' || val === 'undefined' || val === '0.00') return 'Sem dados';
  return val;
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
      <Card className="p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-black uppercase tracking-tight text-white italic">Painel de Travas</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Saúde de cada estágio do funil · Real vs Benchmark</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Marketing column */}
          <div className="space-y-5">
            <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-amber-500/20 pb-2">Marketing</h5>
            {marketingTravas.map((score) => {
              const isBottleneck = score.trava === ai.trava_identificada;
              const pct = getStatusPercent(score.status);
              const displayVal = formatDisplayValue(score.valor_informado);

              return (
                <div key={score.trava} className={cn(
                  "p-4 rounded-2xl border space-y-3 transition-all",
                  isBottleneck ? "border-red-600/40 bg-red-600/5" : "border-white/5 bg-black/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 font-black">T{score.trava}</span>
                      <span className="text-sm font-black text-white">{score.nome}</span>
                      {isBottleneck && <Badge className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0 border-0">GARGALO</Badge>}
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase border", getStatusBadgeColor(score.status))}>
                      {STATUS_LABELS[score.status] || 'SEM DADOS'}
                    </span>
                  </div>

                  <div className="relative h-3 rounded-full bg-zinc-900 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)',
                    }} />
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Real: <span className="text-white font-bold">{displayVal}</span></span>
                    <span className="text-zinc-600">{score.observacao?.slice(0, 50) || 'Sem observação'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vendas/CS column */}
          <div className="space-y-5">
            <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-500/20 pb-2">Vendas / CS</h5>
            {vendasTravas.map((score) => {
              const isBottleneck = score.trava === ai.trava_identificada;
              const pct = getStatusPercent(score.status);
              const displayVal = formatDisplayValue(score.valor_informado);

              return (
                <div key={score.trava} className={cn(
                  "p-4 rounded-2xl border space-y-3 transition-all",
                  isBottleneck ? "border-red-600/40 bg-red-600/5" : "border-white/5 bg-black/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 font-black">T{score.trava}</span>
                      <span className="text-sm font-black text-white">{score.nome}</span>
                      {isBottleneck && <Badge className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0 border-0">GARGALO</Badge>}
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase border", getStatusBadgeColor(score.status))}>
                      {STATUS_LABELS[score.status] || 'SEM DADOS'}
                    </span>
                  </div>

                  <div className="relative h-3 rounded-full bg-zinc-900 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)',
                    }} />
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Real: <span className="text-white font-bold">{displayVal}</span></span>
                    <span className="text-zinc-600">{score.observacao?.slice(0, 50) || 'Sem observação'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 3: BOWTIE FUNNEL ═══ */}
      <Card className="p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-black uppercase tracking-tight text-white italic">Fluxo de Receita</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Modelagem Dinâmica Bowtie</p>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Eficiente</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Na Média</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Gargalo</span>
          </div>
        </div>

        <div className="flex items-stretch justify-between gap-1.5 overflow-x-auto pb-2">
          {BOWTIE_STAGES.map((stage, idx) => {
            const score = scoreMap.get(stage.trava);
            const status = score?.status || 'sem_dados';
            const isBottleneck = stage.trava === ai.trava_identificada;
            const displayVal = formatDisplayValue(score?.valor_informado);

            // Perspective widths — wider at edges, narrower at center
            const centerIdx = 3;
            const distFromCenter = Math.abs(idx - centerIdx);
            const widthPct = 80 + distFromCenter * 8;

            return (
              <div key={stage.trava} className="flex flex-col items-center gap-2 flex-1 min-w-[90px]">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{stage.label}</span>

                <div className="relative flex flex-col items-center justify-center flex-1 w-full">
                  {/* Trapezoid bar */}
                  <div
                    className={cn(
                      "relative w-full rounded-xl border-2 flex flex-col items-center justify-center py-6 px-2 transition-all min-h-[130px]",
                      isBottleneck
                        ? "border-red-500 bg-red-500/10 shadow-[0_0_25px_rgba(239,68,68,0.25)]"
                        : status === 'bom' ? "border-emerald-500/30 bg-emerald-500/5"
                        : status === 'na_media' ? "border-amber-500/30 bg-amber-500/5"
                        : status === 'critico' ? "border-red-500/30 bg-red-500/5"
                        : "border-zinc-700/30 bg-zinc-800/10"
                    )}
                    style={{ width: `${widthPct}%`, margin: '0 auto' }}
                  >
                    {/* Yellow side bars */}
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-amber-500/60 rounded-full" />
                    <div className="absolute right-0 top-3 bottom-3 w-1 bg-amber-500/60 rounded-full" />

                    <span className={cn("text-2xl font-black leading-none", getBowtieTextColor(status))}>
                      {displayVal}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-medium mt-1 text-center leading-tight max-w-[80px] line-clamp-2">
                      {score?.observacao ? score.observacao.slice(0, 30) : 'Aguardando dados'}
                    </span>
                  </div>

                  {/* Arrow to next */}
                  {idx < BOWTIE_STAGES.length - 1 && (
                    <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="w-4 h-4 text-zinc-700" />
                    </div>
                  )}
                </div>

                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                  isBottleneck ? "text-red-500 bg-red-500/10" : getStatusBadgeColor(status)
                )}>
                  {isBottleneck ? 'GARGALO' : STATUS_LABELS[status] || 'SEM DADOS'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

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
