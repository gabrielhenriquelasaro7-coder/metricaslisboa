import React, { useState, useEffect } from 'react';
import { DiagnosticProject, BowtieData } from '@/types/diagnostic';
import { useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useProjects } from '@/hooks/useProjects';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { toast } from 'sonner';
import {
    ChevronRight,
    ChevronLeft,
    Target,
    Users,
    Globe,
    FileText,
    Search,
    Zap,
    Eye,
    MousePointerClick,
    UserCheck,
    Calendar,
    ShoppingCart,
    RefreshCcw,
    EyeOff,
    Database,
    Sparkles,
    Loader2,
    CheckCircle2,
    ArrowRight,
    History as HistoryIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WizardProps {
    project: DiagnosticProject;
    onSave: (project: DiagnosticProject) => void;
    onCancel: () => void;
}

// ─── CONFIG DAS TRAVAS ────────────────────────────────────────────────────────
const STAGE_CONFIGS: Record<string, {
    metricLabel: string;
    metricUnit: string;
    placeholder: string;
    o_que_e: string;
    de_onde_vem: string;
    por_que_importa: string;
    formula?: string;
}> = {
    b07: {
        metricLabel: 'CPM (R$)',
        metricUnit: 'R$',
        placeholder: '18,00',
        o_que_e: 'Custo por Mil Impressões — quanto você paga para exibir seu anúncio 1.000 vezes para o ICP.',
        de_onde_vem: 'Meta Ads → Gerenciador de Anúncios → Coluna "CPM" (ou sincronizado automaticamente se selecionar um projeto ativo).',
        por_que_importa: 'CPM alto significa que você paga caro para ser visto. Benchmark p/ B2B: R$ 12–25. Se acima de R$ 30, sua segmentação ou criativo está repelindo o leilão.',
        formula: 'CPM = (Custo Total / Impressões) × 1.000',
    },
    b06: {
        metricLabel: 'CTR (%)',
        metricUnit: '%',
        placeholder: '6,23',
        o_que_e: 'Click-Through Rate — percentual de pessoas que viram o anúncio e clicaram nele.',
        de_onde_vem: 'Meta Ads → Gerenciador → Coluna "CTR (todos)" ou "CTR (link)". Use CTR de link para análise de topo de funil.',
        por_que_importa: 'CTR mede se o criativo captura atenção. Benchmark: 4,5–8%. CTR abaixo de 2% indica falha criativa (copy, imagem, formato) ou segmentação equivocada.',
        formula: 'CTR = (Cliques / Impressões) × 100',
    },
    b05: {
        metricLabel: 'CPC (R$)',
        metricUnit: 'R$',
        placeholder: '5,70',
        o_que_e: 'Custo por Clique — quanto você paga por cada clique no link do anúncio.',
        de_onde_vem: 'Meta Ads → CPC (link). Pode ser importado automaticamente se o projeto estiver sincronizado.',
        por_que_importa: 'CPC alto com CTR baixo indica que o público vê a criatividade como irrelevante. A trava de Interesse mapeia se o clique converte em lead.',
        formula: 'CPC = Custo Total / Cliques',
    },
    b04: {
        metricLabel: 'Taxa Lead → SQL (%)',
        metricUnit: '%',
        placeholder: '25,00',
        o_que_e: 'Percentual de leads que passam pela qualificação e se tornam SQLs (Sales Qualified Leads).',
        de_onde_vem: 'CRM (HubSpot, RD Station, Pipedrive) — coluna de conversão de Lead para SQL ou Oportunidade.',
        por_que_importa: 'Taxa baixa indica que o topo de funil atrai o perfil errado, ou o processo de qualificação (BANT, SPIN) está fraco.',
        formula: 'SQL Rate = (SQLs / Total Leads) × 100',
    },
    b03: {
        metricLabel: 'Taxa de No-Show (%)',
        metricUnit: '%',
        placeholder: '28,00',
        o_que_e: 'Percentual de reuniões agendadas em que o lead não compareceu.',
        de_onde_vem: 'CRM ou calendário de vendas (Calendly, Google Calendar). Reuniões marcadas vs. realizadas.',
        por_que_importa: 'No-show alto (>30%) indica fraco comprometimento do lead, funil não aquecido ou segmentação muito ampla. Benchmark: 20–35%.',
        formula: 'No-Show = (Faltas / Reuniões Marcadas) × 100',
    },
    b02: {
        metricLabel: 'Win Rate (%)',
        metricUnit: '%',
        placeholder: '25,00',
        o_que_e: 'Taxa de fechamento — percentual de propostas enviadas que se convertem em venda.',
        de_onde_vem: 'CRM: Negócios ganhos / Propostas enviadas. Ou relatório mensal de vendas.',
        por_que_importa: 'Win rate < 15% em B2B é sinal vermelho para trava de Decisão. Pode indicar: preço fora de posição, objeção não tratada ou concorrente mais forte.',
        formula: 'Win Rate = (Vendas / Propostas) × 100',
    },
    b01: {
        metricLabel: 'Churn Mensal (%)',
        metricUnit: '%',
        placeholder: '3,00',
        o_que_e: 'Percentual de clientes que cancelam ou deixam de comprar no mês.',
        de_onde_vem: 'Financeiro ou CRM: (Clientes início - Clientes fim) / Clientes início × 100.',
        por_que_importa: 'Churn alto zera o crescimento. Se churn > ticket médio × novos clientes, a empresa está enchendo um balde furado. Benchmark SaaS: <3% ao mês.',
        formula: 'Churn = ((Clientes Início − Clientes Fim) / Clientes Início) × 100',
    },
};

// ─── COMPONENT: MARKET STEP ───────────────────────────────────────────────────
function MarketStep({ project, updateProject }: { project: DiagnosticProject, updateProject: (data: Partial<DiagnosticProject>) => void }) {
    const [mode, setMode] = React.useState<'calculado' | 'direto'>('direto');
    const [universo, setUniverso] = React.useState(50000);
    const [arpa, setArpa] = React.useState(project.economics.averageTicket || 2500);
    const [freq, setFreq] = React.useState(12);
    const [pctElegivel, setPctElegivel] = React.useState(30);
    const [pctObtivel, setPctObtivel] = React.useState(10);

    React.useEffect(() => {
        if (mode === 'calculado') {
            const tam = universo * arpa * freq;
            const sam = tam * (pctElegivel / 100);
            const som = sam * (pctObtivel / 100);
            updateProject({ market: { ...project.market, tam, sam, som } });
        }
    }, [mode, universo, arpa, freq, pctElegivel, pctObtivel]);

    return (
        <div className="space-y-6 w-full">
            <div>
                <h3 className="text-lg font-black text-white">Mercado</h3>
                <p className="text-[11px] text-red-600 font-bold mt-0.5">Preencha as informações abaixo. Dados mais precisos = diagnóstico mais confiável.</p>
            </div>

            {/* Toggle modo */}
            <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white">Modo de entrada</Label>
                <div className="flex gap-2">
                    {(['calculado', 'direto'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                                'px-5 py-2 rounded-xl text-sm font-medium border transition-all',
                                mode === m
                                    ? 'border-red-600 text-red-600 bg-red-600/5'
                                    : 'border-white/10 text-zinc-400 bg-transparent hover:border-white/20'
                            )}
                        >
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {mode === 'direto' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { key: 'tam', label: 'TAM (R$)' },
                        { key: 'sam', label: 'SAM (R$)' },
                        { key: 'som', label: 'SOM (R$)' },
                    ].map(m => (
                        <div key={m.key} className="space-y-1.5">
                            <Label className="text-sm font-medium text-white">{m.label}</Label>
                            <Input
                                type="number"
                                className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                                value={(project.market as any)[m.key] || ''}
                                onChange={e => updateProject({ market: { ...project.market, [m.key]: Number(e.target.value) } })}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-white">Universo total (nº de contas/usuários)</Label>
                            <Input type="number" placeholder="50000" className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                                value={universo} onChange={e => setUniverso(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-white">ARPA / Ticket (R$)</Label>
                            <Input type="number" placeholder="2500" className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                                value={arpa} onChange={e => setArpa(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-white">Frequência anual</Label>
                            <Input type="number" placeholder="12" className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                                value={freq} onChange={e => setFreq(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-white">% Elegível (geo/ICP)</Label>
                            <Input type="number" placeholder="30" className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                                value={pctElegivel} onChange={e => setPctElegivel(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-white">% Obtível realista</Label>
                            <Input type="number" placeholder="10" className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                                value={pctObtivel} onChange={e => setPctObtivel(Number(e.target.value))} />
                            <p className="text-[11px] text-zinc-500">Default 5-20% dependendo do mercado</p>
                        </div>
                    </div>
                    {/* Resultado Calculado */}
                    <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-2">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Resultado Calculado</p>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { l: 'TAM', v: project.market.tam },
                                { l: 'SAM', v: project.market.sam },
                                { l: 'SOM', v: project.market.som },
                            ].map(item => (
                                <div key={item.l} className="text-center">
                                    <p className="text-[9px] text-zinc-600 font-black uppercase">{item.l}</p>
                                    <p className="text-sm font-black text-white font-mono">
                                        {(item.v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white">Fonte / justificativa</Label>
                <Input
                    placeholder="Ex: relatório Statista 2024"
                    className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                    value={project.market.justification}
                    onChange={e => updateProject({ market: { ...project.market, justification: e.target.value } })}
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white">Receita atual anual (R$)</Label>
                <Input
                    type="number"
                    placeholder="3600000"
                    className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                    value={project.goal.value ? project.goal.value * 12 : ''}
                    onChange={e => updateProject({ goal: { ...project.goal, value: Number(e.target.value) / 12 } })}
                />
            </div>
        </div>
    );
}

// ─── COMPONENT: BOWTIE STEP ───────────────────────────────────────────────────
function BowtieStep({ currentStep, project, updateBowtie, getStageHandle }: {
    currentStep: { id: string; label: string; icon: React.ElementType };
    project: DiagnosticProject;
    updateBowtie: (stage: any, data: any) => void;
    getStageHandle: (stepId: string) => string;
}) {
    const config = STAGE_CONFIGS[currentStep.id];
    const stageData = (project.bowtie as any)[getStageHandle(currentStep.id)] || {};

    return (
        <div className="space-y-5 w-full">
            {/* Cabeçalho */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-black text-white">Trava {currentStep.label}</h3>
                </div>
                <p className="text-[11px] text-red-600 font-bold">Preencha as informações abaixo. Dados mais precisos = diagnóstico mais confiável.</p>
            </div>

            {/* Painel Explicativo — identidade vermelha, sem azul */}
            {config && (
                <div className="border border-white/5 rounded-xl overflow-hidden">
                    <div className="bg-red-600/5 border-b border-white/5 px-5 py-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-red-600 rounded-full flex-shrink-0" />
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.18em]">
                            {config.metricLabel} — O que é esta métrica?
                        </p>
                    </div>
                    <div className="bg-zinc-950 divide-y divide-white/5">
                        {/* O que é */}
                        <div className="px-5 py-4 space-y-2">
                            <p className="text-[12px] text-zinc-200 leading-relaxed">
                                {config.o_que_e}
                            </p>
                            {config.formula && (
                                <p className="text-[10px] font-mono text-zinc-400 bg-black px-3 py-1.5 rounded border border-white/5 w-fit">
                                    {config.formula}
                                </p>
                            )}
                        </div>
                        {/* De onde vem */}
                        <div className="px-5 py-4">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">De onde vem este dado?</p>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">{config.de_onde_vem}</p>
                        </div>
                        {/* Por que importa */}
                        <div className="px-5 py-4">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Por que isso importa?</p>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">{config.por_que_importa}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Inputs — mesma largura total */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        {config?.metricLabel ?? 'Métrica Atual'}
                    </Label>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder={config?.placeholder ?? '0.00'}
                            step="0.01"
                            className="h-12 rounded-xl bg-black border-white/10 text-xl font-black text-white font-mono text-center placeholder:text-zinc-700"
                            value={stageData.value !== undefined ? stageData.value : ''}
                            onChange={e => updateBowtie(getStageHandle(currentStep.id), { value: parseFloat(Number(e.target.value).toFixed(2)) })}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Confiabilidade</Label>
                    <div className="flex gap-2 h-12 items-center">
                        {[
                            { val: 'baixa', label: 'Chute' },
                            { val: 'media', label: 'Estimativa' },
                            { val: 'alta', label: 'Certeza' },
                        ].map(lvl => (
                            <button
                                key={lvl.val}
                                onClick={() => updateBowtie(getStageHandle(currentStep.id), { reliability: lvl.val })}
                                className={cn(
                                    'flex-1 h-12 rounded-xl text-[9px] font-black uppercase border transition-all',
                                    stageData.reliability === lvl.val
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-black text-zinc-500 border-white/5 hover:border-white/15'
                                )}
                            >
                                {lvl.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Evidência */}
            <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Evidência / Fonte</Label>
                <Input
                    placeholder="Ex: Meta Ads → Relatório do período 01/02–28/02/2025"
                    className="h-11 rounded-xl bg-black border-white/10 text-white text-sm placeholder:text-zinc-700"
                    value={stageData.evidence || ''}
                    onChange={e => updateBowtie(getStageHandle(currentStep.id), { evidence: e.target.value })}
                />
                <p className="text-[10px] text-zinc-600">Cole um print, link ou descreva a fonte. Aumenta a confiança do diagnóstico.</p>
            </div>
        </div>
    );
}

const STEPS = [
    { id: 'context', label: 'Identificação', icon: FileText },
    { id: 'goal', label: 'Metas', icon: Target },
    { id: 'economics', label: 'Business', icon: Users },
    { id: 'market', label: 'Mercado', icon: Globe },
    { id: 'b07', label: '07 Exposição', icon: Eye },
    { id: 'b06', label: '06 Atenção', icon: Search },
    { id: 'b05', label: '05 Interesse', icon: MousePointerClick },
    { id: 'b04', label: '04 Qualificação', icon: UserCheck },
    { id: 'b03', label: '03 Compromisso', icon: Calendar },
    { id: 'b02', label: '02 Decisão', icon: ShoppingCart },
    { id: 'b01', label: '01 Retenção', icon: RefreshCcw },
    { id: 'b00', label: '00 Cegueira', icon: EyeOff },
    { id: 'review', label: 'Revisão', icon: Zap },
];

export function DiagnosticWizard({ project: initialProject, onSave, onCancel }: WizardProps) {
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [project, setProject] = useState<DiagnosticProject>(initialProject);
    const [selectedProjectId, setSelectedProjectId] = useState<string>((initialProject as any).systemProjectId || '');
    const toastShownRef = useRef<string | null>(null);
    const { projects: availableProjects } = useProjects();

    // Fetch metrics specifically for the selected project
    const { comparison: metrics, loading: loadingMetrics } = useDailyMetrics(
        selectedProjectId || (project as any).systemProjectId || undefined,
        'last_30d'
    );

    const currentStep = STEPS[currentStepIdx];
    const progress = ((currentStepIdx + 1) / STEPS.length) * 100;

    const updateProject = (data: Partial<DiagnosticProject>) => {
        setProject(prev => ({ ...prev, ...data }));
    };

    const updateBowtie = (stage: keyof BowtieData, data: any) => {
        setProject(prev => ({
            ...prev,
            bowtie: {
                ...prev.bowtie,
                [stage]: { ...prev.bowtie[stage], ...data }
            }
        }));
    };

    // Auto-pre-fill logic - AUTOMATED
    // Re-sincroniza dados sempre que metrics carregar (mesmo em re-edições)
    useEffect(() => {
        if (selectedProjectId && metrics?.currentTotals && !loadingMetrics) {
            const totals = metrics.currentTotals;

            // Verifica se há dados reais vindos da API (pelo menos spend ou impressions > 0)
            const hasRealData = (totals.spend || 0) > 0 || (totals.impressions || 0) > 0;
            if (!hasRealData) {
                console.log('[DiagnosticWizard] Nenhum dado real encontrado para sincronizar.');
                return;
            }

            setProject(prev => {
                // Se for um rascunho novo, podemos ser mais agressivos na sincronização inicial
                const isNewDraft = prev.status === 'rascunho';

                const shouldUpdate = (currentVal: number, newVal: number) =>
                    (isNewDraft || currentVal === 0 || currentVal === undefined) ? newVal : currentVal;

                return {
                    ...prev,
                    bowtie: {
                        ...prev.bowtie,
                        exposicao: {
                            ...prev.bowtie.exposicao,
                            value: shouldUpdate(prev.bowtie.exposicao.value, Number((totals.cpm || 0).toFixed(2))),
                            reliability: prev.bowtie.exposicao.reliability === 'media' ? 'alta' : prev.bowtie.exposicao.reliability,
                            evidence: prev.bowtie.exposicao.evidence || `Sincronizado via Meta/Google Ads. Reach: ${totals.reach || 0}`
                        },
                        atencao: {
                            ...prev.bowtie.atencao,
                            value: shouldUpdate(prev.bowtie.atencao.value, Number((totals.ctr || 0).toFixed(2))),
                            reliability: prev.bowtie.atencao.reliability === 'media' ? 'alta' : prev.bowtie.atencao.reliability,
                            evidence: prev.bowtie.atencao.evidence || `CTR Sincronizado.`
                        },
                        interesse: {
                            ...prev.bowtie.interesse,
                            value: shouldUpdate(prev.bowtie.interesse.value, Number((totals.cpc || 0).toFixed(2))),
                            reliability: prev.bowtie.interesse.reliability === 'media' ? 'alta' : prev.bowtie.interesse.reliability,
                            evidence: prev.bowtie.interesse.evidence || `Custo por Interesse (CPC) identificado.`
                        },
                        qualificacao: {
                            ...prev.bowtie.qualificacao,
                            value: shouldUpdate(prev.bowtie.qualificacao.value, Number((totals.cvr_leads || 0).toFixed(2))),
                            reliability: prev.bowtie.qualificacao.reliability === 'media' ? 'alta' : prev.bowtie.qualificacao.reliability,
                            evidence: prev.bowtie.qualificacao.evidence || `CPL Calculado: R$ ${totals.cpa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`
                        },
                        decisao: {
                            ...prev.bowtie.decisao,
                            value: shouldUpdate(prev.bowtie.decisao.value, Number((totals.cvr_sales || 0).toFixed(2))),
                            reliability: prev.bowtie.decisao.reliability === 'media' ? 'alta' : prev.bowtie.decisao.reliability,
                        }
                    }
                };
            });

            // Toast só na primeira vez
            if (toastShownRef.current !== selectedProjectId) {
                toast.success(`Métricas importadas!`, {
                    icon: <Sparkles className="w-4 h-4 text-red-600" />,
                });
                toastShownRef.current = selectedProjectId;
            }
        }
    }, [selectedProjectId, metrics, loadingMetrics]);

    const handleProjectSelect = (id: string) => {
        setSelectedProjectId(id);
        const selected = availableProjects.find(p => p.id === id);
        if (selected) {
            setProject(prev => ({
                ...prev,
                name: selected.name,
                segment: (selected as any).segment || 'Serviços',
                systemProjectId: id // Persistir o ID do sistema
            }));
        }
    };

    const handleBack = () => {
        if (currentStepIdx > 0) {
            setCurrentStepIdx(prev => prev - 1);
            window.scrollTo(0, 0);
        } else {
            onCancel();
        }
    };

    const handleNext = () => {
        if (currentStepIdx < STEPS.length - 1) {
            setCurrentStepIdx(prev => prev + 1);
            window.scrollTo(0, 0);
        } else {
            const finalProject = {
                ...project,
                status: 'completo' as const,
                updatedAt: new Date().toISOString(),
                systemProjectId: selectedProjectId || (project as any).systemProjectId
            };
            onSave(finalProject);
        }
    };

    const phases = [
        { label: 'Fundamentos', icon: Target, steps: ['context', 'goal', 'economics', 'market'] },
        { label: 'Aquisição', icon: Zap, steps: ['b07', 'b06', 'b05'] },
        { label: 'Comercial', icon: Users, steps: ['b04', 'b03', 'b02'] },
        { label: 'Retenção', icon: HistoryIcon, steps: ['b01', 'b00', 'review'] }
    ];

    const currentPhase = phases.find(p => p.steps.includes(currentStep.id)) || phases[0];

    return (
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Phase Stepper - Premium */}
            <div className="bg-zinc-950 p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] pointer-events-none" />

                <div className="flex items-center justify-between mb-8 overflow-x-auto no-scrollbar pb-2">
                    {phases.map((phase, idx) => {
                        const isActive = currentPhase.label === phase.label;
                        const isPast = phases.findIndex(p => p.label === currentPhase.label) > idx;
                        return (
                            <div key={idx} className="flex items-center gap-4 group">
                                <div className="flex flex-col items-center gap-2">
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                                        isActive ? "bg-red-600 border-red-600 shadow-xl shadow-red-600/20 text-white" :
                                            isPast ? "bg-zinc-900 border-emerald-600/30 text-emerald-500" : "bg-black border-white/5 text-zinc-700"
                                    )}>
                                        {isPast ? <CheckCircle2 className="w-5 h-5" /> : <phase.icon className="w-5 h-5" />}
                                    </div>
                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", isActive ? "text-white" : "text-zinc-700")}>{phase.label}</span>
                                </div>
                                {idx < phases.length - 1 && <div className="w-8 h-px bg-zinc-900 mx-2" />}
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between items-end mb-2 px-1">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight italic">{currentStep.label}</h2>
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{Math.round(progress)}% COMPLETO</span>
                    </div>
                    <Progress value={progress} className="h-1 bg-zinc-900" />
                </div>
            </div>

            {/* Conteúdo */}
            <div className="bg-zinc-950 border border-white/5 rounded-xl overflow-hidden">
                {/* Botão Voltar */}
                <div className="px-8 pt-5 pb-0">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-1.5 text-[10px] font-black text-zinc-600 hover:text-white uppercase tracking-widest transition-colors group"
                    >
                        <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Voltar
                    </button>
                </div>

                <div className="px-8 py-6 md:px-10 md:py-8">
                    {currentStep.id === 'context' && (
                        <div className="space-y-6 w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Nome do Diagnóstico</Label>
                                    <Input
                                        placeholder="Ex: Operação Escala Norte"
                                        className="h-12 rounded-2xl bg-black border-white/10 focus:border-red-600/50 text-white text-xs font-bold px-4"
                                        value={project.name}
                                        onChange={e => updateProject({ name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Segmento de Atuação</Label>
                                    <Select value={project.segment} onValueChange={(val: any) => updateProject({ segment: val })}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-black border-white/10 focus:border-red-600/50 text-white text-xs font-bold px-4">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                            <SelectItem value="Serviços" className="text-xs font-bold uppercase tracking-tight">Serviços</SelectItem>
                                            <SelectItem value="Varejo / Retail" className="text-xs font-bold uppercase tracking-tight">Varejo / Retail</SelectItem>
                                            <SelectItem value="E-commerce B2C" className="text-xs font-bold uppercase tracking-tight">E-commerce B2C</SelectItem>
                                            <SelectItem value="Indústria B2B" className="text-xs font-bold uppercase tracking-tight">Indústria B2B</SelectItem>
                                            <SelectItem value="Infoprodutos" className="text-xs font-bold uppercase tracking-tight">Infoprodutos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">ICP (Perfil do Cliente Ideal)</Label>
                                <Textarea
                                    placeholder="Descreva as dores, ambições e características do público alvo..."
                                    className="h-32 rounded-3xl bg-black border-white/10 focus:border-red-600/50 text-white text-xs font-bold p-4 resize-none"
                                    value={project.icp}
                                    onChange={e => updateProject({ icp: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {currentStep.id === 'goal' && (
                        <div className="space-y-6 w-full">
                            <div className="space-y-5">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Modelo de Faturamento</Label>
                                    <Select value={project.goal.type} onValueChange={(val: any) => updateProject({ goal: { ...project.goal, type: val } })}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-zinc-950 border-white/10 text-white text-xs font-black uppercase">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                            <SelectItem value="mensal" className="text-xs font-black uppercase">Mensal</SelectItem>
                                            <SelectItem value="trimestral" className="text-xs font-black uppercase">Trimestral</SelectItem>
                                            <SelectItem value="anual" className="text-xs font-black uppercase">Anual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Meta Bruta Destino (R$)</Label>
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">R$</span>
                                        <Input
                                            type="number"
                                            className="h-16 pl-12 rounded-2xl bg-zinc-950 border-white/10 focus:border-red-600/50 text-2xl font-black text-white tracking-tighter"
                                            value={project.goal.value || ''}
                                            onChange={e => updateProject({ goal: { ...project.goal, value: Number(e.target.value) } })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep.id === 'economics' && (
                        <div className="space-y-6 w-full">
                            <div>
                                <h3 className="text-lg font-black text-white">Unidades</h3>
                                <p className="text-[11px] text-red-500 font-medium mt-0.5">Preencha as informações abaixo. Dados mais precisos = diagnóstico mais confiável.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Ticket médio (R$)</Label>
                                    <Input
                                        type="number"
                                        placeholder="2500"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.economics.averageTicket || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, averageTicket: Number(e.target.value) } })}
                                    />
                                    <p className="text-[11px] text-zinc-500">Valor médio por venda</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Margem de contribuição (%)</Label>
                                    <Input
                                        type="number"
                                        placeholder="65"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.economics.contributionMargin || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, contributionMargin: Number(e.target.value) } })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">LTV (R$)</Label>
                                    <Input
                                        type="number"
                                        placeholder="30000"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.economics.ltv || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, ltv: Number(e.target.value) } })}
                                    />
                                    <p className="text-[11px] text-amber-500">Lifetime Value (se recorrência)</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Tempo médio de ciclo (dias)</Label>
                                    <Input
                                        type="number"
                                        placeholder="28"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.economics.cycleTime || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, cycleTime: Number(e.target.value) } })}
                                    />
                                    <p className="text-[11px] text-zinc-500">Do primeiro contato até a venda</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Reuniões/semana por vendedor</Label>
                                    <Input
                                        type="number"
                                        placeholder="12"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.economics.meetingsPerWeek || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, meetingsPerWeek: Number(e.target.value) } })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Propostas/semana (time)</Label>
                                    <Input
                                        type="number"
                                        placeholder="8"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.economics.proposalsPerWeek || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, proposalsPerWeek: Number(e.target.value) } })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-white">Limite operacional</Label>
                                <Input
                                    placeholder="Ex: máximo 200 clientes ativos simultâneos"
                                    className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white"
                                    value={project.economics.commercialCapacity}
                                    onChange={e => updateProject({ economics: { ...project.economics, commercialCapacity: e.target.value } })}
                                />
                                <p className="text-[11px] text-zinc-500">Alguma limitação de capacidade relevante?</p>
                            </div>
                        </div>
                    )}

                    {currentStep.id === 'market' && (
                        <MarketStep project={project} updateProject={updateProject} />
                    )}

                    {/* Bowtie Steps */}
                    {currentStep.id.startsWith('b') && currentStep.id !== 'b00' && (
                        <BowtieStep
                            currentStep={currentStep}
                            project={project}
                            updateBowtie={updateBowtie}
                            getStageHandle={getStageHandle}
                        />
                    )}

                    {currentStep.id === 'b00' && (
                        <div className="space-y-10 max-w-xl mx-auto w-full text-center">
                            <div className="w-24 h-24 bg-red-600/10 border border-red-600/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-red-600/5">
                                <EyeOff className="w-12 h-12 text-red-600" />
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Grau de Cegueira (00)</h3>
                                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Se você não tem dados confiáveis, sua verdadeira restrição não é o funil, mas a falta de visibilidade.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Label className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-700">Qual a maturidade dos seus dados?</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {['baixa', 'media', 'alta'].map(lvl => (
                                        <Button
                                            key={lvl}
                                            variant="outline"
                                            className={cn(
                                                "h-16 rounded-2xl text-[9px] font-black uppercase tracking-widest",
                                                project.bowtie.cegueira.reliability === lvl ? "bg-red-600 text-white border-red-600" : "bg-black border-white/5 text-zinc-600"
                                            )}
                                            onClick={() => updateBowtie('cegueira', { reliability: lvl as any })}
                                        >
                                            {lvl === 'alta' ? 'Data-Driven' : lvl === 'media' ? 'Semi-Manual' : 'Operação Cega'}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep.id === 'review' && (
                        <div className="space-y-8 max-w-md mx-auto w-full text-center py-10">
                            <div className="w-24 h-24 bg-emerald-600/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-600/20">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Insumos Coletados</h3>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Clique para processar os dados e gerar a inferência causal de restrição.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 p-6 bg-black rounded-[2rem] border border-white/5 text-left">
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Projeto</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{project.name}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Faturamento Alvo</span>
                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">R$ {project.goal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Maturidade</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{project.bowtie.cegueira.reliability}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rodapé */}
                <div className="px-8 md:px-10 py-4 border-t border-white/5 flex items-center justify-between">
                    <button
                        onClick={onCancel}
                        className="text-[10px] font-black text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition-colors"
                    >
                        Abandonar
                    </button>
                    <Button
                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-10 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95"
                        onClick={handleNext}
                    >
                        {currentStepIdx === STEPS.length - 1 ? 'Gerar Diagnóstico' : 'Avançar'} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function getStageHandle(stepId: string): string {
    const map: Record<string, string> = {
        'b07': 'exposicao',
        'b06': 'atencao',
        'b05': 'interesse',
        'b04': 'qualificacao',
        'b03': 'compromisso',
        'b02': 'decisao',
        'b01': 'retencao',
        'b00': 'cegueira'
    };
    return map[stepId] || 'exposicao';
}
