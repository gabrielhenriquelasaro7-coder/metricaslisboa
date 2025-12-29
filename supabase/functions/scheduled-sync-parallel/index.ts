import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const CONCURRENT_PROJECTS = 5; // Sync 5 projects at the same time (reduced for stability)
const DELAY_BETWEEN_BATCHES = 60000; // 60 seconds between batches
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000; // 15 minutes

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

interface Project {
  id: string;
  ad_account_id: string;
  name: string;
}

interface SyncResult {
  project_id: string;
  project_name: string;
  success: boolean;
  daily_records: number;
  error?: string;
  elapsed_seconds: number;
  needs_retry?: boolean;
}

async function syncProject(
  project: Project,
  supabaseUrl: string,
  supabaseServiceKey: string,
  supabase: any,
  retryCount: number = 0
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    project_id: project.id,
    project_name: project.name,
    success: false,
    daily_records: 0,
    elapsed_seconds: 0,
  };

  console.log(`[${project.name}] Starting sync (retry: ${retryCount})...`);

  try {
    // NOVA ARQUITETURA: Sempre puxar last_90d com time_increment=1
    const now = new Date();
    const until = formatDate(now);
    const since = formatDate(subDays(now, 90));
    
    const response = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        project_id: project.id,
        ad_account_id: project.ad_account_id,
        time_range: { since, until },
        period_key: 'last_90d', // For backward compatibility
        retry_count: retryCount,
      }),
    });
    
    const data = await response.json().catch(() => ({ success: false }));
    
    if (data.success) {
      result.success = true;
      result.daily_records = data.data?.daily_records_count || 0;
      console.log(`[${project.name}] ✓ ${result.daily_records} daily records in ${data.data?.elapsed_seconds || '?'}s`);
    } else if (data.needs_retry && retryCount < MAX_RETRIES) {
      result.needs_retry = true;
      result.error = 'Scheduled for retry';
      console.log(`[${project.name}] ⏳ Needs retry (${retryCount + 1}/${MAX_RETRIES})`);
    } else {
      result.error = data.error || 'Failed';
      console.log(`[${project.name}] ✗ ${result.error}`);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Error';
    console.log(`[${project.name}] ✗ ${result.error}`);
  }

  result.elapsed_seconds = (Date.now() - startTime) / 1000;

  // Update project status
  await supabase.from('projects').update({
    last_sync_at: new Date().toISOString(),
    webhook_status: result.success ? 'success' : (result.needs_retry ? 'retry_pending' : 'error'),
  }).eq('id', project.id);

  // Log completion
  await supabase.from('sync_logs').insert({
    project_id: project.id,
    status: result.success ? 'success' : (result.needs_retry ? 'retry_scheduled' : 'error'),
    message: JSON.stringify({
      type: 'daily_sync',
      daily_records: result.daily_records,
      elapsed: result.elapsed_seconds.toFixed(1) + 's',
      error: result.error,
    }),
  });

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
  project_ids?: string[];
  concurrent?: number;
  retry_failed?: boolean; // Retry projects that need retry
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
      project_ids,
      concurrent = CONCURRENT_PROJECTS,
      retry_failed = false
    } = requestBody;

    const concurrentLimit = Math.min(concurrent, 10); // Max 10 concurrent

    // Fetch projects
    let projectsQuery = supabase
      .from('projects')
      .select('id, ad_account_id, name')
      .eq('archived', false)
      .not('ad_account_id', 'is', null);

    if (project_ids && project_ids.length > 0) {
      projectsQuery = projectsQuery.in('id', project_ids);
    }
    
    // If retrying failed, filter by status
    if (retry_failed) {
      projectsQuery = projectsQuery.eq('webhook_status', 'retry_pending');
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError || !projects || projects.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No projects to sync',
          projects_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n========== DAILY SYNC STARTED ==========`);
    console.log(`[SYNC] Projects: ${projects.length}`);
    console.log(`[SYNC] Concurrent: ${concurrentLimit}`);
    console.log(`[SYNC] Mode: last_90d with time_increment=1`);
    console.log(`[SYNC] Started: ${new Date().toISOString()}`);

    const results: SyncResult[] = [];
    const projectBatches = chunk(projects, concurrentLimit);
    const projectsNeedingRetry: Project[] = [];

    for (let batchIndex = 0; batchIndex < projectBatches.length; batchIndex++) {
      const batch = projectBatches[batchIndex];
      console.log(`\n----- BATCH ${batchIndex + 1}/${projectBatches.length} (${batch.length} projects) -----`);

      // Sync all projects in this batch in parallel
      const batchPromises = batch.map(project =>
        syncProject(project, supabaseUrl, supabaseServiceKey, supabase)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Track projects that need retry
      for (let i = 0; i < batchResults.length; i++) {
        if (batchResults[i].needs_retry) {
          projectsNeedingRetry.push(batch[i]);
        }
      }

      // Delay between batches (except last)
      if (batchIndex < projectBatches.length - 1) {
        console.log(`\n[SYNC] Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const totalSuccess = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success && !r.needs_retry).length;
    const totalRetry = results.filter(r => r.needs_retry).length;
    const totalDailyRecords = results.reduce((sum, r) => sum + r.daily_records, 0);

    console.log(`\n========== DAILY SYNC COMPLETE ==========`);
    console.log(`[SYNC] Total time: ${elapsed.toFixed(1)}s (${(elapsed / 60).toFixed(1)} min)`);
    console.log(`[SYNC] Projects: ${results.length} (${totalSuccess} success, ${totalFailed} failed, ${totalRetry} retry)`);
    console.log(`[SYNC] Total daily records: ${totalDailyRecords}`);

    return new Response(
      JSON.stringify({
        success: true,
        elapsed_seconds: elapsed,
        elapsed_minutes: elapsed / 60,
        projects_count: results.length,
        total_success: totalSuccess,
        total_failed: totalFailed,
        total_retry: totalRetry,
        total_daily_records: totalDailyRecords,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
