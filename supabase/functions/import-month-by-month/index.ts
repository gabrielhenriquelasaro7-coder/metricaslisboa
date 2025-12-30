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

function getMonthDateRange(year: number, month: number): { since: string; until: string } {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
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
  
  if (nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth)) {
    return null;
  }
  
  return { year: nextYear, month: nextMonth };
}

function getMonthName(month: number): string {
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[month - 1] || 'Unknown';
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
      // Update existing record
      await supabase
        .from('project_import_months')
        .update({
          status: 'importing',
          started_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', existingMonth.id);
    } else {
      // Create new record
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
    
    // Get date range
    const { since, until } = getMonthDateRange(year, month);
    console.log(`[MONTH-IMPORT] Date range: ${since} to ${until}`);
    
    // Call meta-ads-sync
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        project_id,
        ad_account_id: project.ad_account_id,
        time_range: { since, until },
      }),
    });
    
    const syncResult = await syncResponse.json();
    
    if (!syncResponse.ok || !syncResult.success) {
      throw new Error(syncResult.error || `Sync failed with status ${syncResponse.status}`);
    }
    
    const recordsCount = syncResult.data?.daily_records_count || syncResult.count || 0;
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
      .eq('project_id', project_id)
      .eq('year', year)
      .eq('month', month);
    
    // Update retry count (optional)
    const { data: monthRecord } = await supabase
      .from('project_import_months')
      .select('retry_count')
      .eq('project_id', project_id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    
    if (monthRecord) {
      await supabase
        .from('project_import_months')
        .update({ retry_count: (monthRecord.retry_count || 0) + 1 })
        .eq('project_id', project_id)
        .eq('year', year)
        .eq('month', month);
    }
    
    // Log success
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: JSON.stringify({
        type: 'month_import',
        month: `${year}-${month}`,
        month_name: `${monthName} ${year}`,
        records: recordsCount,
      }),
    });
    
    // If continue_chain is true, trigger next month in a SEPARATE request
    // This avoids the timeout issues with waitUntil
    let nextMonthTriggered = false;
    if (continue_chain) {
      const nextMonth = getNextMonth(year, month);
      if (nextMonth) {
        console.log(`[MONTH-IMPORT] Triggering next: ${getMonthName(nextMonth.month)} ${nextMonth.year}`);
        
        // Fire and forget - don't await
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
        records: recordsCount,
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
