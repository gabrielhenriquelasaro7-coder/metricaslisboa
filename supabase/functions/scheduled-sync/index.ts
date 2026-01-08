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

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

// Period groups for scheduled syncs
type PeriodGroup = 'priority' | 'recent' | 'extended' | 'historical' | 'all';

// Cache TTL in hours for each period type
const CACHE_TTL_HOURS: Record<string, number> = {
  // Dynamic periods (change daily) - 6 hours
  'yesterday': 6,
  'this_month': 6,
  'this_year': 6,
  // Recent periods - 12 hours
  'last_7d': 12,
  'last_14d': 12,
  'last_30d': 12,
  // Extended periods - 18 hours
  'last_60d': 18,
  'last_90d': 18,
  // Static periods (don't change) - 24 hours
  'last_month': 24,
  'last_year': 24,
};

// Period definitions grouped
const PERIOD_GROUPS: Record<PeriodGroup, string[]> = {
  priority: ['yesterday', 'this_month', 'this_year'],
  recent: ['last_7d', 'last_14d'],
  extended: ['last_30d', 'last_60d', 'last_90d'],
  historical: ['last_month', 'last_year'],
  all: ['yesterday', 'last_7d', 'last_14d', 'last_30d', 'last_60d', 'last_90d', 'this_month', 'last_month', 'this_year', 'last_year'],
};

// Get period date range
function getPeriodDates(periodKey: string): { since: string; until: string } | null {
  const now = new Date();
  const today = formatDate(now);
  const yesterday = subDays(now, 1);
  
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const firstDayThisYear = new Date(now.getFullYear(), 0, 1);
  const firstDayLastYear = new Date(now.getFullYear() - 1, 0, 1);
  const lastDayLastYear = new Date(now.getFullYear() - 1, 11, 31);
  
  const periodMap: Record<string, { since: string; until: string }> = {
    'yesterday': { since: formatDate(yesterday), until: formatDate(yesterday) },
    'last_7d': { since: formatDate(subDays(now, 7)), until: formatDate(yesterday) },
    'last_14d': { since: formatDate(subDays(now, 14)), until: formatDate(yesterday) },
    'last_30d': { since: formatDate(subDays(now, 30)), until: formatDate(yesterday) },
    'last_60d': { since: formatDate(subDays(now, 60)), until: formatDate(yesterday) },
    'last_90d': { since: formatDate(subDays(now, 90)), until: formatDate(yesterday) },
    'this_month': { since: formatDate(firstDayThisMonth), until: today },
    'last_month': { since: formatDate(firstDayLastMonth), until: formatDate(lastDayLastMonth) },
    'this_year': { since: formatDate(firstDayThisYear), until: today },
    'last_year': { since: formatDate(firstDayLastYear), until: formatDate(lastDayLastYear) },
  };
  
  return periodMap[periodKey] || null;
}

// Check if a period was synced recently (within cache TTL)
async function isPeriodCached(supabase: any, projectId: string, periodKey: string): Promise<boolean> {
  const cacheTtlHours = CACHE_TTL_HOURS[periodKey] || 12;
  const cacheExpiry = new Date();
  cacheExpiry.setHours(cacheExpiry.getHours() - cacheTtlHours);
  
  const { data, error } = await supabase
    .from('period_metrics')
    .select('synced_at')
    .eq('project_id', projectId)
    .eq('period_key', periodKey)
    .gt('synced_at', cacheExpiry.toISOString())
    .limit(1);
  
  if (error) {
    console.log(`[CACHE] Error checking cache for ${periodKey}: ${error.message}`);
    return false;
  }
  
  return data && data.length > 0;
}

interface SyncRequest {
  periods?: string[];
  group?: PeriodGroup;
  skip_cache?: boolean;
  project_ids?: string[];
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

