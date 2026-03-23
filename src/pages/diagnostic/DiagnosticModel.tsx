import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
    Activity,
    Shapes,
    SearchCode,
    AlertTriangle,
    Info,
    ShieldCheck,
    Radio,
    EyeOff,
    MousePointerClick,
    Target,
    Handshake,
    FileX,
    UserMinus,
    SearchX,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Dados das 8 Travas ─────────────────────────────────────────────────────
const TRAVAS = [
    { id: '01', icon: <Radio className="w-6 h-6" />, title: 'Exposição', desc: 'Ninguém vê — alcance insuficiente no ICP', color: 'border-red-900/20 bg-red-900/5', badge: 'text-red-600 bg-red-900/10' },
    { id: '02', icon: <EyeOff className="w-6 h-6" />, title: 'Atenção', desc: 'Vê mas não liga — atenção não capturada', color: 'border-orange-600/20 bg-orange-600/5', badge: 'text-orange-500 bg-orange-600/10' },
    { id: '03', icon: <MousePointerClick className="w-6 h-6" />, title: 'Interesse', desc: 'Clica mas não vira lead — interesse sem conversão', color: 'border-amber-600/20 bg-amber-600/5', badge: 'text-amber-500 bg-amber-600/10' },
    { id: '04', icon: <Target className="w-6 h-6" />, title: 'Qualificação', desc: 'Vira lead mas não serve — qualificação fraca', color: 'border-yellow-600/20 bg-yellow-600/5', badge: 'text-yellow-500 bg-yellow-600/10' },
    { id: '05', icon: <Handshake className="w-6 h-6" />, title: 'Compromisso', desc: 'Abandona / no-show — compromisso perdido', color: 'border-amber-700/20 bg-amber-700/5', badge: 'text-amber-500 bg-amber-700/10' },
    { id: '06', icon: <FileX className="w-6 h-6" />, title: 'Decisão', desc: 'Chega no fim e não compra — decisão travada', color: 'border-orange-800/20 bg-orange-800/5', badge: 'text-orange-600 bg-orange-800/10' },
    { id: '07', icon: <UserMinus className="w-6 h-6" />, title: 'Retenção', desc: 'Compra e não fica — retenção deficiente', color: 'border-red-600/20 bg-red-600/5', badge: 'text-red-500 bg-red-600/10' },
    { id: '00', icon: <SearchX className="w-6 h-6" />, title: 'Cegueira', desc: 'Não há dados confiáveis — cegueira operacional', color: 'border-zinc-700/20 bg-zinc-700/5', badge: 'text-zinc-400 bg-zinc-700/10' },
];

const TOC_STEPS = [
    { num: '1', label: 'IDENTIFICAR', desc: 'Encontrar a restrição que limita o throughput (vendas/receita)', color: 'bg-red-600' },
    { num: '2', label: 'EXPLORAR', desc: 'Extrair o máximo da restrição sem investir mais (otimizar)', color: 'bg-orange-500' },
    { num: '3', label: 'SUBORDINAR', desc: 'Alinhar todo o sistema à restrição — não desperdiçar em etapas não-restritivas', color: 'bg-amber-500' },
    { num: '4', label: 'ELEVAR', desc: 'Investir para aumentar a capacidade da restrição', color: 'bg-emerald-500' },
    { num: '5', label: 'REPETIR', desc: 'Quando a restrição muda, voltar ao passo 1', color: 'bg-zinc-500' },
];

const LTP_TOOLS = [
    { abbr: 'CRT', name: 'Current Reality Tree', desc: 'Mapeia UDEs (efeitos indesejáveis), conecta causas e identifica o Core Problem — a causa-raiz que explica ≥70% dos UDEs.' },
    { abbr: 'EC', name: 'Evaporating Cloud', desc: 'Explicita o conflito entre ação atual e ação necessária. Identifica premissas vulneráveis e gera a injeção (solução).' },
    { abbr: 'FRT', name: 'Future Reality Tree', desc: 'Valida que a injeção elimina os UDEs e gera efeitos desejáveis. Identifica ramos negativos (NBR).' },
    { abbr: 'NBR', name: 'Negative Branches', desc: 'Efeitos colaterais potenciais da solução. Trimmings são injeções adicionais para mitigá-los.' },
    { abbr: 'PRT', name: 'Prerequisite Tree', desc: 'Lista obstáculos para implementar a injeção e define objetivos intermediários para superá-los.' },
    { abbr: 'TT', name: 'Transition Tree', desc: 'Plano passo a passo com ações, responsáveis, prazos e critérios de validação.' },
];

