import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  user_id: string;
  project_id: string;
  ad_account_id: string;
  business_model: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WebhookPayload = await req.json();
    
    console.log('Received webhook payload:', payload);

    // Validate required fields
    if (!payload.user_id || !payload.project_id || !payload.ad_account_id) {
      console.error('Missing required fields in payload');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log sync attempt
    const { error: logError } = await supabase
      .from('sync_logs')
      .insert({
        project_id: payload.project_id,
        status: 'started',
        message: `Iniciando sincronização para conta ${payload.ad_account_id}`,
      });

    if (logError) {
      console.error('Error logging sync start:', logError);
    }

    // Here you would typically:
    // 1. Call Meta Ads API to fetch campaigns, ad sets, and ads
    // 2. Store the data in your database
    // 3. Update the project's sync status
    
    // For now, we'll simulate a successful sync
    // In production, you'd integrate with Meta Marketing API
    
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update project sync status
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        webhook_status: 'success',
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', payload.project_id);

    if (updateError) {
      console.error('Error updating project sync status:', updateError);
      throw updateError;
    }

    // Log successful sync
    await supabase
      .from('sync_logs')
      .insert({
        project_id: payload.project_id,
        status: 'success',
        message: `Sincronização concluída com sucesso para conta ${payload.ad_account_id}`,
      });

    console.log('Sync completed successfully for project:', payload.project_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        project_id: payload.project_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
