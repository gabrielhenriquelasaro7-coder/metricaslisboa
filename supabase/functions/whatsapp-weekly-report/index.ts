import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AggregatedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversionValue: number;
  frequency: number;
}

interface SubscriptionConfig {
  includeSpend: boolean;
  includeReach: boolean;
  includeImpressions: boolean;
  includeFrequency: boolean;
  includeClicks: boolean;
  includeCtr: boolean;
  includeCpm: boolean;
  includeCpc: boolean;
  includeConversions: boolean;
  includeConversionValue: boolean;
  includeLeads: boolean;
  includeCpl: boolean;
  includeRoas: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toLocaleString('pt-BR');
}

function formatPercentage(value: number): string {
  return value.toFixed(2) + '%';
}

function getDateRangeForPeriod(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  
  let startDate = new Date(now);
  
  switch (period) {
    case 'last_7_days':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'last_14_days':
      startDate.setDate(startDate.getDate() - 14);
      break;
    case 'last_30_days':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'this_week':
      // Start from Sunday of current week
      const dayOfWeek = now.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);
      break;
    case 'last_week':
      // Last week Sunday to Saturday
      const currentDay = now.getDay();
      startDate.setDate(startDate.getDate() - currentDay - 7);
      endDate.setDate(endDate.getDate() - currentDay - 1);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0); // Last day of previous month
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }
  
  startDate.setHours(0, 0, 0, 0);
  
  return { startDate, endDate };
}

function getPeriodLabel(period: string): string {
  switch (period) {
    case 'last_7_days': return 'Últimos 7 dias';
    case 'last_14_days': return 'Últimos 14 dias';
    case 'last_30_days': return 'Últimos 30 dias';
    case 'this_week': return 'Esta semana';
    case 'last_week': return 'Semana passada';
    case 'this_month': return 'Este mês';
    case 'last_month': return 'Mês passado';
    default: return 'Últimos 7 dias';
  }
}

