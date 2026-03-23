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

// Mapeamento oficial das travas (01=topo, 07=fundo)
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

const TRAVA_CATEGORIES: Record<string, string> = {
  '01': 'ATENÇÃO',
  '02': 'INTERESSE',
  '03': 'INTERESSE',
  '04': 'INTERESSE',
  '05': 'COMPROMISSO',
  '06': 'COMPROMISSO',
  '07': 'RETENÇÃO',
  '00': 'CEGUEIRA',
};

const normalizeTravaId = (trava: string) => (trava === 'cegueira' ? '00' : trava);

// Bowtie stages: renderização da esquerda para direita em análise TOC (07 → 01)
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

function parseValorInformado(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const cleaned = valor.replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function getDisplayPercent(score: { status: string; valor_informado?: string | null }): number {
  const realVal = parseValorInformado(score.valor_informado);
  if (realVal !== null) {
    // Clamp between 1 and 99 for slider display
    return Math.max(1, Math.min(99, realVal));
  }
  return getStatusPercent(score.status);
}

const BENCHMARK_DEFAULTS: Record<string, string> = {
  '01': 'CPM: R$18',
  '02': 'CTR: 5.65%',
  '03': 'CVR: 6.60%',
  '04': 'MQL: 25%',
  '05': 'Show: 72%',
  '06': 'Win: 25%',
  '07': 'Churn: 3%',
  '00': 'Cobertura: 80%+',
};

const MARKET_BENCHMARKS: Record<string, { label: string; value: string }> = {
  '01': { label: 'Mercado Global', value: 'CPM médio: $5-15' },
  '02': { label: 'Mercado Global', value: 'CTR médio: 1.5-3.5%' },
  '03': { label: 'Mercado Global', value: 'Conv. Lead: 2-5%' },
  '04': { label: 'Mercado Global', value: 'MQL Rate: 15-30%' },
  '05': { label: 'Mercado Global', value: 'Show Rate: 60-80%' },
  '06': { label: 'Mercado Global', value: 'Close Rate: 20-35%' },
  '07': { label: 'Mercado Global', value: 'Churn mensal: 3-7%' },
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
      const h = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentW = w - margin * 2;
      let y = 0;

      // ── COVER PAGE ──
      // Dark header band
      doc.setFillColor(17, 17, 17);
      doc.rect(0, 0, w, 90, 'F');
      // Red accent line
      doc.setFillColor(220, 38, 38);
      doc.rect(margin, 70, 40, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('RELATÓRIO DE DIAGNÓSTICO', margin, 30);
      doc.setFontSize(28); doc.setFont('helvetica', 'bold');
      doc.text('Teoria das Restrições', margin, 50);
      doc.setFontSize(12); doc.setFont('helvetica', 'normal');
      doc.text(`${project.name} · ${project.segment}`, margin, 63);

      // Info below header
      doc.setTextColor(100, 100, 100);
      y = 105;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('EMPRESA', margin, y);
      doc.text('SEGMENTO', margin + 60, y);
      doc.text('MODELO', margin + 120, y);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(project.name || '—', margin, y);
      doc.text(project.segment || '—', margin + 60, y);
      doc.text(project.identification?.businessModel || '—', margin + 120, y);

      // ── RESTRIÇÃO IDENTIFICADA ──
      y += 20;
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(margin, y, contentW, 35, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('RESTRIÇÃO ATIVA IDENTIFICADA', margin + 8, y + 10);
      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text((TRAVA_NAMES[activeTrava] || ai.trava_nome).toUpperCase(), margin + 8, y + 25);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Trava ${activeTrava} · Confiança: ${ai.confianca?.toUpperCase() || 'N/A'}`, margin + 8, y + 32);

      // ── CORE PROBLEM ──
      y += 45;
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('CORE PROBLEM', margin, y);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      y += 6;
      const cpLines = doc.splitTextToSize(ai.razao_core_problem, contentW);
      doc.text(cpLines, margin, y);
      y += cpLines.length * 5 + 6;

      // ── INJEÇÃO RECOMENDADA ──
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('INJEÇÃO RECOMENDADA', margin, y);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      y += 6;
      const injLines = doc.splitTextToSize(ai.injecao_recomendada, contentW);
      doc.text(injLines, margin, y);
      y += injLines.length * 5 + 10;

      // ── SÍNTESE EXECUTIVA ──
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, w - margin, y);
      y += 8;
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('SÍNTESE EXECUTIVA', margin, y);
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      y += 6;
      const synLines = doc.splitTextToSize(ai.sintese, contentW);
      for (const line of synLines) {
        if (y > h - 25) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 4.5;
      }

      // ── PAGE 2: BENCHMARKS TABLE ──
      doc.addPage();
      y = margin;
      doc.setFillColor(17, 17, 17);
      doc.rect(0, 0, w, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('BENCHMARKS VS REAL', margin, 10);
      doc.setTextColor(30, 30, 30);
      y = 25;

      // Table header
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text('TRAVA', margin + 3, y + 5.5);
      doc.text('STATUS', margin + 55, y + 5.5);
      doc.text('BENCHMARK', w - margin - 3, y + 5.5, { align: 'right' });
      y += 8;

      // Table rows
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      ai.stage_scores.forEach((score, idx) => {
        const nId = normalizeTravaId(score.trava);
        const isGargalo = nId === activeTrava;
        if (isGargalo) {
          doc.setFillColor(254, 242, 242);
          doc.rect(margin, y, contentW, 9, 'F');
        } else if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, y, contentW, 9, 'F');
        }
        doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold');
        doc.text(`${nId} ${TRAVA_NAMES[nId] || score.nome}`, margin + 3, y + 6);
        const statusLabel = isGargalo ? 'GARGALO' : (STATUS_LABELS[score.status] || 'SEM DADOS');
        if (isGargalo) doc.setTextColor(220, 38, 38);
        else if (score.status === 'bom') doc.setTextColor(16, 185, 129);
        else if (score.status === 'na_media') doc.setTextColor(245, 158, 11);
        else doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'bold');
        doc.text(statusLabel, margin + 55, y + 6);
        doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal');
        doc.text(BENCHMARK_DEFAULTS[nId] || '—', w - margin - 3, y + 6, { align: 'right' });
        y += 9;
      });

      // ── UDEs ──
      y += 10;
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('UDEs — EFEITOS INDESEJÁVEIS', margin, y);
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      y += 6;
      ai.udes.forEach(ude => {
        if (y > h - 20) { doc.addPage(); y = margin; }
        const udeLines = doc.splitTextToSize(`• ${ude}`, contentW - 5);
        doc.text(udeLines, margin + 3, y);
        y += udeLines.length * 4.5 + 2;
      });

      // ── PAGE 3: LTP ANALYSIS ──
      doc.addPage();
      y = margin;
      doc.setFillColor(17, 17, 17);
      doc.rect(0, 0, w, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('LTP — LOGICAL THINKING PROCESS', margin, 10);
      y = 25;

      // CRT
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('CADEIA DE REALIDADE ATUAL (CRT)', margin, y);
      y += 6; doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      ai.ltp_analysis.crt_nodes.forEach((node, idx) => {
        if (y > h - 20) { doc.addPage(); y = margin; }
        const prefix = idx === ai.ltp_analysis.crt_nodes.length - 1 ? '◉ ' : `${idx + 1}. `;
        const nLines = doc.splitTextToSize(`${prefix}${node}`, contentW - 5);
        doc.text(nLines, margin + 3, y);
        y += nLines.length * 4.5 + 2;
      });

      // Evaporating Cloud
      y += 6;
      if (y > h - 60) { doc.addPage(); y = margin; }
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('EVAPORATING CLOUD', margin, y);
      y += 8;

      const ecFields = [
        { label: 'OBJETIVO', value: ai.ltp_analysis.evaporating_cloud.objetivo },
        { label: 'NECESSIDADE A', value: ai.ltp_analysis.evaporating_cloud.necessidade_a },
        { label: 'AÇÃO A', value: ai.ltp_analysis.evaporating_cloud.acao_a },
        { label: 'NECESSIDADE B', value: ai.ltp_analysis.evaporating_cloud.necessidade_b },
        { label: 'AÇÃO B', value: ai.ltp_analysis.evaporating_cloud.acao_b },
        { label: 'PRESSUPOSTO INVÁLIDO', value: ai.ltp_analysis.evaporating_cloud.pressuposto_invalido },
        { label: 'INJEÇÃO', value: ai.ltp_analysis.evaporating_cloud.injecao },
      ];
      ecFields.forEach(field => {
        if (y > h - 20) { doc.addPage(); y = margin; }
        doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.text(field.label, margin + 3, y);
        y += 4;
        doc.setTextColor(30, 30, 30); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        const fLines = doc.splitTextToSize(field.value, contentW - 8);
        doc.text(fLines, margin + 3, y);
        y += fLines.length * 4.5 + 4;
      });

      // FRT
      y += 4;
      if (y > h - 30) { doc.addPage(); y = margin; }
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('EFEITOS DESEJÁVEIS (FRT)', margin, y);
      y += 6; doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      ai.ltp_analysis.frt_effects.forEach(e => {
        if (y > h - 15) { doc.addPage(); y = margin; }
        const eLines = doc.splitTextToSize(`✓ ${e}`, contentW - 5);
        doc.text(eLines, margin + 3, y);
        y += eLines.length * 4.5 + 2;
      });

      // Negative Branches
      y += 4;
      if (y > h - 30) { doc.addPage(); y = margin; }
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('RISCOS — NEGATIVE BRANCHES', margin, y);
      y += 6; doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      ai.ltp_analysis.negative_branches.forEach(nb => {
        if (y > h - 15) { doc.addPage(); y = margin; }
        const nbLines = doc.splitTextToSize(`⚠ ${nb}`, contentW - 5);
        doc.text(nbLines, margin + 3, y);
        y += nbLines.length * 4.5 + 2;
      });

      // ── PAGE 4: PLANO 90 DIAS ──
      doc.addPage();
      y = margin;
      doc.setFillColor(17, 17, 17);
      doc.rect(0, 0, w, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('PLANO ESTRATÉGICO DE 90 DIAS', margin, 10);
      y = 25;

      [
        { phase: 'MÊS 01', data: ai.plano_90_dias.mes_1 },
        { phase: 'MÊS 02', data: ai.plano_90_dias.mes_2 },
        { phase: 'MÊS 03', data: ai.plano_90_dias.mes_3 },
      ].forEach(p => {
        if (y > h - 40) { doc.addPage(); y = margin; }
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, y, contentW, 8, 2, 2, 'F');
        doc.setTextColor(220, 38, 38); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(`${p.phase} — ${p.data.titulo}`, margin + 4, y + 5.5);
        y += 12;
        doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        p.data.acoes.forEach(a => {
          if (y > h - 15) { doc.addPage(); y = margin; }
          const aLines = doc.splitTextToSize(`• ${a}`, contentW - 10);
          doc.text(aLines, margin + 6, y);
          y += aLines.length * 4.5 + 2;
        });
        y += 6;
      });

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(180, 180, 180); doc.setFont('helvetica', 'normal');
        doc.text(`Diagnóstico TOC · ${project.name} · Página ${i}/${totalPages}`, w / 2, h - 8, { align: 'center' });
      }

      doc.save(`diagnostico-${project.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (e) {
      console.error('PDF export error:', e);
      toast.error('Erro ao gerar PDF');
    }
  };

  const getTravaName = (trava: string): string => TRAVA_NAMES[normalizeTravaId(trava)] || trava;

  const renderTravaSlider = (score: { trava: string; nome: string; status: string; valor_informado?: string | null }) => {
    const normalizedTrava = normalizeTravaId(score.trava);
    const isBottleneck = normalizedTrava === activeTrava;
    const pct = getDisplayPercent(score);
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
      <Card className="relative overflow-hidden border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.15)] dark:bg-zinc-950 bg-white rounded-[2.5rem] group w-full">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 blur-[120px] pointer-events-none group-hover:bg-red-600/10 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-600/3 blur-[100px] pointer-events-none" />

        <div className="relative z-10 p-8 md:p-10 space-y-8">
          {/* Top: Badge + Title */}
          <div className="space-y-4">
            <Badge className="w-fit bg-red-600 text-white border-red-600 text-[10px] font-black tracking-widest uppercase px-3 py-1 animate-pulse shadow-lg shadow-red-600/20">
              Restrição Ativa Identificada
            </Badge>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="text-5xl md:text-7xl font-black text-foreground uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {getTravaName(activeTrava)}
              </h3>
              <span className="text-muted-foreground/40 text-lg font-black">({activeTrava})</span>
            </div>
            <p className="text-red-500/80 font-black uppercase tracking-[0.3em] flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4" /> Confiança: {ai.confianca?.toUpperCase()}
            </p>
          </div>

          {/* Middle: Core problem text */}
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-3xl">
            {ai.razao_core_problem}
          </p>

          {/* Bottom: Cards row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card/80 backdrop-blur-sm border border-border p-5 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Benchmark de Mercado</p>
              </div>
              <p className="text-sm text-foreground font-bold">{getTravaName(activeTrava)}</p>
              <p className="text-[10px] text-muted-foreground">
                Segmento <span className="text-foreground font-bold">{project.segment}</span> · {MARKET_BENCHMARKS[activeTrava]?.value || 'N/A'}
              </p>
            </div>

            <div className="bg-red-600/5 dark:bg-red-950/20 border border-red-600/20 p-5 rounded-2xl space-y-2">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Injeção Recomendada</p>
              <p className="text-[11px] text-foreground font-semibold leading-relaxed">{ai.injecao_recomendada}</p>
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
          {/* Vendas / CS Column (07, 06, 05) */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-red-600 mb-4 px-1">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.25em]">Vendas / CS</span>
            </div>
            {ai.stage_scores
              .filter(s => ['07', '06', '05'].includes(normalizeTravaId(s.trava)))
              .sort((a, b) => parseInt(normalizeTravaId(b.trava)) - parseInt(normalizeTravaId(a.trava)))
              .map(score => renderTravaSlider(score))}
          </div>

          {/* Marketing Column (04, 03, 02) */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-amber-500 mb-4 px-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.25em]">Marketing</span>
            </div>
            {ai.stage_scores
              .filter(s => ['04', '03', '02'].includes(normalizeTravaId(s.trava)))
              .sort((a, b) => parseInt(normalizeTravaId(b.trava)) - parseInt(normalizeTravaId(a.trava)))
              .map(score => renderTravaSlider(score))}
          </div>
        </div>

        {/* Bottom: Topo de Funil (01) */}
        <div className="mt-8 pt-6 border-t border-border relative z-10 space-y-3">
          <div className="flex items-center gap-2 text-foreground/60 mb-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-[0.25em]">Topo de Funil</span>
          </div>
          {ai.stage_scores
            .filter(s => normalizeTravaId(s.trava) === '01')
            .map(score => renderTravaSlider(score))}
        </div>

        {/* Bottom: Cegueira (00) */}
        <div className="mt-8 pt-6 border-t border-border relative z-10 space-y-5">
          {ai.stage_scores
            .filter(s => s.trava === 'cegueira' || normalizeTravaId(s.trava) === '00')
            .map(score => (
              <TravaSliderCard
                key={score.trava}
                trava="00"
                nome="Cegueira"
                status={score.status}
                isBottleneck={false}
                pct={getStatusPercent(score.status)}
                benchVal="Cobertura: 80%+"
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
            const pct = score ? getStatusPercent(score.status) : getStatusPercent('sem_dados');
            const mainValue = pct.toFixed(2);
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
                      <div className="flex flex-col items-center z-10 gap-1">
                        <span className={cn(
                          "text-lg font-black drop-shadow-lg leading-none",
                          colors.text,
                          isBottleneck && "scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                        )}>
                          {mainValue}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground/70 leading-none">
                          {mainValue}%
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
                      <line x1="4" y1="10" x2="20" y2="10" stroke="#eab308" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                      <polygon points="20,10 14,7 14,13" fill="#eab308" opacity="0.6" />
                    </svg>
                    <div className="absolute -right-1 w-1.5 h-1.5 rounded-full animate-pulse z-20 bg-yellow-400" style={{ boxShadow: 'rgb(234, 179, 8) 0px 0px 10px' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SECTION 4: SÍNTESE + ECONOMICS ═══ */}
      <Card className="p-0 dark:bg-zinc-950 bg-white rounded-[2.5rem] overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-r from-red-600/10 via-transparent to-transparent p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
              <Target className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 className="text-lg font-black text-foreground uppercase tracking-tight italic">Síntese Executiva</h4>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Visão geral do diagnóstico</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Síntese text — formatted paragraphs */}
          <div className="bg-muted/20 border border-border rounded-2xl p-6">
            {ai.sintese.split('\n\n').filter(Boolean).map((paragraph, idx) => (
              <p key={idx} className={cn(
                "text-sm leading-relaxed",
                idx === 0 ? "text-foreground font-semibold" : "text-muted-foreground mt-4"
              )}>
                {paragraph.trim()}
              </p>
            ))}
          </div>

          {/* Benchmarks vs Real Table — full width */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-foreground uppercase tracking-widest italic ml-2">Benchmarks vs Real</h4>
            <div className="bg-muted/20 border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest">Trava</th>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest">Nº</th>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest">Categoria</th>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest text-center">Status</th>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest text-center">Mercado</th>
                    <th className="px-5 py-3 font-black text-muted-foreground uppercase tracking-widest text-right">Benchmark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ai.stage_scores.map(score => {
                    const nId = normalizeTravaId(score.trava);
                    const isGargalo = nId === activeTrava;
                    return (
                      <tr key={score.trava} className={cn("hover:bg-muted/20 transition-colors", isGargalo && "bg-red-600/5")}>
                        <td className="px-5 py-3.5 font-black text-foreground">{getTravaName(score.trava)}</td>
                        <td className="px-5 py-3.5 text-muted-foreground font-mono text-[10px]">{nId}</td>
                        <td className="px-5 py-3.5 text-muted-foreground text-[9px] font-bold uppercase tracking-widest">{TRAVA_CATEGORIES[nId] || '—'}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                            isGargalo ? "text-red-500 bg-red-500/10" :
                            score.status === 'critico' ? "text-red-500 bg-red-500/10" :
                            score.status === 'bom' ? "text-emerald-500 bg-emerald-500/10" :
                            score.status === 'na_media' ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground bg-muted"
                          )}>
                            {isGargalo ? 'Gargalo' : STATUS_LABELS[score.status] || 'Sem Dados'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center text-[10px] text-muted-foreground">{MARKET_BENCHMARKS[nId]?.value || '—'}</td>
                        <td className="px-5 py-3.5 font-mono text-muted-foreground text-right">{BENCHMARK_DEFAULTS[nId] || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* UDEs */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h5 className="text-xs font-black text-muted-foreground uppercase tracking-widest">UDEs — Efeitos Indesejáveis Identificados</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        </div>
      </Card>

      {/* ═══ SECTION 5: LTP — LOGICAL THINKING PROCESS ═══ */}
      {/* CRT + Core Problem */}
      <Card className="p-0 dark:bg-zinc-950 bg-white rounded-[2.5rem] overflow-hidden">
        <div className="bg-gradient-to-r from-red-600/10 via-transparent to-transparent p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
              <GitBranch className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 className="text-lg font-black text-foreground uppercase tracking-tight italic">LTP — Logical Thinking Process</h4>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Baseado na restrição de {getTravaName(activeTrava)}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* CRT — Timeline */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                <span className="text-[9px] font-black text-red-600">CRT</span>
              </div>
              <span className="text-xs font-black text-foreground uppercase tracking-widest">Cadeia de Realidade Atual</span>
            </div>
            <div className="relative pl-8 space-y-0">
              {ai.ltp_analysis.crt_nodes.map((node, idx) => {
                const isLast = idx === ai.ltp_analysis.crt_nodes.length - 1;
                return (
                  <div key={idx} className="relative">
                    {!isLast && (
                      <div className="absolute left-[-16px] top-10 bottom-0 w-px bg-gradient-to-b from-red-600/40 to-red-600/10" />
                    )}
                    <div className={cn(
                      "absolute left-[-20px] top-4 w-3 h-3 rounded-full border-2",
                      isLast ? "bg-red-600 border-red-600 ring-4 ring-red-600/20" : "bg-card border-red-600/40"
                    )} />
                    <div className={cn(
                      "p-4 mb-3 rounded-xl border text-[12px] leading-relaxed",
                      isLast
                        ? "border-red-600/30 bg-red-600/5 font-bold text-foreground shadow-sm"
                        : "border-border bg-muted/20 text-foreground/80"
                    )}>
                      {isLast && <span className="text-[8px] font-black text-red-500 uppercase tracking-widest block mb-1">Causa Raiz ↓</span>}
                      {node}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CORE PROBLEM */}
          <div className="bg-red-600 p-6 rounded-2xl space-y-3 shadow-xl shadow-red-600/20">
            <Badge className="bg-white text-red-600 text-[8px] font-black uppercase">CORE PROBLEM</Badge>
            <p className="text-[14px] font-black text-white uppercase tracking-tight italic leading-snug">{ai.ltp_analysis.core_problem}</p>
          </div>

          {/* EVAPORATING CLOUD — Visual Diagram */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-600/10 rounded-lg flex items-center justify-center">
                <span className="text-[9px] font-black text-amber-600">EC</span>
              </div>
              <span className="text-xs font-black text-foreground uppercase tracking-widest">Evaporating Cloud — Diagrama de Conflito</span>
            </div>

            <div className="relative bg-gradient-to-b from-muted/40 to-muted/10 border border-border p-6 md:p-8 rounded-2xl space-y-8">
              {/* Objective — centered top */}
              <div className="flex justify-center">
                <div className="bg-blue-600/10 border-2 border-blue-600/30 px-8 py-5 rounded-2xl text-center max-w-lg shadow-lg shadow-blue-600/5 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[7px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full">Objetivo</div>
                  <p className="text-sm text-foreground font-bold leading-relaxed mt-1">{ai.ltp_analysis.evaporating_cloud.objetivo}</p>
                </div>
              </div>

              {/* Connection lines text */}
              <div className="flex justify-center">
                <div className="flex items-center gap-6">
                  <div className="h-6 w-px bg-gradient-to-b from-emerald-600/50 to-emerald-600/10" />
                  <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Para isso, precisamos de...</span>
                  <div className="h-6 w-px bg-gradient-to-b from-purple-600/50 to-purple-600/10" />
                </div>
              </div>

              {/* Two Needs + Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Side A */}
                <div className="space-y-4">
                  <div className="bg-emerald-600/10 border-2 border-emerald-600/25 p-5 rounded-2xl relative">
                    <div className="absolute -top-2.5 left-4 bg-emerald-600 text-white text-[7px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">Necessidade A</div>
                    <p className="text-[12px] text-foreground font-semibold leading-relaxed mt-1">{ai.ltp_analysis.evaporating_cloud.necessidade_a}</p>
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-px h-3 bg-emerald-600/30" />
                      <span className="text-[7px] text-emerald-600/50 font-black uppercase">exige</span>
                      <div className="w-px h-3 bg-emerald-600/30" />
                    </div>
                  </div>
                  <div className="bg-emerald-600/5 border border-emerald-600/15 p-5 rounded-2xl">
                    <p className="text-[8px] font-black text-emerald-500/60 uppercase tracking-[0.2em] mb-2">Ação A</p>
                    <p className="text-[11px] text-foreground/70 leading-relaxed">{ai.ltp_analysis.evaporating_cloud.acao_a}</p>
                  </div>
                </div>

                {/* Side B */}
                <div className="space-y-4">
                  <div className="bg-purple-600/10 border-2 border-purple-600/25 p-5 rounded-2xl relative">
                    <div className="absolute -top-2.5 left-4 bg-purple-600 text-white text-[7px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">Necessidade B</div>
                    <p className="text-[12px] text-foreground font-semibold leading-relaxed mt-1">{ai.ltp_analysis.evaporating_cloud.necessidade_b}</p>
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-px h-3 bg-purple-600/30" />
                      <span className="text-[7px] text-purple-600/50 font-black uppercase">exige</span>
                      <div className="w-px h-3 bg-purple-600/30" />
                    </div>
                  </div>
                  <div className="bg-purple-600/5 border border-purple-600/15 p-5 rounded-2xl">
                    <p className="text-[8px] font-black text-purple-500/60 uppercase tracking-[0.2em] mb-2">Ação B</p>
                    <p className="text-[11px] text-foreground/70 leading-relaxed">{ai.ltp_analysis.evaporating_cloud.acao_b}</p>
                  </div>
                </div>
              </div>

              {/* Conflict Banner */}
              <div className="relative py-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-dashed border-red-500/25" />
                </div>
                <div className="relative flex justify-center">
                  <span className="text-red-500 text-[10px] font-black uppercase tracking-widest px-5 py-2 bg-card border-2 border-red-500/30 rounded-full shadow-lg shadow-red-500/10">
                    ⚡ CONFLITO — As ações são mutuamente exclusivas
                  </span>
                </div>
              </div>

              {/* Invalid Assumption */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500/30 p-6 rounded-2xl relative">
                <div className="absolute -top-2.5 left-4 bg-amber-500 text-white text-[7px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">Pressuposto Inválido</div>
                <p className="text-[13px] text-amber-800 dark:text-amber-200 italic font-semibold leading-relaxed mt-1">"{ai.ltp_analysis.evaporating_cloud.pressuposto_invalido}"</p>
                <p className="text-[9px] text-amber-600/60 dark:text-amber-400/40 mt-3 font-bold uppercase tracking-widest">Este pressuposto é falso. Ao invalidá-lo, o conflito evapora.</p>
              </div>

              {/* Injection */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500/30 p-6 rounded-2xl shadow-lg shadow-emerald-600/10 relative">
                <div className="absolute -top-2.5 left-4 bg-emerald-600 text-white text-[7px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" /> Injeção
                </div>
                <p className="text-sm text-foreground font-bold leading-relaxed mt-1">{ai.ltp_analysis.evaporating_cloud.injecao}</p>
              </div>
            </div>
          </div>

          {/* FRT + NB + PRT in tabs-like sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* FRT Effects */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-600/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Future Reality Tree</span>
              </div>
              <div className="space-y-2">
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
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-amber-600/10 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Negative Branches</span>
              </div>
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
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600/10 rounded-lg flex items-center justify-center">
                  <ListChecks className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Prerequisite Tree</span>
              </div>
              <div className="relative pl-6 space-y-0">
                {ai.ltp_analysis.prerequisite_tree.map((prt, idx) => (
                  <div key={idx} className="relative">
                    {idx < ai.ltp_analysis.prerequisite_tree.length - 1 && (
                      <div className="absolute left-[-12px] top-8 bottom-0 w-px bg-blue-600/20" />
                    )}
                    <div className="absolute left-[-16px] top-3 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                    <div className="p-3 mb-2 rounded-xl border border-blue-600/10 bg-blue-600/5 text-[11px] text-foreground/70">
                      {prt}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
