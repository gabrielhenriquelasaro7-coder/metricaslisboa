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
  max_month?: number;
  fetch_creatives_only?: boolean; // Nova flag para só puxar criativos
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

// Calcular delay baseado no tamanho da conta
function calculateDelay(adsCount: number): number {
  if (adsCount > 500) return 15000;
  if (adsCount > 300) return 10000;
  if (adsCount > 100) return 5000;
  return 3000;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    const body: MonthImportRequest = await req.json();
    const { 
      project_id, 
      year, 
      month, 
      continue_chain = false, 
      ad_account_id, 
      max_month,
      fetch_creatives_only = false,
    } = body;
    
    if (!project_id || !year || !month) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const monthName = getMonthName(month);
    
    // ========================================================================
    // MODO ESPECIAL: Só puxar criativos (fase final)
    // ========================================================================
    if (fetch_creatives_only) {
      console.log(`[MONTH-IMPORT] 🎨 CREATIVES ONLY MODE - Fetching HD creatives for project ${project_id}`);
      
      // Buscar projeto
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('ad_account_id, name')
        .eq('id', project_id)
        .single();
      
      if (projectError || !project) {
        throw new Error(`Project not found: ${projectError?.message}`);
      }
      
      // Chamar meta-ads-sync com syncOnly=creatives para só puxar imagens HD
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min para criativos
      
      try {
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id,
            ad_account_id: ad_account_id || project.ad_account_id,
            date_preset: 'last_7d', // Período irrelevante para criativos
            light_sync: false, // Full sync para pegar criativos HD
            syncOnly: 'creatives', // NOVO: só puxar criativos
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const result = await syncResponse.json().catch(() => ({ success: true }));
        
        console.log(`[MONTH-IMPORT] 🎨 Creatives sync completed for ${project.name}`);
        
        // Atualizar last_sync_at
        await supabase.from('projects').update({
          last_sync_at: new Date().toISOString(),
        }).eq('id', project_id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Creatives HD fetched',
            phase: 'creatives_complete',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.log(`[MONTH-IMPORT] 🎨 Creatives fetch error: ${fetchError.message}`);
        return new Response(
          JSON.stringify({ success: false, error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ========================================================================
    // MODO NORMAL: Light Sync de métricas diárias
    // ========================================================================
    console.log(`[MONTH-IMPORT] 📊 LIGHT SYNC - ${monthName} ${year} for project ${project_id}`);
    
    // Buscar projeto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('ad_account_id, name')
      .eq('id', project_id)
      .single();
    
    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }
    
    const accountId = ad_account_id || project.ad_account_id;
    
    // Contar ads para calcular delay
    const { count: adsCount } = await supabase
      .from('ads')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id);
    
    const effectiveDelay = calculateDelay(adsCount || 0);
    
    console.log(`[MONTH-IMPORT] Project: ${project.name} (${adsCount || 0} ads, delay: ${effectiveDelay/1000}s)`);
    
    // Verificar se já está importando
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
    
    // Atualizar status para importing
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
    
    // Calcular range de datas
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    // ========================================================================
    // SEMPRE dividir em quinzenas para evitar erro 1504018
    // ========================================================================
    const midDay = new Date(year, month - 1, 15);
    const midDayNext = new Date(year, month - 1, 16);
    
    const periods = [
      { since: formatDate(firstDay), until: formatDate(midDay), label: '1ª quinzena' },
      { since: formatDate(midDayNext), until: formatDate(lastDay), label: '2ª quinzena' },
    ];
    
    console.log(`[MONTH-IMPORT] Splitting ${monthName} ${year} into 2 fortnights`);
    
    let totalRecords = 0;
    let hasError = false;
    let lastError: string | null = null;
    
    // Processar cada quinzena
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      console.log(`[MONTH-IMPORT] Processing ${period.label} (${period.since} to ${period.until})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min por quinzena
      
      try {
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id,
            ad_account_id: accountId,
            time_range: { since: period.since, until: period.until },
            light_sync: true, // SEMPRE light sync para métricas
            skip_image_cache: true, // Não puxar imagens agora
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const responseText = await syncResponse.text();
        let syncResult: any;
        
        try {
          syncResult = JSON.parse(responseText);
        } catch {
          console.log(`[MONTH-IMPORT] Response not JSON (status ${syncResponse.status})`);
          syncResult = syncResponse.ok ? { success: true, records: 0 } : { success: false, error: 'Invalid response' };
        }
        
        if (syncResponse.ok && syncResult.success !== false) {
          const periodRecords = syncResult.summary?.records || syncResult.records || 0;
          totalRecords += periodRecords;
          console.log(`[MONTH-IMPORT] ✓ ${period.label}: ${periodRecords} records`);
        } else {
          hasError = true;
          lastError = syncResult.error || 'Sync failed';
          console.log(`[MONTH-IMPORT] ✗ ${period.label}: ${lastError}`);
          
          // Se rate limit ou query muito grande, parar
          if (lastError?.includes('rate') || lastError?.includes('limit') || lastError?.includes('1504018') || lastError?.includes('expirou')) {
            console.log(`[MONTH-IMPORT] Stopping due to API limit`);
            break;
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.log(`[MONTH-IMPORT] Timeout on ${period.label} - checking DB...`);
          
          await delay(5000);
          
          const { count: recordsCount } = await supabase
            .from('ads_daily_metrics')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project_id)
            .gte('date', period.since)
            .lte('date', period.until);
          
          if ((recordsCount || 0) > 0) {
            console.log(`[MONTH-IMPORT] Found ${recordsCount} records in DB - SUCCESS`);
            totalRecords += recordsCount || 0;
          } else {
            hasError = true;
            lastError = 'Timeout';
          }
        } else {
          console.log(`[MONTH-IMPORT] Fetch error: ${fetchError.message}`);
          hasError = true;
          lastError = fetchError.message;
        }
      }
      
      // Delay entre quinzenas
      if (i < periods.length - 1) {
        console.log(`[MONTH-IMPORT] Waiting 8s before next period...`);
        await delay(8000);
      }
    }
    
    // Determinar status final
    let status = hasError ? 'error' : 'success';
    let errorMessage = lastError;
    
    // Se rate limited, marcar para retry
    if (lastError?.includes('rate') || lastError?.includes('limit')) {
      status = 'pending';
      errorMessage = 'Rate limit - retry later';
    }
    
    // Atualizar registro do mês
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
    
    console.log(`[MONTH-IMPORT] ${monthName} ${year} completed - status: ${status}, records: ${totalRecords}`);
    
    // Log de sync
    await supabase.from('sync_logs').insert({
      project_id,
      status,
      message: JSON.stringify({
        type: 'month_import_light',
        month: `${year}-${month}`,
        month_name: `${monthName} ${year}`,
        records: totalRecords,
      }),
    });
    
    // ========================================================================
    // ENCADEAR PRÓXIMO MÊS
    // ========================================================================
    const effectiveMaxMonth = max_month || 12;
    const nextMonthData = getNextMonth(year, month);
    
    if (continue_chain && status === 'success' && nextMonthData) {
      // Verificar se próximo mês está dentro do limite
      if (nextMonthData.month <= effectiveMaxMonth || nextMonthData.year > year) {
        console.log(`[MONTH-IMPORT] Chaining to ${getMonthName(nextMonthData.month)} ${nextMonthData.year} in ${effectiveDelay/1000}s...`);
        
        await delay(effectiveDelay);
        
        // Disparar próximo mês (fire and forget)
        fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id,
            year: nextMonthData.year,
            month: nextMonthData.month,
            continue_chain: true,
            ad_account_id: accountId,
            max_month: effectiveMaxMonth,
          }),
        }).catch(e => console.log(`[MONTH-IMPORT] Chain error: ${e}`));
        
      } else {
        // ========================================================================
        // FASE FINAL: Todos os meses importados, puxar criativos HD
        // ========================================================================
        console.log(`[MONTH-IMPORT] 🎉 All months imported! Now fetching HD creatives...`);
        
        await delay(5000);
        
        // Chamar com fetch_creatives_only
        fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id,
            year,
            month,
            ad_account_id: accountId,
            fetch_creatives_only: true,
          }),
        }).catch(e => console.log(`[MONTH-IMPORT] Creatives chain error: ${e}`));
      }
    }
    
    return new Response(
      JSON.stringify({
        success: status === 'success',
        month: `${monthName} ${year}`,
        records: totalRecords,
        status,
        error: errorMessage,
        next: continue_chain && nextMonthData ? `${getMonthName(nextMonthData.month)} ${nextMonthData.year}` : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[MONTH-IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
