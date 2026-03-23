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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultsProps {
  project: DiagnosticProject;
  onBack: () => void;
  onEdit: () => void;
}

const TRAVA_NAMES: Record<string, string> = {
  '07': 'Exposição', '06': 'Atenção', '05': 'Interesse',
  '04': 'Qualificação', '03': 'Compromisso', '02': 'Decisão',
  '01': 'Retenção', cegueira: 'Cegueira', mercado: 'Mercado',
};

const STATUS_STYLES: Record<string, string> = {
  critico: 'text-red-500 bg-red-500/10',
  na_media: 'text-amber-500 bg-amber-500/10',
  bom: 'text-emerald-500 bg-emerald-500/10',
  sem_dados: 'text-zinc-500 bg-zinc-500/10',
};

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

      {/* ═══ SECTION 1: RESTRIÇÃO ATIVA ═══ */}
      <Card className="relative overflow-hidden border border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.15)] bg-zinc-950 p-10 rounded-[2.5rem] group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 blur-[120px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="flex-1 space-y-6">
            <div className="flex flex-col gap-2">
              <Badge className="w-fit bg-red-600 text-white border-red-600 text-[10px] font-black tracking-widest uppercase px-3 py-1 animate-pulse shadow-lg shadow-red-600/20">
                Restrição Ativa Identificada
              </Badge>
              <h3 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {ai.trava_nome} <span className="text-zinc-800 text-2xl">({ai.trava_identificada})</span>
              </h3>
              <p className="text-red-500/80 font-black uppercase tracking-[0.3em] flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4" /> Confiança: {ai.confianca}
              </p>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl font-medium">
              {ai.razao_core_problem}
            </p>
          </div>
          <div className="flex flex-col gap-4 min-w-[260px]">
            <div className="bg-black/50 backdrop-blur-md border border-white/5 p-6 rounded-3xl space-y-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Injeção Recomendada</p>
              <p className="text-sm font-bold text-white leading-relaxed">{ai.injecao_recomendada}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 2: PAINEL DE TRAVAS ═══ */}
      <Card className="p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-6">
        <div className="space-y-1">
          <h4 className="text-xl font-black uppercase tracking-tight text-white italic">Painel de Travas</h4>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Análise 07→01 por IA</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ai.stage_scores.map((score, idx) => {
            const isBottleneck = score.trava === ai.trava_identificada;
            return (
              <div key={idx} className={cn(
                "p-5 rounded-2xl border transition-all space-y-3",
                isBottleneck ? "border-red-600/30 bg-red-600/5 shadow-[0_0_20px_rgba(220,38,38,0.1)]" : "border-white/5 bg-black/30"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Trava {score.trava}</span>
                    <span className="text-sm font-black text-white">{score.nome}</span>
                    {isBottleneck && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest", STATUS_STYLES[score.status] || STATUS_STYLES.sem_dados)}>
                    {score.status === 'critico' ? 'Crítico' : score.status === 'na_media' ? 'Na Média' : score.status === 'bom' ? 'Bom' : 'Sem Dados'}
                  </span>
                </div>
                {score.valor_informado && (
                  <p className="text-xs text-zinc-400 font-mono">Valor: {score.valor_informado}</p>
                )}
                <p className="text-[11px] text-zinc-500 leading-relaxed">{score.observacao}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ═══ SECTION 3: SÍNTESE ═══ */}
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
        <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{ai.sintese}</p>

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

      {/* ═══ SECTION 4: LTP ═══ */}
      <Card className="p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <GitBranch className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight italic">LTP — Logical Thinking Process</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Árvore de Realidade baseada na restrição de {ai.trava_nome}</p>
          </div>
        </div>

        {/* CRT + Core Problem + EC */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-4">
            <Badge className="bg-red-600/10 text-red-600 border-red-600/20 text-[8px] font-black uppercase">CRT — Cadeia Causal</Badge>
            <ul className="space-y-2">
              {ai.ltp_analysis.crt_nodes.map((node, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[11px] text-zinc-400">
                  <div className="w-1 h-1 rounded-full bg-red-600 mt-1.5 shrink-0" />
                  {node}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-red-600 border-red-600 p-6 rounded-[2rem] space-y-4 shadow-xl shadow-red-600/20">
            <Badge className="bg-white text-red-600 text-[8px] font-black uppercase">CORE PROBLEM</Badge>
            <p className="text-[13px] font-black text-white uppercase tracking-tighter italic leading-tight">{ai.ltp_analysis.core_problem}</p>
          </Card>

          <Card className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-4">
            <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/20 text-[8px] font-black uppercase">INJEÇÃO (EC)</Badge>
            <p className="text-[11px] font-bold text-white leading-relaxed">{ai.ltp_analysis.evaporating_cloud.injecao}</p>
            <div className="h-px w-full bg-white/5" />
            <p className="text-[10px] text-zinc-500">Pressuposto invalidado: {ai.ltp_analysis.evaporating_cloud.pressuposto_invalido}</p>
          </Card>
        </div>

        {/* Evaporating Cloud Detail */}
        <div className="p-5 bg-black/30 border border-white/5 rounded-2xl space-y-4">
          <h5 className="text-xs font-black text-white uppercase tracking-widest">Evaporating Cloud — Detalhe</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
            <div className="space-y-1"><span className="text-zinc-600 font-black uppercase text-[9px]">Objetivo</span><p className="text-zinc-300">{ai.ltp_analysis.evaporating_cloud.objetivo}</p></div>
            <div className="space-y-1"><span className="text-zinc-600 font-black uppercase text-[9px]">Necessidade A</span><p className="text-zinc-300">{ai.ltp_analysis.evaporating_cloud.necessidade_a}</p></div>
            <div className="space-y-1"><span className="text-zinc-600 font-black uppercase text-[9px]">Necessidade B</span><p className="text-zinc-300">{ai.ltp_analysis.evaporating_cloud.necessidade_b}</p></div>
            <div className="space-y-1"><span className="text-zinc-600 font-black uppercase text-[9px]">Ação A</span><p className="text-zinc-300">{ai.ltp_analysis.evaporating_cloud.acao_a}</p></div>
            <div className="space-y-1"><span className="text-zinc-600 font-black uppercase text-[9px]">Ação B</span><p className="text-zinc-300">{ai.ltp_analysis.evaporating_cloud.acao_b}</p></div>
          </div>
        </div>

        {/* FRT Effects */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Efeitos Desejáveis (FRT)
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
            <ShieldCheck className="w-4 h-4 text-amber-500" /> Riscos Potenciais (Negative Branches)
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
            <ListChecks className="w-4 h-4 text-blue-500" /> Pré-Requisitos (PRT)
          </h5>
          <div className="space-y-2">
            {ai.ltp_analysis.prerequisite_tree.map((prt, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 bg-blue-600/5 border border-blue-600/10 rounded-xl">
                <ListChecks className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-300">{prt}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 5: PLANO 90 DIAS ═══ */}
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
