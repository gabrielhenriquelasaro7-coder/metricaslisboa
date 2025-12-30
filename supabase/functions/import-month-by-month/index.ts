import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay between months (in milliseconds)
const DELAY_BETWEEN_MONTHS_MS = 120000; // 2 minutes
const SAFE_MODE_DELAY_MS = 180000; // 3 minutes

interface MonthImportRequest {
  project_id: string;
  year: number;
  month: number; // 1-12
  continue_chain?: boolean; // If true, trigger next month after completion
  safe_mode?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getMonthDateRange(year: number, month: number): { since: string; until: string } {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // Last day of the month
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  return {
    since: formatDate(firstDay),
    until: formatDate(lastDay),
  };
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
  
  // Don't go beyond current month
  if (nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth)) {
    return null;
  }
  
  return { year: nextYear, month: nextMonth };
}

function getMonthName(month: number): string {
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[month - 1] || 'Unknown';
}

async function triggerNextMonth(
  supabaseUrl: string,
  anonKey: string,
  projectId: string,
  year: number,
  month: number,
  safeMode: boolean
) {
  const nextMonthData = getNextMonth(year, month);
  if (!nextMonthData) {
    console.log('[MONTH-IMPORT] No more months to import (reached current month)');
    return;
  }
  
  console.log(`[MONTH-IMPORT] Triggering next month: ${getMonthName(nextMonthData.month)} ${nextMonthData.year}`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        year: nextMonthData.year,
        month: nextMonthData.month,
        continue_chain: true,
        safe_mode: safeMode,
      }),
    });
    
    if (!response.ok) {
      console.error('[MONTH-IMPORT] Failed to trigger next month:', await response.text());
    } else {
      console.log('[MONTH-IMPORT] Next month triggered successfully');
    }
  } catch (error) {
    console.error('[MONTH-IMPORT] Error triggering next month:', error);
  }
}

async function runMonthImport(
  supabaseUrl: string,
  supabaseServiceKey: string,
  anonKey: string,
  projectId: string,
  year: number,
  month: number,
  continueChain: boolean,
  safeMode: boolean
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const monthName = getMonthName(month);
  const monthKey = `${year}-${month}`;
  
  console.log(`\n========== MONTH IMPORT: ${monthName} ${year} ==========`);
  console.log(`[MONTH-IMPORT] Project ID: ${projectId}`);
  console.log(`[MONTH-IMPORT] Continue chain: ${continueChain}`);
  console.log(`[MONTH-IMPORT] Safe mode: ${safeMode}`);
  
  try {
    // Update status to importing
    await supabase
      .from('project_import_months')
      .update({
        status: 'importing',
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('project_id', projectId)
      .eq('year', year)
      .eq('month', month);
    
    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('ad_account_id, name')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }
    
    console.log(`[MONTH-IMPORT] Project: ${project.name}`);
    
    // Get date range for this month
    const { since, until } = getMonthDateRange(year, month);
    console.log(`[MONTH-IMPORT] Date range: ${since} to ${until}`);
    
    // Call meta-ads-sync for this month
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        ad_account_id: project.ad_account_id,
        since,
        until,
        skip_enrichment: true, // Speed up by skipping thumbnail enrichment
      }),
    });
    
    const syncResult = await syncResponse.json();
    
    if (!syncResponse.ok || !syncResult.success) {
      throw new Error(syncResult.error || `Sync failed with status ${syncResponse.status}`);
    }
    
    const recordsCount = syncResult.count || 0;
    console.log(`[MONTH-IMPORT] ✓ ${monthName} ${year}: ${recordsCount} records`);
    
    // Update status to success
    await supabase
      .from('project_import_months')
      .update({
        status: 'success',
        records_count: recordsCount,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('project_id', projectId)
      .eq('year', year)
      .eq('month', month);
    
    // Log success
    await supabase.from('sync_logs').insert({
      project_id: projectId,
      status: 'success',
      message: JSON.stringify({
        type: 'month_import',
        month: monthKey,
        month_name: `${monthName} ${year}`,
        records: recordsCount,
      }),
    });
    
    // If continue_chain, wait and trigger next month
    if (continueChain) {
      const delayMs = safeMode ? SAFE_MODE_DELAY_MS : DELAY_BETWEEN_MONTHS_MS;
      console.log(`[MONTH-IMPORT] Waiting ${delayMs / 1000}s before next month...`);
      await delay(delayMs);
      
      await triggerNextMonth(supabaseUrl, anonKey, projectId, year, month, safeMode);
    }
    
    console.log(`[MONTH-IMPORT] ✓ ${monthName} ${year} completed successfully`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MONTH-IMPORT] ✗ ${monthName} ${year} failed:`, errorMessage);
    
    // Update status to error
    await supabase
      .from('project_import_months')
      .update({
        status: 'error',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('year', year)
      .eq('month', month);
    
    // Increment retry count
    const { data: monthRecord } = await supabase
      .from('project_import_months')
      .select('retry_count')
      .eq('project_id', projectId)
      .eq('year', year)
      .eq('month', month)
      .single();
    
    if (monthRecord) {
      await supabase
        .from('project_import_months')
        .update({ retry_count: (monthRecord.retry_count || 0) + 1 })
        .eq('project_id', projectId)
        .eq('year', year)
        .eq('month', month);
    }
    
    // Log error
    await supabase.from('sync_logs').insert({
      project_id: projectId,
      status: 'error',
      message: JSON.stringify({
        type: 'month_import',
        month: monthKey,
        month_name: `${monthName} ${year}`,
        error: errorMessage,
      }),
    });
    
    // Even on error, if chain is enabled, continue to next month after longer delay
    if (continueChain) {
      const errorDelay = SAFE_MODE_DELAY_MS * 2; // 6 minutes after error
      console.log(`[MONTH-IMPORT] Error occurred, waiting ${errorDelay / 1000}s before next month...`);
      await delay(errorDelay);
      
      await triggerNextMonth(supabaseUrl, anonKey, projectId, year, month, safeMode);
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const body: MonthImportRequest = await req.json();
    const { project_id, year, month, continue_chain = false, safe_mode = true } = body;
    
    if (!project_id || !year || !month) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: project_id, year, month' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (month < 1 || month > 12) {
      return new Response(
        JSON.stringify({ success: false, error: 'Month must be between 1 and 12' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const monthName = getMonthName(month);
    console.log(`[MONTH-IMPORT] Request received for ${monthName} ${year}`);
    
    // Run import in background using waitUntil
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(
        runMonthImport(
          supabaseUrl,
          supabaseServiceKey,
          anonKey,
          project_id,
          year,
          month,
          continue_chain,
          safe_mode
        )
      );
    } else {
      // Fallback: run directly (will block response but still work)
      runMonthImport(
        supabaseUrl,
        supabaseServiceKey,
        anonKey,
        project_id,
        year,
        month,
        continue_chain,
        safe_mode
      ).catch(err => console.error('[MONTH-IMPORT] Background error:', err));
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Import started for ${monthName} ${year}`,
        month: `${year}-${String(month).padStart(2, '0')}`,
        continue_chain,
        safe_mode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MONTH-IMPORT] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle shutdown gracefully
addEventListener('beforeunload', (ev: any) => {
  console.log(`[MONTH-IMPORT] Function shutting down due to: ${ev.detail?.reason}`);
});