const CALC_STEPS = [
    'Calcula o volume necessário em cada etapa para atingir a meta (backward)',
    'Compara com o volume atual (gap ratio)',
    'Mede a sensibilidade: quanto 10% de melhoria impactaria',
    'Avalia atrito qualitativo (no-show, SLA lento, etc.)',
    'Score final = gap + sensibilidade + atrito → maior score = trava ativa',
];

const ROTINA_STEPS = [
    { num: '1', label: 'Preencher dados', desc: 'Coletar métricas reais do cliente no wizard (8-12 steps)' },
    { num: '2', label: 'Obter trava', desc: 'O sistema calcula e identifica a trava ativa automaticamente' },
    { num: '3', label: 'Validar com impulso', desc: 'Testar com "impulso controlado" (ex: +25% em mídia por 2 semanas) para confirmar a restrição' },
    { num: '4', label: 'Executar plano 90 dias', desc: 'Seguir o plano focado em uma trava por vez, com KPIs semanais' },
    { num: '5', label: 'Repetir ciclo', desc: 'Ao destravar, uma nova trava surge. Recomeçar o diagnóstico' },
];

// ─── Label de seção ──────────────────────────────────────────────────────────
function SectionLabel({ tag, title, subtitle }: { tag: string; title: string; subtitle?: string }) {
    return (
        <div className="space-y-2 pb-6 border-b border-border flex flex-col items-center text-center">
            <span className="text-[9px] font-black text-red-600 uppercase tracking-[0.3em]">{tag}</span>
            <h3 className="text-2xl lg:text-3xl font-black text-foreground uppercase tracking-tighter italic" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground font-bold uppercase leading-relaxed tracking-widest w-full text-center">{subtitle}</p>}
        </div>
    );
}

