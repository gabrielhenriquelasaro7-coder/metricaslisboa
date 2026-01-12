import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KommoPipeline {
  id: number;
  name: string;
  sort: number;
  is_main: boolean;
  is_unsorted_on: boolean;
  is_archive: boolean;
  account_id: number;
  _embedded?: {
    statuses?: Array<{
      id: number;
      name: string;
      sort: number;
      is_editable: boolean;
      pipeline_id: number;
      color: string;
      type: number; // 0=open, 1=won, 2=lost
      account_id: number;
    }>;
  };
}

interface StageData {
  id: string;
  name: string;
  color: string;
  sort: number;
  type: number;
  leads_count: number;
  total_value: number;
}

interface DealData {
  id: string;
  title: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  value?: number;
  stage_id: string;
  stage_name?: string;
  created_date?: string;
  closed_date?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  owner_name?: string;
  status?: string;
  lead_source?: string;
  custom_fields?: Record<string, string>;
  company_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const projectId = url.searchParams.get('project_id');

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'project_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get connection for this project
    const { data: connection, error: connError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .single();

    if (connError && connError.code !== 'PGRST116') {
      throw connError;
    }

    if (!connection) {
      return new Response(
        JSON.stringify({
          connected: false,
          provider: null,
          status: 'disconnected',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get latest sync log
    const { data: latestSync } = await supabase
      .from('crm_sync_logs')
      .select('*')
      .eq('connection_id', connection.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get selected pipeline from config
    const selectedPipelineId = (connection.config as Record<string, unknown>)?.selected_pipeline_id as string | null;

    // Get deal statistics - filter by pipeline if selected
    // Limit to most recent 500 deals for performance, ordered by created_date DESC
    let dealsQuery = supabase
      .from('crm_deals')
      .select('id, external_id, title, contact_name, contact_phone, contact_email, value, status, stage_name, external_stage_id, external_pipeline_id, created_date, closed_date, utm_source, utm_medium, utm_campaign, utm_content, utm_term, lead_source, owner_name, custom_fields')
      .eq('connection_id', connection.id)
      .order('created_date', { ascending: false })
      .limit(500);
    
    if (selectedPipelineId) {
      dealsQuery = dealsQuery.eq('external_pipeline_id', selectedPipelineId);
    }

    const { data: allDeals } = await dealsQuery;

    // Get total counts for stats (faster query without all fields)
    const { count: totalCount } = await supabase
      .from('crm_deals')
      .select('id', { count: 'exact', head: true })
      .eq('connection_id', connection.id);
    
    // Get counts by status
    const { data: statusCounts } = await supabase
      .from('crm_deals')
      .select('status, value')
      .eq('connection_id', connection.id);

    const wonDeals = statusCounts?.filter(d => d.status === 'won') || [];
    const lostDeals = statusCounts?.filter(d => d.status === 'lost') || [];
    const openDeals = statusCounts?.filter(d => d.status === 'open') || [];

    // Basic stats
    const stats = {
      total_deals: totalCount || 0,
      won_deals: wonDeals.length,
      lost_deals: lostDeals.length,
      open_deals: openDeals.length,
      total_revenue: wonDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      total_pipeline_value: openDeals.reduce((sum, d) => sum + (d.value || 0), 0),
    };

    // Initialize funnel and stages data
    let funnel = {
      leads: stats.total_deals,
      mql: 0,
      sql: 0,
      sales: stats.won_deals,
      revenue: stats.total_revenue,
    };

    let pipelines: Array<{ id: string; name: string; is_main: boolean; deals_count: number }> = [];
    let stages: StageData[] = [];
    let deals: DealData[] = [];

    // Try to get real data from Kommo API
    if (connection.provider === 'kommo' && connection.status === 'connected') {
      try {
        const apiKey = connection.access_token || connection.api_key;
        const apiUrl = connection.api_url as string;

        if (apiKey && apiUrl) {
          // Fetch pipelines
          const pipelinesResponse = await fetch(`${apiUrl}/api/v4/leads/pipelines`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });

          if (pipelinesResponse.ok) {
            const pipelinesData = await pipelinesResponse.json();
            const kommoPipelines: KommoPipeline[] = pipelinesData._embedded?.pipelines || [];
            
            console.log('Found Kommo pipelines:', kommoPipelines.length);

            // Get deal counts per pipeline from our database
            const { data: pipelineDeals } = await supabase
              .from('crm_deals')
              .select('external_pipeline_id')
              .eq('connection_id', connection.id);

            const dealCountByPipeline: Record<string, number> = {};
            pipelineDeals?.forEach(deal => {
              const pipelineId = String(deal.external_pipeline_id);
              dealCountByPipeline[pipelineId] = (dealCountByPipeline[pipelineId] || 0) + 1;
            });

            // Map pipelines for response
            pipelines = kommoPipelines.map(p => ({
              id: String(p.id),
              name: p.name,
              is_main: p.is_main,
              deals_count: dealCountByPipeline[String(p.id)] || 0,
            }));

            // Get target pipeline
            const targetPipelineId = selectedPipelineId || String(kommoPipelines.find(p => p.is_main)?.id) || String(kommoPipelines[0]?.id);
            const targetPipeline = kommoPipelines.find(p => String(p.id) === targetPipelineId);

            if (targetPipeline) {
              const statuses = targetPipeline._embedded?.statuses || [];
              
              // Sort stages by sort order
              const sortedStatuses = [...statuses].sort((a, b) => a.sort - b.sort);

              // Count deals per stage
              const dealCountByStage: Record<string, { count: number; value: number }> = {};
              allDeals?.forEach(deal => {
                const stageId = String(deal.external_stage_id);
                if (!dealCountByStage[stageId]) {
                  dealCountByStage[stageId] = { count: 0, value: 0 };
                }
                dealCountByStage[stageId].count++;
                dealCountByStage[stageId].value += (deal.value || 0);
              });

              // Build stages array - ALL stages from Kommo, not just 4
              stages = sortedStatuses.map(status => ({
                id: String(status.id),
                name: status.name,
                color: status.color || '#cccccc',
                sort: status.sort,
                type: status.type,
                leads_count: dealCountByStage[String(status.id)]?.count || 0,
                total_value: dealCountByStage[String(status.id)]?.value || 0,
              }));

              // Build deals array with ALL UTMs and custom fields
              deals = (allDeals || []).map(deal => {
                // Parse custom fields if they exist
                let customFields: Record<string, string> = {};
                if (deal.custom_fields && typeof deal.custom_fields === 'object') {
                  customFields = deal.custom_fields as Record<string, string>;
                }

                return {
                  id: deal.id,
                  title: deal.title,
                  contact_name: deal.contact_name || undefined,
                  contact_email: deal.contact_email || undefined,
                  contact_phone: deal.contact_phone || undefined,
                  value: deal.value || undefined,
                  stage_id: String(deal.external_stage_id),
                  stage_name: deal.stage_name || undefined,
                  created_date: deal.created_date || undefined,
                  closed_date: deal.closed_date || undefined,
                  utm_source: deal.utm_source || undefined,
                  utm_medium: deal.utm_medium || undefined,
                  utm_campaign: deal.utm_campaign || undefined,
                  utm_content: deal.utm_content || undefined,
                  utm_term: deal.utm_term || undefined,
                  owner_name: deal.owner_name || undefined,
                  status: deal.status || undefined,
                  lead_source: deal.lead_source || undefined,
                  custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined,
                };
              });

              // Calculate funnel (open stages only)
              const openStatuses = sortedStatuses.filter(s => s.type === 0);
              const stageCount = openStatuses.length;

              if (stageCount > 0) {
                const leadStageIds = new Set(openStatuses.slice(0, Math.ceil(stageCount / 3)).map(s => String(s.id)));
                const mqlStageIds = new Set(openStatuses.slice(Math.ceil(stageCount / 3), Math.ceil(stageCount * 2 / 3)).map(s => String(s.id)));
                const sqlStageIds = new Set(openStatuses.slice(Math.ceil(stageCount * 2 / 3)).map(s => String(s.id)));

                console.log('Stage mapping - Lead stages:', leadStageIds.size, 'MQL:', mqlStageIds.size, 'SQL:', sqlStageIds.size);

                const openDeals = allDeals?.filter(d => d.status === 'open') || [];
                let leadCount = 0;
                let mqlCount = 0;
                let sqlCount = 0;

                for (const deal of openDeals) {
                  const stageId = String(deal.external_stage_id);
                  if (leadStageIds.has(stageId)) leadCount++;
                  else if (mqlStageIds.has(stageId)) mqlCount++;
                  else if (sqlStageIds.has(stageId)) sqlCount++;
                }

                funnel = {
                  leads: stats.total_deals,
                  mql: mqlCount + sqlCount + stats.won_deals,
                  sql: sqlCount + stats.won_deals,
                  sales: stats.won_deals,
                  revenue: stats.total_revenue,
                };

                console.log('Funnel calculated:', funnel);
              }
            }
          } else {
            console.error('Failed to fetch pipelines:', pipelinesResponse.status, await pipelinesResponse.text());
          }
        }
      } catch (funnelError) {
        console.error('Error fetching funnel data:', funnelError);
        funnel = {
          leads: stats.total_deals,
          mql: Math.round(stats.total_deals * 0.6),
          sql: Math.round(stats.total_deals * 0.3),
          sales: stats.won_deals,
          revenue: stats.total_revenue,
        };
      }
    } else {
      funnel = {
        leads: stats.total_deals,
        mql: Math.round(stats.total_deals * 0.6),
        sql: Math.round(stats.total_deals * 0.3),
        sales: stats.won_deals,
        revenue: stats.total_revenue,
      };
    }

    return new Response(
      JSON.stringify({
        connected: connection.status === 'connected',
        connection_id: connection.id,
        provider: connection.provider,
        display_name: connection.display_name,
        status: connection.status,
        connected_at: connection.connected_at,
        last_error: connection.last_error,
        api_url: connection.api_url,
        selected_pipeline_id: selectedPipelineId,
        pipelines,
        stages, // ALL stages from Kommo
        deals,  // Deals with all UTMs and custom fields
        sync: latestSync ? {
          id: latestSync.id,
          type: latestSync.sync_type,
          status: latestSync.status,
          started_at: latestSync.started_at,
          completed_at: latestSync.completed_at,
          records_processed: latestSync.records_processed,
          records_created: latestSync.records_created,
          records_updated: latestSync.records_updated,
          records_failed: latestSync.records_failed,
          error_message: latestSync.error_message,
        } : null,
        stats,
        funnel,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('CRM Status Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
