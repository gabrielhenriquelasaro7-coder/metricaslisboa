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
  na_media: 'ATENÇÃO',
  bom: 'SAUDÁVEL',
  sem_dados: 'SEM DADOS',
  nao_aplica: 'N/A',
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

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeTravaId = (trava?: string, nome?: string): string => {
  const rawTrava = (trava || '').toString();
  const merged = normalizeText(`${rawTrava} ${nome || ''}`);

  if (!merged) return '00';
  if (merged.includes('cegueira') || merged.includes('sem dados')) return '00';

  // Prioriza IDs canônicos quando vierem do backend (ex: 07, T07, trava_07)
  const digitMatch = rawTrava.match(/(\d{1,2})/);
  if (digitMatch) {
    const num = parseInt(digitMatch[1], 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 7) {
      return String(num).padStart(2, '0');
    }
  }

  // Fallback semântico para respostas descritivas da IA
  if (/(volume.*impress|impress.*cpm|\bexposicao\b|\btopo\b)/.test(merged)) return '01';
  if (/(ctr|cliques|cpc|\batencao\b)/.test(merged)) return '02';
  if (/(\blead\b|cpl|interesse|taxa de conversao)/.test(merged)) return '03';
  if (/(qualificacao|mql)/.test(merged)) return '04';
  if (/(reuniao|visita|coleta de informacao|compromisso|show)/.test(merged)) return '05';
  if (/(fechamento|proposta|decisao|sql)/.test(merged)) return '06';
  if (/(churn|recompra|retencao)/.test(merged)) return '07';

  return '00';
};

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
    default: return { text: 'text-yellow-500', glow: 'rgba(234, 179, 8, 0.2)', bg: 'from-yellow-500/10', border: 'border-border', barColor: 'bg-yellow-500', dotColor: 'bg-yellow-400' };
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

function parsePercentFromValorInformado(valor: string | null | undefined): number | null {
  if (!valor) return null;

  const match = valor.match(/(\d+[\.,]?\d*)\s*%/);
  if (!match) return null;

  const num = parseFloat(match[1].replace(',', '.'));
  return isNaN(num) ? null : num;
}

function getDisplayPercent(score: { status: string; valor_informado?: string | null }, isBottleneck?: boolean): number {
  // Bottleneck (restrição ativa) → always low red zone
  if (isBottleneck) return 17;
  
  // Position based purely on AI-assigned status
  switch (score.status) {
    case 'critico': return 18;
    case 'na_media': return 48;
    case 'bom': return 82;
    default: return 50; // sem_dados — center/gray
  }
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
  isRestriction: boolean;
  isSemiManual?: boolean;
  isNaoAplica?: boolean;
  showMissingAlert?: boolean;
}

