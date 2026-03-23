import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { diagnosticData } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const {
      identification,
      business,
      market,
      funnel,
      businessModel,
    } = diagnosticData;

    // Build the trava structure based on business model
    const travaStructures: Record<string, string> = {
      ecommerce: `
Trava 07: Volume de impressões, CPM
Trava 06: CTR, Cliques, CPC
Trava 05: Lead, CPL, Taxa de Conversão, Visitantes
Trava 04: Taxa de Qualificação, MQL, Add to Cart
Trava 03: Checkout
Trava 02: Pedido Realizado
Trava 01: Recompra`,
      inside_sales: `
Trava 07: Volume de impressões, CPM
Trava 06: CTR, Cliques, CPC
Trava 05: Lead, CPL, Taxa de Conversão
Trava 04: Taxa de Qualificação, MQL
Trava 03: Reunião / Visita / Coleta de Informação
Trava 02: Fechamento da Proposta
Trava 01: Churn, Recompra`,
      pdv: `
Trava 07: Volume de impressões OU volume de pessoas que passam na rua (estimativa)
Trava 06: Número de pessoas que entram na loja
Trava 05: Lead, CPL, Taxa de Conversão, Add to Cart
Trava 04: Taxa de Qualificação, MQL
Trava 03: NULL (não se aplica)
Trava 02: Venda
Trava 01: Recompra`,
    };

    const travaStructure = travaStructures[businessModel] || travaStructures.inside_sales;

    // Check for Cegueira (blindness) - if no funnel data at all
    const hasFunnelData = funnel && Object.values(funnel).some((v: any) => {
      if (typeof v === 'object' && v !== null) {
        return Object.values(v).some((innerV: any) => innerV !== null && innerV !== undefined && innerV !== '' && innerV !== 0);
      }
      return v !== null && v !== undefined && v !== '' && v !== 0;
    });

    // Check for Market constraint
    const hasMarketConstraint = market && market.tam > 0 && market.sam > 0 && market.som > 0;

    const systemPrompt = `Você é um consultor especialista em diagnóstico de funil de vendas usando a Teoria das Restrições (TOC) de Goldratt.

Sua tarefa é analisar os dados fornecidos pelo usuário e identificar a TRAVA (gargalo/bottleneck) do funil.

REGRAS CRÍTICAS:
1. A análise é SEMPRE da maior para a menor (Trava 07 → Trava 01).
2. Você DEVE correlacionar o produto, empresa, mercado e segmento com as métricas para NÃO identificar trava errada.
3. Se o usuário NÃO preencheu nenhuma informação de uma determinada trava, retorne "Trava de Cegueira".
4. Se TAM/SAM/SOM indicam que o mercado é a restrição (meta acima do SOM), retorne "Trava de Mercado".
5. NÃO invente dados. NÃO assuma valores. Use APENAS o que foi preenchido.

ESTRUTURA DE TRAVAS PARA MODELO "${businessModel?.toUpperCase() || 'INSIDE SALES'}":
${travaStructure}

Responda SEMPRE em JSON com a seguinte estrutura:
{
  "trava_identificada": "07" | "06" | "05" | "04" | "03" | "02" | "01" | "cegueira" | "mercado",
  "trava_nome": "string com nome da trava",
  "confianca": "alta" | "media" | "baixa",
  "razao_core_problem": "string com explicação detalhada do core problem (CRT da TOC)",
  "injecao_recomendada": "string com a injeção do Evaporating Cloud",
  "udes": ["lista de 3-5 Undesirable Effects observados nos dados"],
  "sintese": "string com síntese executiva de 3-5 parágrafos",
  "ltp_analysis": {
    "crt_nodes": ["lista de nós da Current Reality Tree"],
    "core_problem": "string com o core problem identificado",
    "evaporating_cloud": {
      "objetivo": "string",
      "necessidade_a": "string",
      "necessidade_b": "string",
      "acao_a": "string",
      "acao_b": "string",
      "pressuposto_invalido": "string",
      "injecao": "string"
    },
    "frt_effects": ["lista de efeitos desejáveis esperados após a injeção"],
    "negative_branches": ["lista de riscos potenciais da injeção"],
    "prerequisite_tree": ["lista de obstáculos e objetivos intermediários"]
  },
  "plano_90_dias": {
    "mes_1": {
      "titulo": "string",
      "acoes": ["lista de 3-5 ações"]
    },
    "mes_2": {
      "titulo": "string",
      "acoes": ["lista de 3-5 ações"]
    },
    "mes_3": {
      "titulo": "string",
      "acoes": ["lista de 3-5 ações"]
    }
  },
  "metricas_foco": ["lista de métricas prioritárias para monitorar"],
  "stage_scores": [
    {
      "trava": "07",
      "nome": "string",
      "status": "critico" | "na_media" | "bom" | "sem_dados",
      "valor_informado": "string ou null",
      "observacao": "string"
    }
  ]
}`;

    const userPrompt = `Analise os seguintes dados de diagnóstico:

IDENTIFICAÇÃO:
- Empresa: ${identification?.companyName || 'Não informado'}
- Produto/Serviço: ${identification?.product || 'Não informado'}
- ICP: ${identification?.icp || 'Não informado'}
- Segmento: ${identification?.segment || 'Não informado'}
- Localização: ${identification?.location || 'Não informado'}
- Modelo de Negócio: ${businessModel || 'Não informado'}

BUSINESS:
- Margem de Contribuição: ${business?.contributionMargin || 'Não informado'}%
- Ticket Médio: R$ ${business?.averageTicket || 'Não informado'}
- Faturamento: R$ ${business?.revenue || 'Não informado'} (${business?.revenueType || 'mensal'})

MERCADO:
- TAM: R$ ${market?.tam || 'Não informado'}
- SAM: R$ ${market?.sam || 'Não informado'}
- SOM: R$ ${market?.som || 'Não informado'}
${market?.justification ? `- Justificativa: ${market.justification}` : ''}

DADOS DO FUNIL (preenchidos pelo usuário):
${JSON.stringify(funnel || {}, null, 2)}

${!hasFunnelData ? 'ATENÇÃO: O usuário NÃO preencheu NENHUM dado do funil. Aplique a regra de CEGUEIRA.' : ''}
${hasMarketConstraint && market.som > 0 && business?.revenue && (business.revenueType === 'anual' ? business.revenue : business.revenue * 12) > market.som ? 'ATENÇÃO: A meta de faturamento anual EXCEDE o SOM. Considere TRAVA DE MERCADO.' : ''}

Analise de Trava 07 → Trava 01 e identifique o gargalo principal. Correlacione com o contexto da empresa.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://metricaslisboa.lovable.app",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "diagnostic_analysis",
              description: "Return the complete diagnostic analysis result",
              parameters: {
                type: "object",
                properties: {
                  trava_identificada: { type: "string", enum: ["07", "06", "05", "04", "03", "02", "01", "cegueira", "mercado"] },
                  trava_nome: { type: "string" },
                  confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                  razao_core_problem: { type: "string" },
                  injecao_recomendada: { type: "string" },
                  udes: { type: "array", items: { type: "string" } },
                  sintese: { type: "string" },
                  ltp_analysis: {
                    type: "object",
                    properties: {
                      crt_nodes: { type: "array", items: { type: "string" } },
                      core_problem: { type: "string" },
                      evaporating_cloud: {
                        type: "object",
                        properties: {
                          objetivo: { type: "string" },
                          necessidade_a: { type: "string" },
                          necessidade_b: { type: "string" },
                          acao_a: { type: "string" },
                          acao_b: { type: "string" },
                          pressuposto_invalido: { type: "string" },
                          injecao: { type: "string" },
                        },
                        required: ["objetivo", "necessidade_a", "necessidade_b", "acao_a", "acao_b", "pressuposto_invalido", "injecao"],
                      },
                      frt_effects: { type: "array", items: { type: "string" } },
                      negative_branches: { type: "array", items: { type: "string" } },
                      prerequisite_tree: { type: "array", items: { type: "string" } },
                    },
                    required: ["crt_nodes", "core_problem", "evaporating_cloud", "frt_effects", "negative_branches", "prerequisite_tree"],
                  },
                  plano_90_dias: {
                    type: "object",
                    properties: {
                      mes_1: {
                        type: "object",
                        properties: { titulo: { type: "string" }, acoes: { type: "array", items: { type: "string" } } },
                        required: ["titulo", "acoes"],
                      },
                      mes_2: {
                        type: "object",
                        properties: { titulo: { type: "string" }, acoes: { type: "array", items: { type: "string" } } },
                        required: ["titulo", "acoes"],
                      },
                      mes_3: {
                        type: "object",
                        properties: { titulo: { type: "string" }, acoes: { type: "array", items: { type: "string" } } },
                        required: ["titulo", "acoes"],
                      },
                    },
                    required: ["mes_1", "mes_2", "mes_3"],
                  },
                  metricas_foco: { type: "array", items: { type: "string" } },
                  stage_scores: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trava: { type: "string" },
                        nome: { type: "string" },
                        status: { type: "string", enum: ["critico", "na_media", "bom", "sem_dados"] },
                        valor_informado: { type: "string" },
                        observacao: { type: "string" },
                      },
                      required: ["trava", "nome", "status", "observacao"],
                    },
                  },
                },
                required: ["trava_identificada", "trava_nome", "confianca", "razao_core_problem", "injecao_recomendada", "udes", "sintese", "ltp_analysis", "plano_90_dias", "metricas_foco", "stage_scores"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "diagnostic_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    
    // Extract structured output from tool call
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No structured output received from AI");
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("diagnostic-ai-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
