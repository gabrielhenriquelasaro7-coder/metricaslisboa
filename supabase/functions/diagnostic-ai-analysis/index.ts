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

    const { identification, business, market, funnel, businessModel } = diagnosticData;

    const travaStructures: Record<string, string> = {
      ecommerce: `
Trava 01: Volume de impressões, CPM (TOPO DO FUNIL — Alcance)
Trava 02: CTR, Cliques, CPC (Atenção)
Trava 03: Lead, CPL, Taxa de Conversão, Visitantes (Interesse)
Trava 04: Taxa de Qualificação, MQL, Add to Cart (Qualificação)
Trava 05: Checkout (Compromisso)
Trava 06: Pedido Realizado (Decisão/Fechamento)
Trava 07: Recompra (FUNDO DO FUNIL — Retenção)`,
      inside_sales: `
Trava 01: Volume de impressões, CPM (TOPO DO FUNIL — Alcance)
Trava 02: CTR, Cliques, CPC (Atenção)
Trava 03: Lead, CPL, Taxa de Conversão (Interesse)
Trava 04: Taxa de Qualificação, MQL (Qualificação)
Trava 05: Reunião / Visita / Coleta de Informação (Compromisso)
Trava 06: Fechamento da Proposta (Decisão)
Trava 07: Churn, Recompra (FUNDO DO FUNIL — Retenção)`,
      pdv: `
Trava 01: Volume de impressões OU volume de pessoas que passam na rua (TOPO DO FUNIL — Alcance)
Trava 02: Número de pessoas que entram na loja (Atenção)
Trava 03: Lead, CPL, Taxa de Conversão, Add to Cart (Interesse)
Trava 04: Taxa de Qualificação, MQL (Qualificação)
Trava 05: NULL (não se aplica no PDV)
Trava 06: Venda (Decisão/Fechamento)
Trava 07: Recompra (FUNDO DO FUNIL — Retenção)`,
    };

    const travaStructure = travaStructures[businessModel] || travaStructures.inside_sales;

    const hasFunnelData = funnel && Object.values(funnel).some((v: any) => {
      if (typeof v === 'object' && v !== null) {
        return Object.values(v).some((innerV: any) => innerV !== null && innerV !== undefined && innerV !== '' && innerV !== 0);
      }
      return v !== null && v !== undefined && v !== '' && v !== 0;
    });

    const hasMarketConstraint = market && market.tam > 0 && market.sam > 0 && market.som > 0;

    const systemPrompt = `Você é um consultor sênior especialista em diagnóstico de funil de vendas usando a Teoria das Restrições (TOC) de Eliyahu Goldratt, com profundo domínio do Logical Thinking Process (LTP).

Sua tarefa é analisar os dados fornecidos e identificar a TRAVA (gargalo/bottleneck) do funil usando análise rigorosa de causa e efeito.

REGRAS CRÍTICAS DE NUMERAÇÃO:
- Trava 01 = TOPO DO FUNIL (Alcance / Impressões / CPM) — Categoria: ATENÇÃO
- Trava 02 = Atenção (CTR / Cliques / CPC) — Categoria: INTERESSE
- Trava 03 = Interesse (Lead / CPL / Taxa de Conversão) — Categoria: INTERESSE
- Trava 04 = Qualificação (MQL / Taxa de Qualificação) — Categoria: INTERESSE
- Trava 05 = Compromisso (Reunião / Checkout) — Categoria: COMPROMISSO
- Trava 06 = Decisão / Fechamento (Proposta / Pedido / Venda) — Categoria: COMPROMISSO
- Trava 07 = Retenção (Churn / Recompra) — Categoria: RETENÇÃO — FUNDO DO FUNIL

REGRAS CRÍTICAS DE ANÁLISE:
1. A análise SEMPRE percorre de Trava 07 → Trava 01 (do fundo para o topo). O PRIMEIRO gargalo encontrado nessa direção é a restrição do sistema.
2. Você DEVE correlacionar o produto, empresa, mercado e segmento com as métricas para NÃO identificar trava errada.
3. **REGRA DE CEGUEIRA OBRIGATÓRIA**: Se 2 ou mais travas NÃO possuem dados preenchidos (excluindo travas marcadas como "_nao_aplica": true), você DEVE obrigatoriamente retornar trava_identificada = "cegueira" e trava_nome = "Cegueira de Dados". Não tente identificar uma restrição ativa quando há dados insuficientes. Esta regra tem PRIORIDADE sobre todas as outras.
4. Se TAM/SAM/SOM indicam que o mercado é a restrição (meta acima do SOM), retorne "Trava de Mercado".
5. NÃO invente dados. NÃO assuma valores. Use APENAS o que foi preenchido.
6. O campo "trava_nome" deve usar o NOME COMPLETO da trava conforme listado abaixo (ex: "Volume de impressões, CPM" para Trava 07, "Taxa de Qualificação, MQL" para Trava 04).
7. O campo "nome" em cada stage_score deve usar o NOME COMPLETO da trava (ex: "Volume de impressões, CPM"), NÃO nomes genéricos como "Exposição" ou "Qualificação".

ESTRUTURA DE TRAVAS PARA MODELO "${businessModel?.toUpperCase() || 'INSIDE SALES'}":
${travaStructure}

INSTRUÇÕES DETALHADAS PARA CADA CAMPO DA RESPOSTA:

1. **valor_informado** em stage_scores: Quando houver dados, formate como string legível contendo as métricas reais (ex: "Impressões: 210.000 | CPM: R$14,50"). Quando NÃO houver dados, use null — NUNCA use "null" como string.

2. **observacao** em stage_scores: SEMPRE preencha com observação contextualizada. Se não há dados, escreva "Dados não fornecidos — impossível avaliar esta trava sem métricas reais". Se há dados, compare com benchmarks do segmento e dê parecer técnico (ex: "CPM de R$14,50 está acima da média do segmento automotivo (R$8-12). Indica possível problema de segmentação ou saturação de audiência.").

3. **sintese**: Escreva uma síntese executiva PROFUNDA com 5 a 7 parágrafos. Inclua:
   - Parágrafo 1: Contexto da empresa e seu posicionamento no mercado
   - Parágrafo 2: Diagnóstico geral do funil com números específicos
   - Parágrafo 3: Análise detalhada da trava identificada com comparação a benchmarks
   - Parágrafo 4: Impacto financeiro estimado da restrição (usando ticket médio e margem)
   - Parágrafo 5: Conexão causal entre a trava e os UDEs observados
   - Parágrafo 6-7: Recomendação estratégica e prognóstico

4. **Evaporating Cloud**: Construa um EC COMPLETO, PROFUNDO e ESPECÍFICO ao contexto da empresa seguindo a metodologia rigorosa de Goldratt:
   - objetivo: O objetivo comum que ambos os lados querem atingir — DEVE ser específico ao contexto da empresa (ex: "Aumentar MRR para R$200k mantendo margem saudável"), NÃO genérico como "crescer"
   - necessidade_a e necessidade_b: Duas necessidades REAIS, DISTINTAS e BEM ARTICULADAS que entram em conflito. Cada necessidade deve ter 2-3 frases explicando POR QUE ela é necessária para o objetivo. Evite necessidades genéricas — conecte ao funil e às métricas da empresa.
   - acao_a e acao_b: As ações concretas e DETALHADAS que cada necessidade demanda. Devem ser MUTUAMENTE EXCLUSIVAS — explique claramente por que fazer uma impede a outra. Use exemplos práticos do contexto da empresa (ex: "Investir 80% do budget em campanhas de awareness para aumentar volume de impressões" vs "Concentrar budget em remarketing para maximizar conversão do tráfego existente").
   - pressuposto_invalido: O pressuposto específico que MANTÉM o conflito vivo. Deve ser uma CRENÇA articulada em 2-3 frases, explicando: (1) qual é a crença, (2) por que as pessoas acreditam nela, e (3) por que ela é falsa no contexto específico desta empresa. NÃO use frases genéricas como "não é possível fazer as duas coisas". Cite dados ou benchmarks que invalidem o pressuposto.
   - injecao: A solução CONCRETA e IMPLEMENTÁVEL que INVALIDA o pressuposto e dissolve o conflito. Deve incluir: (1) O QUE fazer especificamente, (2) COMO isso resolve o conflito, (3) métricas esperadas de resultado. NÃO é um compromisso entre A e B — é uma ruptura lógica que permite satisfazer AMBAS as necessidades.

5. **CRT (crt_nodes)**: Liste 5-8 nós da Árvore de Realidade Atual em ordem causal (de causa para efeito). Cada nó deve ser uma afirmação verificável no presente. O último nó deve ser o core problem.

6. **FRT (frt_effects)**: Liste 4-6 efeitos desejáveis que ocorrerão APÓS a injeção ser implementada. Devem ser o OPOSTO dos UDEs.

7. **negative_branches**: Liste 3-5 riscos REAIS e ESPECÍFICOS que a injeção pode causar. Não genéricos — específicos ao contexto da empresa.

8. **prerequisite_tree**: Liste 4-6 obstáculos reais à implementação da injeção, com seus objetivos intermediários. Formato: "Obstáculo: [X] → OI: [Y]"

9. **plano_90_dias**: Cada mês deve ter 4-5 ações ESPECÍFICAS e MENSURÁVEIS (não genéricas). Use números, prazos e métricas-alvo.

10. **udes**: Liste 4-6 UDEs (Efeitos Indesejáveis) que são OBSERVÁVEIS e VERIFICÁVEIS na realidade atual da empresa. Não são causas, são EFEITOS.

Responda SEMPRE em JSON com a estrutura especificada.`;

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

