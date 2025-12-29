import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get the NEW periods to sync
function getPeriodsToSync(): { key: string; since: string; until: string }[] {
  const now = new Date();
  const today = formatDate(now);
  
  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // This month
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Last month (full month)
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  // This year
  const firstDayThisYear = new Date(now.getFullYear(), 0, 1);
  
  // Last year (full year)
  const firstDayLastYear = new Date(now.getFullYear() - 1, 0, 1);
  const lastDayLastYear = new Date(now.getFullYear() - 1, 11, 31);
  
  return [
    {
      key: 'yesterday',
      since: formatDate(yesterday),
      until: formatDate(yesterday),
    },
    {
      key: 'this_month',
      since: formatDate(firstDayThisMonth),
      until: today,
    },
    {
      key: 'last_month',
      since: formatDate(firstDayLastMonth),
      until: formatDate(lastDayLastMonth),
    },
    {
      key: 'this_year',
      since: formatDate(firstDayThisYear),
      until: today,
    },
    {
      key: 'last_year',
      since: formatDate(firstDayLastYear),
      until: formatDate(lastDayLastYear),
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // Fetch all active projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, ad_account_id, name')
      .eq('archived', false)
      .not('ad_account_id', 'is', null);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return new Response(
        JSON.stringify({ success: false, error: projectsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SCHEDULED SYNC] Started at: ${new Date().toISOString()}`);
    console.log(`[SCHEDULED SYNC] Found ${projects?.length || 0} projects`);

    const periods = getPeriodsToSync();
    console.log(`[SCHEDULED SYNC] Periods: ${periods.map(p => p.key).join(', ')}`);

    const results: any[] = [];

    // Process each project
    for (const project of (projects || [])) {
      console.log(`\n========== PROJECT: ${project.name} ==========`);
      
      const projectResult = {
        project_id: project.id,
        project_name: project.name,
        periods_synced: [] as string[],
        periods_failed: [] as string[],
      };

      // Sync each period with LONG delays between them
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        console.log(`\n[${project.name}] Syncing ${period.key} (${period.since} to ${period.until})...`);
        
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              project_id: project.id,
              ad_account_id: project.ad_account_id,
              time_range: { since: period.since, until: period.until },
              period_key: period.key,
            }),
          });
          
          const result = await response.json().catch(() => ({ success: false }));
          
          if (result.success) {
            projectResult.periods_synced.push(period.key);
            console.log(`[${project.name}] ${period.key}: ✓ Success (${result.data?.elapsed_seconds || '?'}s)`);
          } else {
            projectResult.periods_failed.push(period.key);
            console.log(`[${project.name}] ${period.key}: ✗ Failed - ${result.error || 'Unknown'}`);
          }
        } catch (error) {
          projectResult.periods_failed.push(period.key);
          console.log(`[${project.name}] ${period.key}: ✗ Error`);
        }

        // VERY LONG delay between periods (2 minutes) to avoid rate limits
        if (i < periods.length - 1) {
          console.log(`[${project.name}] Waiting 2 minutes before next period...`);
          await delay(120000);
        }
      }

      // Update project status
      const success = projectResult.periods_failed.length === 0;
      const partial = projectResult.periods_synced.length > 0 && projectResult.periods_failed.length > 0;
      
      await supabase.from('projects').update({
        last_sync_at: new Date().toISOString(),
        webhook_status: success ? 'success' : (partial ? 'partial' : 'error'),
      }).eq('id', project.id);

      // Log completion
      await supabase.from('sync_logs').insert({
        project_id: project.id,
        status: success ? 'success' : (partial ? 'partial' : 'error'),
        message: JSON.stringify({
          type: 'scheduled_sync',
          synced: projectResult.periods_synced,
          failed: projectResult.periods_failed,
        }),
      });

      results.push(projectResult);
      
      // VERY LONG delay between projects (5 minutes)
      if (results.length < (projects?.length || 0)) {
        console.log(`\n[SCHEDULED SYNC] Waiting 5 minutes before next project...`);
        await delay(300000);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n[SCHEDULED SYNC] Complete in ${elapsed} minutes`);

    return new Response(
      JSON.stringify({ success: true, elapsed_minutes: parseFloat(elapsed), results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SCHEDULED SYNC] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
