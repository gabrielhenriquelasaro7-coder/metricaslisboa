import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const CONCURRENT_PROJECTS = 10; // Sync 10 projects at the same time
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds between batches
const DELAY_BETWEEN_PERIODS = 5000; // 5 seconds between periods within same project

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

// Period groups
type PeriodGroup = 'priority' | 'recent' | 'extended' | 'historical' | 'all' | 'daily';

const PERIOD_GROUPS: Record<PeriodGroup, string[]> = {
  daily: ['yesterday', 'this_month'], // Quick daily sync
  priority: ['yesterday', 'this_month', 'this_year'],
  recent: ['last_7d', 'last_14d', 'last_30d'],
  extended: ['last_60d', 'last_90d'],
  historical: ['last_month', 'last_year'],
  all: ['yesterday', 'last_7d', 'last_14d', 'last_30d', 'last_60d', 'last_90d', 'this_month', 'last_month', 'this_year', 'last_year'],
};

// Cache TTL in hours
const CACHE_TTL_HOURS: Record<string, number> = {
  'yesterday': 4,
  'this_month': 4,
  'this_year': 6,
  'last_7d': 8,
  'last_14d': 12,
  'last_30d': 12,
  'last_60d': 18,
  'last_90d': 18,
  'last_month': 24,
  'last_year': 48,
};

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
  
  return !error && data && data.length > 0;
}

interface Project {
  id: string;
  ad_account_id: string;
  name: string;
}

interface SyncResult {
  project_id: string;
  project_name: string;
  periods_synced: string[];
  periods_skipped: string[];
  periods_failed: string[];
  elapsed_seconds: number;
}

async function syncProject(
  project: Project,
  periods: string[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  supabase: any,
  skipCache: boolean
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    project_id: project.id,
    project_name: project.name,
    periods_synced: [],
    periods_skipped: [],
    periods_failed: [],
    elapsed_seconds: 0,
  };

  console.log(`[${project.name}] Starting sync for ${periods.length} periods...`);

  for (let i = 0; i < periods.length; i++) {
    const periodKey = periods[i];
    const periodDates = getPeriodDates(periodKey);
    
    if (!periodDates) {
      console.log(`[${project.name}] ${periodKey}: Invalid period`);
      continue;
    }

    // Check cache
    if (!skipCache) {
      const isCached = await isPeriodCached(supabase, project.id, periodKey);
      if (isCached) {
        result.periods_skipped.push(periodKey);
        console.log(`[${project.name}] ${periodKey}: ⏭ Cached`);
        continue;
      }
    }

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
          time_range: periodDates,
          period_key: periodKey,
        }),
      });
      
      const data = await response.json().catch(() => ({ success: false }));
      
      if (data.success) {
        result.periods_synced.push(periodKey);
        console.log(`[${project.name}] ${periodKey}: ✓ ${data.data?.elapsed_seconds || '?'}s`);
      } else {
        result.periods_failed.push(periodKey);
        console.log(`[${project.name}] ${periodKey}: ✗ ${data.error || 'Failed'}`);
      }
    } catch (error) {
      result.periods_failed.push(periodKey);
      console.log(`[${project.name}] ${periodKey}: ✗ ${error instanceof Error ? error.message : 'Error'}`);
    }

    // Small delay between periods
    if (i < periods.length - 1) {
      await delay(DELAY_BETWEEN_PERIODS);
    }
  }

  result.elapsed_seconds = (Date.now() - startTime) / 1000;

  // Update project status
  const success = result.periods_failed.length === 0 && result.periods_synced.length > 0;
  const partial = result.periods_synced.length > 0 && result.periods_failed.length > 0;
  
  await supabase.from('projects').update({
    last_sync_at: new Date().toISOString(),
    webhook_status: success ? 'success' : (partial ? 'partial' : (result.periods_skipped.length === periods.length ? 'cached' : 'error')),
  }).eq('id', project.id);

  // Log completion
  await supabase.from('sync_logs').insert({
    project_id: project.id,
    status: success ? 'success' : (partial ? 'partial' : 'error'),
    message: JSON.stringify({
      type: 'parallel_sync',
      synced: result.periods_synced,
      skipped: result.periods_skipped,
      failed: result.periods_failed,
      elapsed: result.elapsed_seconds.toFixed(1) + 's',
    }),
  });

  console.log(`[${project.name}] Complete: ${result.periods_synced.length} synced, ${result.periods_skipped.length} cached, ${result.periods_failed.length} failed in ${result.elapsed_seconds.toFixed(1)}s`);

  return result;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface SyncRequest {
  periods?: string[];
  group?: PeriodGroup;
  skip_cache?: boolean;
  project_ids?: string[];
  concurrent?: number;
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
      return new Response(
        JSON.stringify({ success: false, error: 'META_ACCESS_TOKEN not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    let requestBody: SyncRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // Use defaults
    }

    const { 
      periods, 
      group = 'daily', 
      skip_cache = false, 
      project_ids,
      concurrent = CONCURRENT_PROJECTS 
    } = requestBody;

    const periodsToSync = periods || PERIOD_GROUPS[group] || PERIOD_GROUPS.daily;
    const concurrentLimit = Math.min(concurrent, 20); // Max 20 concurrent

    // Fetch projects
    let projectsQuery = supabase
      .from('projects')
      .select('id, ad_account_id, name')
      .eq('archived', false)
      .not('ad_account_id', 'is', null);

    if (project_ids && project_ids.length > 0) {
      projectsQuery = projectsQuery.in('id', project_ids);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError || !projects) {
      return new Response(
        JSON.stringify({ success: false, error: projectsError?.message || 'No projects found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n========== PARALLEL SYNC STARTED ==========`);
    console.log(`[PARALLEL] Projects: ${projects.length}`);
    console.log(`[PARALLEL] Concurrent: ${concurrentLimit}`);
    console.log(`[PARALLEL] Periods: ${periodsToSync.join(', ')}`);
    console.log(`[PARALLEL] Skip cache: ${skip_cache}`);
    console.log(`[PARALLEL] Started: ${new Date().toISOString()}`);

    const results: SyncResult[] = [];
    const projectBatches = chunk(projects, concurrentLimit);

    for (let batchIndex = 0; batchIndex < projectBatches.length; batchIndex++) {
      const batch = projectBatches[batchIndex];
      console.log(`\n----- BATCH ${batchIndex + 1}/${projectBatches.length} (${batch.length} projects) -----`);

      // Sync all projects in this batch in parallel
      const batchPromises = batch.map(project =>
        syncProject(project, periodsToSync, supabaseUrl, supabaseServiceKey, supabase, skip_cache)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches (except last)
      if (batchIndex < projectBatches.length - 1) {
        console.log(`\n[PARALLEL] Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const totalSynced = results.reduce((sum, r) => sum + r.periods_synced.length, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.periods_skipped.length, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.periods_failed.length, 0);

    console.log(`\n========== PARALLEL SYNC COMPLETE ==========`);
    console.log(`[PARALLEL] Total time: ${elapsed.toFixed(1)}s (${(elapsed / 60).toFixed(1)} min)`);
    console.log(`[PARALLEL] Projects: ${results.length}`);
    console.log(`[PARALLEL] Synced: ${totalSynced}, Cached: ${totalSkipped}, Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        elapsed_seconds: elapsed,
        elapsed_minutes: elapsed / 60,
        projects_count: results.length,
        total_synced: totalSynced,
        total_skipped: totalSkipped,
        total_failed: totalFailed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PARALLEL SYNC ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
