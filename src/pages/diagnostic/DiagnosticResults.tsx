import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import { DiagnosticProject } from '@/types/diagnostic';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
    ChevronLeft,
    Download,
    Share2,
    AlertTriangle,
    Zap,
    BarChart3,
    Target,
    TrendingUp,
    ArrowLeftRight,
    ShieldCheck,
    GitBranch,
    ChevronRight,
    Cloud,
    ListChecks,
    History,
    Info,
    Users,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    createDefaultBenchmarkConfigFromSeed,
    BenchmarkStatus,
    calculateRatio,
    getStageName,
    getStageReason,
    getStageNum,
    getStageInjection,
    getStageLabel,
    getMetricLabel,
    classifyMetricValue,
    BenchmarkStageId
} from '@/lib/diagnosticBenchmarks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RevenueFlow } from '@/components/dashboard/RevenueFlow';

interface ResultsProps {
    project: DiagnosticProject;
    onBack: () => void;
    onEdit: () => void;
    onSave?: (p: DiagnosticProject) => void;
}


// ─── TRAVA GAUGE COM DRAG INTERATIVO ──────────────────────────────────────────
const TravaGauge = ({ id, idx, analysis, project, onValueChange }: {
    id: string, idx: number, analysis: any, project: any, onValueChange?: (stageId: string, newValue: number) => void
}) => {
    const score = analysis.stageScores.find((item: any) => item.id === id);
    const isBottleneck = (analysis.bottleneck as any).id === id;

    // Configurações específicas para Cegueira
    const isCegueira = id === 'cegueira';

    // Fallback para cegueira
    const bench = score?.benchmark || { mid: 1, min: 0, max: 100, direction: isCegueira ? 'lower_better' : 'higher_better', unit: 'percent', label: isCegueira ? 'Cegueira' : '' };
    const val = score?.value || 0;

    // Para cegueira, sobrescrever statusText com base na reliability
    const cegueiraLabel = isCegueira ? (score?.status === 'ruim' ? 'Cego' : score?.status === 'na_media' ? 'Semi-Manual' : 'Data-Driven') : null;
    const mid = bench?.mid || 1;

    // Estado Local para garantir arraste Manteiga (sem engasgar render global)
    const [localVal, setLocalVal] = useState(val);
    const [isDragging, setIsDragging] = useState(false);

    // Sincronizar com prop quando não estiver arrastando
    useEffect(() => {
        if (!isDragging) {
            setLocalVal(val);
        }
    }, [val, isDragging]);

    const isInverse = bench?.direction === 'lower_better';
    // Ajuste de range dinâmico para permitir arraste total
    const maxVal = isCegueira ? 100 : (bench.max || mid * 2);
    const minVal = bench.min || 0;

    // A Porcentagem visual SEMPRE preencherá do MENOR (esquerda) para o MAIOR (direita) quantitativamente.
    // O que inverte é a COR DO GRADIENTE no CSS (Verde <- se -> Vermelho)
    let percentage = Math.max(0, Math.min(100, ((localVal - minVal) / (maxVal - minVal)) * 100));

    // Determinar o status dinâmico em tempo real para feedback visual instântaneo do slider!
    let dynamicStatus = score?.status;
    if (isCegueira) {
        dynamicStatus = localVal > 50 ? 'ruim' : localVal > 20 ? 'na_media' : 'bom';
    } else {
        percentage = Math.max(0, Math.min(100, ((val - minVal) / (maxVal - minVal)) * 100));
    }

    const statusText = score?.status === 'ruim' ? 'Crítico' : score?.status === 'na_media' ? 'Na Média' : 'Bom';

    // Cores: Para cegueira, valor alto = ruim (vermelho), valor baixo = bom (verde)
    let statusColor = "";
    if (isCegueira) {
        statusColor = val > 50 ? 'text-red-500' : val > 20 ? 'text-amber-500' : 'text-emerald-500';
    } else {
        statusColor = dynamicStatus === 'ruim' ? 'text-red-500' : dynamicStatus === 'na_media' ? 'text-amber-500' : 'text-emerald-500';
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pct = parseFloat(e.target.value) / 100;
        const newVal = minVal + (pct * (maxVal - minVal));
        setLocalVal(newVal);
        setIsDragging(true);
    };

    const handleInputEnd = () => {
        setIsDragging(false);
        onValueChange?.(id, Math.max(0, Number(localVal.toFixed(2))));
    };

    return (
        <div className={cn(
            "relative space-y-4 p-5 rounded-[1.5rem] transition-all duration-500 border border-white/5",
            isBottleneck ? "bg-zinc-900/40 border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.1)]" : "bg-black/30 shadow-xl"
        )}>
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">TRAVA {idx.toString().padStart(2, '0')}</span>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white tracking-tight">{getStageLabel(id, project.segment)}</span>
                            {isBottleneck && <AlertTriangle className="w-4 h-4 text-red-500 ml-1" />}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-medium">{getMetricLabel(id, project.segment)}</span>
                    </div>
                    {isBottleneck && <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> Esta é sua restrição ativa</p>}
                </div>
                <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 bg-black/50", statusColor)}>
                    {statusText}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                {/* Barra arrastável Nativa Restuarada ao Visual Antigo */}
                <div
                    className={cn(
                        "relative h-3 flex-1 rounded-full flex items-center shadow-inner group",
                        isInverse ? "bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600" : "bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600",
                        isDragging && "ring-2 ring-blue-500/40"
                    )}
                >
                    <div
                        className={cn(
                            "absolute w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_12px_rgba(59,130,246,0.8)] z-10 -translate-x-1/2 cursor-grab pointer-events-none transition-transform",
                            isDragging && "scale-150"
                        )}
                        style={{ left: `${percentage}%` }}
                    />

                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={percentage}
                        onChange={handleInputChange}
                        onMouseUp={handleInputEnd}
                        onTouchEnd={handleInputEnd}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                </div>
                <div className="flex flex-col items-end min-w-[100px]">
                    <span className="text-white font-black whitespace-nowrap text-sm text-right">
                        {localVal.toFixed(2)}{bench?.unit === 'percent' || id === 'cegueira' ? '%' : ''} Real
                    </span>
                    <span className="text-zinc-500 font-bold whitespace-nowrap text-xs text-right mt-0.5">
                        {mid.toFixed(2)}{bench?.unit === 'percent' || id === 'cegueira' ? '%' : ''} Bench
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── FLUXO DE RECEITA — DESIGN REPLICADO DA REFERÊNCIA ────────────────────────
const DiagnosticFlow = ({ analysis }: { analysis: any }) => {
    const stages = ['retencao', 'decisao', 'compromisso', 'qualificacao', 'interesse', 'atencao', 'exposicao'];

    // Formata valor numérico de forma segura para 2 casas decimais sem arredondar
    const formatVal = (val: number) => {
        if (val === undefined || val === null || isNaN(val)) return '0.00';
        return val.toFixed(2);
    };

    // Calcula percentual vs benchmark
    const calcPct = (val: number, mid: number, unit?: string) => {
        if (val === undefined || val === null || isNaN(val)) return '0.00%';
        if (unit === 'percent') return `${val.toFixed(2)}%`;
        if (!mid || mid === 0) return '—';
        return `${((val / mid) * 100).toFixed(2)}%`;
    };

    // Clip-paths progressivos — funil abrindo da esquerda para direita
    const CLIP_PATHS: Record<string, string> = {
        retencao: 'polygon(100% 10%, 100% 90%, 0px 100%, 0px 0px)',
        decisao: 'polygon(100% 20%, 100% 80%, 0% 90%, 0% 10%)',
        compromisso: 'polygon(100% 30%, 100% 70%, 0% 80%, 0% 20%)',
        qualificacao: 'polygon(100% 30%, 100% 70%, 0% 70%, 0% 30%)',
        interesse: 'polygon(100% 20%, 100% 80%, 0% 70%, 0% 30%)',
        atencao: 'polygon(100% 10%, 100% 90%, 0% 80%, 0% 20%)',
        exposicao: 'polygon(100% 0%, 100% 100%, 0% 90%, 0% 10%)',
    };

    return (
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

            <div className="flex items-center justify-between gap-1 py-4 px-2">
                {stages.map((id, index) => {
                    const score = analysis.stageScores.find((item: any) => item.id === id);
                    const isBottleneck = (analysis.bottleneck as any).id === id;
                    const val = score?.value || 0;
                    const clipPath = CLIP_PATHS[id];

                    // Cores baseadas no status
                    const textColor = isBottleneck ? 'text-red-500' : (score?.status === 'bom' ? 'text-emerald-500' : 'text-yellow-500');
                    const glowShadow = isBottleneck
                        ? 'shadow-[0_0_25px_rgba(239,68,68,0.4)] scale-105 z-20'
                        : (score?.status === 'bom' ? 'shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'shadow-[0_0_15px_rgba(234,179,8,0.2)]');
                    const bgGrad = isBottleneck
                        ? 'bg-gradient-to-br from-red-600/20 to-transparent'
                        : (score?.status === 'bom' ? 'bg-gradient-to-br from-emerald-500/10 to-transparent' : 'bg-gradient-to-br from-yellow-500/10 to-transparent');
                    const arrowColor = isBottleneck ? '#ef4444' : (score?.status === 'bom' ? '#10b981' : '#eab308');
                    const dotBg = isBottleneck ? 'bg-red-500' : (score?.status === 'bom' ? 'bg-emerald-400' : 'bg-yellow-400');

                    // Badge de status
                    const statusLabel = isBottleneck ? 'GARGALO' : score?.status === 'bom' ? 'Ideal' : score?.status === 'na_media' ? 'Na Média' : 'Crítico';
                    const badgeClass = isBottleneck ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' : score?.status === 'bom' ? 'text-emerald-500' : 'text-yellow-500';

                    return (
                        <div key={id} className="flex items-center">
                            <div className="flex flex-col items-center relative gap-2">
                                {/* Nome da etapa */}
                                <span className="text-white/70 text-[10px] text-center font-bold uppercase tracking-tighter">{getStageName(id)}</span>

                                {/* Shape principal com barras verticais */}
                                <div className="relative group/stage">
                                    {/* Barra Vertical Esquerda — Altura dinâmica para alinhar com o trapezoide */}
                                    <div className={cn(
                                        "absolute left-0 z-30 w-[4px] transition-all duration-500",
                                        isBottleneck ? "bg-red-600 shadow-[0_0_12px_#ef4444]" : (score?.status === 'bom' ? "bg-emerald-500" : "bg-yellow-500"),
                                        id === 'retencao' ? "top-0 bottom-0" :
                                            id === 'decisao' ? "top-[10%] bottom-[10%]" :
                                                id === 'compromisso' ? "top-[20%] bottom-[20%]" :
                                                    id === 'qualificacao' ? "top-[30%] bottom-[30%]" :
                                                        id === 'interesse' ? "top-[30%] bottom-[30%]" :
                                                            id === 'atencao' ? "top-[20%] bottom-[20%]" :
                                                                "top-[10%] bottom-[10%]" // exposicao
                                    )} />

                                    {/* Barra Vertical Direita */}
                                    <div className={cn(
                                        "absolute right-0 z-30 w-[4px] transition-all duration-500",
                                        isBottleneck ? "bg-red-600 shadow-[0_0_12px_#ef4444]" : (score?.status === 'bom' ? "bg-emerald-500" : "bg-yellow-500"),
                                        id === 'retencao' ? "top-[10%] bottom-[10%]" :
                                            id === 'decisao' ? "top-[20%] bottom-[20%]" :
                                                id === 'compromisso' ? "top-[30%] bottom-[30%]" :
                                                    id === 'qualificacao' ? "top-[30%] bottom-[30%]" :
                                                        id === 'interesse' ? "top-[20%] bottom-[20%]" :
                                                            id === 'atencao' ? "top-[10%] bottom-[10%]" :
                                                                "top-0 bottom-0" // exposicao
                                    )} />

                                    <div
                                        className={cn(
                                            'flex items-center justify-center transition-all h-[120px] w-[90px] relative z-10 border-y border-white/5',
                                            bgGrad, glowShadow,
                                            isBottleneck && "animate-pulse border-red-500/50"
                                        )}
                                        style={{ clipPath }}
                                    >
                                        {/* Radial glow interno */}
                                        <div
                                            className="absolute inset-0 z-0"
                                            style={{
                                                background: isBottleneck
                                                    ? 'radial-gradient(circle, rgba(239, 68, 68, 0.4), transparent)'
                                                    : 'radial-gradient(circle, rgba(255, 255, 255, 0.05), transparent)',
                                                transform: 'scale(1.2)',
                                            }}
                                        />

                                        {/* Valor + porcentagem */}
                                        <div className="flex flex-col items-center z-10">
                                            <span className={cn(
                                                'text-lg font-black drop-shadow-lg leading-none',
                                                textColor,
                                                isBottleneck && 'scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]'
                                            )}>
                                                {formatVal(val)}
                                            </span>
                                            <span className="text-white/40 text-[9px] font-bold mt-1">
                                                {calcPct(val, score?.benchmark?.mid, score?.benchmark?.unit)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Badge de status */}
                                <div className={cn('px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest', badgeClass)}>
                                    {statusLabel}
                                </div>
                            </div>

                            {/* Seta SVG animada entre etapas */}
                            {index < stages.length - 1 && (
                                <div className="flex items-center justify-center relative mx-4">
                                    <svg width="24" height="20" viewBox="0 0 24 20" className="relative z-10">
                                        <line x1="20" y1="10" x2="4" y2="10" stroke={arrowColor} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                                        <polygon points="4,10 10,7 10,13" fill={arrowColor} opacity="0.6" />
                                    </svg>
                                    <div
                                        className={cn('absolute -left-1 w-1.5 h-1.5 rounded-full animate-pulse z-20', dotBg)}
                                        style={{ boxShadow: `${arrowColor} 0px 0px 10px` }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export function DiagnosticResults({ project, onBack, onEdit, onSave }: ResultsProps) {
    // Estado local do bowtie para permitir alterações via drag nos sliders
    const [localBowtie, setLocalBowtie] = useState(project.bowtie);

    // ─── EXPORTAR PDF ─────────────────────────────────────────────────────────
    const handleExportPDF = useCallback((proj: typeof project, anal: any) => {
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const w = doc.internal.pageSize.getWidth();
            let y = 20;

            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Relatório de Restrição — TOC', w / 2, y, { align: 'center' });
            y += 10;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Projeto: ${proj.name} · Segmento: ${proj.segment}`, w / 2, y, { align: 'center' });
            y += 6;
            doc.text(`Meta: R$ ${proj.goal.value.toLocaleString('pt-BR')} · Ticket: R$ ${proj.economics.averageTicket.toLocaleString('pt-BR')}`, w / 2, y, { align: 'center' });
            y += 12;

            // Restrição ativa
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(220, 38, 38);
            doc.text(`RESTRIÇÃO ATIVA: ${getStageName(anal.bottleneck.id).toUpperCase()}`, 20, y);
            doc.setTextColor(0, 0, 0);
            y += 8;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Valor Real: ${anal.bottleneck.value.toFixed(2)} · Penalidade: ${anal.bottleneck.penalty.toFixed(0)} pts`, 20, y);
            y += 10;

            // Tabela de travas
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Painel de Travas', 20, y);
            y += 8;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Trava', 20, y);
            doc.text('Valor Real', 80, y);
            doc.text('Status', 130, y);
            y += 6;
            doc.setDrawColor(200);
            doc.line(20, y - 2, w - 20, y - 2);

            doc.setFont('helvetica', 'normal');
            anal.stageScores.forEach((s: any) => {
                const statusLabel = s.status === 'bom' ? 'Bom' : s.status === 'na_media' ? 'Na Média' : 'Crítico';
                const isBottleneck = anal.bottleneck.id === s.id;
                doc.text(`${isBottleneck ? '► ' : '  '}${getStageName(s.id)}`, 20, y);
                doc.text(`${s.value.toFixed(2)}${s.benchmark?.unit === 'percent' || s.id === 'cegueira' ? '%' : ''}`, 80, y);
                doc.text(statusLabel, 130, y);
                y += 6;
                if (y > 270) { doc.addPage(); y = 20; }
            });

            y += 6;
            // Razão e injeção
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Core Problem:', 20, y);
            y += 6;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const reason = getStageReason(anal.bottleneck.id);
            const reasonLines = doc.splitTextToSize(reason, w - 40);
            doc.text(reasonLines, 20, y);
            y += reasonLines.length * 5 + 4;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Injeção Recomendada:', 20, y);
            y += 6;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const injection = getStageInjection(anal.bottleneck.id);
            const injectionLines = doc.splitTextToSize(injection, w - 40);
            doc.text(injectionLines, 20, y);

            // Footer
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · Destrava Receita V4`, w / 2, 290, { align: 'center' });

            doc.save(`diagnostico-${proj.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
            toast.success('PDF exportado com sucesso!');
        } catch (err) {
            console.error('Erro ao exportar PDF:', err);
            toast.error('Erro ao gerar PDF');
        }
    }, []);

    // Callback chamado quando o slider é arrastado
    const handleValueChange = useCallback((stageId: string, newValue: number) => {
        setLocalBowtie(prev => ({
            ...prev,
            [stageId]: { ...prev[stageId as keyof typeof prev], value: newValue }
        }));
    }, []);

    // Load benchmarks for comparison
    const benchmarks = useMemo(() => {
        const config = createDefaultBenchmarkConfigFromSeed();
        return config.segments.find(s => s.segmentKey === project.segment) || config.segments[0];
    }, [project.segment]);

    // Motor de Inferência reativo ao localBowtie (linkado com os sliders)
    const analysis = useMemo(() => {
        // ORDEM FÍSICA PARA TOC: Cegueira -> Topo -> Fim do Funil
        const stageOrder: BenchmarkStageId[] = ['exposicao', 'atencao', 'interesse', 'qualificacao', 'compromisso', 'decisao', 'retencao'];

        // Calcula scores das etapas do funil
        const stageScores = stageOrder.map(stageId => {
            const stageMetrics = benchmarks.stages[stageId] || [];
            const userBowtieData = localBowtie[stageId];

            let stagePenalty = 0;
            let totalWeights = 0;

            stageMetrics.forEach((m, idx) => {
                const weight = idx === 0 ? 1.0 : 0.5;
                const status = classifyMetricValue(userBowtieData.value, m);

                let metricPenalty = 0;
                if (status === 'ruim') metricPenalty = 100;
                else if (status === 'na_media') metricPenalty = 40;
                else if (status === 'bom') metricPenalty = 10;

                stagePenalty += metricPenalty * weight;
                totalWeights += weight;
            });

            const finalPenalty = stagePenalty / (totalWeights || 1);
            const status = finalPenalty > 60 ? 'ruim' : finalPenalty > 25 ? 'na_media' : 'bom';

            return {
                id: stageId,
                status: status as BenchmarkStatus,
                penalty: finalPenalty,
                value: userBowtieData.value,
                benchmark: stageMetrics[0]
            };
        });

        // Score da Cegueira (Lógica Invertida: quanto maior, pior)
        const cegueiraVal = localBowtie.cegueira.value || 0;
        const cegueiraStatus = cegueiraVal > 50 ? 'ruim' : cegueiraVal > 20 ? 'na_media' : 'bom';

        // Gap de cegueira: 100% = penalty máxima, 0% = penalty mínima
        // Se cegueira for 0, gap deve ser 0.
        // Penalty base 100 para cegueira crítica para vencer empates
        const cegueiraPenalty = (cegueiraVal / 100) * 100;

        const cegueiraScore = {
            id: 'cegueira' as any,
            status: cegueiraStatus as BenchmarkStatus,
            penalty: cegueiraPenalty,
            value: cegueiraVal,
            benchmark: { mid: 1, min: 0, max: 100, direction: 'lower_better', unit: 'percent', label: 'Cegueira' } as any
        };

        // LÓGICA DE TOC: Prioridade Absoluta para Cegueira se Ruim, depois segue a ordem física.
        const allScoresOrdered = [cegueiraScore, ...stageScores];

        // 1. Prioridade Absoluta: Se a Cegueira for 'ruim', ela É o gargalo.
        if (cegueiraStatus === 'ruim') {
            return { stageScores: allScoresOrdered, bottleneck: cegueiraScore };
        }

        // 2. Se não for cegueira, procura o primeiro "ruim" na ordem física (Exposição -> ...)
        let bottleneck = stageScores.find(s => s.status === 'ruim');

        // 3. Se ninguém estiver "ruim", procura por alguém "na_media" (priorizando cegueira antes do resto)
        if (!bottleneck) {
            if (cegueiraStatus === 'na_media') {
                bottleneck = cegueiraScore;
            } else {
                bottleneck = stageScores.find(s => s.status === 'na_media');
            }
        }

        // 4. Se todo mundo estiver "bom", pega o que tiver maior penalty (o menos "bom")
        if (!bottleneck) {
            bottleneck = [...allScoresOrdered].sort((a, b) => b.penalty - a.penalty)[0];
        }

        return { stageScores: allScoresOrdered, bottleneck };
    }, [benchmarks, project, localBowtie]);

    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    const handleGenerateAI = async () => {
        setIsGeneratingAI(true);
        try {
            const performanceScores = analysis.stageScores.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.value }), {});

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diagnostic-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project, bottleneck: analysis.bottleneck, performanceScores })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Erro da IA (401/500)');
            }

            const data = await response.json();

            if (data && onSave) {
                const updatedProject: DiagnosticProject = {
                    ...project,
                    ai_analysis: {
                        ...data,
                        generatedAt: new Date().toISOString()
                    }
                };
                onSave(updatedProject);
                toast.success('Análise estratégica gerada com sucesso pela IA!');
            }
        } catch (error: any) {
            console.error('Erro ao gerar análise IA:', error);
            toast.error('Erro ao conectar com a IA: ' + (error.message || 'Verifique sua configuração'));
        } finally {
            setIsGeneratingAI(false);
        }
    };

    return (
        <div className="force-dark-theme space-y-8 animate-in fade-in zoom-in-95 duration-700 bg-zinc-950 rounded-[2rem] p-3 sm:p-5 lg:p-6 border border-white/5 overflow-hidden relative shadow-2xl w-full">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03)_0%,transparent_50%)] pointer-events-none opacity-20" />
            <div className="relative z-10">
                {/* Header do Relatório */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 mb-1 text-zinc-500 hover:text-red-500 pl-0 text-[10px] font-black uppercase tracking-widest h-auto py-0">
                            <ChevronLeft className="w-3.5 h-3.5" /> Projetos
                        </Button>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                            Relatório de <span className="text-red-600">Restrição</span>
                        </h2>
                        <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">Benchmark: {project.segment} · Meta: R$ {(project.goal?.value || 0).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap md:flex-nowrap">
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "rounded-xl h-8 gap-2 text-[9px] font-black uppercase tracking-widest bg-indigo-600/10 border-indigo-600/30 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all",
                                isGeneratingAI && "animate-pulse"
                            )}
                            onClick={handleGenerateAI}
                            disabled={isGeneratingAI}
                        >
                            <Zap className={cn("w-3.5 h-3.5", isGeneratingAI && "animate-spin")} />
                            {isGeneratingAI ? 'Gerando Inteligência...' : 'Gerar Análise IA'}
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl h-8 gap-2 text-[9px] font-black uppercase tracking-widest bg-zinc-950 border-white/5 text-white hover:bg-white/10"><Download className="w-3.5 h-3.5" /> Exportar</Button>
                        <Button size="sm" className="rounded-xl h-8 bg-[#EA3829] hover:bg-[#D32F2F] text-white gap-2 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-600/10">
                            <Share2 className="w-3.5 h-3.5" /> Compartilhar
                        </Button>
                    </div>
                </div>

                <div className="w-full">
                    <div className="space-y-4">
                        {/* 0. BRIEFING DO CLIENTE */}
                        {project.briefing && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                                <Card className="bg-zinc-950/50 border border-white/5 p-5 rounded-[2rem] space-y-1 hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Nicho / Setor</p>
                                    <p className="text-[11px] font-black text-white uppercase italic tracking-tight">{project.briefing.niche}</p>
                                </Card>
                                <Card className="bg-zinc-950/50 border border-white/5 p-5 rounded-[2rem] space-y-1 hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Situação Atual</p>
                                    <p className="text-[10px] font-medium text-zinc-400 line-clamp-2 leading-relaxed">{project.briefing.current_situation}</p>
                                </Card>
                                <Card className="bg-zinc-950/50 border border-white/5 p-5 rounded-[2rem] space-y-1 hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Principais Dores</p>
                                    <p className="text-[10px] font-medium text-zinc-400 line-clamp-2 leading-relaxed">{project.briefing.main_pains}</p>
                                </Card>
                                <Card className="bg-zinc-950/50 border border-white/5 p-5 rounded-[2rem] space-y-1 hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Modelo Negócio</p>
                                    <p className="text-[11px] font-black text-red-500 uppercase italic tracking-tight">{project.briefing.business_model_desc}</p>
                                </Card>
                            </div>
                        )}

                        {/* 1. RESTRIÇÃO ATIVA IDENTIFICADA */}
                        <div id="restricao-ativa">
                            <Card className="relative overflow-hidden border border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.15)] bg-zinc-950 p-10 flex flex-col justify-center rounded-[2.5rem] group mt-6 w-full">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 blur-[120px] pointer-events-none group-hover:bg-red-600/10 transition-all duration-700" />

                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                                    <div className="flex-1 space-y-6">
                                        <div className="flex flex-col gap-2">
                                            <Badge className="w-fit bg-red-600 text-white border-red-600 text-[10px] font-black tracking-widest uppercase px-3 py-1 animate-pulse shadow-lg shadow-red-600/20">
                                                Restrição Ativa Identificada
                                            </Badge>
                                            <h3 className="text-6xl md:text-7xl font-black text-white uppercase tracking-tighter italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                                {getStageName((analysis.bottleneck as any).id)} <span className="text-zinc-800 text-3xl">({getStageNum((analysis.bottleneck as any).id)})</span>
                                            </h3>
                                            <p className="text-red-500/80 font-black uppercase tracking-[0.3em] flex items-center gap-2 text-xs">
                                                <AlertTriangle className="w-4 h-4" /> Gargalo Matemático Crítico
                                            </p>
                                        </div>

                                        <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-2xl font-medium">
                                            Baseado nos benchmarks de <span className="text-white font-bold">{project.segment}</span>, identificamos que sua maior perda de throughput ocorre na trava de {getStageName((analysis.bottleneck as any).id)}. Isso significa que qualquer investimento em outras áreas terá <span className="text-red-500 font-bold italic">retorno decrescente</span> até que este ponto seja resolvido.
                                        </p>

                                        {project.ai_analysis && (
                                            <div className="bg-indigo-600/10 border border-indigo-600/30 p-5 rounded-3xl mt-4 space-y-2 animate-in fade-in slide-in-from-left-4 duration-700">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-indigo-500" />
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Parecer do Consultor (IA)</span>
                                                </div>
                                                <p className="text-white text-sm font-medium italic leading-relaxed">
                                                    "{project.ai_analysis.executiveSummary}"
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-4 min-w-[300px]">
                                        <div className="bg-black/50 backdrop-blur-md border border-white/5 p-6 rounded-3xl space-y-2">
                                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Eficiência Atual Real</p>
                                            <div className="flex items-end gap-2">
                                                <span className="text-5xl font-black text-white tracking-tighter">
                                                    {(analysis.bottleneck as any)?.id === 'cegueira' ? '0.00' : ((analysis.bottleneck as any)?.value || 0).toFixed(2)}
                                                    {(analysis.bottleneck as any)?.id === 'exposicao' ? '' : '%'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-3xl space-y-1">
                                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Gap vs Benchmark</p>
                                            <span className="text-3xl font-black text-red-500 tracking-tighter">
                                                {((analysis.bottleneck as any)?.value || 0) >= 100 && (analysis.bottleneck as any)?.id !== 'cegueira' ? 0 : -Math.abs((analysis.bottleneck as any)?.penalty || 0).toFixed(0)} pts
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* 1.5. DETALHAMENTO DO CONSULTOR (IA) */}
                        {project.ai_analysis && project.ai_analysis.coreProblem && (
                            <div className="animate-in slide-in-from-bottom-8 duration-700 mt-6 space-y-6">
                                {/* Core Problem & Injection - MATCH FIGMA PRINT */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* SINTOMAS (UDEs) */}
                                    <div className="lg:col-span-1 h-full">
                                        <div className="bg-[#120505] border border-red-900/30 p-8 rounded-3xl h-full">
                                            <div className="flex items-center gap-2 mb-6 text-red-500">
                                                <AlertTriangle className="w-4 h-4" />
                                                <h4 className="font-black uppercase tracking-widest text-[11px]">Sintomas (UDEs)</h4>
                                            </div>
                                            <ul className="space-y-4">
                                                {project.ai_analysis.ude?.map((u: string, i: number) => (
                                                    <li key={i} className="text-[#a1a1aa] text-xs font-medium flex gap-3 items-start">
                                                        <span className="text-red-500 mt-0.5">•</span>
                                                        <span className="leading-relaxed">{u}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 flex flex-col gap-6">
                                        {/* PROBLEMA RAIZ */}
                                        <div className="bg-[#120505] border border-red-900/30 p-8 rounded-3xl flex-1">
                                            <div className="flex items-center gap-2 mb-4 text-red-500">
                                                <Target className="w-4 h-4" />
                                                <h4 className="font-black uppercase tracking-widest text-[11px]">Problema Raiz (Core Problem)</h4>
                                            </div>
                                            <p className="text-white text-sm md:text-[15px] font-bold leading-relaxed">
                                                {project.ai_analysis.coreProblem}
                                            </p>
                                        </div>

                                        {/* INJEÇÃO ESTRATÉGICA */}
                                        <div className="bg-[#03170e] border border-emerald-900/40 p-8 rounded-3xl flex-1">
                                            <div className="flex items-center gap-2 mb-4 text-emerald-500">
                                                <ShieldCheck className="w-4 h-4" />
                                                <h4 className="font-black uppercase tracking-widest text-[11px]">Injeção Estratégica (A Solução)</h4>
                                            </div>
                                            <p className="text-emerald-50 text-sm md:text-[15px] font-bold leading-relaxed italic">
                                                "{project.ai_analysis.injection}"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. PAINEL DE TRAVAS — COM SLIDERS ARRASTÁVEIS */}
                        <Card className="p-4 sm:p-5 lg:p-6 border border-white/5 bg-zinc-950 rounded-[2.5rem] relative overflow-hidden flex flex-col shadow-2xl w-full">
                            <div className="absolute top-0 left-0 w-80 h-80 bg-red-600/5 blur-[120px] pointer-events-none" />
                            <div className="flex justify-between items-start mb-8 relative z-10 mt-2">
                                <div className="space-y-1">
                                    <h4 className="text-xl font-black uppercase tracking-tight text-white italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Painel de Travas</h4>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Arraste os sliders para simular cenários · Tudo está linkado</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[9px] border-white/10 text-zinc-400 font-black px-4 py-1.5 rounded-full uppercase">Bench: {project.segment}</Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 flex-1 relative z-10">
                                {/* VENDAS / CS Group */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 text-red-600 mb-4 px-1">
                                        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                        <span className="text-[11px] font-black uppercase tracking-[0.25em]">Vendas / CS</span>
                                    </div>
                                    {['retencao', 'decisao', 'compromisso'].map((s, idx) => (
                                        <TravaGauge key={s} id={s} idx={7 - idx} analysis={analysis} project={project} onValueChange={handleValueChange} />
                                    ))}
                                </div>

                                {/* MARKETING Group */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 text-amber-500 mb-4 px-1">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <span className="text-[11px] font-black uppercase tracking-[0.25em]">Marketing</span>
                                    </div>
                                    {['qualificacao', 'interesse', 'atencao'].map((s, idx) => (
                                        <TravaGauge key={s} id={s} idx={4 - idx} analysis={analysis} project={project} onValueChange={handleValueChange} />
                                    ))}
                                </div>
                            </div>

                            {/* EXPOSIÇÃO + CEGUEIRA Full Width */}
                            <div className="mt-8 pt-6 border-t border-white/10 relative z-10 space-y-5">
                                <div className="flex items-center gap-2 text-white mb-2 px-1">
                                    <span className="text-[11px] font-black uppercase tracking-[0.25em] text-white">Topo de Funil</span>
                                </div>
                                <TravaGauge id="exposicao" idx={1} analysis={analysis} project={project} onValueChange={handleValueChange} />
                                <TravaGauge id="cegueira" idx={0} analysis={analysis} project={project} onValueChange={handleValueChange} />
                            </div>
                        </Card>

                        {/* 2. FLUXO DE RECEITA — DESIGN REPLICADO REFERÊNCIA */}
                        <DiagnosticFlow analysis={analysis} />
                    </div>
                </div>
            </div>
            {/* 5. TABS DE ANÁLISE PROFUNDA */}
            <Tabs defaultValue="dashboard" className="w-full mt-12 bg-zinc-950 p-6 rounded-[2.5rem] border border-white/5" >
                <TabsList className="bg-black/40 border border-white/5 p-1 rounded-2xl mb-8 flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="dashboard" className="rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all">Sintese Base</TabsTrigger>
                    <TabsTrigger value="ltp" className="rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all">LTP (Árvores)</TabsTrigger>
                    <TabsTrigger value="90days" className="rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all">Plano 90 Dias</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest italic ml-2">Economics & Gaps</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-black/30 border border-white/5 p-6 rounded-[2rem] space-y-1 hover:bg-black/50 transition-colors group">
                                    <div className="flex items-center gap-1.5 text-zinc-600 mb-1 group-hover:text-red-500">
                                        <Target className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Ticket Médio</span>
                                    </div>
                                    <p className="text-xl font-black text-white">R$ {(project.economics?.averageTicket || 0).toLocaleString('pt-BR')}</p>
                                    <p className="text-[8px] text-zinc-600 font-bold uppercase">Benchmark Ideal: +/- R$ 1.5k</p>
                                </div>
                                <div className="bg-black/30 border border-white/5 p-6 rounded-[2rem] space-y-1 hover:bg-black/50 transition-colors group">
                                    <div className="flex items-center gap-1.5 text-zinc-600 mb-1 group-hover:text-red-500">
                                        <TrendingUp className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">ROI Mínimo</span>
                                    </div>
                                    <p className="text-xl font-black text-white">{(project.economics?.contributionMargin || 0).toFixed(2)}x</p>
                                    <p className="text-[8px] text-zinc-600 font-bold uppercase">Base Margem: {(100 / (project.economics?.contributionMargin || 1)).toFixed(2)}%</p>
                                </div>
                                <div className="bg-black/30 border border-white/5 p-6 rounded-[2rem] space-y-1 hover:bg-black/50 transition-colors group">
                                    <div className="flex items-center gap-1.5 text-zinc-600 mb-1 group-hover:text-red-500">
                                        <Target className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Meta Vendas</span>
                                    </div>
                                    <p className="text-xl font-black text-white">{Math.ceil((project.goal?.value || 0) / (project.economics?.averageTicket || 1))}</p>
                                    <p className="text-[8px] text-zinc-600 font-bold uppercase">Novos Contratos/Mês</p>
                                </div>
                                <div className="bg-black/30 border border-white/5 p-6 rounded-[2rem] space-y-1 hover:bg-black/50 transition-colors group">
                                    <div className="flex items-center gap-1.5 text-zinc-600 mb-1 group-hover:text-red-500">
                                        <History className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Ciclo Venda</span>
                                    </div>
                                    <p className="text-xl font-black text-white">{project.economics.cycleTime} Dias</p>
                                    <p className="text-[8px] text-zinc-600 font-bold uppercase">Tempo de Decisão</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest italic ml-2">Benchmarks vs Real</h4>
                            <div className="bg-black/30 border border-white/5 rounded-[2rem] overflow-hidden">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-white/5">
                                        <tr>
                                            <th className="px-5 py-3 font-black text-zinc-500 uppercase tracking-widest">Trava</th>
                                            <th className="px-5 py-3 font-black text-zinc-500 uppercase tracking-widest text-center">Real</th>
                                            <th className="px-5 py-3 font-black text-zinc-500 uppercase tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {analysis.stageScores.slice().reverse().map(s => (
                                            <tr key={s.id} className={cn("hover:bg-white/5 transition-colors", (analysis.bottleneck as any).id === s.id && "bg-red-600/5")}>
                                                <td className="px-5 py-4 font-black text-white uppercase">{getStageLabel(s.id as string, project.segment)}</td>
                                                <td className="px-5 py-4 font-mono text-white text-center">
                                                    {(s.value || 0).toFixed(2)}
                                                    {s.benchmark?.unit === 'percent' || s.id === 'cegueira' ? '%' : ''}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                                        s.status === 'proximo_do_ideal' ? "text-cyan-400 bg-cyan-400/10" :
                                                            s.status === 'bom' ? "text-emerald-500 bg-emerald-500/10" :
                                                                s.status === 'na_media' ? "text-amber-500 bg-amber-500/10" :
                                                                    s.status === 'sem_dados' ? "text-zinc-500 bg-zinc-500/10" :
                                                                        "text-red-500 bg-red-500/10"
                                                    )}>
                                                        {s.status === 'proximo_do_ideal' ? 'Excelente' :
                                                            s.status === 'bom' ? 'Bom' :
                                                                s.status === 'na_media' ? 'Médio' :
                                                                    s.status === 'sem_dados' ? 'Sem Dados' : 'Gargalo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="ltp" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* CRT Tree Mockup */}
                    <div className="space-y-8">
                        <div className="flex items-center justify-between px-2">
                            <div className="space-y-1">
                                <h4 className="text-xl font-black text-white uppercase tracking-tighter italic">LTP (Logical Thinking Process)</h4>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Árvore de Realidade Atual baseada na restrição de {(analysis.bottleneck as any).id}</p>
                            </div>
                            <Button variant="outline" className="h-8 rounded-xl border-white/10 bg-black/50 text-[9px] font-black uppercase tracking-widest text-zinc-400">Ver Mapeamento Casual</Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(project.ai_analysis?.ude || []).length > 0 ? (
                                project.ai_analysis?.ude.map((udeText, i) => (
                                    <Card key={i} className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-red-600/30 transition-all group">
                                        <Badge className="bg-red-600/10 text-red-600 border-red-600/20 text-[8px] font-black uppercase">UDE {String(i + 1).padStart(2, '0')}</Badge>
                                        <p className="text-[11px] font-bold text-white uppercase tracking-tight italic leading-relaxed">{udeText}</p>
                                        <div className="h-px w-full bg-white/5" />
                                        <p className="text-[10px] text-zinc-500 font-medium italic">Sinalizador de perda de Throughput.</p>
                                    </Card>
                                ))
                            ) : (
                                <Card className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-red-600/30 transition-all group">
                                    <Badge className="bg-red-600/10 text-red-600 border-red-600/20 text-[8px] font-black uppercase">UDE 01</Badge>
                                    <p className="text-[11px] font-bold text-white uppercase tracking-tight italic">Baixa vazão de receita na etapa de {getStageLabel((analysis.bottleneck as any).id, project.segment)}</p>
                                    <div className="h-px w-full bg-white/5" />
                                    <p className="text-[10px] text-zinc-500 font-medium">Impacto: Imunização do throughput total do sistema.</p>
                                </Card>
                            )}
                            <Card className="bg-red-600 border-red-600 p-6 rounded-[2rem] space-y-4 shadow-xl shadow-red-600/20">
                                <Badge className="bg-white text-red-600 text-[8px] font-black uppercase">CORE PROBLEM</Badge>
                                <p className="text-[13px] font-black text-white uppercase tracking-tighter italic leading-tight">
                                    {project.ai_analysis?.coreProblem || getStageReason((analysis.bottleneck as any).id, project.briefing?.business_model_desc)}
                                </p>
                                <div className="h-px w-full bg-white/20" />
                                <p className="text-[10px] text-white/80 font-bold uppercase">Causa-Raiz Sistêmica Identificada.</p>
                            </Card>
                            <Card className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-emerald-600/30 transition-all group">
                                <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/20 text-[8px] font-black uppercase">INJEÇÃO (EC)</Badge>
                                <p className="text-[11px] font-bold text-white uppercase tracking-tight italic">
                                    {project.ai_analysis?.injection || getStageInjection((analysis.bottleneck as any).id, project.briefing?.business_model_desc)}
                                </p>
                                <div className="h-px w-full bg-white/5" />
                                <p className="text-[10px] text-zinc-500 font-medium">Solução estratégica para "evaporar" o conflito.</p>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="90days" className="py-10 animate-in fade-in slide-in-from-right-2 duration-500">
                    <div className="space-y-12">
                        <div className="flex flex-col items-center justify-center space-y-6 text-center max-w-xl mx-auto">
                            <div className="w-16 h-16 bg-red-600/10 rounded-[1.5rem] flex items-center justify-center border border-red-600/20">
                                <Zap className="w-8 h-8 text-red-600 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-2xl font-black text-white uppercase tracking-tight italic">Plano Estratégico de 90 Dias</h4>
                                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">Foco exclusivo em quebrar a restrição de {getStageLabel((analysis.bottleneck as any).id, project.segment)} para liberar o faturamento represado.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                {
                                    phase: "Mês 01",
                                    title: project.ai_analysis?.plan90Days?.phase1?.title || "Fundação e Estabilização",
                                    items: project.ai_analysis?.plan90Days?.phase1?.actions || ["Setup de analytics e tracking real", "Auditoria de processos na trava", "Correção de vazamentos críticos"]
                                },
                                {
                                    phase: "Mês 02",
                                    title: project.ai_analysis?.plan90Days?.phase2?.title || "Otimização e Alavancagem",
                                    items: project.ai_analysis?.plan90Days?.phase2?.actions || [`Implementação da Injeção: ${getStageInjection(analysis.bottleneck.id, project.briefing?.business_model_desc)}`, "Testes A/B e refinamento de script", "Treinamento intensivo de equipe"]
                                },
                                {
                                    phase: "Mês 03",
                                    title: project.ai_analysis?.plan90Days?.phase3?.title || "Sustentação e Escala",
                                    items: project.ai_analysis?.plan90Days?.phase3?.actions || ["Monitoramento de throughput 24/7", "Expansão de canais satélites", "Preparação para próxima restrição"]
                                }
                            ].map((p, i) => (
                                <div key={i} className="bg-black/30 border border-white/5 p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden group hover:border-red-600/20 transition-all">
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/5 rounded-full blur-3xl group-hover:bg-red-600/10 transition-all" />
                                    <Badge className="bg-zinc-900 border-white/5 text-zinc-400 text-[9px] font-black uppercase tracking-widest">{p.phase}</Badge>
                                    <h5 className="text-lg font-black text-white uppercase tracking-tighter italic">{p.title}</h5>
                                    <ul className="space-y-3">
                                        {(p.items).map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-zinc-500 text-xs font-medium">
                                                <div className="w-1 h-1 rounded-full bg-red-600 mt-1.5 shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center">
                            <Button className="bg-[#EA3829] hover:bg-[#D32F2F] text-white rounded-2xl h-12 px-8 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/20">
                                <Share2 className="w-4 h-4 mr-2" /> Exportar Mural de Metas
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── HELPERS LOCAL ──────────────────────────────────────────────────────────

function getStatusColor(status: BenchmarkStatus): string {
    switch (status) {
        case 'ruim': return 'text-red-500 border-red-500/10 bg-red-500/5';
        case 'na_media': return 'text-amber-500 border-amber-500/10 bg-amber-500/5';
        case 'bom': return 'text-emerald-500 border-emerald-500/10 bg-emerald-500/5';
        default: return 'text-zinc-600 border-white/5 bg-white/5';
    }
}
