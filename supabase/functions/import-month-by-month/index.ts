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
  force_light_sync?: boolean; // Se definido, usa esse valor. Se não, decide automaticamente
  // Parallel processing params
  parallel_next_month?: number | null;
  parallel_batch_size?: number;
  max_month?: number;
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

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if we hit rate limit by testing a simple API call
async function checkRateLimit(adAccountId: string, accessToken: string): Promise<boolean> {
  try {
    const url = `https://graph.facebook.com/v22.0/${adAccountId}?fields=id&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error?.code === 4 || data.error?.message?.includes('request limit')) {
      console.log('[RATE-LIMIT] API rate limit still active');
      return true; // Rate limited
    }
    
    return false; // OK to proceed
  } catch (e) {
    console.log('[RATE-LIMIT] Check failed:', e);
    return false; // Assume OK
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
      parallel_batch_size = 3,
      max_month
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
    
    // Check rate limit before proceeding
    const isRateLimited = await checkRateLimit(accountId, metaAccessToken);
    if (isRateLimited) {
      console.log(`[MONTH-IMPORT] Rate limited, will retry in 5 minutes`);
      
      // Update status to show we're waiting
      await supabase
        .from('project_import_months')
        .upsert({
          project_id,
          year,
          month,
          status: 'pending',
          error_message: 'Rate limit - aguardando reset (tentar novamente em 5-10 min)',
          retry_count: 1,
        }, { onConflict: 'project_id,year,month' });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit active - try again in 5-10 minutes',
          rate_limited: true 
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
    
    console.log(`[MONTH-IMPORT] Project: ${project.name}`);
    
    // Decidir light_sync:
    // 1. Se force_light_sync foi definido, usa esse valor
    // 2. Se não, decide automaticamente baseado no tamanho da conta
    let useLightSync: boolean;
    
    if (force_light_sync !== undefined) {
      useLightSync = force_light_sync;
      console.log(`[MONTH-IMPORT] Modo forçado: ${useLightSync ? 'LIGHT SYNC' : 'HD COMPLETO'}`);
    } else {
      // Verificar tamanho da conta para decidir automaticamente
      const { count: adsCount } = await supabase
        .from('ads')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project_id);
      
      const isLargeAccount = (adsCount || 0) > 200;
      useLightSync = isLargeAccount;
      console.log(`[MONTH-IMPORT] Modo auto: ${adsCount} ads - ${isLargeAccount ? 'LIGHT SYNC' : 'HD COMPLETO'}`);
    }
    // Calculate date range for the month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    const since = formatDate(firstDay);
    const until = formatDate(lastDay);
    
    console.log(`[MONTH-IMPORT] Syncing ${since} to ${until} | light_sync: ${useLightSync}`);
    
    // Call meta-ads-sync for the entire month with extended timeout
    // HD sync pode demorar muito para cachear imagens - timeout de 10min para HD
    const controller = new AbortController();
    const timeoutMs = useLightSync ? 180000 : 600000; // 3min for light, 10min for HD
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
        // Se não conseguiu parsear JSON mas o status é ok, considerar sucesso
        console.log(`[MONTH-IMPORT] Response not JSON (status ${syncResponse.status}): ${responseText.substring(0, 200)}`);
        syncResult = syncResponse.ok ? { success: true, records: 0 } : { success: false, error: 'Invalid response' };
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        // Timeout - verificar se há records salvos no banco
        console.log(`[MONTH-IMPORT] Request timeout after ${timeoutMs/1000}s - checking for saved records...`);
        
        // Esperar um pouco mais para garantir que os dados foram salvos
        await delay(10000); // 10s extra
        
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
          // Tentar uma segunda verificação após mais 10s
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
      // Check if rate limited in sync response
      if (syncResult.error?.includes('rate') || syncResult.error?.includes('limit') || syncResult.records === 0) {
        status = 'pending';
        errorMessage = 'Rate limit detectado - será retentado';
        console.log(`[MONTH-IMPORT] Rate limit detected, marking for retry`);
      } else {
        status = 'error';
        errorMessage = syncResult.error || 'Sync failed';
        console.log(`[MONTH-IMPORT] ✗ ${monthName} ${year}: ${errorMessage}`);
      }
    }
    
    // Update the month record
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
      }),
    });
    
    // Trigger next month - PARALLEL mode or chain mode
    let nextMonthTriggered = false;
    
    // PARALLEL MODE: Dispara o próximo mês do batch (mês atual + batch_size)
    if (parallel_next_month && status === 'success') {
      const effectiveMaxMonth = max_month || 12;
      
      if (parallel_next_month <= effectiveMaxMonth) {
        // Delay curto para não sobrecarregar a API
        const delayTime = 3000; // 3s entre batches
        console.log(`[MONTH-IMPORT] PARALLEL: Waiting ${delayTime/1000}s before month ${parallel_next_month}...`);
        
        await delay(delayTime);
        
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
            parallel_next_month: parallel_next_month + parallel_batch_size <= effectiveMaxMonth 
              ? parallel_next_month + parallel_batch_size 
              : null,
            parallel_batch_size,
            max_month: effectiveMaxMonth,
          }),
        }).catch(err => console.error('[MONTH-IMPORT] Failed to trigger parallel:', err));
        
        nextMonthTriggered = true;
      } else {
        console.log(`[MONTH-IMPORT] PARALLEL: Batch complete for track starting at month ${month}`);
      }
    }
    // LEGACY CHAIN MODE: Sequential processing
    else if (continue_chain && status === 'success') {
      const nextMonth = getNextMonth(year, month);
      if (nextMonth) {
        const delayTime = totalRecords > 0 ? 15000 : 5000;
        console.log(`[MONTH-IMPORT] CHAIN: Waiting ${delayTime/1000}s before next month...`);
        
        await delay(delayTime);
        
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