function TravaSliderCard({ trava, nome, status, isBottleneck, pct, isRestriction, isSemiManual, isNaoAplica, showMissingAlert }: TravaSliderCardProps) {
  const effectiveStatus = isNaoAplica ? 'nao_aplica' : status;

  const dotColor = isBottleneck || effectiveStatus === 'critico'
    ? 'bg-red-500 dark:shadow-[0_0_12px_rgba(239,68,68,0.8)]'
    : effectiveStatus === 'na_media'
      ? 'bg-amber-500 dark:shadow-[0_0_12px_rgba(245,158,11,0.8)]'
      : effectiveStatus === 'bom'
        ? 'bg-emerald-500 dark:shadow-[0_0_12px_rgba(16,185,129,0.8)]'
        : 'bg-muted-foreground/50';

  const tagColor = isNaoAplica ? "text-blue-400 border-blue-400/20" :
    isSemiManual ? "text-amber-500 border-amber-500/20" :
    isBottleneck || effectiveStatus === 'critico' ? "text-red-500 border-red-500/20" :
    effectiveStatus === 'bom' ? "text-emerald-500 border-emerald-500/20" :
    effectiveStatus === 'na_media' ? "text-amber-500 border-amber-500/20" : "text-muted-foreground border-border";

  const tagLabel = isNaoAplica ? 'N/A' : isSemiManual ? 'Semi-Manual' : isBottleneck ? 'CRÍTICO' : (STATUS_LABELS[effectiveStatus] || 'SEM DADOS');

  return (
    <div className={cn(
      "relative space-y-4 p-5 rounded-[1.5rem] transition-all duration-500 border",
      isRestriction
        ? "bg-red-50/50 dark:bg-red-950/20 border-red-500/30 shadow-sm dark:shadow-[0_0_20px_rgba(220,38,38,0.1)]"
        : isNaoAplica
          ? "bg-muted/30 border-border/50 opacity-60"
          : "bg-card border-border"
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
          tagColor
        )}>
          {tagLabel}
        </div>
      </div>

      <div className="pt-2">
        {isNaoAplica ? (
          <div className="h-3 w-full rounded-full bg-muted/50 shadow-inner" />
        ) : (
          <div className="relative h-3 w-full rounded-full flex items-center bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 shadow-inner" style={{ touchAction: 'none' }}>
            {effectiveStatus !== 'sem_dados' && (
              <div
                className={cn("absolute w-5 h-5 rounded-full border-2 border-white z-10 -translate-x-1/2 pointer-events-none transition-all", dotColor)}
                style={{ left: `${pct}%` }}
              />
            )}
          </div>
        )}
      </div>

      {isNaoAplica && (
        <p className="text-[10px] text-blue-400/70 font-bold">Não aplicável a este modelo de negócio</p>
      )}

      {showMissingAlert && !isNaoAplica && (
        <div className="flex items-center gap-1.5 text-amber-500">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span className="text-[11px] font-bold">Dados não preenchidos — preencha para análise mais precisa</span>
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

  const stageScores = ai.stage_scores || [];
  const scoreMap = new Map(stageScores.map(s => [normalizeTravaId(s.trava, s.nome), s]));

  // REGRA OBRIGATÓRIA: Se 2+ travas têm "sem_dados" (excluindo N/A), forçar cegueira
  const semDadosCount = stageScores.filter(s => {
    const nId = normalizeTravaId(s.trava, s.nome);
    const travaKey = `trava${nId}` as keyof typeof project.funnelData;
    const isNaoAplica = project.funnelData?.[travaKey]?._nao_aplica === true;
    return s.status === 'sem_dados' && !isNaoAplica;
  }).length;

  const activeTrava = semDadosCount >= 2 ? '00' : normalizeTravaId(ai.trava_identificada, ai.trava_nome);

  // Debug: log stage_scores normalization
  console.log('[DiagnosticResults] stage_scores raw:', stageScores.map(s => ({ trava: s.trava, nome: s.nome, normalized: normalizeTravaId(s.trava, s.nome), status: s.status })));
  console.log('[DiagnosticResults] stage_scores count:', stageScores.length);
  console.log('[DiagnosticResults] activeTrava:', activeTrava, 'from:', ai.trava_identificada, ai.trava_nome);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentW = w - margin * 2;
      let y = 0;

      const RED = { r: 220, g: 38, b: 38 };
      const RED_DARK = { r: 153, g: 27, b: 27 };
      const RED_LIGHT = { r: 254, g: 242, b: 242 };
      const BLACK = { r: 17, g: 17, b: 17 };
      const GRAY = { r: 107, g: 114, b: 128 };
      const GRAY_LIGHT = { r: 245, g: 245, b: 245 };
      const WHITE = { r: 255, g: 255, b: 255 };
      const GREEN = { r: 16, g: 185, b: 129 };
      const AMBER = { r: 245, g: 158, b: 11 };
      const BLUE = { r: 59, g: 130, b: 246 };

      const s = (text: string): string => {
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[\u{1F600}-\u{1FAFF}]/gu, '')
          .replace(/[\u{2600}-\u{27BF}]/gu, '')
          .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
          .replace(/[^\x20-\x7E\n]/g, '')
          .trim();
      };

      const addFooter = () => {
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, h - 10, w - margin, h - 10);
        doc.setFontSize(6.5); doc.setTextColor(160, 160, 160); doc.setFont('helvetica', 'normal');
        doc.text(s(`Diagnostico TOC  |  ${project.name}  |  ${new Date().toLocaleDateString('pt-BR')}`), margin, h - 6);
      };

      const addMiniHeader = () => {
        doc.setFillColor(BLACK.r, BLACK.g, BLACK.b);
        doc.rect(0, 0, w, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
        doc.text(s(`DIAGNOSTICO TOC  |  ${project.name}`).toUpperCase(), margin, 6.5);
        doc.setFillColor(RED.r, RED.g, RED.b);
        doc.rect(margin, 9.5, 25, 1, 'F');
        y = 16;
      };

      const safeBottom = 22; // margem de segurança inferior (footer + respiro)
      const checkPage = (need: number = 25) => {
        if (y > h - safeBottom - need) {
          doc.addPage();
          addMiniHeader();
        }
      };

      const sectionHeader = (title: string, color = RED) => {
        checkPage(20);
        doc.setFillColor(color.r, color.g, color.b);
        doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(s(title).toUpperCase(), margin + 4, y + 5.5);
        y += 11;
      };

      // ═══ PAGE 1: COVER ═══
      doc.setFillColor(BLACK.r, BLACK.g, BLACK.b);
      doc.rect(0, 0, w, 55, 'F');
      doc.setFillColor(RED.r, RED.g, RED.b);
      doc.rect(margin, 48, 30, 2, 'F');

      doc.setTextColor(120, 120, 120);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('RELATORIO DE DIAGNOSTICO', margin, 16);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('Teoria das Restricoes', margin, 30);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(s(`${project.name}  |  ${project.segment || '--'}`), margin, 40);
      doc.setFontSize(7); doc.setTextColor(160, 160, 160);
      doc.text(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), w - margin, 40, { align: 'right' });

      // Info cards
      y = 62;
      const cardW = (contentW - 6) / 3;
      [
        { label: 'EMPRESA', value: project.name || '--' },
        { label: 'SEGMENTO', value: project.segment || '--' },
        { label: 'MODELO', value: project.identification?.businessModel || '--' },
      ].forEach((info, i) => {
        const x = margin + i * (cardW + 3);
        doc.setFillColor(GRAY_LIGHT.r, GRAY_LIGHT.g, GRAY_LIGHT.b);
        doc.roundedRect(x, y, cardW, 14, 1.5, 1.5, 'F');
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
        doc.text(info.label, x + 3, y + 5);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
        doc.text(s(info.value).slice(0, 24), x + 3, y + 11);
      });

      // Restricao ativa
      y += 22;
      doc.setFillColor(RED.r, RED.g, RED.b);
      doc.roundedRect(margin, y, contentW, 26, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text('RESTRICAO ATIVA IDENTIFICADA', margin + 5, y + 6);
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(s(TRAVA_NAMES[activeTrava] || ai.trava_nome).toUpperCase(), margin + 5, y + 17);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(s(`Trava ${activeTrava}  |  Confianca: ${(ai.confianca || 'N/A').toUpperCase()}`), margin + 5, y + 23);

      // Core Problem
      y += 32;
      doc.setTextColor(RED.r, RED.g, RED.b);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('CORE PROBLEM', margin, y);
      y += 5;
      doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const cpLines = doc.splitTextToSize(s(ai.razao_core_problem), contentW);
      doc.text(cpLines, margin, y);
      y += cpLines.length * 4.2 + 4;

      // Injecao recomendada
      checkPage(22);
      const injLines = doc.splitTextToSize(s(ai.injecao_recomendada), contentW - 8);
      const injH = injLines.length * 4 + 12;
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(margin, y, contentW, injH, 1.5, 1.5, 'F');
      doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b); doc.setLineWidth(0.4);
      doc.roundedRect(margin, y, contentW, injH, 1.5, 1.5, 'S');
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
      doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
      doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text('INJECAO RECOMENDADA', margin + 4, y + 5);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      doc.text(injLines, margin + 4, y + 10);
      y += injH + 4;

      // Sintese executiva
      checkPage(20);
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y, w - margin, y);
      y += 4;
      doc.setTextColor(RED.r, RED.g, RED.b);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('SINTESE EXECUTIVA', margin, y);
      y += 5;
      doc.setTextColor(60, 60, 60); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      const synLines = doc.splitTextToSize(s(ai.sintese), contentW);
      for (const line of synLines) {
        checkPage(6);
        doc.text(line, margin, y);
        y += 4;
      }

      // ═══ BENCHMARKS TABLE ═══
      y += 6;
      sectionHeader('Benchmarks vs Real', RED);

      const colW4 = [contentW * 0.28, contentW * 0.20, contentW * 0.24, contentW * 0.28];
      const colX = [margin];
      for (let i = 1; i < 4; i++) colX.push(colX[i - 1] + colW4[i - 1]);

      // Table header row
      doc.setFillColor(BLACK.r, BLACK.g, BLACK.b);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('TRAVA', colX[0] + 3, y + 5);
      doc.text('CATEGORIA', colX[1] + 3, y + 5);
      doc.text('STATUS', colX[2] + 3, y + 5);
      doc.text('BENCHMARK', colX[3] + 3, y + 5);
      y += 7;

      ai.stage_scores.forEach((score, idx) => {
        checkPage(8);
        const nId = normalizeTravaId(score.trava, score.nome);
        const isGargalo = nId === activeTrava;

        if (isGargalo) {
          doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
        } else if (idx % 2 === 0) {
          doc.setFillColor(GRAY_LIGHT.r, GRAY_LIGHT.g, GRAY_LIGHT.b);
        } else {
          doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
        }
        doc.rect(margin, y, contentW, 8, 'F');

        doc.setTextColor(BLACK.r, BLACK.g, BLACK.b); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text(s(`${nId} ${TRAVA_NAMES[nId] || score.nome}`), colX[0] + 3, y + 5.5);

        doc.setTextColor(GRAY.r, GRAY.g, GRAY.b); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        doc.text(TRAVA_CATEGORIES[nId] || '--', colX[1] + 3, y + 5.5);

        const statusLabel = isGargalo ? 'GARGALO' : (STATUS_LABELS[score.status] || 'SEM DADOS');
        if (isGargalo || score.status === 'critico') doc.setTextColor(RED.r, RED.g, RED.b);
        else if (score.status === 'bom') doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
        else if (score.status === 'na_media') doc.setTextColor(AMBER.r, AMBER.g, AMBER.b);
        else doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text(statusLabel, colX[2] + 3, y + 5.5);

        doc.setTextColor(GRAY.r, GRAY.g, GRAY.b); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        doc.text(BENCHMARK_DEFAULTS[nId] || '--', colX[3] + 3, y + 5.5);

        y += 8;
      });

      // Thin border around table
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
      const tableH = ai.stage_scores.length * 8 + 7;
      doc.rect(margin, y - tableH, contentW, tableH, 'S');
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);

      // ═══ UDEs ═══
      y += 6;
      sectionHeader('UDEs - Efeitos Indesejaveis');
      doc.setTextColor(60, 60, 60); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      ai.udes.forEach((ude, idx) => {
        checkPage(10);
        if (idx % 2 === 0) {
          doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
          const uLines = doc.splitTextToSize(s(`${idx + 1}. ${ude}`), contentW - 8);
          doc.roundedRect(margin, y - 2.5, contentW, uLines.length * 4 + 3, 1, 1, 'F');
        }
        doc.setTextColor(60, 60, 60); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        const uLines = doc.splitTextToSize(s(`${idx + 1}. ${ude}`), contentW - 8);
        doc.text(uLines, margin + 4, y);
        y += uLines.length * 4 + 3;
      });

      // Metricas prioritarias
      if (ai.metricas_foco.length > 0) {
        y += 4;
        checkPage(16);
        doc.setTextColor(RED.r, RED.g, RED.b);
        doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.text('METRICAS PRIORITARIAS', margin, y);
        y += 5;
        const mCardW = (contentW - 4) / Math.min(ai.metricas_foco.length, 4);
        ai.metricas_foco.slice(0, 4).forEach((m, i) => {
          const x = margin + i * (mCardW + 1);
          doc.setFillColor(GRAY_LIGHT.r, GRAY_LIGHT.g, GRAY_LIGHT.b);
          doc.roundedRect(x, y, mCardW, 10, 1.5, 1.5, 'F');
          doc.setTextColor(BLACK.r, BLACK.g, BLACK.b); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
          doc.text(s(m).slice(0, 22), x + 3, y + 6.5);
        });
        y += 14;
      }

      // ═══ LTP ANALYSIS ═══
      y += 4;

      // CRT
      sectionHeader('Cadeia de Realidade Atual (CRT)', RED);
      ai.ltp_analysis.crt_nodes.forEach((node, idx) => {
        checkPage(12);
        const isLast = idx === ai.ltp_analysis.crt_nodes.length - 1;
        if (isLast) {
          doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
          const nLines = doc.splitTextToSize(s(node), contentW - 12);
          doc.roundedRect(margin, y - 2, contentW, nLines.length * 4 + 8, 1.5, 1.5, 'F');
          doc.setTextColor(RED.r, RED.g, RED.b); doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
          doc.text('CAUSA RAIZ', margin + 4, y + 1);
          y += 4;
          doc.setTextColor(RED_DARK.r, RED_DARK.g, RED_DARK.b); doc.setFontSize(8.5);
          doc.text(nLines, margin + 4, y);
          y += nLines.length * 4 + 4;
        } else {
          const nLines = doc.splitTextToSize(s(`${idx + 1}. ${node}`), contentW - 10);
          doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
          doc.text(nLines, margin + 4, y);
          y += nLines.length * 4 + 2.5;
        }
      });

      // Evaporating Cloud
      y += 4;
      sectionHeader('Evaporating Cloud - Conflito', AMBER);
      const ecFields = [
        { label: 'OBJETIVO', value: ai.ltp_analysis.evaporating_cloud.objetivo, color: BLUE },
        { label: 'NECESSIDADE A', value: ai.ltp_analysis.evaporating_cloud.necessidade_a, color: GREEN },
        { label: 'ACAO A', value: ai.ltp_analysis.evaporating_cloud.acao_a, color: GREEN },
        { label: 'NECESSIDADE B', value: ai.ltp_analysis.evaporating_cloud.necessidade_b, color: { r: 147, g: 51, b: 234 } },
        { label: 'ACAO B', value: ai.ltp_analysis.evaporating_cloud.acao_b, color: { r: 147, g: 51, b: 234 } },
        { label: 'PRESSUPOSTO INVALIDO', value: ai.ltp_analysis.evaporating_cloud.pressuposto_invalido, color: AMBER },
        { label: 'INJECAO', value: ai.ltp_analysis.evaporating_cloud.injecao, color: GREEN },
      ];
      ecFields.forEach(field => {
        checkPage(14);
        doc.setTextColor(field.color.r, field.color.g, field.color.b);
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
        doc.text(field.label, margin + 3, y);
        y += 3.5;
        doc.setTextColor(BLACK.r, BLACK.g, BLACK.b); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        const fLines = doc.splitTextToSize(s(field.value), contentW - 8);
        doc.text(fLines, margin + 3, y);
        y += fLines.length * 4 + 3.5;
      });

      // FRT
      y += 3;
      sectionHeader('Efeitos Desejaveis (FRT)', GREEN);
      ai.ltp_analysis.frt_effects.forEach((e, idx) => {
        checkPage(9);
        doc.setFillColor(240, 253, 244);
        const eLines = doc.splitTextToSize(s(e), contentW - 12);
        doc.roundedRect(margin, y - 2, contentW, eLines.length * 4 + 3, 1, 1, 'F');
        doc.setTextColor(GREEN.r, GREEN.g, GREEN.b); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text(`${idx + 1}.`, margin + 3, y);
        doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text(eLines, margin + 10, y);
        y += eLines.length * 4 + 4;
      });

      // Negative Branches
      y += 3;
      sectionHeader('Riscos - Negative Branches', AMBER);
      ai.ltp_analysis.negative_branches.forEach((nb, idx) => {
        checkPage(9);
        doc.setFillColor(255, 251, 235);
        const nbLines = doc.splitTextToSize(s(nb), contentW - 12);
        doc.roundedRect(margin, y - 2, contentW, nbLines.length * 4 + 3, 1, 1, 'F');
        doc.setTextColor(AMBER.r, AMBER.g, AMBER.b); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text(`${idx + 1}.`, margin + 3, y);
        doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text(nbLines, margin + 10, y);
        y += nbLines.length * 4 + 4;
      });

      // Prerequisite Tree
      if (ai.ltp_analysis.prerequisite_tree.length > 0) {
        y += 3;
        sectionHeader('Prerequisite Tree', BLUE);
        ai.ltp_analysis.prerequisite_tree.forEach((prt, idx) => {
          checkPage(9);
          doc.setTextColor(BLUE.r, BLUE.g, BLUE.b); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
          doc.text(`${idx + 1}.`, margin + 3, y);
          doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
          const prtLines = doc.splitTextToSize(s(prt), contentW - 12);
          doc.text(prtLines, margin + 10, y);
          y += prtLines.length * 4 + 3;
        });
      }

      // ═══ PLANO 90 DIAS ═══
      y += 4;
      sectionHeader(`Plano Estrategico de 90 Dias - ${s(TRAVA_NAMES[activeTrava] || ai.trava_nome)}`, BLACK);

      [
        { phase: 'MES 01', data: ai.plano_90_dias.mes_1, color: RED },
        { phase: 'MES 02', data: ai.plano_90_dias.mes_2, color: AMBER },
        { phase: 'MES 03', data: ai.plano_90_dias.mes_3, color: GREEN },
      ].forEach(p => {
        checkPage(30);
        doc.setFillColor(p.color.r, p.color.g, p.color.b);
        doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
        doc.text(s(`${p.phase} - ${p.data.titulo}`), margin + 4, y + 5.5);
        y += 11;

        p.data.acoes.forEach((a, idx) => {
          checkPage(10);
          if (idx % 2 === 0) {
            doc.setFillColor(GRAY_LIGHT.r, GRAY_LIGHT.g, GRAY_LIGHT.b);
            const aL = doc.splitTextToSize(s(a), contentW - 14);
            doc.roundedRect(margin, y - 2, contentW, aL.length * 4 + 3, 1, 1, 'F');
          }
          doc.setFillColor(p.color.r, p.color.g, p.color.b);
          doc.circle(margin + 4, y, 1, 'F');
          doc.setTextColor(60, 60, 60); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
          const aLines = doc.splitTextToSize(s(a), contentW - 14);
          doc.text(aLines, margin + 8, y);
          y += aLines.length * 4 + 3;
        });
        y += 4;
      });

      // ═══ FOOTER ON ALL PAGES ═══
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, h - 10, w - margin, h - 10);
        doc.setFontSize(6.5); doc.setTextColor(160, 160, 160); doc.setFont('helvetica', 'normal');
        doc.text(s(`Diagnostico TOC  |  ${project.name}  |  ${new Date().toLocaleDateString('pt-BR')}`), margin, h - 6);
        doc.text(`${i}/${totalPages}`, w - margin, h - 6, { align: 'right' });
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
    const normalizedTrava = normalizeTravaId(score.trava, score.nome);
    const isBottleneck = normalizedTrava === activeTrava;
    const pct = getDisplayPercent(score, isBottleneck);
    const travaKey = `trava${normalizedTrava}` as keyof typeof project.funnelData;
    const funnelEntry = project.funnelData?.[travaKey];
    const isNaoAplica = funnelEntry && typeof funnelEntry === 'object' && (funnelEntry as any)._nao_aplica === true;
    const showMissingAlert = score.status === 'sem_dados' && !isNaoAplica;

    return (
      <TravaSliderCard
        key={score.trava}
        trava={normalizedTrava}
        nome={getTravaName(normalizedTrava)}
        status={score.status}
        isBottleneck={isBottleneck && !isNaoAplica}
        pct={pct}
        isRestriction={isBottleneck && !isNaoAplica}
        isNaoAplica={isNaoAplica || false}
        showMissingAlert={showMissingAlert}
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
      <Card className="relative overflow-hidden border-red-600/20 dark:border-red-600/30 shadow-md dark:shadow-[0_0_50px_rgba(220,38,38,0.15)] bg-card rounded-[2.5rem] group w-full">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/3 dark:bg-red-600/5 blur-[120px] pointer-events-none group-hover:bg-red-600/5 dark:group-hover:bg-red-600/10 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-600/2 dark:bg-red-600/3 blur-[100px] pointer-events-none" />

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

            <div className="bg-red-600/5 border border-red-600/20 p-5 rounded-2xl space-y-2">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Injeção Recomendada</p>
              <p className="text-[11px] text-foreground font-semibold leading-relaxed">{ai.injecao_recomendada}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══ SECTION 2: PAINEL DE TRAVAS ═══ */}
      <Card className="p-4 sm:p-5 lg:p-6 bg-card rounded-[2.5rem] relative overflow-hidden flex flex-col shadow-md dark:shadow-2xl w-full">
        <div className="absolute top-0 left-0 w-80 h-80 bg-red-600/3 dark:bg-red-600/5 blur-[120px] pointer-events-none" />
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
            {stageScores
              .filter(s => ['07', '06', '05'].includes(normalizeTravaId(s.trava, s.nome)))
              .sort((a, b) => parseInt(normalizeTravaId(b.trava)) - parseInt(normalizeTravaId(a.trava)))
              .map(score => renderTravaSlider(score))}
            {stageScores.filter(s => ['07', '06', '05'].includes(normalizeTravaId(s.trava, s.nome))).length === 0 && (
              <p className="text-[11px] text-muted-foreground italic p-4">Nenhuma trava encontrada nesta coluna</p>
            )}
          </div>

          {/* Marketing Column (04, 03, 02) */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-amber-500 mb-4 px-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.25em]">Marketing</span>
            </div>
            {stageScores
              .filter(s => ['04', '03', '02'].includes(normalizeTravaId(s.trava, s.nome)))
              .sort((a, b) => parseInt(normalizeTravaId(b.trava)) - parseInt(normalizeTravaId(a.trava)))
              .map(score => renderTravaSlider(score))}
            {stageScores.filter(s => ['04', '03', '02'].includes(normalizeTravaId(s.trava, s.nome))).length === 0 && (
              <p className="text-[11px] text-muted-foreground italic p-4">Nenhuma trava encontrada nesta coluna</p>
            )}
          </div>
        </div>

        {/* Bottom: Topo de Funil (01) */}
        <div className="mt-8 pt-6 border-t border-border relative z-10 space-y-3">
          <div className="flex items-center gap-2 text-foreground/60 mb-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-[0.25em]">Topo de Funil</span>
          </div>
          {stageScores
            .filter(s => normalizeTravaId(s.trava, s.nome) === '01')
            .map(score => renderTravaSlider(score))}
          {stageScores.filter(s => normalizeTravaId(s.trava, s.nome) === '01').length === 0 && (
            <p className="text-[11px] text-muted-foreground italic p-4">Trava 01 não encontrada nos dados</p>
          )}
        </div>

        {/* Bottom: Cegueira (00) */}
        <div className="mt-8 pt-6 border-t border-border relative z-10 space-y-5">
          {stageScores
            .filter(s => s.trava === 'cegueira' || normalizeTravaId(s.trava, s.nome) === '00')
            .map(score => (
              <TravaSliderCard
                key={score.trava}
                trava="00"
                nome="Cegueira"
                status={score.status}
                isBottleneck={false}
                pct={getDisplayPercent(score, false)}
                isRestriction={false}
                isSemiManual
                
              />
            ))}
        </div>
      </Card>

      {/* ═══ SECTION 3: BOWTIE FUNNEL ═══ */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-md dark:shadow-2xl md:px-8 md:py-8 w-full">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex flex-col">
            <h5 className="text-[12px] font-black text-foreground uppercase tracking-widest italic">Fluxo de RECEITA</h5>
            <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Modelagem Dinâmica Bowtie</p>
          </div>
          <div className="hidden sm:flex gap-4">
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[8px] font-black text-muted-foreground uppercase">Saudável</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-[8px] font-black text-muted-foreground uppercase">Atenção</span></div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /><span className="text-[8px] font-black text-muted-foreground uppercase">Crítico</span></div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 py-4 px-2 overflow-x-auto">
          {BOWTIE_STAGES.map((stage, idx) => {
            const score = scoreMap.get(stage.trava);
            const status = score?.status || 'sem_dados';
            const isBottleneck = stage.trava === activeTrava;
            const colors = getStageColor(status, isBottleneck);
            const pct = score ? getDisplayPercent(score, isBottleneck) : getStatusPercent('sem_dados');
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
                        boxShadow: isBottleneck ? `0 0 15px ${colors.glow}` : undefined,
                      }}
                    >
                      <div className="absolute inset-0 z-0" style={{ background: `radial-gradient(circle, ${isBottleneck ? 'rgba(239, 68, 68, 0.4)' : 'rgba(128, 128, 128, 0.05)'}, transparent)`, transform: 'scale(1.2)' }} />
                      <span className={cn(
                        "relative z-10 text-sm font-black drop-shadow-lg",
                        colors.text
                      )}>
                        {stage.trava}
                      </span>
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
      <Card className="p-0 bg-card rounded-[2.5rem] overflow-hidden">
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
                  {stageScores.map(score => {
                    const nId = normalizeTravaId(score.trava, score.nome);
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
      <Card className="p-0 bg-card rounded-[2.5rem] overflow-hidden">
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

            <div className="relative bg-muted/20 dark:bg-muted/40 border border-border p-6 md:p-8 rounded-2xl space-y-8">
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
      <Card className="p-6 bg-card rounded-[2.5rem] space-y-8">
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
            <div key={i} className="bg-muted/20 dark:bg-muted/30 border border-border p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden group hover:border-red-600/20 transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/3 dark:bg-red-600/5 rounded-full blur-3xl group-hover:bg-red-600/5 dark:group-hover:bg-red-600/10 transition-all" />
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
