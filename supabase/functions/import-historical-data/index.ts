import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration - Conservative defaults, can be overridden with safe_mode
const BATCH_SIZE_DAYS = 30;
const DEFAULT_DELAY_BETWEEN_BATCHES = 20000; // 20 seconds between batches
const SAFE_MODE_DELAY_BETWEEN_BATCHES = 60000; // 60 seconds in safe mode
const DEFAULT_RETRY_DELAY_ON_RATE_LIMIT = 90000; // 90 seconds on rate limit
const SAFE_MODE_RETRY_DELAY_ON_RATE_LIMIT = 180000; // 3 minutes in safe mode
const MAX_RETRIES = 5;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getMonthName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

interface ImportRequest {
  project_id: string;
  since?: string;
  until?: string;
  safe_mode?: boolean; // Use longer delays to avoid rate limits
}

interface DateRange {
  since: string;
  until: string;
}

interface BatchResult {
  batch: number;
  since: string;
  until: string;
  month: string;
  success: boolean;
  records: number;
  error?: string;
}

function generateDateBatches(since: string, until: string, batchDays: number): DateRange[] {
  const batches: DateRange[] = [];
  let currentStart = new Date(since);
  const endDate = new Date(until);
  
  while (currentStart < endDate) {
    const batchEnd = addDays(currentStart, batchDays - 1);
    const actualEnd = batchEnd > endDate ? endDate : batchEnd;
    
    batches.push({
      since: formatDate(currentStart),
      until: formatDate(actualEnd),
    });
    
    currentStart = addDays(actualEnd, 1);
  }
  
  return batches;
}

