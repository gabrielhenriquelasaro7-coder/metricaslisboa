import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

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
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');

    if (!metaAccessToken) {
      console.error('META_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'META_ACCESS_TOKEN not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all projects that need syncing
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, ad_account_id, name')
      .not('ad_account_id', 'is', null);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return new Response(
        JSON.stringify({ success: false, error: projectsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${projects?.length || 0} projects to sync`);

    const results = [];

    for (const project of projects || []) {
      console.log(`Syncing project: ${project.name} (${project.id})`);

      try {
        // Call the meta-ads-sync function for each project
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            ad_account_id: project.ad_account_id,
          }),
        });

        const syncResult = await syncResponse.json();
        results.push({
          project_id: project.id,
          project_name: project.name,
          success: syncResult.success,
          error: syncResult.error,
        });

        console.log(`Sync result for ${project.name}:`, syncResult.success ? 'success' : syncResult.error);
      } catch (error) {
        console.error(`Error syncing project ${project.name}:`, error);
        results.push({
          project_id: project.id,
          project_name: project.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('Scheduled sync completed');

    return new Response(
      JSON.stringify({
        success: true,
        synced_projects: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scheduled sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
