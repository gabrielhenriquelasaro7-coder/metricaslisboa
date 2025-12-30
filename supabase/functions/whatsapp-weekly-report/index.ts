import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyMetrics {
  projectName: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversionValue: number;
  cpl: number;
  ctr: number;
  roas: number;
  // Previous week for comparison
  prevSpend: number;
  prevConversions: number;
  prevCpl: number;
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

function formatPercentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '🆕' : '-';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
  return `${emoji} ${sign}${change.toFixed(0)}%`;
}

function buildWeeklyReportMessage(metrics: WeeklyMetrics, weekRange: string): string {
  const lines: string[] = [];
  const m = metrics;
  
  lines.push('📊 *Relatório Semanal de Tráfego*');
  lines.push(`📅 ${weekRange}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`🎯 *${m.projectName}*`);
  lines.push('');
  lines.push(`💰 Investido: ${formatCurrency(m.spend)}`);
  lines.push(`👥 Leads: ${m.conversions} ${formatPercentChange(m.conversions, m.prevConversions)}`);
  lines.push(`📊 CPL: ${formatCurrency(m.cpl)} ${formatPercentChange(m.cpl, m.prevCpl)}`);
  lines.push(`👁️ Impressões: ${formatNumber(m.impressions)}`);
  lines.push(`👆 Cliques: ${formatNumber(m.clicks)}`);
  lines.push(`📈 CTR: ${m.ctr.toFixed(2)}%`);
  
  if (m.roas > 0) {
    lines.push(`💎 ROAS: ${m.roas.toFixed(2)}x`);
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('_Relatório gerado automaticamente pela V4 Company_');
  lines.push('_Para configurar, acesse WhatsApp no dashboard_');

  return lines.join('\n');
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

    // Get date ranges
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate this week's range (last 7 days)
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    // Previous week range
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const prevStartDateStr = prevStartDate.toISOString().split('T')[0];
    const prevEndDateStr = prevEndDate.toISOString().split('T')[0];

    const weekRange = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`;

    console.log(`[WEEKLY-REPORT] Processing reports for week: ${weekRange}`);
    console.log(`[WEEKLY-REPORT] Current day of week: ${currentDayOfWeek}`);

    // Fetch active subscriptions
    let subscriptionsQuery = supabase
      .from('whatsapp_subscriptions')
      .select('*')
      .eq('weekly_report_enabled', true)
      .not('project_id', 'is', null);

    if (targetSubscriptionId) {
      // Manual trigger for specific subscription
      subscriptionsQuery = supabase
        .from('whatsapp_subscriptions')
        .select('*')
        .eq('id', targetSubscriptionId);
    } else {
      // Scheduled: filter by day of week
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
        console.log(`[WEEKLY-REPORT] Processing subscription ${subscription.id} for phone ${subscription.phone_number}`);

        const projectId = subscription.project_id;
        
        if (!projectId) {
          console.log(`[WEEKLY-REPORT] No project_id for subscription ${subscription.id}, skipping`);
          continue;
        }

        // Get project name
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .single();

        if (!project) {
          console.log(`[WEEKLY-REPORT] Project not found for subscription ${subscription.id}`);
          continue;
        }

        // Get current week metrics
        const { data: currentData } = await supabase
          .from('ads_daily_metrics')
          .select('spend, impressions, clicks, reach, conversions, conversion_value')
          .eq('project_id', projectId)
          .gte('date', startDateStr)
          .lte('date', endDateStr);

        // Get previous week metrics
        const { data: prevData } = await supabase
          .from('ads_daily_metrics')
          .select('spend, conversions')
          .eq('project_id', projectId)
          .gte('date', prevStartDateStr)
          .lte('date', prevEndDateStr);

        // Aggregate current week
        const current = (currentData || []).reduce(
          (acc, row) => ({
            spend: acc.spend + (Number(row.spend) || 0),
            impressions: acc.impressions + (Number(row.impressions) || 0),
            clicks: acc.clicks + (Number(row.clicks) || 0),
            reach: acc.reach + (Number(row.reach) || 0),
            conversions: acc.conversions + (Number(row.conversions) || 0),
            conversionValue: acc.conversionValue + (Number(row.conversion_value) || 0),
          }),
          { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0 }
        );

        // Aggregate previous week
        const prev = (prevData || []).reduce(
          (acc, row) => ({
            spend: acc.spend + (Number(row.spend) || 0),
            conversions: acc.conversions + (Number(row.conversions) || 0),
          }),
          { spend: 0, conversions: 0 }
        );

        if (current.spend === 0 && current.conversions === 0) {
          console.log(`[WEEKLY-REPORT] No data for subscription ${subscription.id}, skipping`);
          continue;
        }

        const cpl = current.conversions > 0 ? current.spend / current.conversions : 0;
        const prevCpl = prev.conversions > 0 ? prev.spend / prev.conversions : 0;
        const ctr = current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0;
        const roas = current.spend > 0 ? current.conversionValue / current.spend : 0;

        const metrics: WeeklyMetrics = {
          projectName: project.name,
          spend: current.spend,
          impressions: current.impressions,
          clicks: current.clicks,
          reach: current.reach,
          conversions: current.conversions,
          conversionValue: current.conversionValue,
          cpl,
          ctr,
          roas,
          prevSpend: prev.spend,
          prevConversions: prev.conversions,
          prevCpl,
        };

        // Build the message
        const message = buildWeeklyReportMessage(metrics, weekRange);

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
          // Update last_report_sent_at
          await supabase
            .from('whatsapp_subscriptions')
            .update({ last_report_sent_at: new Date().toISOString() })
            .eq('id', subscription.id);

          results.push({ subscriptionId: subscription.id, success: true });
          console.log(`[WEEKLY-REPORT] Successfully sent report for subscription ${subscription.id}`);
        } else {
          results.push({ 
            subscriptionId: subscription.id, 
            success: false, 
            error: sendResult.error || 'Unknown error' 
          });
          console.error(`[WEEKLY-REPORT] Failed to send report for subscription ${subscription.id}:`, sendResult);
        }

      } catch (error) {
        console.error(`[WEEKLY-REPORT] Error processing subscription ${subscription.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ 
          subscriptionId: subscription.id, 
          success: false, 
          error: errorMessage 
        });
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
