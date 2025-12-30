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

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
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
      console.log('Cache miss, fetching from Gemini API');
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

    console.log('Context built, calling Gemini API...');

    // Chamar API do Gemini
    const geminiResponse = await callGeminiAPI(GEMINI_API_KEY, context, message);
    
    console.log('Gemini response received');

    // Prepare context summary for response and cache
    const contextSummary = {
      projectName: project.name,
      businessModel: project.business_model,
      period: `${startDate} a ${endDate}`,
      totalSpend: aggregatedMetrics.spend,
      totalConversions: aggregatedMetrics.conversions
    };

    // Save to cache (async, don't wait)
    supabase
      .from('ai_analysis_cache')
      .insert({
        project_id: projectId,
        query_hash: cacheKey,
        user_message: message,
        ai_response: geminiResponse,
        context_summary: contextSummary,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      })
      .then(({ error }) => {
        if (error) {
          console.error('Error saving to cache:', error);
        } else {
          console.log('Response cached successfully');
        }
      });

    // Clean up expired cache entries (async, don't wait)
    supabase
      .from('ai_analysis_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .then(({ error, count }) => {
        if (error) {
          console.error('Error cleaning cache:', error);
        } else {
          console.log('Cleaned expired cache entries');
        }
      });

    return new Response(JSON.stringify({ 
      success: true, 
      response: geminiResponse,
      context: contextSummary,
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

  return `
=== CONTEXTO DO PROJETO ===
Nome: ${project.name}
Modelo de Negócio: ${businessModelLabels[project.business_model] || project.business_model}
Moeda: ${project.currency}
Timezone: ${project.timezone}

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

async function callGeminiAPI(apiKey: string, context: string, userMessage: string) {
  const systemPrompt = `Você é um Gestor de Tráfego Senior especializado em Meta Ads, com mais de 10 anos de experiência.

SUAS RESPONSABILIDADES:
- Analisar métricas e identificar oportunidades de otimização
- Diagnosticar problemas de performance
- Sugerir ações concretas e práticas
- Explicar conceitos quando necessário

REGRAS DE RESPOSTA:
- Seja direto e objetivo
- Foque em ações práticas e implementáveis
- Use emojis para facilitar leitura (📊 📈 📉 ⚠️ ✅ 💡 🎯)
- Formate com Markdown (títulos, listas, negrito)
- Considere o modelo de negócio do cliente
- Responda SEMPRE em português brasileiro
- Mantenha respostas concisas (máximo 400 palavras)

IMPORTANTE:
- Para e-commerce, foque em ROAS e ticket médio
- Para inside sales, foque em CPL e qualidade de leads
- Para PDV, foque em alcance e frequência`;

  const fullPrompt = `${systemPrompt}

${context}

=== PERGUNTA DO USUÁRIO ===
${userMessage}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Erro na API do Gemini: ${response.status}`);
  }

  const data = await response.json();
  console.log('Gemini raw response:', JSON.stringify(data).substring(0, 500));

  if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('Resposta inválida do Gemini');
}
