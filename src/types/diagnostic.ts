import { BenchmarkStageId, BenchmarkStatus } from '@/lib/diagnosticBenchmarks';

export type BusinessModel = 'ecommerce' | 'inside_sales' | 'pdv';

export interface MarketMetrics {
    tam: number;
    sam: number;
    som: number;
    currentShare: number;
    targetShare: number;
    confidence: 'alta' | 'media' | 'baixa';
    justification: string;
}

export interface BowtieMetricData {
    value: number;
    evidence?: string;
    reliability: 'alta' | 'media' | 'baixa';
}

export type BowtieData = Record<BenchmarkStageId | 'cegueira', BowtieMetricData>;

export interface LTPNode {
    id: string;
    text: string;
    type: 'ude' | 'cause' | 'core_problem' | 'injection' | 'effect' | 'obstacle' | 'objective' | 'action';
    connections: string[]; // IDs of child nodes
}

export interface LTPEntity {
    ioMap: LTPNode[];
    crt: {
        nodes: LTPNode[];
        coreProblemId: string;
    };
    ec: {
        objective: string;
        needs: string[];
        actions: string[];
        assumptions: string[];
        injection: string;
    };
    frt: LTPNode[];
    prt: LTPNode[];
    tt: LTPNode[];
}

// Identification step data
export interface DiagnosticIdentification {
    companyName: string;
    product: string;
    icp: string;
    segment: string;
    location: string;
    businessModel: BusinessModel;
}

// Simplified business step
export interface DiagnosticBusiness {
    contributionMargin: number;
    averageTicket: number;
    revenue: number;
    revenueType: 'mensal' | 'anual';
}

// Funnel data per trava
export interface FunnelTravaData {
    [key: string]: number | string | boolean | null;
    _nao_aplica?: boolean;
}

export interface DiagnosticFunnelData {
    trava07: FunnelTravaData;
    trava06: FunnelTravaData;
    trava05: FunnelTravaData;
    trava04: FunnelTravaData;
    trava03: FunnelTravaData;
    trava02: FunnelTravaData;
    trava01: FunnelTravaData;
}

// AI Analysis result
export interface AIAnalysisResult {
    trava_identificada: string;
    trava_nome: string;
    confianca: 'alta' | 'media' | 'baixa';
    razao_core_problem: string;
    injecao_recomendada: string;
    udes: string[];
    sintese: string;
    ltp_analysis: {
        crt_nodes: string[];
        core_problem: string;
        evaporating_cloud: {
            objetivo: string;
            necessidade_a: string;
            necessidade_b: string;
            acao_a: string;
            acao_b: string;
            pressuposto_invalido: string;
            injecao: string;
        };
        frt_effects: string[];
        negative_branches: string[];
        prerequisite_tree: string[];
    };
    plano_90_dias: {
        mes_1: { titulo: string; acoes: string[] };
        mes_2: { titulo: string; acoes: string[] };
        mes_3: { titulo: string; acoes: string[] };
    };
    metricas_foco: string[];
    stage_scores: Array<{
        trava: string;
        nome: string;
        status: 'critico' | 'na_media' | 'bom' | 'sem_dados';
        valor_informado: string | null;
        observacao: string;
    }>;
}

export interface DiagnosticProject {
    id: string;
    name: string;
    segment: string;
    region?: string;
    icp?: string;
    model?: string;
    team?: string;
    businessModel?: BusinessModel;
    identification?: DiagnosticIdentification;
    businessData?: DiagnosticBusiness;
    funnelData?: DiagnosticFunnelData;
    aiAnalysis?: AIAnalysisResult;
    goal: {
        type: 'mensal' | 'trimestral' | 'anual';
        value: number;
        deadline?: string;
        restrictions: string[];
    };
    economics: {
        averageTicket: number;
        contributionMargin: number;
        ltv?: number;
        cycleTime: number;
        commercialCapacity: string;
        meetingsPerWeek?: number;
        proposalsPerWeek?: number;
    };
    market: MarketMetrics;
    bowtie: BowtieData;
    ltp: LTPEntity;
    status: 'rascunho' | 'completo';
    createdAt: string;
    updatedAt: string;
}
