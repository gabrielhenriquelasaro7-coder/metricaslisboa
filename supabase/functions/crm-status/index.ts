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

    // Get connection for this project
    const { data: connection, error: connError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
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
      .select('status, value')
      .eq('connection_id', connection.id);

    const stats = {
      total_deals: dealStats?.length || 0,
      won_deals: dealStats?.filter(d => d.status === 'won').length || 0,
      lost_deals: dealStats?.filter(d => d.status === 'lost').length || 0,
      open_deals: dealStats?.filter(d => d.status === 'open').length || 0,
      total_revenue: dealStats?.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.value || 0), 0) || 0,
      total_pipeline_value: dealStats?.filter(d => d.status === 'open').reduce((sum, d) => sum + (d.value || 0), 0) || 0,
    };

    return new Response(
      JSON.stringify({
        connected: connection.status === 'connected',
        connection_id: connection.id,
        provider: connection.provider,
        display_name: connection.display_name,
        status: connection.status,
        connected_at: connection.connected_at,
        last_error: connection.last_error,
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
