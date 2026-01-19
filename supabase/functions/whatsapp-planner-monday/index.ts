import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubMeta {
  id: string;
  text: string;
  completed: boolean;
}

interface PlannerConfig {
  id: string;
  user_id: string;
  project_id: string;
  instance_id: string | null;
  target_type: string;
  phone_number: string | null;
  group_id: string | null;
  group_name: string | null;
  planner_enabled: boolean;
  report_day_of_week: number;
  report_time: string;
  current_step: string;
  target_step: string;
  roi_atual: number | null;
  cac_atual: number | null;
  investimento_mensal: number | null;
  faturamento_marketing: number | null;
  meta_principal_quarter: string | null;
  sub_metas: SubMeta[];
  criterios_mudanca_step: SubMeta[];
  meta_semana: string | null;
  meta_semana_porque: string | null;
  link_forecasting: string | null;
  link_plano_midia: string | null;
  link_planejamento_quarter: string | null;
  message_template: string | null;
  last_report_sent_at: string | null;
}

function formatCurrency(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCurrentDayOfWeek(): number {
  const now = new Date();
  // Adjust for Brasília timezone (UTC-3)
  const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  return brasiliaTime.getUTCDay();
}

function isScheduledTime(configTime: string): boolean {
  const now = new Date();
  const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  const currentHour = brasiliaTime.getUTCHours();
  const currentMinute = brasiliaTime.getUTCMinutes();
  
  const [configHour, configMinute] = configTime.split(':').map(Number);
  
  // Allow 30 minute window
  const configTotalMinutes = configHour * 60 + configMinute;
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  
  return Math.abs(currentTotalMinutes - configTotalMinutes) <= 30;
}

async function getCPLForProject(supabase: any, projectId: string): Promise<number | null> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  
  const { data } = await supabase
    .from('ads_daily_metrics')
    .select('spend, leads_count')
    .eq('project_id', projectId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', now.toISOString().split('T')[0]);

  if (!data || data.length === 0) return null;
  
  const totalSpend = data.reduce((acc: number, row: any) => acc + (row.spend || 0), 0);
  const totalLeads = data.reduce((acc: number, row: any) => acc + (row.leads_count || 0), 0);
  
  return totalLeads > 0 ? totalSpend / totalLeads : null;
}

function buildPlannerMessage(
  config: PlannerConfig,
  projectName: string,
  realCPL: number | null
): string {
  let msg = `📊 *Diagnóstico Atual do Cliente (Ponto de Partida)*\n`;
  msg += `📋 Projeto: *${projectName}*\n\n`;
  msg += `🎯 Step Atual: *${config.current_step}*\n`;
  msg += `🎯 Step Alvo no Q1: *${config.target_step}*\n\n`;
  
  msg += `📈 *Métricas Atuais* - Últimos 7 dias\n`;
  msg += `• ROI atual: ${config.roi_atual ? `${config.roi_atual}x` : '____'}\n`;
  msg += `• CPL atual: ${realCPL ? formatCurrency(realCPL) : '____'}\n`;
  msg += `• CAC atual: ${config.cac_atual ? formatCurrency(config.cac_atual) : '____'}\n`;
  msg += `• Investimento mensal em mídia: ${config.investimento_mensal ? formatCurrency(config.investimento_mensal) : '____'}\n`;
  msg += `• Faturamento do marketing: ${config.faturamento_marketing ? formatCurrency(config.faturamento_marketing) : '____'}\n\n`;
  
  msg += `🎯 *Meta Principal do Cliente – Quarter (Q1)*\n`;
  msg += `${config.meta_principal_quarter || '(não definida)'}\n\n`;
  
  const subMetas = config.sub_metas || [];
  if (subMetas.length > 0) {
    msg += `🔧 *Sub-metas de Suporte (Q1)*\n`;
    subMetas.forEach(m => {
      msg += `${m.completed ? '✅' : '⬜'} ${m.text}\n`;
    });
    msg += '\n';
  }
  
  const criterios = config.criterios_mudanca_step || [];
  msg += `🧭 *Critério Objetivo de Mudança de Step*\n`;
  msg += `Para sair do Step ${config.current_step} e atingir o ${config.target_step}, este cliente precisa:\n`;
  criterios.forEach(c => {
    msg += `${c.completed ? '✅' : '⬜'} ${c.text}\n`;
  });
  msg += '\n';
  
  msg += `📆 *Meta da Semana* (Próximos 7 dias)\n`;
  msg += `Meta: ${config.meta_semana || '(não definida)'}\n`;
  if (config.meta_semana_porque) {
    msg += `Por quê: ${config.meta_semana_porque}\n`;
  }
  msg += '\n';
  
  msg += `🔗 *Links Operacionais do Cliente*\n`;
  msg += `• Forecasting: ${config.link_forecasting || '____'}\n`;
  msg += `• Plano de Mídia: ${config.link_plano_midia || '____'}\n`;
  msg += `• Planejamento Quarter: ${config.link_planejamento_quarter || '____'}\n\n`;
  
  msg += `_Relatório automático via V4 Dashboard_`;
  
  return msg;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let configId: string | null = null;
    let forceResend = false;

    try {
      const body = await req.json();
      configId = body.configId || null;
      forceResend = body.forceResend || false;
    } catch {
      // No body provided
    }

    const currentDayOfWeek = getCurrentDayOfWeek();
    console.log(`[PLANNER] Current day of week: ${currentDayOfWeek}`);

    // Fetch active planner configs
    let query = supabase
      .from('whatsapp_planner_configs')
      .select(`
        *,
        project:projects(id, name)
      `)
      .eq('planner_enabled', true);

    if (configId) {
      query = query.eq('id', configId);
    } else if (!forceResend) {
      query = query.eq('report_day_of_week', currentDayOfWeek);
    }

    const { data: configs, error: configsError } = await query;

    if (configsError) {
      console.error('[PLANNER] Error fetching configs:', configsError);
      throw configsError;
    }

    console.log(`[PLANNER] Found ${configs?.length || 0} configs to process`);

    const results: any[] = [];

    for (const config of configs || []) {
      try {
        const projectName = config.project?.name || 'Projeto';
        console.log(`[PLANNER] Processing: ${projectName}`);

        // Check if it's the scheduled time (unless force resend)
        if (!forceResend && !configId && !isScheduledTime(config.report_time)) {
          console.log(`[PLANNER] Skipping ${projectName} - not scheduled time`);
          continue;
        }

        // Get real CPL
        const realCPL = await getCPLForProject(supabase, config.project_id);
        console.log(`[PLANNER] CPL for ${projectName}: ${realCPL}`);

        // Build message
        const message = buildPlannerMessage(config, projectName, realCPL);

        // Determine target
        const targetType = config.target_type || 'phone';
        const phone = targetType === 'phone' ? config.phone_number : undefined;
        const groupId = targetType === 'group' ? config.group_id : undefined;

        if (!phone && !groupId) {
          console.log(`[PLANNER] Skipping ${projectName} - no target configured`);
          continue;
        }

        // Send message
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-send', {
          body: {
            instanceId: config.instance_id,
            targetType,
            phone,
            groupId,
            message,
          }
        });

        if (sendError) {
          console.error(`[PLANNER] Error sending to ${projectName}:`, sendError);
          results.push({ project: projectName, success: false, error: sendError.message });
        } else {
          console.log(`[PLANNER] Successfully sent to ${projectName}`);
          
          // Update last_report_sent_at
          await supabase
            .from('whatsapp_planner_configs')
            .update({ last_report_sent_at: new Date().toISOString() })
            .eq('id', config.id);

          results.push({ project: projectName, success: true });
        }
      } catch (err: any) {
        console.error(`[PLANNER] Error processing config:`, err);
        results.push({ project: config.project?.name || 'Unknown', success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[PLANNER] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
