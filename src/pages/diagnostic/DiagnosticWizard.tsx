import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DiagnosticProject, BowtieData } from '@/types/diagnostic';
import {
    BenchmarkStageId,
    classifyMetricValue,
    createDefaultBenchmarkConfigFromSeed,
    getStageName,
    getStageReason
} from '@/lib/diagnosticBenchmarks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useProjects } from '@/hooks/useProjects';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useSquads } from '@/hooks/useSquads';
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
    CheckCircle2,
    ArrowRight,
    Sparkles as SparklesIcon,
    History as HistoryIcon,
    Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDiagnosticAnalysis } from '@/hooks/useDiagnosticAnalysis';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WizardProps {
    project: DiagnosticProject;
    onSave: (project: DiagnosticProject) => void;
    onCancel: () => void;
}

// ─── TIPO DO CONFIG DA TRAVA ──────────────────────────────────────────────────
interface StageConfig {
    metricLabel: string;
    metricUnit: string;
    placeholder: string;
    o_que_e: string;
    de_onde_vem: string;
    por_que_importa: string;
    formula?: string;
}

// ─── TRAVAS UNIVERSAIS (07, 06, 05) ───────────────────────────────────────────
const UNIVERSAL_CONFIGS: Record<string, StageConfig> = {
    b01: {
        metricLabel: 'CPM (R$)',
        metricUnit: 'R$',
        placeholder: '18,00',
        o_que_e: 'Custo por Mil Impressões — quanto você paga para exibir seu anúncio 1.000 vezes para o ICP.',
        de_onde_vem: 'Meta Ads → Gerenciador de Anúncios → Coluna "CPM" (ou sincronizado automaticamente se selecionar um projeto ativo).',
        por_que_importa: 'CPM alto significa que você paga caro para ser visto. Benchmark p/ B2B: R$ 12–25. Se acima de R$ 30, sua segmentação ou criativo está repelindo o leilão.',
        formula: 'CPM = (Custo Total / Impressões) × 1.000',
    },
    b02: {
        metricLabel: 'CTR (%)',
        metricUnit: '%',
        placeholder: '6,23',
        o_que_e: 'Click-Through Rate — percentual de pessoas que viram o anúncio e clicaram nele.',
        de_onde_vem: 'Meta Ads → Gerenciador → Coluna "CTR (todos)" ou "CTR (link)". Use CTR de link para análise de topo de funil.',
        por_que_importa: 'CTR mede se o criativo captura atenção. Benchmark: 4,5–8%. CTR abaixo de 2% indica falha criativa (copy, imagem, formato) ou segmentação equivocada.',
        formula: 'CTR = (Cliques / Impressões) × 100',
    },
    b03: {
        metricLabel: 'CPC (R$)',
        metricUnit: 'R$',
        placeholder: '5,70',
        o_que_e: 'Custo por Clique — quanto você paga por cada clique no link do anúncio.',
        de_onde_vem: 'Meta Ads → CPC (link). Pode ser importado automaticamente se o projeto estiver sincronizado.',
        por_que_importa: 'CPC alto com CTR baixo indica que o público vê a criatividade como irrelevante. A trava de Interesse mapeia se o clique converte em lead.',
        formula: 'CPC = Custo Total / Cliques',
    },
};

