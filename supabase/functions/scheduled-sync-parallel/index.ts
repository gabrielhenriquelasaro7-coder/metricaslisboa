import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { filterProjectsForSync } from './_filter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const CONCURRENT_PROJECTS = 10; // Sync 10 projects at the same time (increased for full coverage)
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds between batches (reduced)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000; // 15 minutes
const FUNCTION_TIMEOUT_BUFFER = 50000; // Leave 50s buffer before function timeout

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
  google_customer_id?: string | null;
  access_token?: string | null;
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
    // Sincronizar últimos 3 dias por padrão
    const now = new Date();
    const until = formatDate(now);
    const since = formatDate(subDays(now, 3));

    const syncPromises: Promise<any>[] = [];

    // Meta Ads sync (only if ad_account_id starts with 'act_')
    const hasMeta = project.ad_account_id?.startsWith('act_');
    if (hasMeta) {
      syncPromises.push(
        fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            ad_account_id: project.ad_account_id,
            // Passa o token do projeto específico — fallback para META_ACCESS_TOKEN global se não houver
            ...(project.access_token ? { access_token: project.access_token } : {}),
            time_range: { since, until },
            period_key: 'last_3d',
            retry_count: retryCount,
            light_sync: false,
            skip_image_cache: false,
          }),
        }).then(r => r.json().catch(() => ({ success: false }))).then(data => ({ type: 'meta', data }))
      );
    }

    // Google Ads sync (only if google_customer_id is set)
    const hasGoogle = !!project.google_customer_id?.trim();
    if (hasGoogle) {
      syncPromises.push(
        fetch(`${supabaseUrl}/functions/v1/google-ads-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            projectId: project.id,
            syncType: 'full',
            days: 3,
          }),
        }).then(r => r.json().catch(() => ({ success: false }))).then(data => ({ type: 'google', data }))
      );
    }

    if (syncPromises.length === 0) {
      result.error = 'No ad accounts configured';
      console.log(`[${project.name}] ⚠ No Meta or Google configured, skipping`);
    } else {
      const results = await Promise.all(syncPromises);

      let allSuccess = true;
      let needsRetry = false;

      for (const r of results) {
        if (r.data.success) {
          const records = r.data.data?.daily_records_count || r.data.recordsCount || 0;
          result.daily_records += records;
          console.log(`[${project.name}] ✓ ${r.type}: ${records} records`);
        } else if (r.data.needs_retry && retryCount < MAX_RETRIES) {
          needsRetry = true;
          console.log(`[${project.name}] ⏳ ${r.type}: Needs retry`);
        } else {
          allSuccess = false;
          console.log(`[${project.name}] ✗ ${r.type}: ${r.data.error || 'Failed'}`);
        }
      }

      result.success = allSuccess;
      if (needsRetry) {
        result.needs_retry = true;
        result.error = 'Scheduled for retry';
      } else if (!allSuccess) {
        result.error = results.filter(r => !r.data.success).map(r => `${r.type}: ${r.data.error}`).join('; ');
      }

      // CRM sync (only if connected)
      try {
        const { data: crmConn } = await supabase
          .from('crm_connections')
          .select('id')
          .eq('project_id', project.id)
          .eq('status', 'connected')
          .single();

        if (crmConn) {
          console.log(`[${project.name}] ⏳ Triggering CRM sync...`);
          fetch(`${supabaseUrl}/functions/v1/crm-sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              connection_id: crmConn.id,
              project_id: project.id,
              sync_type: 'incremental'
            })
          }).catch(err => console.error(`[${project.name}] CRM sync failed:`, err));
        }
      } catch (crmErr) {
        // Not connected or error, ignore
      }
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
    // META_ACCESS_TOKEN é fallback global (opcional) — projetos com token próprio o usam diretamente
    // Não bloqueamos a execução se não existir, pois cada projeto pode ter seu token no banco

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

    // Busca projetos com Meta e/ou Google configurado (incluindo token por projeto)
    let projectsQuery = supabase
      .from('projects')
      .select('id, ad_account_id, name, google_customer_id, sync_progress, webhook_status')
      .eq('archived', false);

    if (project_ids && project_ids.length > 0) {
      projectsQuery = projectsQuery.in('id', project_ids);
    }

    // If retrying failed, filter by status
    if (retry_failed) {
      projectsQuery = projectsQuery.eq('webhook_status', 'retry_pending');
    }

    // Filter: must have at least Meta OR Google configured
    // We'll filter in-memory after fetch since OR conditions are complex
    console.log(`[SYNC] Fetching projects with Meta or Google configured`);

    const { data: allProjects, error: projectsError } = await projectsQuery;

    const { eligible: projects, skippedScheduled, skippedExhausted, skippedNoAccount } =
      filterProjectsForSync(allProjects || []);

    if (skippedScheduled.length) {
      console.log(`[SYNC] Skipping ${skippedScheduled.length} project(s) waiting for next_retry_at:`, skippedScheduled.slice(0, 10));
    }
    if (skippedExhausted.length) {
      console.log(`[SYNC] Skipping ${skippedExhausted.length} project(s) that exhausted retries:`, skippedExhausted.slice(0, 10));
    }
    if (skippedNoAccount.length) {
      console.log(`[SYNC] Skipping ${skippedNoAccount.length} project(s) without ad accounts`);
    }

    if (projectsError || projects.length === 0) {
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
    console.log(`[SYNC] Mode: last_3d`);
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

    // AUTOMATIC GAP DETECTION AND FIX
    // After daily sync, check for gaps in the last 30 days and fix them automatically
    console.log(`\n========== RUNNING GAP DETECTION ==========`);
    try {
      const gapResponse = await fetch(`${supabaseUrl}/functions/v1/detect-and-fix-gaps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          since: formatDate(subDays(new Date(), 30)), // Check last 30 days
          auto_fix: true,
        }),
      });

      const gapData = await gapResponse.json().catch(() => ({}));
      console.log(`[GAPS] Found: ${gapData.gaps_found || 0}, Fixed: ${gapData.gaps_fixed || 0}, Records: ${gapData.records_imported || 0}`);
    } catch (gapError) {
      console.error('[GAPS] Error running gap detection:', gapError);
    }

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
