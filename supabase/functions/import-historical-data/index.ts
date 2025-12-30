import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const BATCH_SIZE_DAYS = 30; // Process 30 days at a time to avoid timeouts
const DELAY_BETWEEN_BATCHES = 15000; // 15 seconds between date batches to avoid rate limit
const RETRY_DELAY_ON_RATE_LIMIT = 60000; // 60 seconds on rate limit
const MAX_RETRIES = 3;

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

interface ImportRequest {
  project_id: string;
  since?: string; // Default: 2025-01-01
  until?: string; // Default: today
}

interface DateRange {
  since: string;
  until: string;
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

    const body: ImportRequest = await req.json();
    const { project_id, since = '2025-01-01', until } = body;
    
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

    console.log(`\n========== HISTORICAL IMPORT STARTED ==========`);
    console.log(`[IMPORT] Project: ${project.name}`);
    console.log(`[IMPORT] Range: ${since} to ${finalUntil}`);
    console.log(`[IMPORT] Batch size: ${BATCH_SIZE_DAYS} days`);

    // Update project status with progress
    const updateProgress = async (progress: number, message: string, status: string = 'importing') => {
      await supabase.from('projects').update({ 
        webhook_status: status === 'importing' ? 'importing_history' : status,
        sync_progress: {
          status,
          progress,
          message,
          started_at: new Date().toISOString()
        }
      }).eq('id', project_id);
    };

    await updateProgress(0, 'Iniciando importação histórica...');

    // Generate date batches
    const batches = generateDateBatches(since, finalUntil, BATCH_SIZE_DAYS);
    console.log(`[IMPORT] Total batches: ${batches.length}`);

    const results: { batch: number; since: string; until: string; success: boolean; records?: number; error?: string }[] = [];
    let totalRecords = 0;
    let successBatches = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const progress = Math.round(((i + 1) / batches.length) * 100);
      
      console.log(`\n[IMPORT] Batch ${i + 1}/${batches.length}: ${batch.since} to ${batch.until}`);
      await updateProgress(progress, `Importando período ${batch.since} a ${batch.until}...`);

      let retryCount = 0;
      let batchSuccess = false;
      
      while (retryCount < MAX_RETRIES && !batchSuccess) {
        try {
          // Call meta-ads-sync for this date range
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
            results.push({ batch: i + 1, ...batch, success: true, records });
            console.log(`[IMPORT] ✓ Batch ${i + 1}: ${records} records`);
            batchSuccess = true;
          } else {
            // Check if rate limit error
            const isRateLimit = data.error?.includes('rate') || data.error?.includes('limit') || data.error?.includes('too many');
            
            if (isRateLimit && retryCount < MAX_RETRIES - 1) {
              retryCount++;
              console.log(`[IMPORT] ⏳ Rate limit detected on batch ${i + 1}, waiting ${RETRY_DELAY_ON_RATE_LIMIT / 1000}s before retry ${retryCount}/${MAX_RETRIES}...`);
              await updateProgress(progress, `Rate limit - aguardando ${RETRY_DELAY_ON_RATE_LIMIT / 1000}s (tentativa ${retryCount + 1}/${MAX_RETRIES})...`);
              await delay(RETRY_DELAY_ON_RATE_LIMIT);
            } else {
              results.push({ batch: i + 1, ...batch, success: false, error: data.error });
              console.log(`[IMPORT] ✗ Batch ${i + 1}: ${data.error}`);
              batchSuccess = true; // Exit retry loop
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          const isRateLimit = errorMsg.includes('rate') || errorMsg.includes('limit') || errorMsg.includes('429');
          
          if (isRateLimit && retryCount < MAX_RETRIES - 1) {
            retryCount++;
            console.log(`[IMPORT] ⏳ Rate limit error on batch ${i + 1}, waiting ${RETRY_DELAY_ON_RATE_LIMIT / 1000}s before retry ${retryCount}/${MAX_RETRIES}...`);
            await delay(RETRY_DELAY_ON_RATE_LIMIT);
          } else {
            results.push({ batch: i + 1, ...batch, success: false, error: errorMsg });
            console.log(`[IMPORT] ✗ Batch ${i + 1}: ${errorMsg}`);
            batchSuccess = true; // Exit retry loop
          }
        }
      }

      // Delay between batches (except last)
      if (i < batches.length - 1) {
        console.log(`[IMPORT] Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const success = successBatches === batches.length;

    // Also sync demographic data
    console.log(`[IMPORT] Syncing demographic data...`);
    await updateProgress(95, 'Sincronizando dados demográficos...');
    
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

    // Update project status with final progress
    await supabase.from('projects').update({ 
      webhook_status: success ? 'success' : 'partial',
      last_sync_at: new Date().toISOString(),
      sync_progress: {
        status: success ? 'success' : 'error',
        progress: 100,
        message: success ? `Importação concluída: ${totalRecords} registros` : `Importação parcial: ${successBatches}/${batches.length} lotes`,
        started_at: null
      }
    }).eq('id', project_id);

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

    // Automatically detect and fix gaps after historical import
    console.log(`[IMPORT] Running gap detection and fix...`);
    await updateProgress(98, 'Verificando e corrigindo lacunas de dados...');
    
    try {
      const gapsResponse = await fetch(`${supabaseUrl}/functions/v1/detect-and-fix-gaps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          project_id: project.id,
          since,
          until: finalUntil,
          auto_fix: true, // Automatically fix detected gaps
        }),
      });
      
      const gapsData = await gapsResponse.json().catch(() => ({ success: false }));
      if (gapsData.gaps_found > 0) {
        console.log(`[IMPORT] ✓ Gaps detected: ${gapsData.gaps_found}, fixed: ${gapsData.gaps_fixed || 0}`);
        totalRecords += gapsData.records_recovered || 0;
      } else {
        console.log(`[IMPORT] ✓ No gaps detected`);
      }
    } catch (gapsError) {
      console.error('[IMPORT] Gap detection error:', gapsError);
    }

    return new Response(
      JSON.stringify({
        success,
        project_id: project.id,
        project_name: project.name,
        range: { since, until: finalUntil },
        elapsed_seconds: elapsed,
        elapsed_minutes: elapsed / 60,
        total_batches: batches.length,
        success_batches: successBatches,
        total_records: totalRecords,
        results,
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
