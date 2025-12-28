import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  project_id: string;
  ad_account_id: string;
  access_token?: string;
  date_preset?: string;
}

interface MetaAdsResponse {
  data: any[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_id, ad_account_id, access_token, date_preset = 'last_30d' }: SyncRequest = await req.json();

    const token = access_token || metaAccessToken;

    if (!token) {
      console.error('No Meta access token provided');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Meta access token is required. Please configure META_ACCESS_TOKEN in secrets or provide access_token in request.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project_id || !ad_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'project_id and ad_account_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting Meta Ads sync for account: ${ad_account_id}`);

    // Log sync start
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'in_progress',
      message: `Iniciando sincronização da conta ${ad_account_id}`,
    });

    // Define fields to fetch from Meta Ads API
    const campaignFields = [
      'id',
      'name',
      'status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'created_time',
      'updated_time',
    ].join(',');

    const insightsFields = [
      'spend',
      'impressions',
      'clicks',
      'ctr',
      'cpm',
      'cpc',
      'reach',
      'frequency',
      'actions',
      'action_values',
      'conversions',
      'conversion_values',
      'cost_per_action_type',
    ].join(',');

    // Fetch campaigns from Meta Ads API
    const campaignsUrl = `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=${campaignFields}&access_token=${token}`;
    
    console.log('Fetching campaigns from Meta Ads API...');
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData: MetaAdsResponse = await campaignsResponse.json();

    if (!campaignsResponse.ok) {
      console.error('Meta API error:', campaignsData);
      
      await supabase.from('sync_logs').insert({
        project_id,
        status: 'error',
        message: `Erro na API do Meta: ${JSON.stringify(campaignsData)}`,
      });

      await supabase.from('projects').update({
        webhook_status: 'error',
      }).eq('id', project_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Meta API error',
          details: campaignsData 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${campaignsData.data?.length || 0} campaigns`);

    // Fetch insights for each campaign
    const campaignsWithInsights = [];

    for (const campaign of campaignsData.data || []) {
      const insightsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/insights?fields=${insightsFields}&date_preset=${date_preset}&access_token=${token}`;
      
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();

        campaignsWithInsights.push({
          ...campaign,
          insights: insightsData.data?.[0] || null,
        });
      } catch (error) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, error);
        campaignsWithInsights.push({
          ...campaign,
          insights: null,
        });
      }
    }

    // Update project with successful sync
    await supabase.from('projects').update({
      webhook_status: 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    // Log successful sync
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: `Sincronização concluída: ${campaignsWithInsights.length} campanhas sincronizadas`,
    });

    console.log('Sync completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          campaigns: campaignsWithInsights,
          total_campaigns: campaignsWithInsights.length,
          synced_at: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
