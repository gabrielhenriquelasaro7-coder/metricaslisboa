import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, startDate, endDate } = await req.json();
    
    if (!projectId) {
      throw new Error('projectId é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    // Fetch last 30 days of metrics for trend analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('ads_daily_metrics')
      .select('date, spend, impressions, clicks, conversions, conversion_value, reach')
      .eq('project_id', projectId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (metricsError) throw metricsError;

    // Fetch campaign budgets
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, daily_budget, lifetime_budget, spend, status')
      .eq('project_id', projectId)
      .eq('status', 'ACTIVE');

    if (campaignsError) throw campaignsError;

    // Aggregate metrics by date
    const aggregatedByDate = dailyMetrics?.reduce((acc: Record<string, any>, metric) => {
      if (!acc[metric.date]) {
        acc[metric.date] = { date: metric.date, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, reach: 0 };
      }
      acc[metric.date].spend += metric.spend || 0;
      acc[metric.date].impressions += metric.impressions || 0;
      acc[metric.date].clicks += metric.clicks || 0;
      acc[metric.date].conversions += metric.conversions || 0;
      acc[metric.date].conversion_value += metric.conversion_value || 0;
      acc[metric.date].reach += metric.reach || 0;
      return acc;
    }, {}) || {};

    const sortedDates = Object.values(aggregatedByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate trends and predictions
    const last7Days = sortedDates.slice(-7);
    const previous7Days = sortedDates.slice(-14, -7);

    const avgDailySpend7 = last7Days.reduce((sum: number, d: any) => sum + d.spend, 0) / Math.max(last7Days.length, 1);
    const avgDailySpendPrev7 = previous7Days.reduce((sum: number, d: any) => sum + d.spend, 0) / Math.max(previous7Days.length, 1);
    const avgDailyConversions7 = last7Days.reduce((sum: number, d: any) => sum + d.conversions, 0) / Math.max(last7Days.length, 1);
    const avgDailyRevenue7 = last7Days.reduce((sum: number, d: any) => sum + d.conversion_value, 0) / Math.max(last7Days.length, 1);

    // Calculate budget alerts
    const budgetAlerts = campaigns?.map(campaign => {
      const dailyBudget = campaign.daily_budget || 0;
      const lifetimeBudget = campaign.lifetime_budget || 0;
      const currentSpend = campaign.spend || 0;
      
      // Estimate days until budget runs out
      let daysRemaining = null;
      let budgetStatus = 'healthy';
      
      if (lifetimeBudget > 0 && avgDailySpend7 > 0) {
        const remainingBudget = lifetimeBudget - currentSpend;
        daysRemaining = Math.floor(remainingBudget / avgDailySpend7);
        
        if (daysRemaining <= 3) budgetStatus = 'critical';
        else if (daysRemaining <= 7) budgetStatus = 'warning';
      }

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        dailyBudget,
        lifetimeBudget,
        currentSpend,
        daysRemaining,
        budgetStatus,
        percentUsed: lifetimeBudget > 0 ? (currentSpend / lifetimeBudget) * 100 : null
      };
    }) || [];

    // Build predictions
    const predictions = {
      next7Days: {
        estimatedSpend: avgDailySpend7 * 7,
        estimatedConversions: Math.round(avgDailyConversions7 * 7),
        estimatedRevenue: avgDailyRevenue7 * 7,
      },
      next30Days: {
        estimatedSpend: avgDailySpend7 * 30,
        estimatedConversions: Math.round(avgDailyConversions7 * 30),
        estimatedRevenue: avgDailyRevenue7 * 30,
      },
      trends: {
        spendTrend: avgDailySpendPrev7 > 0 ? ((avgDailySpend7 - avgDailySpendPrev7) / avgDailySpendPrev7) * 100 : 0,
        avgDailySpend: avgDailySpend7,
        avgDailyConversions: avgDailyConversions7,
        avgDailyRevenue: avgDailyRevenue7,
      }
    };

    // Generate AI optimization suggestions
    let aiSuggestions: string[] = [];
    
    if (lovableApiKey) {
      const contextData = {
        projectName: project.name,
        businessModel: project.business_model,
        currency: project.currency,
        last7DaysMetrics: last7Days,
        predictions,
        budgetAlerts: budgetAlerts.filter(b => b.budgetStatus !== 'healthy'),
        totalSpend30Days: sortedDates.reduce((sum: number, d: any) => sum + d.spend, 0),
        totalConversions30Days: sortedDates.reduce((sum: number, d: any) => sum + d.conversions, 0),
        totalRevenue30Days: sortedDates.reduce((sum: number, d: any) => sum + d.conversion_value, 0),
      };

      const systemPrompt = `Você é um especialista em tráfego pago e análise de dados de marketing digital.
Analise os dados fornecidos e gere exatamente 5 sugestões de otimização práticas e acionáveis.

Considere:
- Tendências de gasto e performance
- Alertas de orçamento
- Oportunidades de melhoria de ROAS/CPL
- Recomendações para escalar ou pausar campanhas

Responda APENAS com um array JSON de 5 strings, cada uma sendo uma sugestão concisa (máximo 100 caracteres).
Exemplo: ["Sugestão 1", "Sugestão 2", "Sugestão 3", "Sugestão 4", "Sugestão 5"]`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: JSON.stringify(contextData) }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '[]';
          try {
            // Try to parse as JSON, handling potential markdown formatting
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            aiSuggestions = JSON.parse(cleanContent);
          } catch {
            console.log('Failed to parse AI suggestions, using fallback');
          }
        }
      } catch (aiError) {
        console.error('AI suggestion error:', aiError);
      }
    }

    // Fallback suggestions if AI fails
    if (aiSuggestions.length === 0) {
      aiSuggestions = generateFallbackSuggestions(predictions, budgetAlerts, project.business_model);
    }

    const result = {
      project: {
        id: project.id,
        name: project.name,
        businessModel: project.business_model,
        currency: project.currency,
      },
      predictions,
      budgetAlerts,
      dailyTrend: sortedDates,
      suggestions: aiSuggestions,
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Predictive analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackSuggestions(predictions: any, budgetAlerts: any[], businessModel: string): string[] {
  const suggestions: string[] = [];
  
  // Budget alerts
  const criticalAlerts = budgetAlerts.filter(b => b.budgetStatus === 'critical');
  if (criticalAlerts.length > 0) {
    suggestions.push(`⚠️ ${criticalAlerts.length} campanha(s) com orçamento crítico - ação urgente necessária`);
  }

  // Spend trend
  if (predictions.trends.spendTrend > 20) {
    suggestions.push('📈 Gasto aumentando +20% - monitore o ROI de perto');
  } else if (predictions.trends.spendTrend < -20) {
    suggestions.push('📉 Gasto caindo -20% - verifique se campanhas estão pausadas');
  }

  // ROAS/CPL based on business model
  if (businessModel === 'ecommerce') {
    const roas = predictions.trends.avgDailyRevenue / predictions.trends.avgDailySpend;
    if (roas < 2) {
      suggestions.push('🎯 ROAS abaixo de 2x - considere otimizar públicos ou criativos');
    } else if (roas > 4) {
      suggestions.push('🚀 ROAS excelente (>4x) - oportunidade de escalar investimento');
    }
  } else {
    const cpl = predictions.trends.avgDailySpend / Math.max(predictions.trends.avgDailyConversions, 1);
    if (cpl > 50) {
      suggestions.push('💰 CPL alto - teste novos públicos ou otimize landing pages');
    }
  }

  // Conversion prediction
  if (predictions.next7Days.estimatedConversions < 10) {
    suggestions.push('⚡ Poucas conversões previstas - revise estratégia de anúncios');
  }

  // Add generic if needed
  while (suggestions.length < 3) {
    const genericSuggestions = [
      '🔄 Teste A/B de criativos pode melhorar performance em até 30%',
      '📊 Revise segmentação demográfica para otimizar entrega',
      '🎨 Renove criativos a cada 2-3 semanas para evitar fadiga',
      '⏰ Analise horários de pico para melhor distribuição de budget',
    ];
    suggestions.push(genericSuggestions[suggestions.length]);
  }

  return suggestions.slice(0, 5);
}