// ─── TRAVAS CONDICIONAIS POR MODELO DE NEGÓCIO (04, 03, 02, 01) ──────────────
const MODEL_CONFIGS: Record<string, Record<string, StageConfig>> = {
    recorrente_b2b: {
        b04: {
            metricLabel: 'Taxa Lead → SQL (%)',
            metricUnit: '%',
            placeholder: '25,00',
            o_que_e: 'Dos leads gerados, quantos foram qualificados pelo SDR e se tornaram Oportunidades Reais (SQL)?',
            de_onde_vem: 'CRM → Funil de Vendas → Etapa de Qualificação Concluída.',
            por_que_importa: 'Se a taxa é <20%, seu marketing está atraindo curiosos ou seu time de SDR não tem critério de filtro.',
            formula: 'SQL Rate = (SQLs / Total Leads) × 100',
        },
        b05: {
            metricLabel: 'Taxa de Agendamento (%)',
            metricUnit: '%',
            placeholder: '35,00',
            o_que_e: 'Dos leads qualificados, quantos efetivamente agendaram uma reunião de diagnóstico/venda?',
            de_onde_vem: 'Ferramenta de Agendamento (Calendly/HubSpot) vs CRM.',
            por_que_importa: 'Agendamento baixo indica falta de urgência na abordagem ou processo de agendamento burocrático.',
            formula: 'Agendamento = (Agendados / SQLs) × 100',
        },
        b06: {
            metricLabel: 'Win Rate (%)',
            metricUnit: '%',
            placeholder: '25,00',
            o_que_e: 'Das reuniões realizadas, quantas viraram contrato assinado?',
            de_onde_vem: 'CRM: Negócios Ganhos / Total de Reuniões Realizadas.',
            por_que_importa: 'Win rate baixo é sinal de falha no fechamento, preço desancorado ou má condução do diagnóstico.',
            formula: 'Win Rate = (Vendas / Reuniões) × 100',
        },
        b07: {
            metricLabel: 'Churn Mensal (%)',
            metricUnit: '%',
            placeholder: '3,00',
            o_que_e: 'Percentual de clientes que cancelaram a assinatura no mês.',
            de_onde_vem: 'Painel Financeiro / ERP.',
            por_que_importa: 'Churn alto destrói o LTV. Se o balde está furado, colocar mais água (leads) é desperdício.',
            formula: 'Churn = (Cancelados / Base Ativa) × 100',
        },
    },
    venda_unica_high_ticket: {
        b04: {
            metricLabel: 'Taxa de Qualificação ICP (%)',
            metricUnit: '%',
            placeholder: '45,00',
            o_que_e: 'Dos leads que chegam, quantos realmente têm dinheiro e perfil para o seu High Ticket?',
            de_onde_vem: 'Planilha de Triagem ou CRM.',
            por_que_importa: 'Em High Ticket, o volume de leads é menor. Errar no ICP aqui custa muito caro em tempo de consultor.',
            formula: 'Fit Rate = (Leads Qualificados / Total Leads) × 100',
        },
        b05: {
            metricLabel: 'Taxa de Presença (Show-up) (%)',
            metricUnit: '%',
            placeholder: '70,00',
            o_que_e: 'Dos agendados, quantos efetivamente APARECERAM na reunião de fechamento?',
            de_onde_vem: 'CRM ou Agenda Comercial.',
            por_que_importa: 'Show-up <60% indica falta de aquecimento pós-agendamento. Falta vídeo de autoridade ou lembretes.',
            formula: 'Show-up = (Compareceram / Agendados) × 100',
        },
        b06: {
            metricLabel: 'Win Rate de Diagnóstico (%)',
            metricUnit: '%',
            placeholder: '20,00',
            o_que_e: 'Das reuniões de fechamento realizadas, quantos pagaram o ticket alto?',
            de_onde_vem: 'Financeiro / CRM.',
            por_que_importa: 'Se a taxa é <15%, sua oferta não gerou percepção de valor suficiente para o preço cobrado.',
            formula: 'Win Rate = (Vendas / Reuniões Realizadas) × 100',
        },
        b07: {
            metricLabel: 'Taxa de Indicação Ativa (%)',
            metricUnit: '%',
            placeholder: '15,00',
            o_que_e: 'Quantos novos clientes vieram recomendados por clientes atuais nos últimos 12 meses?',
            de_onde_vem: 'CRM (Campo: Origem do Lead -> Indicação).',
            por_que_importa: 'High Ticket cresce por autoridade e prova social. Se ninguém indica, a entrega pode estar falhando.',
        },
    },
    telecom_provedores: {
        b04: {
            metricLabel: 'Viabilidade Técnica (%)',
            metricUnit: '%',
            placeholder: '60,00',
            o_que_e: 'Dos endereços consultados, para quantos você realmente pode entregar o link de internet?',
            de_onde_vem: 'Software de Gestão (ERP Telecom) ou Planilha Técnica.',
            por_que_importa: 'Viabilidade baixa indica que seu marketing está atingindo áreas onde você não tem rede.',
            formula: 'Viabilidade = (Endereços OK / Consultas Totais) × 100',
        },
        b05: {
            metricLabel: 'Agendamento Instalação (%)',
            metricUnit: '%',
            placeholder: '80,00',
            o_que_e: 'Dos clientes viáveis, quantos agendaram a instalação em até 48h?',
            de_onde_vem: 'Agenda Técnica / Ordem de Serviço.',
            por_que_importa: 'Demora no agendamento faz o cliente desistir e ir para o concorrente. O "timing" aqui é lucro.',
            formula: 'Agendamento = (Instalacões Agendadas / Viáveis) × 100',
        },
        b06: {
            metricLabel: 'Taxa de Ativação (%)',
            metricUnit: '%',
            placeholder: '95,00',
            o_que_e: 'Das ordens de serviço geradas, quantas foram efetivamente ativadas com link funcionando?',
            de_onde_vem: 'Sistema de Monitoramento de Rede / Financeiro.',
            por_que_importa: 'Muitas desistências no momento da instalação indicam promessa comercial errada ou técnicos mal treinados.',
            formula: 'Ativação = (Instalados / Agendados) × 100',
        },
        b07: {
            metricLabel: 'Churn Operacional (%)',
            metricUnit: '%',
            placeholder: '1,20',
            o_que_e: 'Percentual de cancelamentos mensais (desconexões).',
            de_onde_vem: 'Financeiro / Baixa de Contrato.',
            por_que_importa: 'Em Telecom, a recorrência é tudo. Churn >2% é sinal de instabilidade de rede ou mau atendimento.',
        },
    },
    venda_unica_low: {
        b04: {
            metricLabel: 'Taxa Visitante → Carrinho (%)',
            metricUnit: '%',
            placeholder: '8,00',
            o_que_e: 'Dos visitantes totais, quantos adicionaram pelo menos um produto ao carrinho?',
            de_onde_vem: 'Google Analytics (GA4) -> Add to Cart.',
            por_que_importa: 'Taxa <5% indica que sua oferta, preço ou fotos do produto não estão convencendo.',
            formula: 'Add-to-cart = (Carrinhos / Sessões) × 100',
        },
        b05: {
            metricLabel: 'Abandono de Carrinho (%)',
            metricUnit: '%',
            placeholder: '70,00',
            o_que_e: 'Dos que iniciaram o checkout, quantos NÃO finalizaram a compra?',
            de_onde_vem: 'Plataforma de E-commerce.',
            por_que_importa: 'Abandono alto indica frete caro, falta de parcelamento ou checkout confuso.',
            formula: 'Abandono = (Não comprados / Iniciados) × 100',
        },
        b06: {
            metricLabel: 'Taxa de Conversão Checkout (%)',
            metricUnit: '%',
            placeholder: '2,50',
            o_que_e: 'Dos visitantes totais da loja, quantos efetivamente compraram?',
            de_onde_vem: 'Painel da Loja (Pedidos / Visitas).',
            por_que_importa: 'Benchmark de e-commerce saudável gira entre 1.5% e 3.5%.',
        },
        b07: {
            metricLabel: 'Taxa de Recompra (90 dias) (%)',
            metricUnit: '%',
            placeholder: '20,00',
            o_que_e: 'Dos clientes que compraram, quantos voltaram para uma segunda compra em 90 dias?',
            de_onde_vem: 'CRM / Lista de Pedidos por Cliente.',
            por_que_importa: 'Aumentar a frequência de compra diminui o seu CPA e aumenta significativamente o lucro.',
        },
    },
    infoproduto: {
        b04: {
            metricLabel: 'Taxa Inscrição → Grupo (%)',
            metricUnit: '%',
            placeholder: '60,00',
            o_que_e: 'Dos leads cadastrados, quantos entraram no seu grupo de WhatsApp / Comunidade?',
            de_onde_vem: 'Relatório da LP vs Membros do Grupo.',
            por_que_importa: 'O grupo é o seu "canal quente". Lead fora do grupo tem 4x menos chance de comprar.',
            formula: 'Taxa Grupo = (Membros / Leads) × 100',
        },
        b05: {
            metricLabel: 'Presença no Evento/Live (%)',
            metricUnit: '%',
            placeholder: '35,00',
            o_que_e: 'Dos inscritos totais, quantos apareceram ao vivo na hora do pitch?',
            de_onde_vem: 'YouTube Analytics / StreamYard / InEvent.',
            por_que_importa: 'Venda de infoproduto acontece no pico de energia da live. Sem presença, sem volume de vendas.',
            formula: 'Presença = (Pico de Visualização / Inscritos) × 100',
        },
        b06: {
            metricLabel: 'Conversão de Checkout (%)',
            metricUnit: '%',
            placeholder: '10,00',
            o_que_e: 'Dos que abriram o checkout, quantos efetivamente pagaram?',
            de_onde_vem: 'Hotmart / Eduzz / Kiwify (Vendas vs Checkouts abertos).',
            por_que_importa: 'Se muitos abrem e poucos compram, você tem problema de parcelamento ou medo da garantia.',
        },
        b07: {
            metricLabel: 'Taxa de Reembolso (7 dias) (%)',
            metricUnit: '%',
            placeholder: '5,00',
            o_que_e: 'Percentual de alunos que pediram o dinheiro de volta na primeira semana.',
            de_onde_vem: 'Painel da plataforma de vendas.',
            por_que_importa: 'Refund alto (>10%) indica que sua promessa na venda foi muito maior que a entrega no curso.',
        },
    },
    servico_consultivo: {
        b04: {
            metricLabel: 'Taxa Lead → Diagnóstico (%)',
            metricUnit: '%',
            placeholder: '30,00',
            o_que_e: 'Dos leads que chegam, quantos avançam para uma call de diagnóstico ou levantamento?',
            de_onde_vem: 'CRM → Funil Comercial.',
            por_que_importa: 'Se <25%, você está gastando marketing com quem não tem o problema que você resolve.',
        },
        b05: {
            metricLabel: 'Taxa de Aceite de Proposta (%)',
            metricUnit: '%',
            placeholder: '40,00',
            o_que_e: 'Das propostas enviadas pós-diagnóstico, quantas são aprovadas?',
            de_onde_vem: 'CRM (Negócios Ganhos / Propostas Enviadas).',
            por_que_importa: 'Aceite baixo indica que a solução proposta não atacou a dor real ou o preço está desancorado.',
        },
        b06: {
            metricLabel: 'Win Rate Final (%)',
            metricUnit: '%',
            placeholder: '25,00',
            o_que_e: 'Percentual de contratos assinados sobre o total de oportunidades abertas.',
            de_onde_vem: 'CRM.',
            por_que_importa: 'Mede a eficiência real do seu time em transformar interesse em faturamento efetivo.',
        },
        b07: {
            metricLabel: 'LTV (Tempo de Permanência) (Meses)',
            metricUnit: 'Meses',
            placeholder: '12,00',
            o_que_e: 'Quantos meses, em média, o cliente permanece pagando pelo serviço?',
            de_onde_vem: 'Financeiro.',
            por_que_importa: 'Serviços consultivos morrem se o LTV for menor que 6 meses devido ao alto custo de setup.',
        },
    },
    servico_presencial: {
        b04: {
            metricLabel: 'Taxa Lead → Visita (%)',
            metricUnit: '%',
            placeholder: '40,00',
            o_que_e: 'Dos contatos recebidos, quantos efetivamente visitam o estabelecimento?',
            de_onde_vem: 'Recepção / Sistema de Check-in.',
            por_que_importa: 'Se a visita não ocorre, o lead esfria. O marketing local precisa gerar tráfego de pedestres/visitas.',
        },
        b05: {
            metricLabel: 'No-Show Presencial (%)',
            metricUnit: '%',
            placeholder: '20,00',
            o_que_e: 'Dos agendados, quantos não apareceram e não desmarcaram?',
            de_onde_vem: 'Agenda da Clínica/Estabelecimento.',
            por_que_importa: 'No-show presencial queima hora-homem e infraestrutura. Exige confirmação ativa.',
        },
        b06: {
            metricLabel: 'Taxa de Fechamento Balcão (%)',
            metricUnit: '%',
            placeholder: '60,00',
            o_que_e: 'Das pessoas que foram atendidas, quantas fecharam um plano ou pacote?',
            de_onde_vem: 'Financeiro / Sistema de Vendas.',
            por_que_importa: 'Se a taxa é baixa, o vendedor local não está fazendo a ancoragem de valor correta no momento do desejo.',
        },
        b07: {
            metricLabel: 'Taxa de Retorno (30 dias) (%)',
            metricUnit: '%',
            placeholder: '55,00',
            o_que_e: 'Clientes que voltaram para consumir novamente em até 30 dias.',
            de_onde_vem: 'Sistema de Gestão de Clientes.',
            por_que_importa: 'Negócios presenciais dependem de recorrência orgânica. Retorno baixo indica má experiência.',
        },
    },
    recorrente_b2c: {
        b04: {
            metricLabel: 'Trial → Assinante (%)',
            metricUnit: '%',
            placeholder: '20,00',
            o_que_e: 'Dos que iniciaram o teste grátis, quantos viraram assinantes pagos?',
            de_onde_vem: 'Stripe / Recorrência Analytics.',
            por_que_importa: 'O Trial é o momento da verdade. Conversão baixa indica que o produto não gerou "Aha! Moment".',
        },
        b05: {
            metricLabel: 'Ativação de Usuário (%)',
            metricUnit: '%',
            placeholder: '70,00',
            o_que_e: 'Dos novos assinantes, quantos completaram as ações críticas de ativação?',
            de_onde_vem: 'Amplitude / Mixpanel.',
            por_que_importa: 'Usuário que não ativa no primeiro dia vira Churn no primeiro mês.',
        },
        b06: {
            metricLabel: 'Average Revenue Per User (ARPU)',
            metricUnit: 'R$',
            placeholder: '49,90',
            o_que_e: 'Receita média gerada por cada usuário ativo.',
            de_onde_vem: 'Financeiro / Dash de Assinatura.',
            por_que_importa: 'ARPU baixo exige volume massivo para sobrevivência.',
        },
        b07: {
            metricLabel: 'Chun Rate Mensal (%)',
            metricUnit: '%',
            placeholder: '3,00',
            o_que_e: 'Percentual de cancelamentos sobre a base total mensal.',
            de_onde_vem: 'Recorrência Dashboard.',
            por_que_importa: 'Churn é o balde furado. Acima de 5%, você está perdendo o negócio.',
        }
    },
    franquia_rede: {
        b04: {
            metricLabel: 'Auditoria de Padrão (%)',
            metricUnit: '%',
            placeholder: '95,00',
            o_que_e: 'Nível de conformidade das unidades com o manual da marca.',
            de_onde_vem: ' Checklist de Auditoria / Visita Técnica.',
            por_que_importa: 'Marca diluída em unidades ruins derruba o valor da franqueadora.',
        },
        b05: {
            metricLabel: 'Crescimento Same-Store Sales (%)',
            metricUnit: '%',
            placeholder: '15,00',
            o_que_e: 'Crescimento médio de vendas em unidades abertas há mais de 1 ano.',
            de_onde_vem: 'BI Consolidador da Rede.',
            por_que_importa: 'Indica se o modelo de negócio está amadurecendo e ganhando eficiência.',
        },
        b06: {
            metricLabel: 'Markup Médio da Rede (%)',
            metricUnit: '%',
            placeholder: '2.5',
            o_que_e: 'Média de margem praticada pelas unidades franqueadas.',
            de_onde_vem: 'DRE Consolidada.',
            por_que_importa: 'Se os franqueados não têm margem, a rede colapsa.',
        },
        b07: {
            metricLabel: 'Taxa de Inadimplência Royalties (%)',
            metricUnit: '%',
            placeholder: '2,00',
            o_que_e: 'Percentual de unidades que não pagam os royalties em dia.',
            de_onde_vem: 'Contas a Receber da Franqueadora.',
            por_que_importa: 'Inadimplência alta é sinal de que a unidade está operando no prejuízo.',
        }
    }
};

