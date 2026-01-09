import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountGoal {
  targetLeadsMonthly?: number | null;
  targetCpl?: number | null;
  targetRoas?: number | null;
  targetCtr?: number | null;
  targetSpendDaily?: number | null;
  targetSpendMonthly?: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, accountGoal } = await req.json();
    
    console.log('[PREDICTIVE] Received request with projectId:', projectId);
    console.log('[PREDICTIVE] Received accountGoal:', JSON.stringify(accountGoal || {}));
    
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
      fundingType: null as number | null,
      autoReloadEnabled: false,
      autoReloadThreshold: null as number | null,
      accountStatus: null as number | null,
    };

    if (metaAccessToken && project.ad_account_id) {
      try {
        const adAccountId = project.ad_account_id.startsWith('act_') 
          ? project.ad_account_id 
          : `act_${project.ad_account_id}`;
        
        // Fetch account info including funding source details
        const metaResponse = await fetch(
          `https://graph.facebook.com/v22.0/${adAccountId}?fields=balance,amount_spent,currency,funding_source_details,account_status,spend_cap&access_token=${metaAccessToken}`
        );
        
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          console.log('[PREDICTIVE] Meta account data:', JSON.stringify(metaData));
          
          // Check for funding source details
          let fundingType = null;
          let autoReloadEnabled = false;
          let autoReloadThreshold = null;
          let balanceValue = 0;
          
          // Account status mapping:
          // 1 = ACTIVE - Account is active
          // 2 = DISABLED - Account is disabled
          // 3 = UNSETTLED - Account has payment issues / no balance
          // 7 = PENDING_REVIEW - Account is pending review
          // 9 = IN_GRACE_PERIOD - Account is in grace period
          // 100 = PENDING_CLOSURE - Account is pending closure
          // 101 = CLOSED - Account is closed
          // 201 = ANY_ACTIVE - Any active status
          // 202 = ANY_CLOSED - Any closed status
          const accountStatus = metaData.account_status;
          const isAccountBlocked = accountStatus === 3 || accountStatus === 2;
          
          console.log('[PREDICTIVE] Account status:', accountStatus, 'isBlocked:', isAccountBlocked);
          
          // Get funding source type
          if (metaData.funding_source_details) {
            const fsd = metaData.funding_source_details;
            fundingType = fsd.type || null;
            
            // Funding source types from Meta API:
            // type 1 = Credit Card (postpaid)
            // type 2 = Facebook Coupon
            // type 3 = Direct Debit (prepaid/PIX)
            // type 4 = PayPal
            // type 5 = Bank Transfer
            // type 20 = Business Credit Line / Ad Credits (prepaid-like)
            console.log('[PREDICTIVE] Funding type:', fundingType, 'display_string:', fsd.display_string);
            
            // For PREPAID-like accounts (type=3, 5, 20), extract balance from display_string
            const isPrepaidLike = fundingType === 3 || fundingType === 5 || fundingType === 20 || fundingType === 2;
            
            if (isPrepaidLike && fsd.display_string) {
              // display_string for prepaid: "Saldo disponível (R$2.003,11 BRL)" or similar
              if (fsd.display_string.toLowerCase().includes('saldo') || 
                  fsd.display_string.toLowerCase().includes('available') ||
                  fsd.display_string.toLowerCase().includes('crédito')) {
                const match = fsd.display_string.match(/R\$\s*([\d.,]+)/);
                if (match) {
                  let valueStr = match[1];
                  // Handle Brazilian format (1.234,56)
                  if (valueStr.includes('.') && valueStr.includes(',')) {
                    if (valueStr.lastIndexOf(',') > valueStr.lastIndexOf('.')) {
                      valueStr = valueStr.replace(/\./g, '').replace(',', '.');
                    } else {
                      valueStr = valueStr.replace(/,/g, '');
                    }
                  } else if (valueStr.includes(',') && !valueStr.includes('.')) {
                    valueStr = valueStr.replace(',', '.');
                  }
                  balanceValue = parseFloat(valueStr) || 0;
                  console.log('[PREDICTIVE] Prepaid-like balance from display_string:', balanceValue);
                }
              }
            }
            
            // For CREDIT CARD accounts (type=1), the 'balance' field shows available credit
            // But if account_status is 3 (UNSETTLED), the account has no effective balance
            if (fundingType === 1) {
              if (isAccountBlocked) {
                // Account is blocked/unsettled - effective balance is 0
                balanceValue = 0;
                console.log('[PREDICTIVE] Credit card account is blocked, setting balance to 0');
              } else if (metaData.balance !== undefined && metaData.balance !== null) {
                // Account is active, use balance field (in cents)
                const rawBalance = typeof metaData.balance === 'string' 
                  ? parseFloat(metaData.balance) 
                  : metaData.balance;
                balanceValue = rawBalance / 100;
                console.log('[PREDICTIVE] Credit card available balance (cents):', balanceValue);
              }
            }
            
            // For PayPal (type=4), try to get from balance field if display_string not helpful
            if (fundingType === 4 && balanceValue === 0 && metaData.balance) {
              const rawBalance = typeof metaData.balance === 'string' 
                ? parseFloat(metaData.balance) 
                : metaData.balance;
              balanceValue = rawBalance / 100;
              console.log('[PREDICTIVE] PayPal balance from API:', balanceValue);
            }
            
            // Check if auto-reload is configured (for prepaid/coupon accounts)
            if (fsd.coupons && Array.isArray(fsd.coupons)) {
              // Check coupons array for any active coupons
              const activeCoupons = fsd.coupons.filter((c: any) => c.amount > 0);
              if (activeCoupons.length > 0) {
                console.log('[PREDICTIVE] Active coupons found:', activeCoupons.length);
              }
            }
            
            if (fsd.coupon && fsd.coupon.auto_reload_enabled) {
              autoReloadEnabled = true;
              autoReloadThreshold = fsd.coupon.auto_reload_threshold_amount 
                ? parseFloat(fsd.coupon.auto_reload_threshold_amount) / 100 
                : null;
            }
          }
          
          // Determine status based on account_status and balance
          let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'unknown';
          if (isAccountBlocked) {
            status = 'critical';
          } else if (accountStatus === 1) {
            // Account is active
            if (balanceValue > 0) {
              status = 'healthy';
            } else {
              status = 'warning';
            }
          } else if (accountStatus === 7 || accountStatus === 9) {
            // Pending review or grace period
            status = 'warning';
          }
          
          console.log('[PREDICTIVE] Final balance value:', balanceValue, 'status:', status);
          
          accountBalance = {
            balance: balanceValue,
            currency: metaData.currency || project.currency,
            lastUpdated: new Date().toISOString(),
            daysOfSpendRemaining: null,
            status,
            fundingType,
            autoReloadEnabled,
            autoReloadThreshold,
            accountStatus: accountStatus, // 1=Active, 2=Disabled, 3=Unsettled, etc.
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
    const last14Days = sortedDates.slice(-14);

    const avgDailySpend7 = last7Days.reduce((sum: number, d: any) => sum + d.spend, 0) / Math.max(last7Days.length, 1);
    const avgDailySpendPrev7 = previous7Days.reduce((sum: number, d: any) => sum + d.spend, 0) / Math.max(previous7Days.length, 1);
    const avgDailyConversions7 = last7Days.reduce((sum: number, d: any) => sum + d.conversions, 0) / Math.max(last7Days.length, 1);
    const avgDailyRevenue7 = last7Days.reduce((sum: number, d: any) => sum + d.conversion_value, 0) / Math.max(last7Days.length, 1);
    const avgDailyClicks7 = last7Days.reduce((sum: number, d: any) => sum + d.clicks, 0) / Math.max(last7Days.length, 1);
    const avgDailyImpressions7 = last7Days.reduce((sum: number, d: any) => sum + d.impressions, 0) / Math.max(last7Days.length, 1);

    // Calculate Standard Deviation for scenario projections
    const spendValues = last14Days.map((d: any) => d.spend);
    const conversionValues = last14Days.map((d: any) => d.conversions);
    const revenueValues = last14Days.map((d: any) => d.conversion_value);
    
    const calculateStdDev = (values: number[]) => {
      if (values.length < 2) return 0;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const squareDiffs = values.map(v => Math.pow(v - mean, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
      return Math.sqrt(avgSquareDiff);
    };

    const stdDevSpend = calculateStdDev(spendValues);
    const stdDevConversions = calculateStdDev(conversionValues);
    const stdDevRevenue = calculateStdDev(revenueValues);

    // Calculate trend direction (positive = growing, negative = declining)
    const spendTrend = avgDailySpendPrev7 > 0 ? ((avgDailySpend7 - avgDailySpendPrev7) / avgDailySpendPrev7) * 100 : 0;
    
    // Determine growth factor based on trend
    const trendFactor = 1 + (spendTrend / 100) * 0.3; // 30% of trend applied to projections

    // Calculate days until end of year
    const today = new Date();
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const daysUntilEndOfYear = Math.ceil((endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate account balance days remaining
    if (accountBalance.balance > 0 && avgDailySpend7 > 0) {
      accountBalance.daysOfSpendRemaining = Math.floor(accountBalance.balance / avgDailySpend7);
      if (accountBalance.daysOfSpendRemaining <= 3) accountBalance.status = 'critical';
      else if (accountBalance.daysOfSpendRemaining <= 7) accountBalance.status = 'warning';
      else accountBalance.status = 'healthy';
    }

    // Calculate campaign performance (using account-level goals, not per-campaign)
    const accountGoalData = accountGoal as AccountGoal | undefined;
    const accountTargetCpl = accountGoalData?.targetCpl || null;
    const accountTargetRoas = accountGoalData?.targetRoas || null;
    const accountTargetLeadsMonthly = accountGoalData?.targetLeadsMonthly || null;
    const accountTargetCtr = accountGoalData?.targetCtr || null;

    const campaignGoalsProgress = Object.values(campaignMetrics).map((metrics: any) => {
      const cpl = metrics.conversions > 0 ? metrics.spend / metrics.conversions : null;
      const roas = metrics.spend > 0 ? metrics.conversion_value / metrics.spend : null;
      const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : null;
      
      // Use account-level goals if available
      const hasAccountGoal = !!(accountTargetCpl || accountTargetRoas || accountTargetLeadsMonthly);
      
      // Default goals based on business model (only if no account goal)
      const effectiveRoasTarget = accountTargetRoas || (project.business_model === 'ecommerce' ? 3 : 2);
      const effectiveCplTarget = accountTargetCpl || (project.business_model === 'inside_sales' ? 30 : 50);
      
      return {
        ...metrics,
        cpl,
        roas,
        ctr,
        targetRoas: accountTargetRoas || effectiveRoasTarget,
        targetCpl: accountTargetCpl || effectiveCplTarget,
        targetLeads: null, // No per-campaign lead target
        hasCustomGoal: hasAccountGoal,
        roasProgress: roas !== null && accountTargetRoas ? Math.min((roas / accountTargetRoas) * 100, 150) : null,
        cplProgress: cpl !== null && accountTargetCpl ? Math.min((accountTargetCpl / cpl) * 100, 150) : null,
        leadsProgress: null,
        roasStatus: roas !== null && accountTargetRoas ? (roas >= accountTargetRoas ? 'success' : roas >= accountTargetRoas * 0.7 ? 'warning' : 'critical') : 'unknown',
        cplStatus: cpl !== null && accountTargetCpl ? (cpl <= accountTargetCpl ? 'success' : cpl <= accountTargetCpl * 1.3 ? 'warning' : 'critical') : 'unknown',
        leadsStatus: 'unknown',
      };
    });

    // Calculate budget alerts
    const budgetAlerts = campaigns?.map(campaign => {
      const dailyBudget = campaign.daily_budget || 0;
      const lifetimeBudget = campaign.lifetime_budget || 0;
      const currentSpend = campaign.spend || 0;
      
      let daysRemaining = null;
      let budgetStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      
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

    // Build scenario-based predictions
    // Pessimistic: -1 std dev, Realistic: mean with trend, Optimistic: +1 std dev + trend bonus
    const buildScenario = (days: number, label: string) => {
      const baseSpend = avgDailySpend7 * days;
      const baseConversions = avgDailyConversions7 * days;
      const baseRevenue = avgDailyRevenue7 * days;
      
      // Apply trend factor for longer projections (more impact over time)
      const trendMultiplier = label === '7d' ? 1 : label === '30d' ? Math.pow(trendFactor, 0.5) : trendFactor;
      
      return {
        pessimistic: {
          spend: Math.max(0, baseSpend - stdDevSpend * days * 0.5),
          conversions: Math.round(Math.max(0, baseConversions - stdDevConversions * days * 0.5)),
          revenue: Math.max(0, baseRevenue - stdDevRevenue * days * 0.5),
        },
        realistic: {
          spend: baseSpend * trendMultiplier,
          conversions: Math.round(baseConversions * trendMultiplier),
          revenue: baseRevenue * trendMultiplier,
        },
        optimistic: {
          spend: (baseSpend + stdDevSpend * days * 0.3) * trendMultiplier,
          conversions: Math.round((baseConversions + stdDevConversions * days * 0.5) * trendMultiplier),
          revenue: (baseRevenue + stdDevRevenue * days * 0.5) * trendMultiplier,
        },
      };
    };

    const scenario7Days = buildScenario(7, '7d');
    const scenario30Days = buildScenario(30, '30d');
    const scenarioEndOfYear = buildScenario(daysUntilEndOfYear, 'eoy');

    // Calculate confidence level based on data consistency
    const coefficientOfVariation = avgDailySpend7 > 0 ? (stdDevSpend / avgDailySpend7) * 100 : 100;
    const confidenceLevel = coefficientOfVariation < 20 ? 'alta' : coefficientOfVariation < 40 ? 'média' : 'baixa';

    // Build predictions
    const predictions = {
      next7Days: {
        estimatedSpend: scenario7Days.realistic.spend,
        estimatedConversions: scenario7Days.realistic.conversions,
        estimatedRevenue: scenario7Days.realistic.revenue,
        scenarios: scenario7Days,
      },
      next30Days: {
        estimatedSpend: scenario30Days.realistic.spend,
        estimatedConversions: scenario30Days.realistic.conversions,
        estimatedRevenue: scenario30Days.realistic.revenue,
        scenarios: scenario30Days,
      },
      endOfYear: {
        daysRemaining: daysUntilEndOfYear,
        estimatedSpend: scenarioEndOfYear.realistic.spend,
        estimatedConversions: scenarioEndOfYear.realistic.conversions,
        estimatedRevenue: scenarioEndOfYear.realistic.revenue,
        scenarios: scenarioEndOfYear,
      },
      trends: {
        spendTrend,
        avgDailySpend: avgDailySpend7,
        avgDailyConversions: avgDailyConversions7,
        avgDailyRevenue: avgDailyRevenue7,
        avgDailyCpl: avgDailyConversions7 > 0 ? avgDailySpend7 / avgDailyConversions7 : null,
        avgDailyRoas: avgDailySpend7 > 0 ? avgDailyRevenue7 / avgDailySpend7 : null,
        avgCtr: avgDailyImpressions7 > 0 ? (avgDailyClicks7 / avgDailyImpressions7) * 100 : null,
        stdDevSpend,
        stdDevConversions,
        stdDevRevenue,
        confidenceLevel,
        trendDirection: spendTrend > 5 ? 'crescente' : spendTrend < -5 ? 'decrescente' : 'estável',
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
      // Filter only active campaigns with spend
      const activeCampaigns = campaignGoalsProgress.filter((c: any) => c.spend > 0);
      
      // Build detailed campaign context - with clean formatting to avoid NULL issues
      const campaignDetails = activeCampaigns.slice(0, 8).map((c: any) => ({
        nome: c.campaignName || 'Campanha sem nome',
        leads: c.conversions || 0,
        gasto: c.spend ? `R$ ${c.spend.toFixed(2)}` : 'R$ 0',
        cpl: c.cpl ? `R$ ${c.cpl.toFixed(2)}` : 'Sem leads',
        ctr: c.ctr ? `${c.ctr.toFixed(2)}%` : '0%',
        roas: c.roas ? `${c.roas.toFixed(2)}x` : 'N/A',
        performance: c.cpl && c.cpl < 30 ? 'Boa' : c.cpl && c.cpl < 50 ? 'Regular' : c.cpl ? 'Precisa melhorar' : 'Sem dados'
      }));

      const contextData = {
        projectName: project.name,
        businessModel: project.business_model,
        currency: project.currency,
        accountBalance: {
          saldo: accountBalance.balance > 0 ? `R$ ${accountBalance.balance.toFixed(2)}` : 'Não disponível',
          diasRestantes: accountBalance.daysOfSpendRemaining || 'Não calculado',
          status: accountBalance.status
        },
        metricas7Dias: {
          gastoMedioDiario: `R$ ${avgDailySpend7.toFixed(2)}`,
          leadsMedioDiario: avgDailyConversions7.toFixed(1),
          cplMedio: avgDailyConversions7 > 0 ? `R$ ${(avgDailySpend7 / avgDailyConversions7).toFixed(2)}` : 'Sem leads',
          roasMedio: avgDailySpend7 > 0 ? `${(avgDailyRevenue7 / avgDailySpend7).toFixed(2)}x` : 'N/A',
          tendencia: predictions.trends.spendTrend > 5 ? 'Crescente' : predictions.trends.spendTrend < -5 ? 'Decrescente' : 'Estável',
        },
        totais30Dias: {
          gasto: `R$ ${totals.spend30Days.toFixed(2)}`,
          leads: totals.conversions30Days,
          cplGeral: totals.conversions30Days > 0 ? `R$ ${(totals.spend30Days / totals.conversions30Days).toFixed(2)}` : 'Sem leads',
        },
        campanhasAtivas: campaignDetails,
        totalCampanhasAtivas: activeCampaigns.length,
        metasGerais: accountGoal ? {
          cplMeta: accountGoal.targetCpl ? `R$ ${accountGoal.targetCpl}` : null,
          roasMeta: accountGoal.targetRoas ? `${accountGoal.targetRoas}x` : null,
          leadsMensal: accountGoal.targetLeadsMonthly || null,
          ctrMeta: accountGoal.targetCtr ? `${accountGoal.targetCtr}%` : null,
        } : null,
      };

      // Determine which metrics are relevant based on business model
      const isRevenueModel = contextData.businessModel === 'ecommerce' || contextData.businessModel === 'infoproduto';
      const metricsContext = isRevenueModel 
        ? 'ROAS (retorno sobre investimento) é a métrica principal. CPL também é relevante.'
        : 'CPL (custo por lead) é a métrica PRINCIPAL. NÃO mencione ROAS pois este projeto não vende online.';

      const systemPrompt = `Você é um gestor de tráfego pago experiente analisando campanhas reais do Meta Ads.

MODELO DE NEGÓCIO: ${contextData.businessModel}
${metricsContext}

Gere EXATAMENTE 5 sugestões de otimização seguindo estas regras:

ESTRUTURA DAS SUGESTÕES (2 MACRO + 3 MICRO):
- 2 sugestões MACRO: sobre a conta como um todo (saldo, tendência geral, distribuição de budget)
- 3 sugestões MICRO: sobre campanhas específicas mencionando o NOME exato da campanha

REGRAS CRÍTICAS:
1. NUNCA use "null", "N/A", "undefined" ou valores vazios na resposta
2. Se não há dados, diga "sem dados suficientes" ou omita a informação
3. Mencione valores em REAIS (R$) e porcentagens reais dos dados
4. Títulos curtos e diretos (máximo 50 caracteres)
5. Descrições práticas e acionáveis (máximo 120 caracteres)
6. Motivo baseado em DADOS REAIS fornecidos (máximo 80 caracteres)
7. NÃO invente números - use apenas os dados fornecidos
8. Prioridade: "high" para urgente/impacto alto, "medium" para melhorias, "low" para otimizações finas

${!isRevenueModel ? 'NÃO mencione ROAS, receita ou vendas - foque em CPL, CTR, leads e engajamento' : ''}

Formato JSON estrito:
[
  {"title": "Título curto", "description": "O que fazer", "reason": "Por quê (com dados)", "priority": "high|medium|low"}
]

EXEMPLOS DE BOAS SUGESTÕES MICRO:
- Título: "Otimizar [Nome Campanha]"
- Descrição: "CPL de R$45 acima do ideal. Teste públicos mais segmentados ou novos criativos."
- Reason: "CPL atual R$45 vs média da conta R$32 - 40% acima"

EXEMPLOS DE BOAS SUGESTÕES MACRO:
- Título: "Recarregar saldo da conta"
- Descrição: "Saldo baixo pode pausar campanhas. Adicione créditos nos próximos dias."
- Reason: "Apenas 5 dias de saldo com gasto médio atual"

Responda APENAS o JSON array.`;

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
              { role: 'user', content: JSON.stringify(contextData, null, 2) }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '[]';
          try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            // Clean up any null/undefined values in the response
            aiSuggestions = parsed.map((s: any) => ({
              title: (s.title || 'Sugestão de otimização').replace(/null|undefined|N\/A/gi, '').trim(),
              description: (s.description || 'Revise os dados da campanha').replace(/null|undefined|N\/A/gi, '').trim(),
              reason: (s.reason || 'Baseado na análise dos dados').replace(/null|undefined|N\/A/gi, '').trim(),
              priority: s.priority || 'medium'
            }));
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
