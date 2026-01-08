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

interface ConfigSettings {
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
      const dayOfWeek = now.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);
      break;
    case 'last_week':
      const currentDay = now.getDay();
      startDate.setDate(startDate.getDate() - currentDay - 7);
      endDate.setDate(endDate.getDate() - currentDay - 1);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0);
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
  config: ConfigSettings
): string {
  const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
  const cpm = metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0;
  const cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
  const cpl = metrics.conversions > 0 ? metrics.spend / metrics.conversions : 0;
  const cpa = metrics.conversions > 0 ? metrics.spend / metrics.conversions : 0;
  const roas = metrics.spend > 0 ? metrics.conversionValue / metrics.spend : 0;

  let result = template
    .replace('{projeto}', projectName)
    .replace('{periodo}', periodLabel);

  const replacements: { key: string; value: string; enabled: boolean }[] = [
    { key: 'investimento', value: `💰 Investimento: ${formatCurrency(metrics.spend)}`, enabled: config.includeSpend },
    { key: 'alcance', value: `👁️ Alcance: ${formatNumber(metrics.reach)}`, enabled: config.includeReach },
    { key: 'impressoes', value: `📺 Impressões: ${formatNumber(metrics.impressions)}`, enabled: config.includeImpressions },
    { key: 'frequencia', value: `🔄 Frequência: ${metrics.frequency.toFixed(2)}`, enabled: config.includeFrequency },
    { key: 'cliques', value: `👆 Cliques: ${formatNumber(metrics.clicks)}`, enabled: config.includeClicks },
    { key: 'ctr', value: `📈 CTR: ${formatPercentage(ctr)}`, enabled: config.includeCtr },
    { key: 'cpm', value: `💵 CPM: ${formatCurrency(cpm)}`, enabled: config.includeCpm },
    { key: 'cpc', value: `💳 CPC: ${formatCurrency(cpc)}`, enabled: config.includeCpc },
    { key: 'leads', value: `🎯 Leads: ${metrics.conversions}`, enabled: config.includeLeads },
    { key: 'cpl', value: `📊 CPL: ${formatCurrency(cpl)}`, enabled: config.includeCpl },
    { key: 'conversoes', value: `🛒 Conversões: ${metrics.conversions}`, enabled: config.includeConversions },
    { key: 'valor_conversao', value: `💎 Valor: ${formatCurrency(metrics.conversionValue)}`, enabled: config.includeConversionValue },
    { key: 'cpa', value: `💳 CPA: ${formatCurrency(cpa)}`, enabled: config.includeConversions },
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

  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

function isScheduledTime(reportTime: string, timezone: string = 'America/Sao_Paulo'): boolean {
  const now = new Date();
  
  // Get current time in the project's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  const [scheduledHour, scheduledMinute] = reportTime.split(':').map(Number);
  
  const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  
  const diff = Math.abs(currentTotalMinutes - scheduledTotalMinutes);
  
  console.log(`[WEEKLY-REPORT] Time check - Current: ${currentHour}:${currentMinute} (${timezone}), Scheduled: ${scheduledHour}:${scheduledMinute}, Diff: ${diff} minutes`);
  
  return diff <= 5;
}

function alreadySentForScheduledTime(lastSentAt: string | null, reportTime: string, timezone: string = 'America/Sao_Paulo'): boolean {
  if (!lastSentAt) return false;
  
  const lastSent = new Date(lastSentAt);
  const now = new Date();
  
  // Compare dates in the project's timezone
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // If not same day, hasn't been sent today
  if (dateFormatter.format(lastSent) !== dateFormatter.format(now)) {
    return false;
  }
  
  // Same day - check if last sent time is close to the scheduled time
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  
  const lastSentParts = timeFormatter.formatToParts(lastSent);
  const lastSentHour = parseInt(lastSentParts.find(p => p.type === 'hour')?.value || '0');
  const lastSentMinute = parseInt(lastSentParts.find(p => p.type === 'minute')?.value || '0');
  
  const [scheduledHour, scheduledMinute] = reportTime.split(':').map(Number);
  
  const lastSentTotalMinutes = lastSentHour * 60 + lastSentMinute;
  const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;
  
  // If last sent was within 10 minutes of the scheduled time, consider it already sent
  const diff = Math.abs(lastSentTotalMinutes - scheduledTotalMinutes);
  
  console.log(`[WEEKLY-REPORT] Already sent check - Last sent: ${lastSentHour}:${lastSentMinute}, Scheduled: ${scheduledHour}:${scheduledMinute}, Diff: ${diff} minutes`);
  
  return diff <= 10;
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let targetConfigId: string | null = null;
    let forceResend = false;
    try {
      const body = await req.json();
      targetConfigId = body.configId || null;
      forceResend = body.forceResend || false;
    } catch {
      // No body, will process all active configs
    }

    const now = new Date();
    const currentDayOfWeek = now.getDay();

    console.log(`[WEEKLY-REPORT] Starting report generation at ${now.toISOString()}`);
    console.log(`[WEEKLY-REPORT] Current day of week: ${currentDayOfWeek}`);

    // Fetch configs from whatsapp_report_configs (NEW TABLE)
    let configsQuery = supabase
      .from('whatsapp_report_configs')
      .select('*, whatsapp_manager_instances(instance_name, instance_status, token), projects(id, name, business_model, timezone)')
      .eq('report_enabled', true)
      .not('project_id', 'is', null);

    if (targetConfigId) {
      configsQuery = supabase
        .from('whatsapp_report_configs')
        .select('*, whatsapp_manager_instances(instance_name, instance_status, token), projects(id, name, business_model, timezone)')
        .eq('id', targetConfigId);
    } else {
      configsQuery = configsQuery.eq('report_day_of_week', currentDayOfWeek);
    }

    const { data: configs, error: configError } = await configsQuery;

    if (configError) {
      console.error('[WEEKLY-REPORT] Error fetching configs:', configError);
      throw configError;
    }

    console.log(`[WEEKLY-REPORT] Found ${configs?.length || 0} configs for today`);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No configs to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ configId: string; projectId: string; success: boolean; error?: string; skipped?: boolean; reason?: string }> = [];

    for (const config of configs) {
      try {
        console.log(`[WEEKLY-REPORT] Processing config ${config.id}`);

        const projectId = config.project_id;
        const project = config.projects;
        
        if (!project || !projectId) {
          console.log(`[WEEKLY-REPORT] No project for config ${config.id}`);
          continue;
        }

        // Get project timezone (default to America/Sao_Paulo)
        const timezone = project.timezone || 'America/Sao_Paulo';

        // Check if this is a manual trigger or if it's the scheduled time
        if (!targetConfigId) {
          const reportTime = config.report_time || '08:00';
          
          // Check if already sent for this scheduled time
          if (alreadySentForScheduledTime(config.last_report_sent_at, reportTime, timezone) && !forceResend) {
            console.log(`[WEEKLY-REPORT] Already sent for this time slot for ${config.id}, skipping`);
            results.push({ 
              configId: config.id,
              projectId,
              success: true, 
              skipped: true, 
              reason: 'already_sent_today' 
            });
            continue;
          }

          // Check if it's the right time
          if (!isScheduledTime(reportTime, timezone)) {
            console.log(`[WEEKLY-REPORT] Not scheduled time for ${config.id} (scheduled: ${reportTime})`);
            results.push({ 
              configId: config.id,
              projectId,
              success: true, 
              skipped: true, 
              reason: 'not_scheduled_time' 
            });
            continue;
          }
        }

        // Check instance status
        const instanceData = config.whatsapp_manager_instances;
        if (config.instance_id && instanceData) {
          if (instanceData.instance_status !== 'connected') {
            console.log(`[WEEKLY-REPORT] Instance not connected for ${config.id}`);
            results.push({
              configId: config.id,
              projectId,
              success: false,
              error: 'WhatsApp instance is not connected',
            });
            continue;
          }
        }

        // Get period configuration
        const period = config.report_period || 'last_7_days';
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

        if (metricsData && metricsData.length > 0) {
          aggregated.frequency = aggregated.frequency / metricsData.length;
        }

        console.log(`[WEEKLY-REPORT] Aggregated metrics:`, JSON.stringify(aggregated));

        if (aggregated.spend === 0 && aggregated.impressions === 0) {
          console.log(`[WEEKLY-REPORT] No data for config ${config.id}, skipping`);
          results.push({ 
            configId: config.id,
            projectId,
            success: true, 
            skipped: true, 
            reason: 'no_data' 
          });
          continue;
        }

        // Get metric config from config
        const configSettings: ConfigSettings = {
          includeSpend: config.include_spend ?? true,
          includeReach: config.include_reach ?? true,
          includeImpressions: config.include_impressions ?? true,
          includeFrequency: config.include_frequency ?? true,
          includeClicks: config.include_clicks ?? true,
          includeCtr: config.include_ctr ?? true,
          includeCpm: config.include_cpm ?? true,
          includeCpc: config.include_cpc ?? true,
          includeConversions: config.include_conversions ?? true,
          includeConversionValue: config.include_conversion_value ?? true,
          includeLeads: config.include_leads ?? true,
          includeCpl: config.include_cpl ?? true,
          includeRoas: config.include_roas ?? true,
        };

        const periodLabel = getPeriodLabel(period);
        const template = config.message_template || getDefaultTemplate(project.business_model);

        const message = buildMessageFromTemplate(
          template,
          project.name,
          periodLabel,
          aggregated,
          configSettings
        );

        // Determine target type and destination
        const targetType = config.target_type || 'phone';
        const groupId = config.group_id;
        const phoneNumber = config.phone_number;

        console.log(`[WEEKLY-REPORT] Sending to ${targetType}: ${targetType === 'group' ? groupId : phoneNumber}`);

        // Build request payload for whatsapp-send
        // We need to get the token from the manager instance
        const sendPayload: Record<string, unknown> = {
          message,
          configId: config.id,
          messageType: 'weekly_report',
          targetType,
        };

        if (config.instance_id) {
          sendPayload.instanceId = config.instance_id;
          sendPayload.useManagerInstance = true;
        }

        if (targetType === 'group' && groupId) {
          sendPayload.groupId = groupId;
        } else {
          sendPayload.phone = phoneNumber;
        }

        // Send via whatsapp-send function
        const sendResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/whatsapp-send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify(sendPayload),
          }
        );

        const sendResult = await sendResponse.json();

        if (sendResponse.ok && sendResult.success) {
          // Update last_report_sent_at on the new table
          await supabase
            .from('whatsapp_report_configs')
            .update({ last_report_sent_at: new Date().toISOString() })
            .eq('id', config.id);

          results.push({ configId: config.id, projectId, success: true });
          console.log(`[WEEKLY-REPORT] Successfully sent report for ${config.id}`);
        } else {
          results.push({
            configId: config.id,
            projectId,
            success: false,
            error: sendResult.error || 'Unknown error',
          });
          console.error(`[WEEKLY-REPORT] Failed to send:`, sendResult.error);
        }

      } catch (error) {
        console.error(`[WEEKLY-REPORT] Error processing config ${config.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ configId: config.id, projectId: config.project_id, success: false, error: errorMessage });
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
