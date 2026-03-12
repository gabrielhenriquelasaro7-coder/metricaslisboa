import { useMemo } from 'react';
import { DiagnosticProject } from '@/types/diagnostic';
import {
    BenchmarkStageId,
    BenchmarkStatus,
    calculateRatio,
    classifyMetricValue,
    createDefaultBenchmarkConfigFromSeed,
    calculateScore1to10
} from '@/lib/diagnosticBenchmarks';

export function useDiagnosticAnalysis(project: DiagnosticProject, manualBowtie?: any) {
    return useMemo(() => {
        const config = createDefaultBenchmarkConfigFromSeed();
        const benchmarks = config.segments.find(s => s.segmentKey === project.segment) || config.segments[0];
        const bowtieData = manualBowtie || project.bowtie || {};
        const stageOrder: BenchmarkStageId[] = ['exposicao', 'atencao', 'interesse', 'qualificacao', 'compromisso', 'decisao', 'retencao'];

        // Mapeamento de métricas legadas para compatibilidade
        const legacyMapping: Record<string, string> = {
            exposicao: 'ctr_medio',
            atencao: 'hook_rate',
            interesse: 'conv_visita_lead',
            qualificacao: 'perc_qualificados',
            compromisso: 'show_up_rate',
            decisao: 'conv_proposta_venda',
            retencao: 'churn_mensal'
        };

        const stageScores = stageOrder.map(stageId => {
            const stageMetrics = benchmarks.stages[stageId] || [];
            let userBowtieData = bowtieData[stageId] || { value: 0, reliability: 'baixa' };

            // Se o valor de rascunho (new school) não existir, tenta migrar do formato antigo
            if (userBowtieData.value === undefined || userBowtieData.value === null) {
                const legacyField = legacyMapping[stageId];
                if (legacyField && (userBowtieData as any)[legacyField] !== undefined) {
                    userBowtieData = { ...userBowtieData, value: (userBowtieData as any)[legacyField] };
                } else {
                    userBowtieData = { ...userBowtieData, value: 0 };
                }
            }

            const val = userBowtieData.value || 0;
            const isEmpty = val === 0 && !userBowtieData.evidence;

            const mainMetric = stageMetrics[0];
            const ratio = calculateRatio(val, mainMetric);
            const status = classifyMetricValue(val, mainMetric);
            const score = calculateScore1to10(ratio);
            const penalty = Math.max(0, (1 - ratio) * 100);

            return {
                id: stageId,
                status: status as BenchmarkStatus,
                penalty,
                ratio,
                score,
                isEmpty,
                value: val,
                benchmark: mainMetric
            };
        });

        const emptyFieldsCount = stageScores.filter(s => s.isEmpty).length;
        const autoCegueira = emptyFieldsCount >= 3;
        const cegueiraData = bowtieData.cegueira || { reliability: 'baixa' };
        const reliabilityValues = { 'alta': 0, 'media': 40, 'baixa': 80 };
        
        let cegueiraVal = 80;
        let cegueiraStatus = 'ruim';

        if (cegueiraData.value !== undefined) {
            cegueiraVal = cegueiraData.value;
            cegueiraStatus = cegueiraVal > 50 ? 'ruim' : cegueiraVal > 20 ? 'na_media' : 'bom';
        } else {
            cegueiraVal = (reliabilityValues as any)[cegueiraData.reliability] ?? 80;
            cegueiraStatus = (cegueiraData.reliability === 'baixa' || !cegueiraData.reliability) ? 'ruim' :
                cegueiraData.reliability === 'media' ? 'na_media' : 'bom';
        }

        // Se ativou cegueira automática, status é obrigatoriamente ruim
        if (autoCegueira) {
            cegueiraStatus = 'ruim';
            cegueiraVal = 100;
        }

        const cegueiraScore = {
            id: 'cegueira' as any,
            status: cegueiraStatus as BenchmarkStatus,
            penalty: cegueiraVal,
            ratio: 1,
            score: autoCegueira ? 1 : (cegueiraStatus === 'bom' ? 10 : (cegueiraStatus === 'na_media' ? 6 : 3)),
            isEmpty: false,
            value: cegueiraVal,
            benchmark: { mid: 0, min: 0, max: 100, direction: 'lower_better', unit: 'percent', label: 'Cegueira' } as any
        };

        const allScoresOrdered = [cegueiraScore, ...stageScores];

        // LÓGICA DE IDENTIFICAÇÃO DE RESTRIÇÃO (TOC) DA DIREITA PARA ESQUERDA (TRÁS PRA FRENTE)
        const reversedScores = [...stageScores].reverse();
        let bottleneck = reversedScores[reversedScores.length - 1]; // Fallback (Exposição)

        // 1. Prioridade Máxima: Cegueira (Trava 00) - Manual ou Automática
        if (cegueiraStatus === 'ruim') {
            bottleneck = cegueiraScore;
        } else {
            // 2. Precedência de Funil (Trás pra frente): O primeiro gargalo "ruim" que TENHA dados (value > 0)
            const criticalBottleneck = reversedScores.find(s => s.status === 'ruim' && !s.isEmpty);
            if (criticalBottleneck) {
                bottleneck = criticalBottleneck;
            } else {
                // 3. Se ninguém for crítico com dados, pega o pior "na_media" com dados
                const averageBottleneck = reversedScores.find(s => s.status === 'na_media' && !s.isEmpty);
                if (averageBottleneck) {
                    bottleneck = averageBottleneck;
                } else {
                    // 4. Se tudo estiver bom ou sem dados, pega o que tem o pior Ratio e que NÃO esteja vazio
                    const validScores = reversedScores.filter(s => !s.isEmpty);
                    if (validScores.length > 0) {
                        const worstRatio = [...validScores].sort((a, b) => a.ratio - b.ratio)[0];
                        bottleneck = worstRatio;
                    } else {
                        // Se TUDO estiver vazio e não caiu na cegueira automática (threshold), 
                        // forçamos a cegueira de qualquer forma pois não há insumos.
                        bottleneck = cegueiraScore;
                    }
                }
            }
        }

        return {
            stageScores: allScoresOrdered,
            bottleneck,
            benchmarks,
            emptyFieldsCount,
            autoCegueira
        };
    }, [project]);
}
