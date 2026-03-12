import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project, bottleneck, performanceScores } = await req.json();
    
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY não configurada no Supabase');
    }

    const businessModel = project.briefing?.business_model_desc || 'Não informado';
    const bowtieEntries = Object.entries(project.bowtie || {})
      .filter(([k, v]: [string, any]) => v?.value !== undefined && v?.value !== 0)
      .map(([stage, data]: [string, any]) => `- ${stage}: ${data.value} (confiabilidade: ${data.reliability || 'N/A'})`)
      .join('\n');

    const systemPrompt = `Você é um Consultor Estratégico Especialista em Teoria das Restrições (TOC) e Funil Bowtie da "Métricas Lisboa".
Sua missão é realizar um diagnóstico profundo de um ecossistema de vendas e gerar uma análise estratégica de elite, focada em Throughput e Lucratividade.

CONTEXTO DO CLIENTE (BRIEFING):
- Nicho/Setor: ${project.briefing?.niche || 'Não informado'}
- Modelo de Negócio: ${businessModel}
- Squad Responsável: ${project.team || 'Não vinculado'}
- Região: ${project.region || 'Não informada'}
- ICP: ${project.icp || 'Não informado'}
- Situação Atual: ${project.briefing?.current_situation || 'Não informada'}
- Principais Dores: ${project.briefing?.main_pains || 'Não informadas'}

TAMANHO DO MERCADO (ECONOMICS):
- TAM (Total): R$ ${project.market?.tam?.toLocaleString('pt-BR') || '0'}
- SAM (Atendível): R$ ${project.market?.sam?.toLocaleString('pt-BR') || '0'}
- SOM (Meta): R$ ${project.market?.som?.toLocaleString('pt-BR') || '0'}
- Ticket Médio: R$ ${project.economics?.averageTicket || '0'}
- LTV Estimado: R$ ${project.economics?.ltv || '0'}

INSTRUÇÕES ESTRATÉGICAS POR MODELO:
- HIGH TICKET: Priorize Qualidade de Lead vs Volume. A restrição costuma ser a taxa de Show-up e a Win Rate de Diagnóstico. CPL alto é aceitável se o ICP for qualificado.
- TELECOM: A restrição é Geográfica e Operacional. Viabilidade Técnica e Agendamento em até 48h são os KPIs vitais. Churn > 1.5% é crítico.
- SAAS/RECORRENTE: Foco total no Balde Furado (Churn). Se Churn > 5%, não recomende escala de leads, e sim redução de fricção no onboarding.
- INFOPRODUTO: A restrição é a Presença e o Pitch. Se o show-up na live for baixo, o lançamento falha mesmo com leads baratos.

DADOS DE PERFORMANCE (RESUMO):
GARGALO ATUAL (TOC): ${bottleneck.id} (Score: ${bottleneck.score}/10)
Status do Gargalo: ${bottleneck.status}
Valor Atual: ${bottleneck.value}

MÉTRICAS DETALHADAS:
${bowtieEntries || 'Nenhum dado preenchido (Cegueira Total)'}

SCORES POR ETAPA:
${Object.entries(performanceScores).map(([stage, score]) => `- ${stage}: ${score}/10`).join('\n')}

METODOLOGIA DE ANÁLISE:
1. UDEs (Efeitos Indesejados): Liste 3 sintomas claros causados pela restrição ${bottleneck.id}. Seja específico ao nicho.
2. Core Problem: Identifique a causa raiz que impede o aumento do throughput.
3. Injeção: A mudança estratégica "vaca sagrada" que deve ser quebrada.
4. Plano de 90 Dias (3 Fases): Ações PRÁTICAS e EXECUTÁVEIS. Ex: "Implementar Vídeo de Autoridade pós-agendamento", "Refazer script de SDR focado em dor".

REGRAS DE OURO:
- Idioma: Português (Brasil).
- Seja Direto: Sem "papo de vendedor", foque em engenharia de vendas e ROI.
- Zero Dados: Se houver cegueira, recomende primeiro a implementação de tracking e gestão.
- Personalização: Se mencionou o Squad "${project.team}", dê uma instrução específica para eles.

RETORNE APENAS JSON:
{
  "ude": ["...", "...", "..."],
  "coreProblem": "...",
  "injection": "...",
  "plan90Days": {
    "phase1": { "title": "...", "actions": ["..."] },
    "phase2": { "title": "...", "actions": ["..."] },
    "phase3": { "title": "...", "actions": ["..."] }
  },
  "executiveSummary": "Máximo 300 caracteres, tom agressivo e focado em lucro."
}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Gere o diagnóstico estratégico com base nos dados fornecidos.' }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter Error: ${error}`);
    }

    const aiData = await response.json();
    const content = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
