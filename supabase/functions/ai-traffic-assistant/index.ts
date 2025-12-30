import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for cache key
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, startDate, endDate, message, analysisType, skipCache = false } = await req.json();
    
    console.log('AI Assistant request:', { projectId, startDate, endDate, analysisType, message, skipCache });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate cache key based on project, period and message
    const cacheKey = hashString(`${projectId}-${startDate}-${endDate}-${message}`);
    console.log('Cache key:', cacheKey);

    // Check cache first (unless skipCache is true)
    if (!skipCache) {
      const { data: cachedResponse, error: cacheError } = await supabase
        .from('ai_analysis_cache')
        .select('*')
        .eq('project_id', projectId)
        .eq('query_hash', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cacheError && cachedResponse) {
        console.log('Cache hit! Returning cached response');
        return new Response(JSON.stringify({ 
          success: true, 
          response: cachedResponse.ai_response,
          context: cachedResponse.context_summary,
          cached: true,
          cachedAt: cachedResponse.created_at
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Cache miss, fetching from AI Gateway');
    }

    // Buscar dados do projeto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Projeto não encontrado');
    }

    console.log('Project found:', project.name, project.business_model);

    // Buscar métricas diárias do período
    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('ads_daily_metrics')
      .select('*')
      .eq('project_id', projectId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (metricsError) {
      console.error('Error fetching daily metrics:', metricsError);
    }

    // Agregar métricas
    const aggregatedMetrics = aggregateMetrics(dailyMetrics || []);
    console.log('Aggregated metrics:', aggregatedMetrics);

    // Buscar top campanhas
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('project_id', projectId)
      .order('spend', { ascending: false })
      .limit(5);

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
    }

    // Buscar demographics
    const { data: demographics, error: demoError } = await supabase
      .from('demographic_insights')
      .select('*')
      .eq('project_id', projectId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (demoError) {
      console.error('Error fetching demographics:', demoError);
    }

    // Montar contexto para IA
    const context = buildContext({
      project,
      aggregatedMetrics,
      campaigns: campaigns || [],
      demographics: demographics || [],
      startDate,
      endDate,
      analysisType
    });

    console.log('Context built, calling AI Gateway with streaming...');

    // Prepare context summary
    const contextSummary = {
      projectName: project.name,
      businessModel: project.business_model,
      period: `${startDate} a ${endDate}`,
      totalSpend: aggregatedMetrics.spend,
      totalConversions: aggregatedMetrics.conversions
    };

    // Call Lovable AI Gateway with streaming
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: buildSystemPrompt(!!project.ai_briefing) },
          { role: 'user', content: `${context}\n\n=== PERGUNTA DO USUÁRIO ===\n${message}\n\nTake a deep breath and work on this problem step-by-step.` }
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos de IA esgotados. Adicione mais créditos em Settings.');
      }
      
      throw new Error(`Erro no AI Gateway: ${aiResponse.status}`);
    }

    // Stream the response directly to the client
    return new Response(aiResponse.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function aggregateMetrics(dailyMetrics: any[]) {
  return dailyMetrics.reduce((acc, day) => ({
    spend: acc.spend + (day.spend || 0),
    impressions: acc.impressions + (day.impressions || 0),
    clicks: acc.clicks + (day.clicks || 0),
    conversions: acc.conversions + (day.conversions || 0),
    conversionValue: acc.conversionValue + (day.conversion_value || 0),
    reach: acc.reach + (day.reach || 0),
    days: acc.days + 1
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, reach: 0, days: 0 });
}

function buildContext(data: {
  project: any;
  aggregatedMetrics: any;
  campaigns: any[];
  demographics: any[];
  startDate: string;
  endDate: string;
  analysisType?: string;
}) {
  const { project, aggregatedMetrics, campaigns, demographics, startDate, endDate } = data;
  
  const businessModelLabels: Record<string, string> = {
    'inside_sales': 'Inside Sales (geração de leads)',
    'ecommerce': 'E-commerce (vendas online)',
    'pdv': 'PDV (ponto de venda físico)'
  };

  const ctr = aggregatedMetrics.impressions > 0 
    ? ((aggregatedMetrics.clicks / aggregatedMetrics.impressions) * 100).toFixed(2) 
    : 0;
  
  const cpc = aggregatedMetrics.clicks > 0 
    ? (aggregatedMetrics.spend / aggregatedMetrics.clicks).toFixed(2) 
    : 0;
  
  const cpm = aggregatedMetrics.impressions > 0 
    ? ((aggregatedMetrics.spend / aggregatedMetrics.impressions) * 1000).toFixed(2) 
    : 0;

  const costPerResult = aggregatedMetrics.conversions > 0 
    ? (aggregatedMetrics.spend / aggregatedMetrics.conversions).toFixed(2) 
    : 0;

  const roas = aggregatedMetrics.spend > 0 
    ? (aggregatedMetrics.conversionValue / aggregatedMetrics.spend).toFixed(2) 
    : 0;

  // Agregar demographics
  const demoByType: Record<string, Record<string, number>> = {};
  demographics.forEach(d => {
    if (!demoByType[d.breakdown_type]) {
      demoByType[d.breakdown_type] = {};
    }
    if (!demoByType[d.breakdown_type][d.breakdown_value]) {
      demoByType[d.breakdown_type][d.breakdown_value] = 0;
    }
    demoByType[d.breakdown_type][d.breakdown_value] += d.spend || 0;
  });

  let demographicsText = '';
  Object.entries(demoByType).forEach(([type, values]) => {
    demographicsText += `\n${type.toUpperCase()}:\n`;
    Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([value, spend]) => {
        demographicsText += `  - ${value}: R$ ${spend.toFixed(2)}\n`;
      });
  });

  const campaignsText = campaigns.map((c, i) => 
    `${i + 1}. ${c.name} | Status: ${c.status} | Gasto: R$ ${(c.spend || 0).toFixed(2)} | Conversões: ${c.conversions || 0}`
  ).join('\n');

  // Incluir briefing do projeto se existir
  const briefingSection = project.ai_briefing 
    ? `\n=== BRIEFING DO PROJETO (CONTEXTO ESTRATÉGICO) ===\n${project.ai_briefing}\n`
    : '';

  return `
=== CONTEXTO DO PROJETO ===
Nome: ${project.name}
Modelo de Negócio: ${businessModelLabels[project.business_model] || project.business_model}
Moeda: ${project.currency}
Timezone: ${project.timezone}
${briefingSection}
=== PERÍODO ANALISADO ===
De: ${startDate}
Até: ${endDate}
Total de dias com dados: ${aggregatedMetrics.days}

=== MÉTRICAS GERAIS ===
Investimento Total: R$ ${aggregatedMetrics.spend.toFixed(2)}
Impressões: ${aggregatedMetrics.impressions.toLocaleString()}
Cliques: ${aggregatedMetrics.clicks.toLocaleString()}
CTR: ${ctr}%
CPC: R$ ${cpc}
CPM: R$ ${cpm}
Alcance: ${aggregatedMetrics.reach.toLocaleString()}
Conversões: ${aggregatedMetrics.conversions}
${project.business_model === 'ecommerce' ? `ROAS: ${roas}x` : `CPL/CPA: R$ ${costPerResult}`}
Valor de Conversão: R$ ${aggregatedMetrics.conversionValue.toFixed(2)}

=== TOP 5 CAMPANHAS ===
${campaignsText || 'Nenhuma campanha encontrada'}

=== DADOS DEMOGRÁFICOS ===${demographicsText || '\nNenhum dado demográfico disponível'}
`;
}

function buildSystemPrompt(hasBriefing: boolean) {
  const briefingNote = hasBriefing 
    ? `

<importante>
ATENÇÃO: Este projeto possui um BRIEFING ESTRATÉGICO fornecido pelo gestor. 
Use as informações do briefing como referência principal para:
- Entender o mercado-alvo e país de atuação
- Avaliar se as métricas estão dentro do esperado para ESTE projeto específico
- Considerar os KPIs e metas definidos pelo cliente
- NÃO use benchmarks genéricos de mercado brasileiro se o projeto atua em outro país
</importante>`
    : '';

  return `<role>
Você é o Agente Lisboa, um analista sênior de performance e inteligência de dados em mídia paga, especializado em Meta Ads para Inside Sales e E-commerce.

Você atua como um motor analítico, responsável por interpretar métricas, identificar padrões, variações, tendências e anomalias de performance, sempre com foco em resultado financeiro e eficiência.
</role>
${briefingNote}

<objective>
Seu objetivo é gerar análises e diagnósticos baseados EXCLUSIVAMENTE nos dados fornecidos e no contexto específico do projeto.

A análise deve:
- Ser contextualizada para o mercado/país onde o projeto atua
- Comparar métricas com histórico do próprio projeto (não benchmarks genéricos)
- Identificar tendências e variações significativas
- Detectar gargalos e oportunidades no funil
- Gerar recomendações acionáveis e específicas

IMPORTANTE: 
- NÃO use benchmarks genéricos de mercado brasileiro para projetos internacionais
- Se não houver briefing do projeto, pergunte sobre o contexto antes de fazer julgamentos de valor
- CPM, CPC e outras métricas variam MUITO por país, nicho e objetivo de campanha
</objective>

<analysis_framework>
- Análise puramente quantitativa baseada nos dados fornecidos
- Conclusões sustentadas por métricas e variações percentuais
- Eficiência tem prioridade sobre volume
- Destacar impacto financeiro das variações
- Ser honesto quando não tiver informações suficientes para julgar se algo está "bom" ou "ruim"
</analysis_framework>

<output_rules>
- Use emojis para facilitar leitura (📊 📈 📉 ⚠️ ✅ 💡 🎯)
- Formate com Markdown (títulos, listas, negrito)
- Responda SEMPRE em português brasileiro
- Seja direto, objetivo e executivo
- Se não houver briefing do projeto, sugira ao usuário configurar um para análises mais precisas
</output_rules>`;
}
