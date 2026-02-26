import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    BENCHMARK_STAGES,
    BenchmarkConfig,
    BenchmarkDirection,
    BenchmarkStageId,
    SegmentBenchmarks,
    createDefaultBenchmarkConfigFromSeed,
    resetSegmentFromSeed
} from '@/lib/diagnosticBenchmarks';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, Database, Info } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'diagnostic_benchmarks_v1';

export function BenchmarksManager() {
    const { toast } = useToast();
    const [benchmarkConfig, setBenchmarkConfig] = useState<BenchmarkConfig | null>(null);
    const [selectedSegmentKey, setSelectedSegmentKey] = useState<string | null>(null);
    const [selectedStageId, setSelectedStageId] = useState<BenchmarkStageId>('exposicao');

    useEffect(() => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            try {
                setBenchmarkConfig(JSON.parse(stored));
            } catch (e) {
                const seed = createDefaultBenchmarkConfigFromSeed();
                setBenchmarkConfig(seed);
            }
        } else {
            const seed = createDefaultBenchmarkConfigFromSeed();
            setBenchmarkConfig(seed);
        }
    }, []);

    const segments = useMemo(() => benchmarkConfig?.segments ?? [], [benchmarkConfig]);

    useEffect(() => {
        if (segments.length > 0 && !selectedSegmentKey) {
            setSelectedSegmentKey(segments[0].segmentKey);
        }
    }, [segments, selectedSegmentKey]);

    const activeSegment = useMemo(() => {
        return segments.find(s => s.segmentKey === selectedSegmentKey) || null;
    }, [segments, selectedSegmentKey]);

    const metricsForStage = useMemo(() => {
        if (!activeSegment) return [];
        return activeSegment.stages[selectedStageId] || [];
    }, [activeSegment, selectedStageId]);

    const handleMetricChange = (
        metricKey: string,
        field: 'min' | 'mid' | 'max' | 'direction',
        value: number | BenchmarkDirection
    ) => {
        if (!benchmarkConfig || !selectedSegmentKey) return;

        const next: BenchmarkConfig = {
            ...benchmarkConfig,
            segments: benchmarkConfig.segments.map(s => {
                if (s.segmentKey !== selectedSegmentKey) return s;

                return {
                    ...s,
                    stages: {
                        ...s.stages,
                        [selectedStageId]: s.stages[selectedStageId].map(m =>
                            m.key === metricKey ? { ...m, [field]: value } : m
                        )
                    }
                };
            })
        };

        setBenchmarkConfig(next);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    };

    const handleReset = () => {
        if (!selectedSegmentKey || !benchmarkConfig) return;
        const updated = resetSegmentFromSeed(selectedSegmentKey, benchmarkConfig);
        setBenchmarkConfig(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        toast({
            title: "Benchmarks restaurados",
            description: `Os valores para ${selectedSegmentKey} foram resetados para o padrão.`,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">Gerenciador de Benchmarks</h2>
                    <p className="text-sm text-slate-500">Defina as métricas de referência para cada segmento do mercado.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleReset}>
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
                    </Button>
                    <Button size="sm" className="gap-2 text-xs bg-red-600 hover:bg-red-700 text-white">
                        <Save className="w-3.5 h-3.5" /> Salvar Tudo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Segmento</label>
                        <Select value={selectedSegmentKey || ''} onValueChange={setSelectedSegmentKey}>
                            <SelectTrigger className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
                                <SelectValue placeholder="Selecione um segmento" />
                            </SelectTrigger>
                            <SelectContent>
                                {segments.map(s => (
                                    <SelectItem key={s.segmentKey} value={s.segmentKey}>{s.segmentKey}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Etapa do Bowtie</label>
                        <div className="flex flex-col gap-1">
                            {BENCHMARK_STAGES.map(stage => (
                                <Button
                                    key={stage.id}
                                    variant={selectedStageId === stage.id ? 'secondary' : 'ghost'}
                                    className={cn(
                                        "justify-start text-xs h-9 px-3 rounded-lg",
                                        selectedStageId === stage.id ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold" : "text-slate-600 dark:text-slate-400"
                                    )}
                                    onClick={() => setSelectedStageId(stage.id)}
                                >
                                    {stage.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Editor */}
                <div className="md:col-span-2 space-y-4">
                    {metricsForStage.map(metric => (
                        <Card key={metric.key} className="p-4 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{metric.label}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{metric.key}</p>
                                </div>
                                <Badge variant="outline" className="text-[9px]">{metric.unit}</Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Ruim (Min)</label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={metric.min}
                                        onChange={(e) => handleMetricChange(metric.key, 'min', Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Na Média</label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={metric.mid}
                                        onChange={(e) => handleMetricChange(metric.key, 'mid', Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Ideal (Max)</label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={metric.max}
                                        onChange={(e) => handleMetricChange(metric.key, 'max', Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Direção</label>
                                    <Select value={metric.direction} onValueChange={(val: any) => handleMetricChange(metric.key, 'direction', val)}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="higher_better" className="text-xs">Maior é melhor</SelectItem>
                                            <SelectItem value="lower_better" className="text-xs">Menor é melhor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {metricsForStage.length === 0 && (
                        <div className="p-12 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                            <Info className="w-8 h-8 text-slate-300" />
                            <p className="text-sm text-slate-500">Nenhuma métrica configurada para esta etapa.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