// Fallback para modelos não selecionados (usa recorrente_b2b como padrão)
const DEFAULT_MODEL = 'recorrente_b2b';

// Função para obter config da trava baseado no modelo de negócio
function getStageConfig(stepId: string, businessModel?: string): StageConfig | undefined {
    // Travas universais (07, 06, 05) — iguais para todos
    if (UNIVERSAL_CONFIGS[stepId]) return UNIVERSAL_CONFIGS[stepId];
    // Travas condicionais (04, 03, 02, 01) — variam por modelo
    const model = businessModel || DEFAULT_MODEL;
    const modelConfigs = MODEL_CONFIGS[model] || MODEL_CONFIGS[DEFAULT_MODEL];
    return modelConfigs[stepId];
}

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
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Mercado</h3>
                    <p className="text-[11px] text-red-600 font-bold mt-0.5">Definição do Tamanho de Oportunidade (TAM/SAM/SOM).</p>
                </div>
                {/* Botão de Ajuda Contextual */}
                <div className="group relative">
                    <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-500 hover:border-red-600 hover:text-red-600 cursor-help transition-all">
                        ?
                    </div>
                    <div className="absolute right-0 top-7 w-64 p-4 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none transition-all z-50">
                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">TAM (Total Addressable Market)</p>
                                <p className="text-[11px] text-zinc-400">Demanda total do mercado se você não tivesse concorrência (ex: todos os provedores do BR).</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">SAM (Serviceable Addressable Market)</p>
                                <p className="text-[11px] text-zinc-400">A parte do TAM que você consegue atender hoje com seu produto e região.</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">SOM (Serviceable Obtainable Market)</p>
                                <p className="text-[11px] text-zinc-400">Sua meta realista de fatia de mercado (Market Share) para os próximos 12-24 meses.</p>
                            </div>
                        </div>
                    </div>
                </div>
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
function BowtieStep({ currentStep, project, updateBowtie, getStageHandle, benchmarks }: {
    currentStep: { id: string; label: string; icon: React.ElementType };
    project: DiagnosticProject;
    updateBowtie: (stage: any, data: any) => void;
    getStageHandle: (stepId: string) => string;
    benchmarks: any;
}) {
    const stageId = getStageHandle(currentStep.id) as BenchmarkStageId | 'cegueira';
    const config = getStageConfig(currentStep.id, project.briefing?.business_model_desc);
    const stageData = (project.bowtie as any)[stageId] || {};

    // Get Benchmark for this specific stage
    const stageBenchmark = useMemo(() => {
        if (!benchmarks || !stageId || stageId === 'cegueira') return null;
        const metrics = benchmarks.stages[stageId];
        return metrics && metrics.length > 0 ? metrics[0] : null;
    }, [benchmarks, stageId]);

    const analysis = useDiagnosticAnalysis(project);
    const stageAnalysis = useMemo(() => {
        return analysis.stageScores.find(s => s.id === stageId);
    }, [analysis.stageScores, stageId]);

    const status = stageAnalysis?.status;
    const score = stageAnalysis?.score;

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
                        {/* Live Feedback Benchmark */}
                        {status && stageId !== 'cegueira' && (
                            <div className={cn(
                                "absolute -bottom-6 left-0 right-0 flex justify-center gap-2 items-center text-[10px] font-black uppercase tracking-widest",
                                status === 'ruim' ? "text-red-500" : status === 'na_media' ? "text-amber-500" : "text-emerald-500"
                            )}>
                                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse",
                                    status === 'ruim' ? "bg-red-500" : status === 'na_media' ? "bg-amber-500" : "bg-emerald-500"
                                )} />
                                <span>NOTA: {score}/10</span>
                                <span className="text-zinc-600">·</span>
                                {status === 'ruim' ? 'Gargalo Crítico' : status === 'na_media' ? 'Alerta: Na Média' : 'Performance Ideal'}
                                <span className="text-zinc-600 ml-1">· Meta Mid: {stageBenchmark?.mid}{stageBenchmark?.unit === 'percent' ? '%' : ''}</span>
                            </div>
                        )}
                        {analysis.autoCegueira && (
                            <div className="absolute -top-12 left-0 right-0 bg-red-600/20 border border-red-600/30 rounded-xl px-4 py-2 flex items-center justify-between gap-3 animate-bounce">
                                <div className="flex items-center gap-2">
                                    <EyeOff className="w-4 h-4 text-red-500" />
                                    <span className="text-[10px] font-black text-white uppercase italic">Diagnóstico Incompleto: Faltam dados críticos</span>
                                </div>
                                <span className="text-[9px] font-bold text-red-500 uppercase">Apenas {7 - analysis.emptyFieldsCount}/7 etapas respondidas</span>
                            </div>
                        )}
                        {analysis.autoCegueira && stageId !== 'cegueira' && (
                            <div className="absolute -top-6 right-0 text-[10px] font-black text-red-600 uppercase tracking-tighter flex items-center gap-1">
                                <span className="animate-pulse">⚠️ BLOQUEADO POR CEGUEIRA</span>
                            </div>
                        )}
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
    { id: 'client_briefing', label: 'Briefing', icon: FileText },
    { id: 'context', label: 'Identificação', icon: Target },
    { id: 'goal', label: 'Metas', icon: Users },
    { id: 'economics', label: 'Business', icon: Globe },
    { id: 'market', label: 'Mercado', icon: Search },
    { id: 'b01', label: '01 Exposição', icon: Eye },
    { id: 'b02', label: '02 Atenção', icon: Search },
    { id: 'b03', label: '03 Interesse', icon: MousePointerClick },
    { id: 'b04', label: '04 Qualificação', icon: UserCheck },
    { id: 'b05', label: '05 Compromisso', icon: Calendar },
    { id: 'b06', label: '06 Decisão', icon: ShoppingCart },
    { id: 'b07', label: '07 Retenção', icon: RefreshCcw },
    { id: 'b00', label: '00 Cegueira', icon: EyeOff },
    { id: 'review', label: 'Revisão', icon: Zap },
];

