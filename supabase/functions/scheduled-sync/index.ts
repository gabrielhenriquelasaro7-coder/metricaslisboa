import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay helper with jitter to spread requests uniformly
function delay(ms: number): Promise<void> {
  const jitter = ms * (Math.random() * 0.3);
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get date ranges for different periods
function getDateRanges(): { key: string; since: string; until: string }[] {
  const now = new Date();
  const until = formatDate(now);
  
  const periods = [
    { key: 'last_7d', days: 7 },
    { key: 'last_14d', days: 14 },
    { key: 'last_30d', days: 30 },
    { key: 'last_60d', days: 60 },
    { key: 'last_90d', days: 90 },
  ];
  
  return periods.map(p => {
    const sinceDate = new Date(now);
    sinceDate.setDate(sinceDate.getDate() - p.days);
    return {
      key: p.key,
      since: formatDate(sinceDate),
      until,
    };
  });
}

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

    // Fetch all active projects with ad_account_id
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

    console.log(`[SCHEDULED SYNC] Found ${projects?.length || 0} projects to sync`);
    console.log(`[SCHEDULED SYNC] Started at: ${new Date().toISOString()}`);

    const dateRanges = getDateRanges();
    console.log(`[SCHEDULED SYNC] Will sync ${dateRanges.length} periods: ${dateRanges.map(d => d.key).join(', ')}`);

    const results: {
      project_id: string;
      project_name: string;
      periods_synced: string[];
      periods_failed: string[];
      success: boolean;
    }[] = [];

    // Process each project sequentially with delays to avoid rate limits
    for (let projectIndex = 0; projectIndex < (projects || []).length; projectIndex++) {
      const project = projects![projectIndex];
      console.log(`\n[PROJECT ${projectIndex + 1}/${projects!.length}] Starting sync for: ${project.name}`);
      
      const projectResult = {
        project_id: project.id,
        project_name: project.name,
        periods_synced: [] as string[],
        periods_failed: [] as string[],
        success: true,
      };

      // Sync all periods for this project
      for (let periodIndex = 0; periodIndex < dateRanges.length; periodIndex++) {
        const period = dateRanges[periodIndex];
        console.log(`[PROJECT ${project.name}] Syncing period ${period.key} (${period.since} to ${period.until})`);
        
        try {
          // Call meta-ads-sync for this project and period
          const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              project_id: project.id,
              ad_account_id: project.ad_account_id,
              time_range: {
                since: period.since,
                until: period.until,
              },
              batch_mode: true, // Signal to use more conservative rate limiting
            }),
          });

          const syncResult = await syncResponse.json();
          
          if (syncResult.success) {
            projectResult.periods_synced.push(period.key);
            console.log(`[PROJECT ${project.name}] Period ${period.key}: ✓ Success`);
          } else {
            projectResult.periods_failed.push(period.key);
            projectResult.success = false;
            console.log(`[PROJECT ${project.name}] Period ${period.key}: ✗ Failed - ${syncResult.error}`);
            
            // If rate limited, wait much longer before next period
            if (syncResult.rate_limited) {
              console.log(`[PROJECT ${project.name}] Rate limited, waiting 3 minutes before next period...`);
              await delay(180000);
            }
          }
        } catch (error) {
          projectResult.periods_failed.push(period.key);
          projectResult.success = false;
          console.error(`[PROJECT ${project.name}] Period ${period.key}: Error -`, error);
        }

        // Conservative delay between periods (60 seconds)
        if (periodIndex < dateRanges.length - 1) {
          console.log(`[PROJECT ${project.name}] Waiting 60s before next period...`);
          await delay(60000);
        }
      }

      // Log sync completion to sync_logs table
      await supabase.from('sync_logs').insert({
        project_id: project.id,
        status: projectResult.success ? 'success' : 'partial',
        message: projectResult.success 
          ? `Sync completed: ${projectResult.periods_synced.length} periods synced`
          : `Sync partial: ${projectResult.periods_synced.length} synced, ${projectResult.periods_failed.length} failed (${projectResult.periods_failed.join(', ')})`,
      });

      // Update project last_sync_at
      await supabase.from('projects').update({
        last_sync_at: new Date().toISOString(),
        webhook_status: projectResult.success ? 'success' : 'partial',
      }).eq('id', project.id);

      results.push(projectResult);

      // Conservative delay between projects (2 minutes)
      if (projectIndex < projects!.length - 1) {
        console.log(`\n[SCHEDULED SYNC] Waiting 2 minutes before next project...`);
        await delay(120000);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const partialCount = results.filter(r => !r.success && r.periods_synced.length > 0).length;
    const failedCount = results.filter(r => r.periods_synced.length === 0).length;

    console.log('\n[SCHEDULED SYNC] ============ SUMMARY ============');
    console.log(`[SCHEDULED SYNC] Total projects: ${results.length}`);
    console.log(`[SCHEDULED SYNC] Fully synced: ${successCount}`);
    console.log(`[SCHEDULED SYNC] Partially synced: ${partialCount}`);
    console.log(`[SCHEDULED SYNC] Failed: ${failedCount}`);
    console.log(`[SCHEDULED SYNC] Completed at: ${new Date().toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_projects: results.length,
          fully_synced: successCount,
          partially_synced: partialCount,
          failed: failedCount,
          periods_per_project: dateRanges.length,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SCHEDULED SYNC] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