export function DiagnosticModel() {
    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">

            {/* ── HERO ─────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden flex flex-col items-center text-center">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.06),transparent_60%)] pointer-events-none" />

                <div className="relative z-10 space-y-6 flex flex-col items-center">
                    <Badge className="bg-red-600 text-white border-none py-1.5 px-5 text-[8px] font-black tracking-[0.25em] uppercase rounded-full shadow-lg shadow-red-600/30">
                        DESTRAVA RECEITA · ENGINE V4
                    </Badge>

                    <h2 className="text-4xl lg:text-7xl font-black text-foreground leading-[0.85] uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        Toda empresa é uma <br /><span className="text-red-500 italic">Fábrica de Receita</span>
                    </h2>

                    <div className="space-y-4 w-full">
                        <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                            Seu produto final não é o que você vende — é a receita que você gera. Empresas com produtos piores vencem por dominarem melhor seu <strong className="text-foreground">sistema de geração de receita</strong>. Produtos e serviços são apenas os meios para esse fim.
                        </p>
                        <p className="text-sm text-muted-foreground/70 leading-relaxed font-medium">
                            A maioria das empresas faz "várias coisas certas" sem um fluxo orientado ao output global. Agências melhoram anúncios, posts, CRM... mas o faturamento não sobe proporcionalmente. <span className="text-foreground/70 italic">Execução, sem a direção correta, é apenas velocidade no caminho errado.</span>
                        </p>
                    </div>

                    <div className="p-5 bg-red-600/5 border border-red-600/20 rounded-xl w-full text-center">
                        <p className="text-[11px] font-black text-foreground uppercase tracking-widest mb-1">A Restrição Dominante</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Sempre existe uma única restrição que limita o sistema inteiro. Identificá-la é o primeiro passo. O Destrava Receita faz exatamente isso: encontra a trava e cria um plano causal para resolvê-la.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── MODELO: BOWTIE ─────────────────────────────────────── */}
            <section className="space-y-8">
                <SectionLabel tag="Modelo" title="Bowtie e as 8 Travas" subtitle="O funil de receita é modelado como um Bowtie com 8 etapas. Cada etapa pode ser a trava ativa — o ponto que limita todo o sistema." />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {TRAVAS.map((trava) => (
                        <div key={trava.id} className={cn("p-5 rounded-xl border flex flex-col gap-3 group transition-all hover:scale-[1.02] duration-300", trava.color)}>
                            <div className="flex items-center justify-between">
                                <div className={cn("text-foreground/80 p-2 rounded-xl bg-muted/50 dark:bg-black/40 border border-border", trava.badge)}>
                                    {trava.icon}
                                </div>
                                <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest", trava.badge)}>
                                    Trava {trava.id}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm font-black text-white uppercase tracking-tight">{trava.title}</p>
                                <p className="text-[9px] text-zinc-500 font-medium leading-relaxed mt-1">{trava.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Como o app calcula */}
                <div className="border-l-2 border-red-600/40 pl-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-red-600" />
                        <p className="text-xs font-black text-white uppercase tracking-widest">Como o app calcula a trava · Motor de Inferência Causal</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {CALC_STEPS.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                <span className="text-[10px] font-black text-red-600 bg-red-600/10 border border-red-600/20 w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                                <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── TEORIA: TOC ──────────────────────────────────────────── */}
            <section className="space-y-8">
                <SectionLabel tag="Teoria" title="TOC Aplicado ao Funil" subtitle="A Theory of Constraints (TOC) de Goldratt aplicada ao sistema de receita:" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {TOC_STEPS.map((step) => (
                        <div key={step.num} className="relative p-5 bg-zinc-950 border border-white/5 rounded-xl space-y-3 group hover:border-white/10 transition-all">
                            <span className={cn("w-7 h-7 rounded text-white text-[11px] font-black flex items-center justify-center", step.color)}>{step.num}</span>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{step.label}</p>
                            <p className="text-[9px] text-zinc-600 font-medium leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start p-6 bg-zinc-950 border border-white/5 rounded-xl">
                    <div className="relative w-20 h-20 flex-shrink-0">
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-red-600/20 animate-[spin_20s_linear_infinite]" />
                        <div className="absolute inset-3 rounded-full border border-white/5" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Activity className="w-8 h-8 text-red-600 animate-pulse" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Badge className="bg-red-600/10 text-red-600 border-none px-3 py-0.5 text-[8px] font-black">THROUGHPUT NO FUNIL</Badge>
                        <p className="text-sm text-zinc-400 leading-relaxed w-full">
                            O <strong className="text-white">"throughput"</strong> é a taxa com que o sistema converte impressões em receita. A restrição é o ponto mais estreito — onde o fluxo é interrompido ou acumulado. <span className="text-zinc-300">Melhorar qualquer outra etapa não aumenta o output do sistema.</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* ── FERRAMENTAS: LTP ─────────────────────────────────────── */}
            <section className="space-y-8">
                <SectionLabel tag="Ferramentas" title="LTP – Logical Thinking Process" subtitle="Após identificar a trava, o motor LTP gera automaticamente uma cadeia lógica completa:" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {LTP_TOOLS.map((tool, idx) => (
                        <div key={tool.abbr} className="p-5 bg-zinc-950 border border-white/5 rounded-xl space-y-3 group hover:border-red-600/20 transition-all">
                            <div className="flex items-start justify-between">
                                <div className="w-10 h-10 rounded bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                                    <span className="text-[11px] font-black text-red-600">{tool.abbr}</span>
                                </div>
                                <span className="text-[9px] text-zinc-700 font-black font-mono">{String(idx + 1).padStart(2, '0')}</span>
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-white uppercase tracking-widest">{tool.name}</p>
                                <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-2">{tool.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── MERCADO: TAM/SAM/SOM ─────────────────────────────────── */}
            <section className="space-y-8">
                <SectionLabel tag="Mercado" title="TAM / SAM / SOM e Market Share" subtitle="O mercado pode ser a própria restrição. Se a meta exige um market share irreal, não há otimização de funil que resolva." />

                <div className="flex flex-col gap-6">
                    {/* Linha 1: 3 cards TAM, SAM, SOM */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { abbr: 'TAM', name: 'Total Addressable Market', formula: 'Universo total × ARPA × frequência' },
                            { abbr: 'SAM', name: 'Serviceable Addressable Market', formula: 'TAM × % elegível' },
                            { abbr: 'SOM', name: 'Serviceable Obtainable Market', formula: 'SAM × % obtível realista' },
                        ].map((m) => (
                            <div key={m.abbr} className="p-6 bg-zinc-950/80 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 hover:border-amber-500/20 transition-all shadow-lg shadow-black/50">
                                <div>
                                    <p className="text-2xl font-black text-white">{m.abbr}</p>
                                    <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-widest mt-1">{m.name}</p>
                                </div>
                                <p className="text-[11px] text-zinc-500 font-medium">{m.formula}</p>
                            </div>
                        ))}
                    </div>

                    {/* Linha 2: Share Atual vs Necessário */}
                    <div className="p-6 md:p-8 bg-zinc-950/80 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-black/50">
                        <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-3">
                                <Shapes className="w-5 h-5 text-amber-500" />
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Share Atual vs Necessário</h4>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { label: 'Share atual', formula: 'Receita atual / SAM' },
                                    { label: 'Share necessário', formula: 'Meta anual / SAM' },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center gap-3 text-sm">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                        <span className="font-bold text-zinc-300 uppercase text-[10px] tracking-widest">{item.label}</span>
                                        <span className="text-zinc-600">=</span>
                                        <span className="text-zinc-500 font-mono text-[10px]">{item.formula}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 w-full">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-500/90 leading-relaxed font-bold">
                                Se share necessário &gt; 20-30% → <span className="text-amber-500 font-black">sinal vermelho</span>. O mercado pode ser a própria restrição.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── ROTINA ──────────────────────────────────────────────── */}
            <section className="space-y-8">
                <SectionLabel tag="Rotina" title="Como Usar na Prática" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {ROTINA_STEPS.map((step) => (
                        <div key={step.num} className="p-5 bg-zinc-950 border border-white/5 rounded-xl space-y-3 hover:border-white/10 transition-all group">
                            <span className="w-7 h-7 rounded bg-zinc-900 text-white text-[11px] font-black flex items-center justify-center group-hover:bg-red-600 transition-all">
                                {step.num}
                            </span>
                            <p className="text-[10px] font-black text-white uppercase tracking-tight">{step.label}</p>
                            <p className="text-[9px] text-zinc-600 font-medium leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="flex items-start gap-4 border-l-2 border-amber-500/40 pl-5">
                    <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[11px] font-black text-white uppercase tracking-widest mb-1">💡 Recomendação</p>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Sempre <strong className="text-white">"uma trava por vez"</strong> em ciclos de 90 dias. Tentar resolver múltiplas travas simultaneamente é otimização local — aumenta custo sem mover o throughput global.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── PADRÕES DE QUALIDADE ─────────────────────────────────── */}
            <section className="space-y-8">
                <SectionLabel tag="Padrões" title="Padrões de Qualidade" subtitle="Nível de Confiança do Diagnóstico — baseado em: completude dos dados, confiabilidade informada e consistência entre métricas." />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        {[
                            { cor: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]', nivel: 'Alta', desc: 'Dados completos e consistentes', bg: 'bg-emerald-500/5 border-emerald-500/20', label: 'text-emerald-500' },
                            { cor: 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]', nivel: 'Média', desc: 'Alguns dados estimados', bg: 'bg-yellow-500/5 border-yellow-500/20', label: 'text-yellow-500' },
                            { cor: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', nivel: 'Baixa', desc: 'Dados insuficientes ou inconsistentes', bg: 'bg-red-500/5 border-red-500/20', label: 'text-red-500' },
                        ].map((item) => (
                            <div key={item.nivel} className={cn("p-5 rounded-xl border flex items-center gap-4", item.bg)}>
                                <div className={cn("w-4 h-4 rounded-full flex-shrink-0 mt-0.5", item.cor)} />
                                <div>
                                    <p className={cn("text-[11px] font-black uppercase tracking-widest", item.label)}>{item.nivel}</p>
                                    <p className="text-[10px] text-zinc-500 font-medium">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-zinc-950 border border-red-600/10 rounded-xl space-y-5">
                        <div className="flex items-center gap-3">
                            <SearchCode className="w-5 h-5 text-red-600" />
                            <p className="text-[11px] font-black text-white uppercase tracking-widest">Quando o sistema força "Trava 00 – Cegueira"</p>
                        </div>
                        <ul className="space-y-2.5">
                            {[
                                'Confiabilidade do CRM marcada como "baixa"',
                                'Campos críticos faltantes para calcular o funil',
                                'Tracking (UTM/origem) não implementado',
                                'Funil não padronizado no CRM',
                            ].map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 flex-shrink-0 shadow-[0_0_6px_rgba(220,38,38,0.6)]" />
                                    <p className="text-[10px] text-zinc-500 font-medium">{item}</p>
                                </li>
                            ))}
                        </ul>
                        <div className="pt-4 border-t border-white/5">
                            <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Importância de evidências</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">Cada métrica coletada deve ter evidência (print, link, relatório) e nível de confiabilidade. Números sem evidência reduzem a confiança do diagnóstico.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FINAL ──────────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-red-600 rounded-xl p-10 lg:p-16 group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-[80px] group-hover:scale-110 transition-all duration-[2000ms]" />
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10 text-white">
                    <div className="space-y-4 text-center lg:text-left">
                        <ShieldCheck className="w-14 h-14 opacity-30 mx-auto lg:mx-0" />
                        <h4 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                            Precisão <br /><span className="italic">Cirúrgica</span>
                        </h4>
                        <p className="w-full text-red-50/70 font-black text-xs uppercase tracking-tight leading-relaxed">
                            "A melhoria de qualquer coisa que não seja a Restrição é uma ilusão técnica."
                        </p>
                        <p className="text-[10px] font-black text-red-100 uppercase tracking-[0.6em] py-2 border-y border-white/10 w-fit">BOWTIE ENGINE V4</p>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md p-7 rounded-xl border border-white/10 space-y-3 max-w-xs transition-transform hover:-rotate-1 duration-500">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Pronto para começar?</span>
                        </div>
                        <p className="text-[11px] font-bold uppercase leading-relaxed text-red-50">Inicie o diagnóstico para mapear sua primeira trava e desbloquear o próximo nível de escala.</p>
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] pt-1">
                            INICIAR AGORA <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