    // Parse request body
    let requestBody: SyncRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use defaults
    }

    const { periods, group = 'all', skip_cache = false, project_ids } = requestBody;

    // Determine which periods to sync
    const periodsToSync = periods || PERIOD_GROUPS[group] || PERIOD_GROUPS.all;

    // Fetch projects (optionally filtered by IDs)
    let projectsQuery = supabase
      .from('projects')
      .select('id, ad_account_id, name')
      .eq('archived', false)
      .not('ad_account_id', 'is', null);

    if (project_ids && project_ids.length > 0) {
      projectsQuery = projectsQuery.in('id', project_ids);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return new Response(
        JSON.stringify({ success: false, error: projectsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SCHEDULED SYNC] Started at: ${new Date().toISOString()}`);
    console.log(`[SCHEDULED SYNC] Found ${projects?.length || 0} projects`);
    console.log(`[SCHEDULED SYNC] Group: ${group}, Periods: ${periodsToSync.join(', ')}`);
    console.log(`[SCHEDULED SYNC] Skip cache: ${skip_cache}`);

    const results: any[] = [];
    let totalSynced = 0;
    let totalSkipped = 0;

    // Process each project
    for (const project of (projects || [])) {
      console.log(`\n========== PROJECT: ${project.name} ==========`);
      
      const projectResult = {
        project_id: project.id,
        project_name: project.name,
        periods_synced: [] as string[],
        periods_skipped: [] as string[],
        periods_failed: [] as string[],
      };

      // Sync each period with delays between them
      for (let i = 0; i < periodsToSync.length; i++) {
        const periodKey = periodsToSync[i];
        const periodDates = getPeriodDates(periodKey);
        
        if (!periodDates) {
          console.log(`[${project.name}] ${periodKey}: Invalid period, skipping`);
          continue;
        }

        // Check cache (unless skip_cache is true)
        if (!skip_cache) {
          const isCached = await isPeriodCached(supabase, project.id, periodKey);
          if (isCached) {
            projectResult.periods_skipped.push(periodKey);
            totalSkipped++;
            console.log(`[${project.name}] ${periodKey}: ⏭ Skipped (cached)`);
            continue;
          }
        }

        console.log(`[${project.name}] Syncing ${periodKey} (${periodDates.since} to ${periodDates.until})...`);
        
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
              time_range: { since: periodDates.since, until: periodDates.until },
              period_key: periodKey,
            }),
          });
          
          const result = await response.json().catch(() => ({ success: false }));
          
          if (result.success) {
            projectResult.periods_synced.push(periodKey);
            totalSynced++;
            console.log(`[${project.name}] ${periodKey}: ✓ Success (${result.data?.elapsed_seconds || '?'}s)`);
          } else {
            projectResult.periods_failed.push(periodKey);
            console.log(`[${project.name}] ${periodKey}: ✗ Failed - ${result.error || 'Unknown'}`);
          }
        } catch (error) {
          projectResult.periods_failed.push(periodKey);
          console.log(`[${project.name}] ${periodKey}: ✗ Error - ${error instanceof Error ? error.message : 'Unknown'}`);
        }

        // Delay between periods (90 seconds) to avoid rate limits
        if (i < periodsToSync.length - 1) {
          console.log(`[${project.name}] Waiting 90s before next period...`);
          await delay(90000);
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
          group,
          synced: projectResult.periods_synced,
          skipped: projectResult.periods_skipped,
          failed: projectResult.periods_failed,
        }),
      });

      results.push(projectResult);
      
      // Delay between projects (5 minutes) to avoid rate limits
      if (results.length < (projects?.length || 0)) {
        console.log(`\n[SCHEDULED SYNC] Waiting 5 minutes before next project...`);
        await delay(300000);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n[SCHEDULED SYNC] Complete in ${elapsed} minutes`);
    console.log(`[SCHEDULED SYNC] Total synced: ${totalSynced}, skipped: ${totalSkipped}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        elapsed_minutes: parseFloat(elapsed), 
        total_synced: totalSynced,
        total_skipped: totalSkipped,
        results 
      }),
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