export function DiagnosticWizard({ project: initialProject, onSave, onCancel }: WizardProps) {
    const { squads, loading: squadsLoading } = useSquads();
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [project, setProject] = useState<DiagnosticProject>(() => ({
        ...initialProject,
        briefing: initialProject.briefing || {
            niche: '',
            current_situation: '',
            main_pains: '',
            business_model_desc: ''
        }
    }));
    const [selectedProjectId, setSelectedProjectId] = useState<string>((initialProject as any).systemProjectId || '');
    const toastShownRef = useRef<string | null>(null);
    const [showValidationErrors, setShowValidationErrors] = useState(false);
    const { projects: availableProjects } = useProjects();

    // Fetch metrics specifically for the selected project
    const { comparison: metrics, loading: loadingMetrics } = useDailyMetrics(
        selectedProjectId || (project as any).systemProjectId || undefined,
        'last_30d'
    );

    // Load benchmarks for comparison
    const benchmarks = useMemo(() => {
        const config = createDefaultBenchmarkConfigFromSeed();
        return config.segments.find(s => s.segmentKey === project.segment) || config.segments[0];
    }, [project.segment]);

    const currentStep = STEPS[currentStepIdx];
    const progress = ((currentStepIdx + 1) / STEPS.length) * 100;

    // Live restriction analysis
    const { bottleneck, stageScores } = useDiagnosticAnalysis(project);

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

    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [showAILoadingScreen, setShowAILoadingScreen] = useState(false);

    const handleGenerateWizardAI = async () => {
        setIsProcessingAI(true);
        try {
            const performanceScores = stageScores.reduce((acc, curr) => ({
                ...acc,
                [curr.id]: curr.score
            }), {});

            const { data, error } = await supabase.functions.invoke('diagnostic-ai', {
                body: { 
                    project, 
                    bottleneck,
                    performanceScores
                }
            });

            if (error) throw error;
            if (data?.executiveSummary) {
                setAiInsight(data.executiveSummary);
                setProject(prev => ({
                    ...prev,
                    ai_analysis: {
                        ...data,
                        generatedAt: new Date().toISOString()
                    }
                }));
            }
        } catch (err) {
            console.error('Erro IA Wizard:', err);
        } finally {
            setIsProcessingAI(false);
        }
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
                    icon: <SparklesIcon className="w-4 h-4 text-red-600" />,
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

    const handleNext = async () => {
        // Validação do Briefing
        if (currentStep.id === 'client_briefing') {
            const isNameOk = !!project.name.trim();
            const isNicheOk = !!project.briefing?.niche?.trim();
            const isModelOk = !!project.briefing?.business_model_desc;
            const isIcpOk = !!project.icp?.trim();
            const isSituationOk = !!project.briefing?.current_situation?.trim();
            const isPainsOk = !!project.briefing?.main_pains?.trim();

            if (!isNameOk || !isNicheOk || !isModelOk || !isIcpOk || !isSituationOk || !isPainsOk) {
                setShowValidationErrors(true);
                toast.error("Preenchimento Obrigatório", {
                    description: "Por favor, preencha todos os campos do briefing antes de continuar.",
                    className: "bg-red-600 border-red-600 text-white font-black"
                });
                return;
            }
        }

        if (currentStepIdx < STEPS.length - 1) {
            setShowValidationErrors(false);
            setCurrentStepIdx(prev => prev + 1);
            window.scrollTo(0, 0);
        } else {
            // Último passo: gerar IA e salvar
            setShowAILoadingScreen(true);
            setIsProcessingAI(true);
            try {
                const performanceScores = stageScores.reduce((acc, curr) => ({
                    ...acc,
                    [curr.id]: curr.score
                }), {});

                const response = await fetch('https://skneplgqejrokoewnyhx.supabase.co/functions/v1/diagnostic-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        project, 
                        bottleneck,
                        performanceScores
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(errText || 'Erro da IA (401/500)');
                }

                const data = await response.json();
                const error = null;

                let finalProject = {
                    ...project,
                    status: 'completo' as const,
                    updatedAt: new Date().toISOString(),
                    systemProjectId: selectedProjectId || (project as any).systemProjectId
                };

                if (!error && data?.executiveSummary) {
                    finalProject.ai_analysis = {
                        ...data,
                        generatedAt: new Date().toISOString()
                    };
                }

                onSave(finalProject);
            } catch (err) {
                console.error('Erro ao gerar diagnóstico com IA:', err);
                toast.error('Erro na IA. Salvando diagnóstico sem análise inteligente.');
                const finalProject = {
                    ...project,
                    status: 'completo' as const,
                    updatedAt: new Date().toISOString(),
                    systemProjectId: selectedProjectId || (project as any).systemProjectId
                };
                onSave(finalProject);
            } finally {
                setIsProcessingAI(false);
                setShowAILoadingScreen(false);
            }
        }
    };

    const phases = [
        { label: 'Fundamentos', icon: Target, steps: ['client_briefing', 'context', 'goal', 'economics', 'market'] },
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
                    {currentStep.id === 'client_briefing' && (
                        <div className="space-y-6 w-full">
                            <div>
                                <h3 className="text-lg font-black text-white">Resumo do Cliente (Briefing)</h3>
                                <p className="text-[11px] text-red-600 font-medium mt-0.5">Forneça o contexto estratégico do negócio. A IA usará estas informações para gerar um diagnóstico personalizado.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className={cn(
                                        "text-[10px] font-black uppercase tracking-widest transition-colors",
                                        showValidationErrors && !project.name.trim() ? "text-red-500" : "text-zinc-500"
                                    )}>
                                        Nome do Diagnóstico <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        placeholder="Ex: Operação Escala Norte"
                                        className={cn(
                                            "h-12 rounded-xl bg-black border-white/10 text-white text-xs font-bold px-4 transition-all",
                                            showValidationErrors && !project.name.trim() && "border-red-500/50 bg-red-500/5"
                                        )}
                                        value={project.name}
                                        onChange={e => updateProject({ name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className={cn(
                                        "text-[10px] font-black uppercase tracking-widest transition-colors",
                                        showValidationErrors && !project.briefing?.niche?.trim() ? "text-red-500" : "text-zinc-500"
                                    )}>
                                        Nicho / Setor <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        placeholder="Ex: SaaS para Logística, E-commerce de Moda..."
                                        className={cn(
                                            "h-12 rounded-xl bg-black border-white/10 text-white text-xs font-bold px-4 transition-all",
                                            showValidationErrors && !project.briefing?.niche?.trim() && "border-red-500/50 bg-red-500/5"
                                        )}
                                        value={project.briefing?.niche || ''}
                                        onChange={e => updateProject({ briefing: { ...project.briefing!, niche: e.target.value } })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className={cn(
                                    "text-[10px] font-black uppercase tracking-widest transition-colors",
                                    showValidationErrors && !project.briefing?.business_model_desc ? "text-red-500" : "text-zinc-500"
                                )}>
                                    Modelo de Negócio <span className="text-red-500">*</span>
                                </Label>
                                <p className="text-[10px] text-zinc-600 font-medium -mt-0.5 mb-1">Selecione o modelo que mais se aproxima. As perguntas de cada trava se adaptarão a esta escolha.</p>
                                <Select value={project.briefing?.business_model_desc || ''} onValueChange={(val: string) => updateProject({ briefing: { ...project.briefing!, business_model_desc: val }, segment: val })}>
                                    <SelectTrigger className={cn(
                                        "h-12 rounded-xl bg-black border-white/10 text-white text-xs font-bold px-4 transition-all",
                                        showValidationErrors && !project.briefing?.business_model_desc && "border-red-500/50 bg-red-500/5"
                                    )}>
                                        <SelectValue placeholder="Selecione o modelo de negócio..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                        <SelectItem value="recorrente_b2b" className="text-xs font-bold">Recorrente B2B (SaaS, Consultoria Mensal)</SelectItem>
                                        <SelectItem value="recorrente_b2c" className="text-xs font-bold">Recorrente B2C (Assinatura, Streaming)</SelectItem>
                                        <SelectItem value="venda_unica_high_ticket" className="text-xs font-bold">Venda Única High Ticket (&gt;R$ 5k)</SelectItem>
                                        <SelectItem value="venda_unica_low" className="text-xs font-bold">Venda Única Low Ticket (E-commerce Digital)</SelectItem>
                                        <SelectItem value="telecom_provedores" className="text-xs font-bold">Telecom / Provedores de Internet</SelectItem>
                                        <SelectItem value="infoproduto" className="text-xs font-bold">Infoproduto (Lançamento / Perpétuo)</SelectItem>
                                        <SelectItem value="servico_consultivo" className="text-xs font-bold">Serviço Consultivo (Projeto / Contrato B2B)</SelectItem>
                                        <SelectItem value="produto_fisico_distribuicao" className="text-xs font-bold text-red-400">Produto Físico / Varejo / Distribuição</SelectItem>
                                        <SelectItem value="servico_presencial" className="text-xs font-bold text-red-400">Serviço Presencial (Clínicas, Academias)</SelectItem>
                                        <SelectItem value="franquia_rede" className="text-xs font-bold text-red-400">Franquia ou Rede de Unidades</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className={cn(
                                    "text-[10px] font-black uppercase tracking-widest transition-colors",
                                    showValidationErrors && !project.icp?.trim() ? "text-red-500" : "text-zinc-500"
                                )}>
                                    ICP (Perfil do Cliente Ideal) <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    placeholder="Descreva as dores, ambições e características do público alvo..."
                                    className={cn(
                                        "h-28 rounded-xl bg-black border-white/10 text-white resize-none p-4 text-xs font-bold transition-all",
                                        showValidationErrors && !project.icp?.trim() && "border-red-500/50 bg-red-500/5"
                                    )}
                                    value={project.icp || ''}
                                    onChange={e => updateProject({ icp: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={cn(
                                    "text-[10px] font-black uppercase tracking-widest transition-colors",
                                    showValidationErrors && !project.briefing?.current_situation?.trim() ? "text-red-500" : "text-zinc-500"
                                )}>
                                    Situação Atual <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    placeholder="Descreva brevemente o momento da empresa..."
                                    className={cn(
                                        "h-24 rounded-xl bg-black border-white/10 text-white resize-none p-4 text-xs font-bold transition-all",
                                        showValidationErrors && !project.briefing?.current_situation?.trim() && "border-red-500/50 bg-red-500/5"
                                    )}
                                    value={project.briefing?.current_situation || ''}
                                    onChange={e => updateProject({ briefing: { ...project.briefing!, current_situation: e.target.value } })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={cn(
                                    "text-[10px] font-black uppercase tracking-widest transition-colors",
                                    showValidationErrors && !project.briefing?.main_pains?.trim() ? "text-red-500" : "text-zinc-500"
                                )}>
                                    Principais Dores / Desafios <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    placeholder="O que está tirando o sono do cliente?"
                                    className={cn(
                                        "h-24 rounded-xl bg-black border-white/10 text-white resize-none p-4 text-xs font-bold transition-all",
                                        showValidationErrors && !project.briefing?.main_pains?.trim() && "border-red-500/50 bg-red-500/5"
                                    )}
                                    value={project.briefing?.main_pains || ''}
                                    onChange={e => updateProject({ briefing: { ...project.briefing!, main_pains: e.target.value } })}
                                />
                            </div>
                        </div>
                    )}

                    {currentStep.id === 'context' && (
                        <div className="space-y-6 w-full">
                            <div>
                                <h3 className="text-lg font-black text-white">Identificação do Projeto</h3>
                                <p className="text-[11px] text-red-600 font-medium mt-0.5">Vincule a um projeto do sistema para importar métricas automaticamente.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Time Responsável (Squad)</Label>
                                    <Select 
                                        value={project.team || ''} 
                                        onValueChange={(val) => updateProject({ team: val })}
                                    >
                                        <SelectTrigger className="h-12 rounded-2xl bg-black border-white/10 focus:border-red-600/50 text-white text-xs font-bold px-4">
                                            <SelectValue placeholder="Selecione a Squad..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10 text-white">
                                            {squadsLoading ? (
                                                <div className="p-2 flex items-center justify-center">
                                                    <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                                                </div>
                                            ) : (
                                                squads.map(squad => (
                                                    <SelectItem key={squad.id} value={squad.name} className="text-xs font-bold uppercase tracking-tight">
                                                        {squad.name}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Região / Praça</Label>
                                    <Input
                                        placeholder="Ex: Brasil, São Paulo, Global"
                                        className="h-12 rounded-2xl bg-black border-white/10 focus:border-red-600/50 text-white text-xs font-bold px-4"
                                        value={project.region || ''}
                                        onChange={e => updateProject({ region: e.target.value })}
                                    />
                                </div>
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
                                    <Label className="text-sm font-medium text-white">MRR atual (R$)</Label>
                                    <Input
                                        type="number"
                                        placeholder="15000"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.goal.mrr_atual || ''}
                                        onChange={e => updateProject({ goal: { ...project.goal, mrr_atual: Number(e.target.value) } })}
                                    />
                                    <p className="text-[11px] text-zinc-500">Faturamento recorrente atual</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Custo Total Vendas/Mkt (R$)</Label>
                                    <Input
                                        type="number"
                                        placeholder="5000"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={project.economics.monthlySalesMktCost || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, monthlySalesMktCost: Number(e.target.value) } })}
                                    />
                                    <p className="text-[11px] text-zinc-500">Salários + Marketing + Ferramentas + Mídia</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Reuniões/semana por vendedor</Label>
                                    <Input
                                        type="number"
                                        placeholder="12"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={(project.economics as any).meetingsPerWeek || ''}
                                        onChange={e => updateProject({ economics: { ...project.economics, meetingsPerWeek: Number(e.target.value) } })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-white">Propostas em aberto</Label>
                                    <Input
                                        type="number"
                                        placeholder="15"
                                        className="h-11 rounded-xl bg-zinc-950 border-white/10 text-white placeholder:text-zinc-600"
                                        value={''}
                                        onChange={() => { }}
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

                    {/* Bowtie Steps (b01 a b07, sem b00 que tem tratamento próprio) */}
                    {currentStep.id.match(/^b0[1-7]$/) && (
                        <BowtieStep
                            currentStep={currentStep}
                            project={project}
                            updateBowtie={updateBowtie}
                            getStageHandle={getStageHandle}
                            benchmarks={benchmarks}
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

                            {/* Explicação da Métrica */}
                            <div className="border border-white/5 rounded-xl overflow-hidden">
                                <div className="bg-red-600/5 border-b border-white/5 px-5 py-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-red-600 rounded-full flex-shrink-0" />
                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.18em]">
                                        Índice de Visibilidade — O que é esta métrica?
                                    </p>
                                </div>
                                <div className="bg-zinc-950 divide-y divide-white/5">
                                    <div className="px-5 py-4 space-y-2">
                                        <p className="text-[12px] text-zinc-200 leading-relaxed">
                                            O Índice de Visibilidade mede o quanto a empresa consegue <strong>enxergar o próprio funil</strong>. Se UTMs não estão implementadas, se o CRM não registra a origem do lead, ou se o funil não está padronizado — você está operando às cegas.
                                        </p>
                                        <p className="text-[10px] font-mono text-zinc-400 bg-black px-3 py-1.5 rounded border border-white/5 w-fit">
                                            Visibilidade = (Checklist marcado / 3) × Peso Confiabilidade CRM
                                        </p>
                                    </div>
                                    <div className="px-5 py-4">
                                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Por que isso importa?</p>
                                        <p className="text-[11px] text-zinc-400 leading-relaxed">Se a Cegueira é identificada como trava, todos os outros gargalos são <strong>suspeitos</strong>. Não se pode otimizar o que não se mede. O primeiro passo é sempre garantir rastreabilidade total.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6 bg-black/40 border border-white/5 p-8 rounded-[2rem] text-left">
                                <div className="space-y-4">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center mb-4">Checklist de Tracking</p>
                                    {[
                                        { key: 'utms_implementadas', label: 'UTMs implementadas em todas as campanhas' },
                                        { key: 'crm_com_origem', label: 'Lead entra no CRM com origem/mídia preenchida' },
                                        { key: 'funil_padronizado_crm', label: 'Funil padronizado no CRM (etapas claras)' },
                                    ].map(item => (
                                        <div key={item.key} className="flex items-center gap-3 group cursor-pointer" onClick={() => updateProject({ tracking: { ...project.tracking, [item.key]: !project.tracking[item.key as keyof typeof project.tracking] } })}>
                                            <div className={cn(
                                                "w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                                                project.tracking[item.key as keyof typeof project.tracking] ? "bg-red-600 border-red-600 text-white" : "bg-black border-white/10 text-transparent"
                                            )}>
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <span className={cn("text-xs font-black uppercase tracking-tight", project.tracking[item.key as keyof typeof project.tracking] ? "text-white" : "text-zinc-600")}>
                                                {item.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="h-px w-full bg-white/5 my-6" />

                                <div className="space-y-4">
                                    <Label className="text-center block text-[10px] font-black uppercase tracking-widest text-zinc-700">Confiabilidade geral do CRM</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {['baixa', 'media', 'alta'].map(lvl => (
                                            <Button
                                                key={lvl}
                                                variant="outline"
                                                className={cn(
                                                    "h-16 rounded-2xl text-[9px] font-black uppercase tracking-widest",
                                                    project.tracking.conf_crm === lvl ? "bg-red-600 text-white border-red-600" : "bg-black border-white/5 text-zinc-600"
                                                )}
                                                onClick={() => {
                                                    updateProject({ tracking: { ...project.tracking, conf_crm: lvl as any } });
                                                    updateBowtie('cegueira', { reliability: lvl as any });
                                                }}
                                            >
                                                {lvl === 'alta' ? 'Alta' : lvl === 'media' ? 'Média' : 'Baixa'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep.id === 'review' && !showAILoadingScreen && (
                        <div className="space-y-8 max-w-md mx-auto w-full text-center py-10">
                            <div className="w-24 h-24 bg-emerald-600/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-600/20">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Insumos Coletados</h3>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Revise os dados e clique em "Gerar Diagnóstico" para a IA analisar tudo.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 p-6 bg-black rounded-[2rem] border border-white/5 text-left">
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Projeto</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{project.name}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Modelo</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{project.briefing?.business_model_desc || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Nicho</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{project.briefing?.niche || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Faturamento Alvo</span>
                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">R$ {project.goal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Ticket Médio</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">R$ {(project.economics.averageTicket || 0).toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase">Maturidade CRM</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{project.bowtie.cegueira.reliability}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TELA DE CARREGAMENTO DA IA — fullscreen overlay */}
                    {showAILoadingScreen && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="relative">
                                <div className="w-28 h-28 rounded-full border-2 border-red-600/30 flex items-center justify-center">
                                    <div className="w-20 h-20 rounded-full border-2 border-red-600/50 flex items-center justify-center animate-pulse">
                                        <SparklesIcon className="w-10 h-10 text-red-600 animate-spin" />
                                    </div>
                                </div>
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full animate-ping" />
                            </div>
                            <div className="space-y-3 text-center max-w-sm">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">IA Processando...</h3>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Analisando {stageScores.length} métricas, briefing e modelo de negócio para identificar a restrição do sistema.
                                </p>
                            </div>
                            <div className="w-full max-w-xs space-y-2">
                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full animate-pulse" style={{ width: '70%' }} />
                                </div>
                                <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest text-center">Open Router · Gemini Flash · TOC Engine</p>
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
                    {!showAILoadingScreen && (
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-10 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600"
                            onClick={handleNext}
                            disabled={isProcessingAI}
                        >
                            {currentStepIdx === STEPS.length - 1 
                              ? 'Gerar Diagnóstico' 
                              : 'Avançar'} 
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function getStageHandle(stepId: string): string {
    const map: Record<string, string> = {
        'b01': 'exposicao',
        'b02': 'atencao',
        'b03': 'interesse',
        'b04': 'qualificacao',
        'b05': 'compromisso',
        'b06': 'decisao',
        'b07': 'retencao',
        'b00': 'cegueira'
    };
    return map[stepId] || 'exposicao';
}
