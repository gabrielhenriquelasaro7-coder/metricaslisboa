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
  safe_mode?: boolean;
}

// Get weeks for a month (to split large requests)
function getWeeksInMonth(year: number, month: number): Array<{ since: string; until: string }> {
  const weeks: Array<{ since: string; until: string }> = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  let currentStart = new Date(firstDay);
  
  while (currentStart <= lastDay) {
    // Each week is 7 days
    const weekEnd = new Date(currentStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Don't go past month end
    const actualEnd = weekEnd > lastDay ? lastDay : weekEnd;
    
    weeks.push({
      since: formatDate(currentStart),
      until: formatDate(actualEnd),
    });
    
    // Move to next week
    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return weeks;
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

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  try {
    const body: MonthImportRequest = await req.json();
    const { project_id, year, month, continue_chain = false, safe_mode = true } = body;
    
    if (!project_id || !year || !month) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const monthName = getMonthName(month);
    
    console.log(`[MONTH-IMPORT] Starting ${monthName} ${year} for project ${project_id}`);
    
    // Check if already importing
    const { data: existingMonth } = await supabase
      .from('project_import_months')
      .select('id, status, completed_at')
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
    
    // Create or update the month record - UPSERT pattern
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
      console.log(`[MONTH-IMPORT] Creating new record for ${monthName} ${year}`);
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
    
    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('ad_account_id, name')
      .eq('id', project_id)
      .single();
    
    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }
    
    console.log(`[MONTH-IMPORT] Project: ${project.name}`);
    
    // Split month into weeks to avoid "Your request timed out" error from Meta API
    const weeks = getWeeksInMonth(year, month);
    console.log(`[MONTH-IMPORT] Splitting ${monthName} ${year} into ${weeks.length} weeks`);
    
    let totalRecords = 0;
    let totalConversions = 0;
    let successfulWeeks = 0;
    let failedWeeks = 0;
    
    // Process each week sequentially with delays
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      console.log(`[MONTH-IMPORT] Week ${i + 1}/${weeks.length}: ${week.since} to ${week.until}`);
      
      try {
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id,
            ad_account_id: project.ad_account_id,
            time_range: { since: week.since, until: week.until },
            light_sync: true,
            skip_image_cache: true,
          }),
        });
        
        const syncResult = await syncResponse.json();
        
        if (syncResponse.ok && syncResult.success) {
          const weekRecords = syncResult.summary?.records || syncResult.records || 0;
          const weekConversions = syncResult.summary?.conversions || 0;
          totalRecords += weekRecords;
          totalConversions += weekConversions;
          successfulWeeks++;
          console.log(`[MONTH-IMPORT] Week ${i + 1} ✓: ${weekRecords} records`);
        } else {
          failedWeeks++;
          console.log(`[MONTH-IMPORT] Week ${i + 1} ✗: ${syncResult.error || 'Unknown error'}`);
        }
      } catch (weekError) {
        failedWeeks++;
        console.log(`[MONTH-IMPORT] Week ${i + 1} ✗: ${weekError instanceof Error ? weekError.message : 'Unknown error'}`);
      }
      
      // Delay between weeks to avoid rate limiting
      if (i < weeks.length - 1) {
        await delay(2000);
      }
    }
    
    console.log(`[MONTH-IMPORT] ✓ ${monthName} ${year}: ${totalRecords} records total (${successfulWeeks}/${weeks.length} weeks ok)`);
    
    // Update status based on results
    const finalStatus = failedWeeks === weeks.length ? 'error' : 'success';
    
    await supabase
      .from('project_import_months')
      .update({
        status: finalStatus,
        records_count: totalRecords,
        completed_at: new Date().toISOString(),
        error_message: failedWeeks > 0 ? `${failedWeeks}/${weeks.length} weeks failed` : null,
      })
      .eq('project_id', project_id)
      .eq('year', year)
      .eq('month', month);
    
    // Log success
    await supabase.from('sync_logs').insert({
      project_id,
      status: finalStatus,
      message: JSON.stringify({
        type: 'month_import',
        month: `${year}-${month}`,
        month_name: `${monthName} ${year}`,
        records: totalRecords,
        weeks: { total: weeks.length, success: successfulWeeks, failed: failedWeeks },
      }),
    });
    
    // If continue_chain is true, trigger next month
    let nextMonthTriggered = false;
    if (continue_chain) {
      const nextMonth = getNextMonth(year, month);
      if (nextMonth) {
        console.log(`[MONTH-IMPORT] Triggering next: ${getMonthName(nextMonth.month)} ${nextMonth.year}`);
        
        // Fire and forget
        fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            project_id,
            year: nextMonth.year,
            month: nextMonth.month,
            continue_chain: true,
            safe_mode,
          }),
        }).catch(err => console.error('[MONTH-IMPORT] Failed to trigger next:', err));
        
        nextMonthTriggered = true;
      } else {
        console.log('[MONTH-IMPORT] Reached current month, chain complete');
      }
    }
    
    console.log(`[MONTH-IMPORT] ✓ ${monthName} ${year} completed successfully`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `${monthName} ${year} imported successfully`,
        records: totalRecords,
        weeks: { total: weeks.length, success: successfulWeeks, failed: failedWeeks },
        next_month_triggered: nextMonthTriggered,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MONTH-IMPORT] Error:', errorMessage);
    
    // Try to update status to error
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
      
      // If chain mode, still try to continue with next month
      if (body.continue_chain) {
        const nextMonth = getNextMonth(body.year, body.month);
        if (nextMonth) {
          fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              project_id: body.project_id,
              year: nextMonth.year,
              month: nextMonth.month,
              continue_chain: true,
              safe_mode: body.safe_mode,
            }),
          }).catch(() => {});
        }
      }
    } catch {}
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
