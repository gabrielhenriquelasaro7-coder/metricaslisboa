import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

function alreadySentToday(lastSentAt: string | null): boolean {
  if (!lastSentAt) return false;
  
  const lastSent = new Date(lastSentAt);
  const now = new Date();
  
  return lastSent.toDateString() === now.toDateString();
}

function generateBalanceAlertMessage(
  projectName: string,
  balance: number,
  daysRemaining: number,
  avgDailySpend: number
): string {
  const emoji = daysRemaining <= 2 ? '🚨🚨🚨' : daysRemaining <= 3 ? '🚨' : '⚠️';
  const urgency = daysRemaining <= 2 ? 'URGENTE' : daysRemaining <= 3 ? 'CRÍTICO' : 'ATENÇÃO';

  return `${emoji} *ALERTA DE SALDO ${urgency}*

📊 *Projeto:* ${projectName}

💰 *Saldo Atual:* ${formatCurrency(balance)}
📉 *Gasto Médio Diário:* ${formatCurrency(avgDailySpend)}
⏰ *Dias Restantes:* ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}

${daysRemaining <= 2 
  ? '‼️ *Adicione créditos IMEDIATAMENTE para evitar pausar campanhas!*'
  : daysRemaining <= 3 
    ? '⚠️ *Recomendamos adicionar créditos hoje!*'
    : '💡 *Programe uma recarga nos próximos dias.*'
}

_Alerta automático do V4 Dashboard_`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let targetProjectId: string | null = null;
    let forceResend = false;
    try {
      const body = await req.json();
      targetProjectId = body.projectId || null;
      forceResend = body.forceResend || false;
    } catch {
      // No body, process all projects
    }

    console.log(`[BALANCE-ALERT] Starting balance check at ${new Date().toISOString()}`);

    // Fetch configs from whatsapp_report_configs (NEW TABLE) with balance alerts enabled
    let configsQuery = supabase
      .from('whatsapp_report_configs')
      .select('*, whatsapp_manager_instances(instance_name, instance_status, token), projects(id, name, account_balance, account_balance_updated_at)')
      .eq('balance_alert_enabled', true)
      .not('project_id', 'is', null);

    if (targetProjectId) {
      configsQuery = configsQuery.eq('project_id', targetProjectId);
    }

    const { data: configs, error: configError } = await configsQuery;

    if (configError) {
      console.error('[BALANCE-ALERT] Error fetching configs:', configError);
      throw configError;
    }

    console.log(`[BALANCE-ALERT] Found ${configs?.length || 0} configs with balance alerts enabled`);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No balance alert configs found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ configId: string; projectId: string; success: boolean; error?: string; skipped?: boolean; reason?: string }> = [];

    for (const config of configs) {
      try {
        const projectId = config.project_id;
        const project = config.projects;
        
        if (!project || !projectId) {
          console.log(`[BALANCE-ALERT] No project for config ${config.id}`);
          continue;
        }

        console.log(`[BALANCE-ALERT] Processing project ${project.name} (${projectId})`);

        // Check if already sent today
        if (!forceResend && alreadySentToday(config.last_balance_alert_at)) {
          console.log(`[BALANCE-ALERT] Already sent today for ${project.name}, skipping`);
          results.push({
            configId: config.id,
            projectId,
            success: true,
            skipped: true,
            reason: 'already_sent_today'
          });
          continue;
        }

        // Check if project has balance
        if (!project.account_balance || project.account_balance <= 0) {
          console.log(`[BALANCE-ALERT] No balance data for ${project.name}`);
          results.push({
            configId: config.id,
            projectId,
            success: true,
            skipped: true,
            reason: 'no_balance_data'
          });
          continue;
        }

        // Get last 7 days spend to calculate average
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const { data: metricsData, error: metricsError } = await supabase
          .from('ads_daily_metrics')
          .select('spend, date')
          .eq('project_id', projectId)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (metricsError) {
          console.error(`[BALANCE-ALERT] Error fetching metrics for ${project.name}:`, metricsError);
          continue;
        }

        if (!metricsData || metricsData.length === 0) {
          console.log(`[BALANCE-ALERT] No spend data for ${project.name}`);
          results.push({
            configId: config.id,
            projectId,
            success: true,
            skipped: true,
            reason: 'no_spend_data'
          });
          continue;
        }

        // Calculate average daily spend
        const totalSpend = metricsData.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
        const uniqueDays = new Set(metricsData.map(row => row.date)).size;
        const avgDailySpend = uniqueDays > 0 ? totalSpend / uniqueDays : 0;

        if (avgDailySpend === 0) {
          console.log(`[BALANCE-ALERT] Zero average spend for ${project.name}`);
          results.push({
            configId: config.id,
            projectId,
            success: true,
            skipped: true,
            reason: 'zero_spend'
          });
          continue;
        }

        const daysRemaining = Math.floor(project.account_balance / avgDailySpend);
        const threshold = config.balance_alert_threshold || 3;

        console.log(`[BALANCE-ALERT] ${project.name}: Balance=${formatCurrency(project.account_balance)}, AvgSpend=${formatCurrency(avgDailySpend)}, Days=${daysRemaining}, Threshold=${threshold}`);

        // Check if balance is below threshold
        if (daysRemaining > threshold) {
          console.log(`[BALANCE-ALERT] ${project.name}: Balance OK (${daysRemaining} days > ${threshold} threshold)`);
          results.push({
            configId: config.id,
            projectId,
            success: true,
            skipped: true,
            reason: 'balance_ok'
          });
          continue;
        }

        // Check instance status
        const instanceData = config.whatsapp_manager_instances;
        if (config.instance_id && instanceData) {
          if (instanceData.instance_status !== 'connected') {
            console.log(`[BALANCE-ALERT] Instance not connected for ${project.name}`);
            results.push({
              configId: config.id,
              projectId,
              success: false,
              error: 'WhatsApp instance is not connected',
            });
            continue;
          }
        }

        // Generate alert message
        const message = generateBalanceAlertMessage(
          project.name,
          project.account_balance,
          daysRemaining,
          avgDailySpend
        );

        // Determine target type and destination
        const targetType = config.target_type || 'phone';
        const groupId = config.group_id;
        const phoneNumber = config.phone_number;

        console.log(`[BALANCE-ALERT] Sending alert to ${targetType}: ${targetType === 'group' ? groupId : phoneNumber}`);

        // Build request payload for whatsapp-send
        const sendPayload: Record<string, unknown> = {
          message,
          configId: config.id,
          messageType: 'balance_alert',
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
          // Update last_balance_alert_at on the new table
          await supabase
            .from('whatsapp_report_configs')
            .update({ last_balance_alert_at: new Date().toISOString() })
            .eq('id', config.id);

          results.push({ configId: config.id, projectId, success: true });
          console.log(`[BALANCE-ALERT] Successfully sent alert for ${project.name}`);
        } else {
          results.push({
            configId: config.id,
            projectId,
            success: false,
            error: sendResult.error || 'Unknown error',
          });
          console.error(`[BALANCE-ALERT] Failed to send:`, sendResult.error);
        }

      } catch (error) {
        console.error(`[BALANCE-ALERT] Error processing config ${config.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ 
          configId: config.id, 
          projectId: config.project_id, 
          success: false, 
          error: errorMessage 
        });
      }
    }

    console.log(`[BALANCE-ALERT] Completed. Results:`, JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BALANCE-ALERT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