// Background task for importing data
async function runImport(
  supabaseUrl: string,
  supabaseServiceKey: string,
  project: { id: string; ad_account_id: string; name: string },
  since: string,
  finalUntil: string,
  safeMode: boolean = false
) {
  const DELAY_BETWEEN_BATCHES = safeMode ? SAFE_MODE_DELAY_BETWEEN_BATCHES : DEFAULT_DELAY_BETWEEN_BATCHES;
  const RETRY_DELAY_ON_RATE_LIMIT = safeMode ? SAFE_MODE_RETRY_DELAY_ON_RATE_LIMIT : DEFAULT_RETRY_DELAY_ON_RATE_LIMIT;
  const startTime = Date.now();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const updateProgress = async (progress: number, message: string, status: string = 'importing') => {
    await supabase.from('projects').update({ 
      webhook_status: status === 'importing' ? 'importing_history' : status,
      sync_progress: {
        status,
        progress,
        message,
        started_at: new Date().toISOString()
      }
    }).eq('id', project.id);
  };

  try {
    console.log(`\n========== HISTORICAL IMPORT STARTED (BACKGROUND) ==========`);
    console.log(`[IMPORT] Project: ${project.name}`);
    console.log(`[IMPORT] Range: ${since} to ${finalUntil}`);
    console.log(`[IMPORT] Batch size: ${BATCH_SIZE_DAYS} days`);

    await updateProgress(0, 'Iniciando importação histórica...');

    const batches = generateDateBatches(since, finalUntil, BATCH_SIZE_DAYS);
    console.log(`[IMPORT] Total batches: ${batches.length}`);

    let totalRecords = 0;
    let successBatches = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const progress = Math.round(((i + 1) / batches.length) * 90); // Save 10% for demographics
      
      console.log(`\n[IMPORT] Batch ${i + 1}/${batches.length}: ${batch.since} to ${batch.until}`);
      await updateProgress(progress, `Importando período ${batch.since} a ${batch.until}...`);

      let retryCount = 0;
      let batchSuccess = false;
      
      while (retryCount < MAX_RETRIES && !batchSuccess) {
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
              time_range: batch,
              period_key: `history_${batch.since}_${batch.until}`,
            }),
          });

          const data = await response.json().catch(() => ({ success: false }));

          if (data.success) {
            const records = data.data?.daily_records_count || 0;
            totalRecords += records;
            successBatches++;
            console.log(`[IMPORT] ✓ Batch ${i + 1}: ${records} records`);
            batchSuccess = true;
          } else {
            const isRateLimit = data.error?.includes('rate') || data.error?.includes('limit') || data.error?.includes('too many') || data.error?.includes('80004');
            
            if (isRateLimit && retryCount < MAX_RETRIES - 1) {
              retryCount++;
              const waitTime = RETRY_DELAY_ON_RATE_LIMIT * retryCount; // Exponential backoff
              console.log(`[IMPORT] ⏳ Rate limit on batch ${i + 1}, waiting ${waitTime / 1000}s (retry ${retryCount}/${MAX_RETRIES})...`);
              await updateProgress(progress, `Rate limit - aguardando ${Math.round(waitTime / 1000)}s (tentativa ${retryCount + 1}/${MAX_RETRIES})...`);
              await delay(waitTime);
            } else {
              console.log(`[IMPORT] ✗ Batch ${i + 1}: ${data.error}`);
              batchSuccess = true; // Exit retry loop
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          const isRateLimit = errorMsg.includes('rate') || errorMsg.includes('limit') || errorMsg.includes('429');
          
          if (isRateLimit && retryCount < MAX_RETRIES - 1) {
            retryCount++;
            const waitTime = RETRY_DELAY_ON_RATE_LIMIT * retryCount;
            console.log(`[IMPORT] ⏳ Rate limit error on batch ${i + 1}, waiting ${waitTime / 1000}s (retry ${retryCount}/${MAX_RETRIES})...`);
            await delay(waitTime);
          } else {
            console.log(`[IMPORT] ✗ Batch ${i + 1}: ${errorMsg}`);
            batchSuccess = true;
          }
        }
      }

      // Delay between batches
      if (i < batches.length - 1) {
        console.log(`[IMPORT] Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const success = successBatches === batches.length;

    // Sync demographic data
    console.log(`[IMPORT] Syncing demographic data...`);
    await updateProgress(92, 'Sincronizando dados demográficos...');
    
    try {
      const demoResponse = await fetch(`${supabaseUrl}/functions/v1/sync-demographics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          project_id: project.id,
          ad_account_id: project.ad_account_id,
          time_range: { since, until: finalUntil },
        }),
      });
      
      const demoData = await demoResponse.json().catch(() => ({ success: false }));
      if (demoData.success) {
        console.log(`[IMPORT] ✓ Demographics synced: ${demoData.records_count} records`);
      } else {
        console.log(`[IMPORT] ✗ Demographics sync failed:`, demoData.error);
      }
    } catch (demoError) {
      console.error('[IMPORT] Demographics sync error:', demoError);
    }

    // Update final status
    await supabase.from('projects').update({ 
      webhook_status: success ? 'success' : 'partial',
      last_sync_at: new Date().toISOString(),
      sync_progress: {
        status: success ? 'success' : 'partial',
        progress: 100,
        message: success 
          ? `Importação concluída: ${totalRecords} registros em ${Math.round(elapsed / 60)} min`
          : `Importação parcial: ${successBatches}/${batches.length} lotes, ${totalRecords} registros`,
        started_at: null
      }
    }).eq('id', project.id);

    // Log completion
    await supabase.from('sync_logs').insert({
      project_id: project.id,
      status: success ? 'success' : 'partial',
      message: JSON.stringify({
        type: 'historical_import',
        range: `${since} to ${finalUntil}`,
        total_batches: batches.length,
        success_batches: successBatches,
        total_records: totalRecords,
        elapsed: elapsed.toFixed(1) + 's',
      }),
    });

    console.log(`\n========== HISTORICAL IMPORT COMPLETE ==========`);
    console.log(`[IMPORT] Total time: ${elapsed.toFixed(1)}s (${(elapsed / 60).toFixed(1)} min)`);
    console.log(`[IMPORT] Batches: ${successBatches}/${batches.length} success`);
    console.log(`[IMPORT] Total records: ${totalRecords}`);

  } catch (error) {
    console.error('[IMPORT BACKGROUND ERROR]', error);
    await updateProgress(0, `Erro: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
  }
}

// Handle shutdown gracefully
addEventListener('beforeunload', (ev) => {
  console.log('[IMPORT] Function shutting down due to:', (ev as any).detail?.reason || 'unknown');
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const body: ImportRequest = await req.json();
    const { project_id, since = '2025-01-01', until, safe_mode = false } = body;
    
    const finalUntil = until || formatDate(new Date());

    if (!project_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'project_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, ad_account_id, name')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate batches for response
    const delayPerBatch = safe_mode ? SAFE_MODE_DELAY_BETWEEN_BATCHES : DEFAULT_DELAY_BETWEEN_BATCHES;
    const batches = generateDateBatches(since, finalUntil, BATCH_SIZE_DAYS);
    const estimatedMinutes = Math.ceil(batches.length * (delayPerBatch / 1000 + 60) / 60);

    console.log(`[IMPORT] Starting background import for ${project.name}`);
    console.log(`[IMPORT] Range: ${since} to ${finalUntil}, ${batches.length} batches`);

    // Update project status immediately
    await supabase.from('projects').update({ 
      webhook_status: 'importing_history',
      sync_progress: {
        status: 'importing',
        progress: 0,
        message: `Iniciando importação de ${batches.length} lotes...`,
        started_at: new Date().toISOString()
      }
    }).eq('id', project_id);

    // Start background task - this continues even after response is sent
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(runImport(supabaseUrl, supabaseServiceKey, project, since, finalUntil, safe_mode));

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Importação iniciada em segundo plano',
        project_id: project.id,
        project_name: project.name,
        range: { since, until: finalUntil },
        total_batches: batches.length,
        estimated_minutes: estimatedMinutes,
        note: 'A importação continuará em segundo plano. Acompanhe o progresso no painel do projeto.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[IMPORT ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
