import { BenchmarkStageId, BenchmarkStatus } from '@/lib/diagnosticBenchmarks';

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
    type: 'ude' | 'cause' | 'core_problem' | 'injection' | 'effect' | 'obstacle' | 'objective' | 'action' | 'milestone' | 'kpi';
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

export interface DiagnosticProject {
    id: string;
    name: string;
    segment: string;
    region?: string;
    icp?: string;
    model?: string;
    team?: string;
    briefing?: {
        niche: string;
        current_situation: string;
        main_pains: string;
        business_model_desc: string;
    };
    goal: {
        type: 'mensal' | 'trimestral' | 'anual';
        value: number;
        mrr_atual?: number;
        deadline?: string;
        restrictions: string[];
    };
    economics: {
        averageTicket: number;
        contributionMargin: number;
        ltv?: number;
        cycleTime: number;
        commercialCapacity: string;
    };
    market: MarketMetrics;
    bowtie: BowtieData;
    ltp: LTPEntity;
    tracking: {
        utms_implementadas: boolean;
        crm_com_origem: boolean;
        funil_padronizado_crm: boolean;
        conf_crm: 'alta' | 'media' | 'baixa';
    };
    status: 'rascunho' | 'completo';
    createdAt: string;
    updatedAt: string;
    ai_analysis?: {
        ude: string[];
        coreProblem: string;
        injection: string;
        plan90Days: {
            phase1: { title: string; actions: string[] };
            phase2: { title: string; actions: string[] };
            phase3: { title: string; actions: string[] };
        };
        executiveSummary: string;
        generatedAt: string;
    };
}