function buildMessageFromTemplate(
  template: string,
  projectName: string,
  periodLabel: string,
  metrics: AggregatedMetrics,
  config: SubscriptionConfig
): string {
  // Calculate derived metrics
  const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
  const cpm = metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0;
  const cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
  const cpl = metrics.conversions > 0 ? metrics.spend / metrics.conversions : 0;
  const cpa = metrics.conversions > 0 ? metrics.spend / metrics.conversions : 0;
  const roas = metrics.spend > 0 ? metrics.conversionValue / metrics.spend : 0;

  let result = template
    .replace('{projeto}', projectName)
    .replace('{periodo}', periodLabel);

  // Replace each metric variable - either with value or remove the line
  const replacements: { key: string; value: string; enabled: boolean }[] = [
    { key: 'investimento', value: `💰 Investimento: ${formatCurrency(metrics.spend)}`, enabled: config.includeSpend },
    { key: 'alcance', value: `👁️ Alcance: ${formatNumber(metrics.reach)}`, enabled: config.includeReach },
    { key: 'impressoes', value: `📺 Impressões: ${formatNumber(metrics.impressions)}`, enabled: config.includeImpressions },
    { key: 'frequencia', value: `🔄 Frequência: ${metrics.frequency.toFixed(2)}`, enabled: config.includeFrequency },
    { key: 'cliques', value: `👆 Cliques: ${formatNumber(metrics.clicks)}`, enabled: config.includeClicks },
    { key: 'ctr', value: `📈 CTR: ${formatPercentage(ctr)}`, enabled: config.includeCtr },
    { key: 'cpm', value: `💵 CPM: ${formatCurrency(cpm)}`, enabled: config.includeCpm },
    { key: 'cpc', value: `💳 CPC: ${formatCurrency(cpc)}`, enabled: config.includeCpc },
    // Inside Sales specific
    { key: 'leads', value: `🎯 Leads: ${metrics.conversions}`, enabled: config.includeLeads },
    { key: 'cpl', value: `📊 CPL: ${formatCurrency(cpl)}`, enabled: config.includeCpl },
    // E-commerce specific
    { key: 'conversoes', value: `🛒 Conversões: ${metrics.conversions}`, enabled: config.includeConversions },
    { key: 'valor_conversao', value: `💎 Valor: ${formatCurrency(metrics.conversionValue)}`, enabled: config.includeConversionValue },
    { key: 'cpa', value: `💳 CPA: ${formatCurrency(cpa)}`, enabled: config.includeConversions }, // CPA tied to conversions
    { key: 'roas', value: `🚀 ROAS: ${roas.toFixed(2)}x`, enabled: config.includeRoas && roas > 0 },
  ];

  replacements.forEach(({ key, value, enabled }) => {
    const pattern = new RegExp(`.*\\{${key}\\}.*\\n?`, 'g');
    if (enabled) {
      result = result.replace(`{${key}}`, value);
    } else {
      result = result.replace(pattern, '');
    }
  });

  // Also handle legacy {metricas} placeholder if present
  if (result.includes('{metricas}')) {
    const metricLines: string[] = [];
    if (config.includeSpend) metricLines.push(`💰 Investimento: ${formatCurrency(metrics.spend)}`);
    if (config.includeReach) metricLines.push(`👁️ Alcance: ${formatNumber(metrics.reach)}`);
    if (config.includeImpressions) metricLines.push(`📺 Impressões: ${formatNumber(metrics.impressions)}`);
    if (config.includeClicks) metricLines.push(`👆 Cliques: ${formatNumber(metrics.clicks)}`);
    if (config.includeCtr) metricLines.push(`📈 CTR: ${formatPercentage(ctr)}`);
    if (config.includeLeads) metricLines.push(`🎯 Leads: ${metrics.conversions}`);
    if (config.includeCpl) metricLines.push(`📊 CPL: ${formatCurrency(cpl)}`);
    if (config.includeConversions) metricLines.push(`🛒 Conversões: ${metrics.conversions}`);
    if (config.includeConversionValue) metricLines.push(`💎 Valor: ${formatCurrency(metrics.conversionValue)}`);
    if (config.includeRoas && roas > 0) metricLines.push(`🚀 ROAS: ${roas.toFixed(2)}x`);
    
    result = result.replace('{metricas}', metricLines.join('\n'));
  }

  // Clean up multiple empty lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this is a manual trigger for a specific subscription
    let targetSubscriptionId: string | null = null;
    try {
      const body = await req.json();
      targetSubscriptionId = body.subscriptionId || null;
    } catch {
      // No body, will process all active subscriptions
    }

    const now = new Date();
    const currentDayOfWeek = now.getDay();

    console.log(`[WEEKLY-REPORT] Starting report generation`);

    // Fetch subscriptions
    let subscriptionsQuery = supabase
      .from('whatsapp_subscriptions')
      .select('*')
      .eq('weekly_report_enabled', true)
      .not('project_id', 'is', null);

    if (targetSubscriptionId) {
      subscriptionsQuery = supabase
        .from('whatsapp_subscriptions')
        .select('*')
        .eq('id', targetSubscriptionId);
    } else {
      subscriptionsQuery = subscriptionsQuery.eq('report_day_of_week', currentDayOfWeek);
    }

    const { data: subscriptions, error: subError } = await subscriptionsQuery;

    if (subError) {
      console.error('[WEEKLY-REPORT] Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`[WEEKLY-REPORT] Found ${subscriptions?.length || 0} subscriptions to process`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ subscriptionId: string; success: boolean; error?: string }> = [];

    for (const subscription of subscriptions) {
      try {
        console.log(`[WEEKLY-REPORT] Processing subscription ${subscription.id}`);

        const projectId = subscription.project_id;
        if (!projectId) continue;

        // Get project info
        const { data: project } = await supabase
          .from('projects')
          .select('name, business_model')
          .eq('id', projectId)
          .single();

        if (!project) {
          console.log(`[WEEKLY-REPORT] Project not found for ${subscription.id}`);
          continue;
        }

        // Get period configuration
        const period = subscription.report_period || 'last_7_days';
        const { startDate, endDate } = getDateRangeForPeriod(period);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        console.log(`[WEEKLY-REPORT] Fetching metrics for period ${startDateStr} to ${endDateStr}`);

        // Get metrics for the period
        const { data: metricsData, error: metricsError } = await supabase
          .from('ads_daily_metrics')
          .select('spend, impressions, clicks, reach, conversions, conversion_value, frequency')
          .eq('project_id', projectId)
          .gte('date', startDateStr)
          .lte('date', endDateStr);

        if (metricsError) {
          console.error(`[WEEKLY-REPORT] Error fetching metrics:`, metricsError);
          continue;
        }

        console.log(`[WEEKLY-REPORT] Found ${metricsData?.length || 0} metric records`);

        // Aggregate metrics
        const aggregated: AggregatedMetrics = (metricsData || []).reduce(
          (acc, row) => ({
            spend: acc.spend + (Number(row.spend) || 0),
            impressions: acc.impressions + (Number(row.impressions) || 0),
            clicks: acc.clicks + (Number(row.clicks) || 0),
            reach: acc.reach + (Number(row.reach) || 0),
            conversions: acc.conversions + (Number(row.conversions) || 0),
            conversionValue: acc.conversionValue + (Number(row.conversion_value) || 0),
            frequency: acc.frequency + (Number(row.frequency) || 0),
          }),
          { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0, frequency: 0 }
        );

        // Calculate average frequency
        if (metricsData && metricsData.length > 0) {
          aggregated.frequency = aggregated.frequency / metricsData.length;
        }

        console.log(`[WEEKLY-REPORT] Aggregated metrics:`, JSON.stringify(aggregated));

        if (aggregated.spend === 0 && aggregated.impressions === 0) {
          console.log(`[WEEKLY-REPORT] No data for subscription ${subscription.id}, skipping`);
          continue;
        }

        // Get metric config from subscription
        const config: SubscriptionConfig = {
          includeSpend: subscription.include_spend ?? true,
          includeReach: subscription.include_reach ?? true,
          includeImpressions: subscription.include_impressions ?? true,
          includeFrequency: subscription.include_frequency ?? true,
          includeClicks: subscription.include_clicks ?? true,
          includeCtr: subscription.include_ctr ?? true,
          includeCpm: subscription.include_cpm ?? true,
          includeCpc: subscription.include_cpc ?? true,
          includeConversions: subscription.include_conversions ?? true,
          includeConversionValue: subscription.include_conversion_value ?? true,
          includeLeads: subscription.include_leads ?? true,
          includeCpl: subscription.include_cpl ?? true,
          includeRoas: subscription.include_roas ?? true,
        };

        // Get period label
        const periodLabel = getPeriodLabel(period);

        // Use custom template or build default based on business model
        const template = subscription.message_template || getDefaultTemplate(project.business_model);

        // Build the message
        const message = buildMessageFromTemplate(
          template,
          project.name,
          periodLabel,
          aggregated,
          config
        );

        console.log(`[WEEKLY-REPORT] Message built, sending to ${subscription.phone_number}`);

        // Send via whatsapp-send function
        const sendResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/whatsapp-send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              phone: subscription.phone_number,
              message,
              subscriptionId: subscription.id,
              messageType: 'weekly_report',
            }),
          }
        );

        const sendResult = await sendResponse.json();

        if (sendResponse.ok && sendResult.success) {
          await supabase
            .from('whatsapp_subscriptions')
            .update({ last_report_sent_at: new Date().toISOString() })
            .eq('id', subscription.id);

          results.push({ subscriptionId: subscription.id, success: true });
          console.log(`[WEEKLY-REPORT] Successfully sent report for ${subscription.id}`);
        } else {
          results.push({
            subscriptionId: subscription.id,
            success: false,
            error: sendResult.error || 'Unknown error',
          });
          console.error(`[WEEKLY-REPORT] Failed to send:`, sendResult.error);
        }

      } catch (error) {
        console.error(`[WEEKLY-REPORT] Error processing subscription ${subscription.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ subscriptionId: subscription.id, success: false, error: errorMessage });
      }
    }

    console.log(`[WEEKLY-REPORT] Completed. Results:`, JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WEEKLY-REPORT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Default templates
function getDefaultTemplate(businessModel: string | null): string {
  if (businessModel === 'ecommerce' || businessModel === 'pdv') {
    return `📊 *Relatório de Tráfego - {projeto}*
📅 Período: {periodo}

━━━━━━━━━━━━━━━━━━━━━

{investimento}
{alcance}
{impressoes}
{frequencia}
{cliques}
{ctr}
{cpm}
{cpc}
{conversoes}
{valor_conversao}
{cpa}
{roas}

━━━━━━━━━━━━━━━━━━━━━

_Relatório gerado automaticamente_`;
  }

  return `📊 *Relatório de Tráfego - {projeto}*
📅 Período: {periodo}

━━━━━━━━━━━━━━━━━━━━━

{investimento}
{alcance}
{impressoes}
{frequencia}
{cliques}
{ctr}
{cpm}
{cpc}
{leads}
{cpl}

━━━━━━━━━━━━━━━━━━━━━

_Relatório gerado automaticamente_`;
}