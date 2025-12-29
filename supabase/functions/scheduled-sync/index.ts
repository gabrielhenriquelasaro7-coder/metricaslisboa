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

    console.log(`[SCHEDULED SYNC] Found ${projects?.length || 0} projects`);

    const dateRanges = getDateRanges();
    console.log(`[SCHEDULED SYNC] Periods: ${dateRanges.map(d => d.key).join(', ')}`);

    const results: any[] = [];

    // Process each project
    for (const project of (projects || [])) {
      console.log(`\n[PROJECT ${project.name}] Starting...`);
      
      const projectResult = {
        project_id: project.id,
        project_name: project.name,
        periods_synced: [] as string[],
        periods_failed: [] as string[],
      };

      // Sync each period
      for (const period of dateRanges) {
        console.log(`[${project.name}] Syncing ${period.key}...`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout
          
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
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          const result = await response.json().catch(() => ({ success: false }));
          
          if (result.success) {
            projectResult.periods_synced.push(period.key);
            console.log(`[${project.name}] ${period.key}: ✓ Success`);
          } else {
            projectResult.periods_failed.push(period.key);
            console.log(`[${project.name}] ${period.key}: ✗ Failed`);
          }
        } catch (error) {
          projectResult.periods_failed.push(period.key);
          console.log(`[${project.name}] ${period.key}: ✗ Error`);
        }

        // Short delay between periods (10s)
        await delay(10000);
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
          synced: projectResult.periods_synced,
          failed: projectResult.periods_failed,
        }),
      });

      results.push(projectResult);
      
      // Delay between projects (30s)
      await delay(30000);
    }

    console.log('\n[SCHEDULED SYNC] Complete');

    return new Response(
      JSON.stringify({ success: true, results }),
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
