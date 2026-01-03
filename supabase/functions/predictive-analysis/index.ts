import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignGoal {
  campaignId: string;
  targetRoas?: number;
  targetCpl?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, campaignGoals } = await req.json();
    
    if (!projectId) {
      throw new Error('projectId é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    // Fetch account balance from Meta API if token available
    let accountBalance = {
      balance: project.account_balance || 0,
      currency: project.currency || 'BRL',
      lastUpdated: project.account_balance_updated_at,
      daysOfSpendRemaining: null as number | null,
      status: 'unknown' as 'healthy' | 'warning' | 'critical' | 'unknown',
      fundingType: null as string | null,
      autoReloadEnabled: false,
      autoReloadThreshold: null as number | null,
    };

    if (metaAccessToken && project.ad_account_id) {
      try {
        const adAccountId = project.ad_account_id.startsWith('act_') 
          ? project.ad_account_id 
          : `act_${project.ad_account_id}`;
        
        // Fetch account info including funding source details
        const metaResponse = await fetch(
          `https://graph.facebook.com/v21.0/${adAccountId}?fields=balance,amount_spent,currency,funding_source_details,account_status,spend_cap&access_token=${metaAccessToken}`
        );
        
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          console.log('[PREDICTIVE] Meta account data:', JSON.stringify(metaData));
          
          // Check for funding source details (for prepaid/PIX accounts)
          let fundingType = null;
          let autoReloadEnabled = false;
          let autoReloadThreshold = null;
          let balanceValue = 0;
          
          // PRIORITY: Extract balance from funding_source_details.display_string
          // This is the CORRECT balance shown in Meta Ads Manager
          // Example: "Saldo disponível (R$2.003,11 BRL)"
          if (metaData.funding_source_details?.display_string) {
            const displayString = metaData.funding_source_details.display_string;
            console.log('[PREDICTIVE] display_string:', displayString);
            
            // Extract value from formats like "R$2.003,11" or "R$2,003.11" or "$2,003.11"
            const match = displayString.match(/[\$R\€]?\s*([\d.,]+)/);
            if (match) {
              let valueStr = match[1];
              // Handle Brazilian format (1.234,56) vs US format (1,234.56)
              // If has both . and , check which comes last
              if (valueStr.includes('.') && valueStr.includes(',')) {
                if (valueStr.lastIndexOf(',') > valueStr.lastIndexOf('.')) {
                  // Brazilian format: 1.234,56 -> remove dots, replace comma with dot
                  valueStr = valueStr.replace(/\./g, '').replace(',', '.');
                } else {
                  // US format: 1,234.56 -> remove commas
                  valueStr = valueStr.replace(/,/g, '');
                }
              } else if (valueStr.includes(',') && !valueStr.includes('.')) {
                // Only comma, assume Brazilian decimal: 234,56 -> 234.56
                valueStr = valueStr.replace(',', '.');
              } else if (valueStr.includes('.') && !valueStr.includes(',')) {
                // Only dot - could be decimal or thousands separator
                // If only one dot and 2 digits after, it's decimal
                const parts = valueStr.split('.');
                if (parts.length === 2 && parts[1].length <= 2) {
                  // It's a decimal like 234.56
                  // keep as is
                } else {
                  // It's thousands like 2.003 -> 2003
                  valueStr = valueStr.replace(/\./g, '');
                }
              }
              balanceValue = parseFloat(valueStr) || 0;
              console.log('[PREDICTIVE] Parsed balance from display_string:', balanceValue);
            }
            
            const fsd = metaData.funding_source_details;
            fundingType = fsd.type || null;
            
            // Check if auto-reload is configured
            if (fsd.coupon && fsd.coupon.auto_reload_enabled) {
              autoReloadEnabled = true;
              autoReloadThreshold = fsd.coupon.auto_reload_threshold_amount 
                ? parseFloat(fsd.coupon.auto_reload_threshold_amount) / 100 
                : null;
            }
          } else if (metaData.balance !== undefined && metaData.balance !== null) {
            // Fallback: use balance field (in cents)
            const rawBalance = typeof metaData.balance === 'string' 
              ? parseFloat(metaData.balance) 
              : metaData.balance;
            balanceValue = rawBalance / 100;
            console.log('[PREDICTIVE] Using fallback balance from cents:', balanceValue);
          }
          
          accountBalance = {
            balance: balanceValue,
            currency: metaData.currency || project.currency,
            lastUpdated: new Date().toISOString(),
            daysOfSpendRemaining: null,
            status: 'unknown',
            fundingType,
            autoReloadEnabled,
            autoReloadThreshold,
          };

          // Update project with new balance
          await supabase
            .from('projects')
            .update({ 
              account_balance: balanceValue,
              account_balance_updated_at: new Date().toISOString()
            })
            .eq('id', projectId);
        } else {
          const errorText = await metaResponse.text();
          console.log('[PREDICTIVE] Meta API error:', metaResponse.status, errorText);
        }
      } catch (metaError) {
        console.log('[PREDICTIVE] Could not fetch Meta account balance:', metaError);
      }
    }

    // Fetch last 30 days of metrics for trend analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('ads_daily_metrics')
      .select('date, spend, impressions, clicks, conversions, conversion_value, reach, campaign_id, campaign_name')
      .eq('project_id', projectId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (metricsError) throw metricsError;

    // Fetch campaign budgets
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, daily_budget, lifetime_budget, spend, status, conversions, conversion_value')
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

    // Aggregate metrics by campaign
    const campaignMetrics = dailyMetrics?.reduce((acc: Record<string, any>, metric) => {
      if (!acc[metric.campaign_id]) {
        acc[metric.campaign_id] = { 
          campaignId: metric.campaign_id,
          campaignName: metric.campaign_name,
          spend: 0, 
          conversions: 0, 
          conversion_value: 0,
          clicks: 0,
          impressions: 0
        };
      }
      acc[metric.campaign_id].spend += metric.spend || 0;
      acc[metric.campaign_id].conversions += metric.conversions || 0;
      acc[metric.campaign_id].conversion_value += metric.conversion_value || 0;
      acc[metric.campaign_id].clicks += metric.clicks || 0;
      acc[metric.campaign_id].impressions += metric.impressions || 0;
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
    const avgDailyClicks7 = last7Days.reduce((sum: number, d: any) => sum + d.clicks, 0) / Math.max(last7Days.length, 1);
    const avgDailyImpressions7 = last7Days.reduce((sum: number, d: any) => sum + d.impressions, 0) / Math.max(last7Days.length, 1);

    // Calculate account balance days remaining
    if (accountBalance.balance > 0 && avgDailySpend7 > 0) {
      accountBalance.daysOfSpendRemaining = Math.floor(accountBalance.balance / avgDailySpend7);
      if (accountBalance.daysOfSpendRemaining <= 3) accountBalance.status = 'critical';
      else if (accountBalance.daysOfSpendRemaining <= 7) accountBalance.status = 'warning';
      else accountBalance.status = 'healthy';
    }

    // Calculate campaign goals progress
    const campaignGoalsProgress = Object.values(campaignMetrics).map((metrics: any) => {
      const cpl = metrics.conversions > 0 ? metrics.spend / metrics.conversions : null;
      const roas = metrics.spend > 0 ? metrics.conversion_value / metrics.spend : null;
      const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : null;
      
      // Find if there's a custom goal for this campaign
      const customGoal = campaignGoals?.find((g: CampaignGoal) => g.campaignId === metrics.campaignId);
      
      // Default goals based on business model
      const defaultRoasTarget = project.business_model === 'ecommerce' ? 3 : 2;
      const defaultCplTarget = project.business_model === 'inside_sales' ? 30 : 50;
      
      const targetRoas = customGoal?.targetRoas || defaultRoasTarget;
      const targetCpl = customGoal?.targetCpl || defaultCplTarget;
      
      return {
        ...metrics,
        cpl,
        roas,
        ctr,
        targetRoas,
        targetCpl,
        roasProgress: roas !== null ? Math.min((roas / targetRoas) * 100, 150) : null,
        cplProgress: cpl !== null ? Math.min((targetCpl / cpl) * 100, 150) : null,
        roasStatus: roas !== null ? (roas >= targetRoas ? 'success' : roas >= targetRoas * 0.7 ? 'warning' : 'critical') : 'unknown',
        cplStatus: cpl !== null ? (cpl <= targetCpl ? 'success' : cpl <= targetCpl * 1.3 ? 'warning' : 'critical') : 'unknown',
      };
    });

    // Calculate budget alerts
    const budgetAlerts = campaigns?.map(campaign => {
      const dailyBudget = campaign.daily_budget || 0;
      const lifetimeBudget = campaign.lifetime_budget || 0;
      const currentSpend = campaign.spend || 0;
      
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
        avgDailyCpl: avgDailyConversions7 > 0 ? avgDailySpend7 / avgDailyConversions7 : null,
        avgDailyRoas: avgDailySpend7 > 0 ? avgDailyRevenue7 / avgDailySpend7 : null,
        avgCtr: avgDailyImpressions7 > 0 ? (avgDailyClicks7 / avgDailyImpressions7) * 100 : null,
      }
    };

    // Calculate totals for context
    const totals = {
      spend30Days: sortedDates.reduce((sum: number, d: any) => sum + d.spend, 0),
      conversions30Days: sortedDates.reduce((sum: number, d: any) => sum + d.conversions, 0),
      revenue30Days: sortedDates.reduce((sum: number, d: any) => sum + d.conversion_value, 0),
      clicks30Days: sortedDates.reduce((sum: number, d: any) => sum + d.clicks, 0),
      impressions30Days: sortedDates.reduce((sum: number, d: any) => sum + d.impressions, 0),
    };

    // Generate detailed AI optimization suggestions
    let aiSuggestions: { title: string; description: string; reason: string; priority: 'high' | 'medium' | 'low' }[] = [];
    
    if (lovableApiKey) {
      const contextData = {
        projectName: project.name,
        businessModel: project.business_model,
        currency: project.currency,
        accountBalance: accountBalance,
        last7DaysMetrics: {
          avgDailySpend: avgDailySpend7,
          avgDailyConversions: avgDailyConversions7,
          avgDailyRevenue: avgDailyRevenue7,
          avgCpl: avgDailyConversions7 > 0 ? avgDailySpend7 / avgDailyConversions7 : null,
          avgRoas: avgDailySpend7 > 0 ? avgDailyRevenue7 / avgDailySpend7 : null,
          spendTrend: predictions.trends.spendTrend,
        },
        totals,
        campaignPerformance: campaignGoalsProgress.slice(0, 10),
        budgetAlerts: budgetAlerts.filter(b => b.budgetStatus !== 'healthy'),
        activeCampaignsCount: campaigns?.length || 0,
      };

      const systemPrompt = `Você é um especialista em tráfego pago e análise de dados de marketing digital.
Analise os dados fornecidos e gere exatamente 5 sugestões de otimização ESPECÍFICAS e ACIONÁVEIS.

IMPORTANTE:
- Cada sugestão DEVE ser baseada em dados concretos fornecidos
- Explique o MOTIVO da sugestão com números específicos
- Indique prioridade (high, medium, low) baseada no impacto potencial

Formato de resposta (JSON array estrito):
[
  {
    "title": "Título curto da ação (máx 50 chars)",
    "description": "Descrição detalhada da ação a tomar (máx 150 chars)",
    "reason": "Por que esta sugestão? Cite dados específicos (máx 100 chars)",
    "priority": "high|medium|low"
  }
]

Exemplos de boas sugestões:
- "CPL de R$45 está 50% acima da meta de R$30 - otimize públicos"
- "ROAS de 4.2x está excelente - aumente budget em 20%"
- "Saldo de conta para apenas 3 dias - recarregue urgente"

Responda APENAS com o JSON array, sem texto adicional.`;

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

    // Fallback suggestions with reasons if AI fails
    if (aiSuggestions.length === 0) {
      aiSuggestions = generateDetailedFallbackSuggestions(predictions, budgetAlerts, accountBalance, campaignGoalsProgress, project.business_model, project.currency);
    }

    const result = {
      project: {
        id: project.id,
        name: project.name,
        businessModel: project.business_model,
        currency: project.currency,
      },
      accountBalance,
      predictions,
      totals,
      budgetAlerts,
      campaignGoalsProgress,
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

function generateDetailedFallbackSuggestions(
  predictions: any, 
  budgetAlerts: any[], 
  accountBalance: any,
  campaignGoals: any[],
  businessModel: string,
  currency: string
): { title: string; description: string; reason: string; priority: 'high' | 'medium' | 'low' }[] {
  const suggestions: { title: string; description: string; reason: string; priority: 'high' | 'medium' | 'low' }[] = [];
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2)}`;
  
  // Account balance critical
  if (accountBalance.status === 'critical') {
    suggestions.push({
      title: '🚨 Recarregar saldo da conta URGENTE',
      description: `Saldo atual: ${formatCurrency(accountBalance.balance)}. Adicione créditos para não pausar campanhas.`,
      reason: `Apenas ${accountBalance.daysOfSpendRemaining} dias de saldo restante com gasto médio atual`,
      priority: 'high'
    });
  } else if (accountBalance.status === 'warning') {
    suggestions.push({
      title: '⚠️ Saldo da conta baixo',
      description: `Saldo: ${formatCurrency(accountBalance.balance)}. Programe uma recarga para os próximos dias.`,
      reason: `${accountBalance.daysOfSpendRemaining} dias de saldo restante`,
      priority: 'medium'
    });
  }

  // Budget alerts
  const criticalAlerts = budgetAlerts.filter(b => b.budgetStatus === 'critical');
  if (criticalAlerts.length > 0) {
    suggestions.push({
      title: '⚠️ Campanhas com orçamento crítico',
      description: `${criticalAlerts.length} campanha(s) vão ficar sem budget em breve. Revise ou aumente orçamentos.`,
      reason: `${criticalAlerts.map(a => a.campaignName.slice(0, 20)).join(', ')} com <3 dias`,
      priority: 'high'
    });
  }

  // Performance based on business model
  if (businessModel === 'ecommerce') {
    const roas = predictions.trends.avgDailyRoas;
    if (roas !== null) {
      if (roas < 2) {
        suggestions.push({
          title: '📉 ROAS abaixo do ideal',
          description: 'Revise públicos, criativos ou landing pages para melhorar retorno.',
          reason: `ROAS atual: ${roas.toFixed(2)}x - Meta recomendada: 3x ou superior`,
          priority: 'high'
        });
      } else if (roas > 4) {
        suggestions.push({
          title: '🚀 Oportunidade de escalar',
          description: `ROAS excelente! Considere aumentar budget em 20-30% gradualmente.`,
          reason: `ROAS de ${roas.toFixed(2)}x está muito acima da meta de 3x`,
          priority: 'medium'
        });
      }
    }
  } else {
    const cpl = predictions.trends.avgDailyCpl;
    if (cpl !== null) {
      if (cpl > 50) {
        suggestions.push({
          title: '💰 CPL acima do ideal',
          description: 'Teste novos públicos ou otimize suas landing pages para conversão.',
          reason: `CPL atual: ${formatCurrency(cpl)} - Meta recomendada: R$ 30`,
          priority: 'high'
        });
      } else if (cpl < 20) {
        suggestions.push({
          title: '🚀 CPL excelente - escale!',
          description: 'Oportunidade de aumentar investimento mantendo qualidade.',
          reason: `CPL de ${formatCurrency(cpl)} está bem abaixo da meta de R$ 30`,
          priority: 'medium'
        });
      }
    }
  }

  // Spend trend
  if (predictions.trends.spendTrend > 30) {
    suggestions.push({
      title: '📈 Aumento significativo no gasto',
      description: 'Monitore de perto o retorno para garantir que o investimento extra vale a pena.',
      reason: `Gasto aumentou ${predictions.trends.spendTrend.toFixed(0)}% vs semana anterior`,
      priority: 'medium'
    });
  } else if (predictions.trends.spendTrend < -30) {
    suggestions.push({
      title: '📉 Queda significativa no gasto',
      description: 'Verifique se há campanhas pausadas ou problemas de entrega.',
      reason: `Gasto caiu ${Math.abs(predictions.trends.spendTrend).toFixed(0)}% vs semana anterior`,
      priority: 'medium'
    });
  }

  // Low conversions
  if (predictions.next7Days.estimatedConversions < 10) {
    suggestions.push({
      title: '⚡ Volume de conversões baixo',
      description: 'Considere ampliar públicos ou testar novos canais de aquisição.',
      reason: `Previsão: apenas ${predictions.next7Days.estimatedConversions} conversões nos próximos 7 dias`,
      priority: 'medium'
    });
  }

  // CTR analysis
  if (predictions.trends.avgCtr !== null && predictions.trends.avgCtr < 1) {
    suggestions.push({
      title: '🎨 CTR abaixo da média',
      description: 'Renove criativos e teste novos formatos para aumentar engajamento.',
      reason: `CTR atual: ${predictions.trends.avgCtr.toFixed(2)}% - Média do mercado: 1-2%`,
      priority: 'low'
    });
  }

  // Generic if needed
  while (suggestions.length < 3) {
    const generics = [
      {
        title: '🔄 Teste A/B de criativos',
        description: 'Testes regulares podem melhorar performance em até 30%.',
        reason: 'Prática recomendada: renove criativos a cada 2-3 semanas',
        priority: 'low' as const
      },
      {
        title: '⏰ Otimize horários de veiculação',
        description: 'Analise quando seu público converte mais e concentre budget.',
        reason: 'Distribuição inteligente pode reduzir CPL em até 20%',
        priority: 'low' as const
      },
    ];
    suggestions.push(generics[suggestions.length % generics.length]);
  }

  return suggestions.slice(0, 5);
}
