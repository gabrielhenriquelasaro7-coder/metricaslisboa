import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonthImportRequest {
  project_id: string;
  year: number;
  month: number;
  continue_chain?: boolean;
  ad_account_id?: string;
  force_light_sync?: boolean;
  parallel_next_month?: number | null;
  parallel_batch_size?: number; // Se não definido, será calculado automaticamente
  max_month?: number;
  safe_mode?: boolean;
}

interface AccountSizeInfo {
  adSetsCount: number;
  adsCount: number;
  recommendedBatchSize: number;
  recommendedDelay: number;
  isLargeAccount: boolean;
}

function getNextMonth(year: number, month: number): { year: number; month: number } | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  let nextMonth = month + 1;
  let nextYear = year;
  
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  
  if (nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth)) {
    return null;
  }
  
  return { year: nextYear, month: nextMonth };
}

function getMonthName(month: number): string {
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[month - 1] || 'Unknown';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate optimal batch size and delay based on account size
function calculateAccountStrategy(adSetsCount: number, adsCount: number): AccountSizeInfo {
  const totalEntities = adSetsCount + adsCount;
  
  // MUITO GRANDE: > 200 adsets ou > 500 ads - 1 mês por vez, delay longo
  if (adSetsCount > 200 || adsCount > 500 || totalEntities > 600) {
    return {
      adSetsCount,
      adsCount,
      recommendedBatchSize: 1, // Sequencial
      recommendedDelay: 20000, // 20s entre meses
      isLargeAccount: true,
    };
  }
  
  // GRANDE: 100-200 adsets ou 200-500 ads - 2 meses paralelos, delay médio
  if (adSetsCount > 100 || adsCount > 200 || totalEntities > 300) {
    return {
      adSetsCount,
      adsCount,
      recommendedBatchSize: 2,
      recommendedDelay: 10000, // 10s entre batches
      isLargeAccount: true,
    };
  }
  
  // MÉDIA: 50-100 adsets ou 100-200 ads - 3 meses paralelos
  if (adSetsCount > 50 || adsCount > 100 || totalEntities > 150) {
    return {
      adSetsCount,
      adsCount,
      recommendedBatchSize: 3,
      recommendedDelay: 5000, // 5s entre batches
      isLargeAccount: false,
    };
  }
  
  // PEQUENA: < 50 adsets - 4 meses paralelos, delay curto
  return {
    adSetsCount,
    adsCount,
    recommendedBatchSize: 4,
    recommendedDelay: 3000, // 3s
    isLargeAccount: false,
  };
}

// Get account size from database
async function getAccountSize(supabase: any, projectId: string): Promise<AccountSizeInfo> {
  const [adSetsResult, adsResult] = await Promise.all([
    supabase.from('ad_sets').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('ads').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
  ]);
  
  const adSetsCount = adSetsResult.count || 0;
  const adsCount = adsResult.count || 0;
  
  return calculateAccountStrategy(adSetsCount, adsCount);
}

// Check rate limit
async function checkRateLimit(adAccountId: string, accessToken: string): Promise<boolean> {
  try {
    const url = `https://graph.facebook.com/v22.0/${adAccountId}?fields=id&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error?.code === 4 || data.error?.code === 80004 || data.error?.message?.includes('request limit') || data.error?.message?.includes('too many calls')) {
      console.log('[RATE-LIMIT] API rate limit detected');
      return true;
    }
    
    return false;
  } catch (e) {
    console.log('[RATE-LIMIT] Check failed:', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN') || '';
  
  try {
    const body: MonthImportRequest = await req.json();
    const { 
      project_id, 
      year, 
      month, 
      continue_chain = false, 
      ad_account_id, 
      force_light_sync,
      parallel_next_month,
      parallel_batch_size: requestedBatchSize,
      max_month,
      safe_mode = false,
    } = body;
    
    if (!project_id || !year || !month) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const monthName = getMonthName(month);
    
    console.log(`[MONTH-IMPORT] Starting ${monthName} ${year} for project ${project_id}`);
    
    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('ad_account_id, name')
      .eq('id', project_id)
      .single();
    
    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }
    
    const accountId = ad_account_id || project.ad_account_id;
    
    // Get account size and calculate optimal strategy
    const accountInfo = await getAccountSize(supabase, project_id);
    const effectiveBatchSize = requestedBatchSize || accountInfo.recommendedBatchSize;
    const effectiveDelay = accountInfo.recommendedDelay;
    
    console.log(`[MONTH-IMPORT] Project: ${project.name}`);
    console.log(`[MONTH-IMPORT] Account size: ${accountInfo.adSetsCount} adsets, ${accountInfo.adsCount} ads`);
    console.log(`[MONTH-IMPORT] Strategy: batch_size=${effectiveBatchSize}, delay=${effectiveDelay}ms, large=${accountInfo.isLargeAccount}`);
    
    // Check rate limit before proceeding
    const isRateLimited = await checkRateLimit(accountId, metaAccessToken);
    if (isRateLimited) {
      console.log(`[MONTH-IMPORT] Rate limited, will retry later`);
      
      await supabase
        .from('project_import_months')
        .upsert({
          project_id,
          year,
          month,
          status: 'pending',
          error_message: 'Rate limit - aguardando reset (5-10 min)',
          retry_count: 1,
        }, { onConflict: 'project_id,year,month' });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit active - try again in 5-10 minutes',
          rate_limited: true,
          account_info: accountInfo,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if already importing
    const { data: existingMonth } = await supabase
      .from('project_import_months')
      .select('id, status')
      .eq('project_id', project_id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    
    if (existingMonth?.status === 'importing') {
      console.log(`[MONTH-IMPORT] ${monthName} ${year} already importing, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: 'Already importing', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update status to importing
    if (existingMonth) {
      await supabase
        .from('project_import_months')
        .update({
          status: 'importing',
          started_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', existingMonth.id);
    } else {
      await supabase
        .from('project_import_months')
        .insert({
          project_id,
          year,
          month,
          status: 'importing',
          started_at: new Date().toISOString(),
          records_count: 0,
          retry_count: 0,
        });
    }
    
    // Decide light_sync mode
    let useLightSync: boolean;
    
    if (force_light_sync !== undefined) {
      useLightSync = force_light_sync;
      console.log(`[MONTH-IMPORT] Modo forçado: ${useLightSync ? 'LIGHT SYNC' : 'HD COMPLETO'}`);
    } else {
      // Auto-decide based on account size
      useLightSync = accountInfo.isLargeAccount;
      console.log(`[MONTH-IMPORT] Modo auto: ${accountInfo.isLargeAccount ? 'LIGHT SYNC (conta grande)' : 'HD COMPLETO (conta pequena)'}`);
    }
    
    // Calculate date range
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    const since = formatDate(firstDay);
    const until = formatDate(lastDay);
    
    console.log(`[MONTH-IMPORT] Syncing ${since} to ${until} | light_sync: ${useLightSync}`);
    
    // Call meta-ads-sync with extended timeout
    const controller = new AbortController();
    const timeoutMs = useLightSync ? 180000 : 600000; // 3min light, 10min HD
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    let syncResponse: Response;
    let syncResult: any;
    
    try {
      syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          project_id,
          ad_account_id: accountId,
          time_range: { since, until },
          light_sync: useLightSync,
          skip_image_cache: useLightSync,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const responseText = await syncResponse.text();
      try {
        syncResult = JSON.parse(responseText);
      } catch {
        console.log(`[MONTH-IMPORT] Response not JSON (status ${syncResponse.status}): ${responseText.substring(0, 200)}`);
        syncResult = syncResponse.ok ? { success: true, records: 0 } : { success: false, error: 'Invalid response' };
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.log(`[MONTH-IMPORT] Request timeout after ${timeoutMs/1000}s - checking for saved records...`);
        
        await delay(10000);
        
        const { count: recordsCount } = await supabase
          .from('ads_daily_metrics')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project_id)
          .gte('date', since)
          .lte('date', until);
        
        if ((recordsCount || 0) > 0) {
          console.log(`[MONTH-IMPORT] Found ${recordsCount} records in DB despite timeout - SUCCESS`);
          syncResult = { success: true, records: recordsCount };
          syncResponse = new Response(null, { status: 200 });
        } else {
          await delay(10000);
          
          const { count: recordsCount2 } = await supabase
            .from('ads_daily_metrics')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project_id)
            .gte('date', since)
            .lte('date', until);
          
          if ((recordsCount2 || 0) > 0) {
            console.log(`[MONTH-IMPORT] Found ${recordsCount2} records on second check - SUCCESS`);
            syncResult = { success: true, records: recordsCount2 };
            syncResponse = new Response(null, { status: 200 });
          } else {
            syncResult = { success: false, error: 'Timeout - nenhum registro encontrado' };
            syncResponse = new Response(null, { status: 408 });
          }
        }
      } else {
        console.log(`[MONTH-IMPORT] Fetch error: ${fetchError.message}`);
        syncResult = { success: false, error: fetchError.message };
        syncResponse = new Response(null, { status: 500 });
      }
    }
    
    let totalRecords = 0;
    let status = 'success';
    let errorMessage = null;
    
    if (syncResponse.ok && syncResult.success !== false) {
      totalRecords = syncResult.summary?.records || syncResult.records || 0;
      console.log(`[MONTH-IMPORT] ✓ ${monthName} ${year}: ${totalRecords} records`);
    } else {
      // Check if rate limited
      if (syncResult.error?.includes('rate') || syncResult.error?.includes('limit') || syncResult.error?.includes('too many')) {
        status = 'pending';
        errorMessage = 'Rate limit detectado - será retentado';
        console.log(`[MONTH-IMPORT] Rate limit detected, marking for retry`);
      } else {
        status = 'error';
        errorMessage = syncResult.error || 'Sync failed';
        console.log(`[MONTH-IMPORT] ✗ ${monthName} ${year}: ${errorMessage}`);
      }
    }
    
    // Update month record
    await supabase
      .from('project_import_months')
      .update({
        status,
        records_count: totalRecords,
        completed_at: status === 'success' ? new Date().toISOString() : null,
        error_message: errorMessage,
      })
      .eq('project_id', project_id)
      .eq('year', year)
      .eq('month', month);
    
    // Log the sync
    await supabase.from('sync_logs').insert({
      project_id,
      status,
      message: JSON.stringify({
        type: 'month_import',
        month: `${year}-${month}`,
        month_name: `${monthName} ${year}`,
        records: totalRecords,
        account_info: accountInfo,
      }),
    });
    
    // Trigger next month - with SMART PARALLELISM
    let nextMonthTriggered = false;
    
    // PARALLEL MODE with adaptive batch size
    if (parallel_next_month && status === 'success') {
      const effectiveMaxMonth = max_month || 12;
      
      if (parallel_next_month <= effectiveMaxMonth) {
        // Use calculated delay based on account size
        console.log(`[MONTH-IMPORT] PARALLEL: Waiting ${effectiveDelay/1000}s before month ${parallel_next_month}...`);
        
        await delay(effectiveDelay);
        
        console.log(`[MONTH-IMPORT] PARALLEL: Triggering month ${parallel_next_month} of ${year}`);
        
        fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            project_id,
            ad_account_id: accountId,
            year,
            month: parallel_next_month,
            continue_chain: false,
            force_light_sync: force_light_sync,
            parallel_next_month: parallel_next_month + effectiveBatchSize <= effectiveMaxMonth 
              ? parallel_next_month + effectiveBatchSize 
              : null,
            parallel_batch_size: effectiveBatchSize,
            max_month: effectiveMaxMonth,
            safe_mode,
          }),
        }).catch(err => console.error('[MONTH-IMPORT] Failed to trigger parallel:', err));
        
        nextMonthTriggered = true;
      } else {
        console.log(`[MONTH-IMPORT] PARALLEL: Batch complete for track starting at month ${month}`);
      }
    }
    // CHAIN MODE (sequential) - with smart delays
    else if (continue_chain && status === 'success') {
      const nextMonth = getNextMonth(year, month);
      if (nextMonth) {
        // Use larger delay for large accounts
        const chainDelay = accountInfo.isLargeAccount ? 20000 : (totalRecords > 0 ? 15000 : 5000);
        console.log(`[MONTH-IMPORT] CHAIN: Waiting ${chainDelay/1000}s before next month...`);
        
        await delay(chainDelay);
        
        console.log(`[MONTH-IMPORT] CHAIN: Triggering next: ${getMonthName(nextMonth.month)} ${nextMonth.year}`);
        
        fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            project_id,
            ad_account_id: accountId,
            year: nextMonth.year,
            month: nextMonth.month,
            continue_chain: true,
            force_light_sync: force_light_sync,
            safe_mode,
          }),
        }).catch(err => console.error('[MONTH-IMPORT] Failed to trigger next:', err));
        
        nextMonthTriggered = true;
      } else {
        console.log('[MONTH-IMPORT] CHAIN: Reached current month, complete');
      }
    }
    
    console.log(`[MONTH-IMPORT] ✓ ${monthName} ${year} completed`);
    
    return new Response(
      JSON.stringify({
        success: status === 'success',
        message: `${monthName} ${year} imported`,
        records: totalRecords,
        next_month_triggered: nextMonthTriggered,
        account_info: accountInfo,
        effective_batch_size: effectiveBatchSize,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MONTH-IMPORT] Error:', errorMessage);
    
    try {
      const body = await req.clone().json();
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('project_import_months')
        .update({
          status: 'error',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('project_id', body.project_id)
        .eq('year', body.year)
        .eq('month', body.month);
    } catch {}
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