REGRA IMPORTANTE SOBRE TRAVAS "NÃO SE APLICA":
Se uma trava possui o campo "_nao_aplica": true nos dados do funil, isso significa que o usuário declarou que essa trava NÃO SE APLICA ao modelo de negócio dele (ex: retenção/recompra em produtos high-ticket únicos). 
- NÃO marque essas travas como "sem_dados" ou "cegueira"
- Atribua status "sem_dados" para elas mas NÃO as considere como candidatas a restrição ativa
- Na observação, escreva "Trava marcada como não aplicável pelo usuário — excluída da análise de restrição"
- NUNCA identifique uma trava marcada como _nao_aplica como a restrição ativa do sistema

IMPORTANTE: Use os dados REAIS fornecidos acima para preencher valor_informado em cada stage_score. Formate os valores de forma legível. Compare com benchmarks do segmento "${identification?.segment || 'geral'}". Seja ESPECÍFICO e PROFUNDO na análise.

Analise de Trava 07 → Trava 01 (fundo para topo, seguindo a lógica TOC) e identifique o gargalo principal. Correlacione com o contexto da empresa. Lembre-se: Trava 01 = topo (Impressões), Trava 07 = fundo (Retenção/Recompra).`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://metricaslisboa.lovable.app",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
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
                        valor_informado: { type: "string", nullable: true },
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
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output received from AI");

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
