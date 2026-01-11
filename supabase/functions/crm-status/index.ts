import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get connection for this project (any connected status for the project)
    const { data: connection, error: connError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .single();

    if (connError && connError.code !== 'PGRST116') { // PGRST116 = no rows
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

    // Get deal statistics
    const { data: dealStats } = await supabase
      .from('crm_deals')
      .select('status, value, stage_name, external_stage_id')
      .eq('connection_id', connection.id);

    // Basic stats
    const stats = {
      total_deals: dealStats?.length || 0,
      won_deals: dealStats?.filter(d => d.status === 'won').length || 0,
      lost_deals: dealStats?.filter(d => d.status === 'lost').length || 0,
      open_deals: dealStats?.filter(d => d.status === 'open').length || 0,
      total_revenue: dealStats?.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.value || 0), 0) || 0,
      total_pipeline_value: dealStats?.filter(d => d.status === 'open').reduce((sum, d) => sum + (d.value || 0), 0) || 0,
    };

    // Get funnel data from Kommo if connected
    let funnel = {
      leads: stats.total_deals,
      mql: 0,
      sql: 0,
      sales: stats.won_deals,
      revenue: stats.total_revenue,
    };

    // Try to get real funnel data from Kommo API
    if (connection.provider === 'kommo' && connection.status === 'connected') {
      try {
        const apiKey = connection.access_token || connection.api_key;
        const apiUrl = connection.api_url as string;

        if (apiKey && apiUrl) {
          // Fetch pipelines to get stage mapping
          const pipelinesResponse = await fetch(`${apiUrl}/api/v4/leads/pipelines`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });

          if (pipelinesResponse.ok) {
            const pipelinesData = await pipelinesResponse.json();
            const pipelines = pipelinesData._embedded?.pipelines || [];
            
            // Build stage ID to name/type mapping
            const stageMap: Record<string, { name: string; type: string; sort: number }> = {};
            
            for (const pipeline of pipelines) {
              const statuses = pipeline._embedded?.statuses || [];
              for (const status of statuses) {
                stageMap[String(status.id)] = {
                  name: status.name,
                  type: status.type || 'open', // 0=open, 1=won, 2=lost
                  sort: status.sort || 0,
                };
              }
            }

            // Count deals by funnel stage based on their position
            // Logic: First stages = Lead, Middle stages = MQL/SQL, Final = Won
            const openDeals = dealStats?.filter(d => d.status === 'open') || [];
            const totalStages = Object.keys(stageMap).length;
            
            if (totalStages > 0 && openDeals.length > 0) {
              // Sort stages by sort order
              const sortedStages = Object.entries(stageMap)
                .filter(([_, info]) => info.type !== '1' && info.type !== '2') // exclude won/lost
                .sort((a, b) => a[1].sort - b[1].sort);
              
              const stageCount = sortedStages.length;
              
              // Divide stages into Lead (first 1/3), MQL (middle 1/3), SQL (last 1/3)
              const leadStages = new Set(sortedStages.slice(0, Math.ceil(stageCount / 3)).map(s => s[0]));
              const mqlStages = new Set(sortedStages.slice(Math.ceil(stageCount / 3), Math.ceil(stageCount * 2 / 3)).map(s => s[0]));
              const sqlStages = new Set(sortedStages.slice(Math.ceil(stageCount * 2 / 3)).map(s => s[0]));

              let leadCount = 0;
              let mqlCount = 0;
              let sqlCount = 0;

              for (const deal of openDeals) {
                const stageId = String(deal.external_stage_id);
                if (leadStages.has(stageId)) leadCount++;
                else if (mqlStages.has(stageId)) mqlCount++;
                else if (sqlStages.has(stageId)) sqlCount++;
              }

              // Funnel is cumulative: leads include all, MQL includes MQL+SQL+sales, etc.
              funnel = {
                leads: stats.total_deals,
                mql: mqlCount + sqlCount + stats.won_deals,
                sql: sqlCount + stats.won_deals,
                sales: stats.won_deals,
                revenue: stats.total_revenue,
              };
            }
          }
        }
      } catch (funnelError) {
        console.error('Error fetching funnel data:', funnelError);
        // Keep default funnel based on basic stats
        funnel = {
          leads: stats.total_deals,
          mql: Math.round(stats.total_deals * 0.6),
          sql: Math.round(stats.total_deals * 0.3),
          sales: stats.won_deals,
          revenue: stats.total_revenue,
        };
      }
    } else {
      // For other CRMs or when API fails, estimate funnel
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
