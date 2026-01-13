import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================================================================
// NOVA ARQUITETURA DE IMPORTAÇÃO MENSAL
// 
// Full Sync = Month Base Sync → Creative Sync → HD Image Sync (não bloqueante)
//
// 1️⃣ Month Base Sync: métricas + estrutura (mês inteiro, SEM divisão)
// 2️⃣ Creative Sync: conteúdo dos anúncios (executar após base sync)
// 3️⃣ HD Image Sync: imagens em alta resolução (assíncrono, não bloqueia UI)
//
// ⚠️ REMOVIDO: lógica de importação quinzenal/semanal/diária
// ===========================================================================================

interface MonthImportRequest {
  project_id: string;
  year: number;
  month: number;
  continue_chain?: boolean;
  ad_account_id?: string;
  max_month?: number;
  phase?: 'base' | 'creatives' | 'hd_images';
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

// Delay baseado no tamanho da conta para encadeamento
function calculateChainDelay(adsCount: number): number {
  if (adsCount > 500) return 10000;
  if (adsCount > 300) return 7000;
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
      phase = 'base',
    } = body;
    
    if (!project_id || !year || !month) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const monthName = getMonthName(month);
    
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
    
    // ========================================================================
    // FASE 2: CREATIVE SYNC (após base sync de todos os meses)
    // ========================================================================
    if (phase === 'creatives') {
      console.log(`[MONTH-IMPORT] 📝 CREATIVE SYNC for ${project.name}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min
      
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
            syncMode: 'creatives',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const result = await syncResponse.json().catch(() => ({ success: true }));
        
        console.log(`[MONTH-IMPORT] ✓ Creative sync completed: ${result.updated || 0} ads`);
        
        // Encadear HD Image Sync (não bloqueante)
        console.log(`[MONTH-IMPORT] 🖼️ Starting HD Image Sync (async)...`);
        
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
            phase: 'hd_images',
          }),
        }).catch(e => console.log(`[MONTH-IMPORT] HD chain error: ${e}`));
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            phase: 'creatives',
            updated: result.updated || 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.log(`[MONTH-IMPORT] Creative sync error: ${fetchError.message}`);
        return new Response(
          JSON.stringify({ success: false, error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ========================================================================
    // FASE 3: HD IMAGE SYNC (assíncrono, não bloqueia UI)
    // ========================================================================
    if (phase === 'hd_images') {
      console.log(`[MONTH-IMPORT] 🖼️ HD IMAGE SYNC for ${project.name}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min (imagens demoram)
      
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
            syncMode: 'hd_images',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const result = await syncResponse.json().catch(() => ({ success: true }));
        
        console.log(`[MONTH-IMPORT] ✓ HD Image sync completed: ${result.cached || 0}/${result.total || 0}`);
        
        // Atualizar last_sync_at
        await supabase.from('projects').update({
          last_sync_at: new Date().toISOString(),
        }).eq('id', project_id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            phase: 'hd_images',
            cached: result.cached || 0,
            total: result.total || 0,
            errors: result.errors || 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // Falhas de HD Image NÃO interrompem o sistema (conforme especificação)
        console.log(`[MONTH-IMPORT] HD Image sync error (non-blocking): ${fetchError.message}`);
        return new Response(
          JSON.stringify({ success: true, phase: 'hd_images', error: fetchError.message, non_blocking: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ========================================================================
    // FASE 1: MONTH BASE SYNC (métricas + estrutura)
    // Mês inteiro, SEM divisão quinzenal/semanal
    // ========================================================================
    console.log(`[MONTH-IMPORT] 📊 BASE SYNC - ${monthName} ${year} for ${project.name}`);
    
    // Contar ads para delay de encadeamento
    const { count: adsCount } = await supabase
      .from('ads')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id);
    
    const chainDelay = calculateChainDelay(adsCount || 0);
    
    console.log(`[MONTH-IMPORT] Project: ${project.name} (${adsCount || 0} ads)`);
    
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
    
    // Calcular range do MÊS INTEIRO (SEM divisão)
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    const since = formatDate(firstDay);
    const until = formatDate(lastDay);
    
    console.log(`[MONTH-IMPORT] Range: ${since} to ${until} (full month)`);
    
    // Chamar meta-ads-sync com syncMode: 'base'
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min para o mês inteiro
    
    let syncResult: any = null;
    let hasError = false;
    let errorMessage: string | null = null;
    
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
          time_range: { since, until },
          syncMode: 'base',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const responseText = await syncResponse.text();
      
      try {
        syncResult = JSON.parse(responseText);
      } catch {
        syncResult = syncResponse.ok ? { success: true, summary: { records: 0 } } : { success: false, error: 'Invalid response' };
      }
      
      if (!syncResponse.ok || syncResult.success === false) {
        hasError = true;
        errorMessage = syncResult.error || 'Sync failed';
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      hasError = true;
      
      if (fetchError.name === 'AbortError') {
        errorMessage = 'Timeout';
        console.log(`[MONTH-IMPORT] Timeout on ${monthName} ${year}`);
      } else {
        errorMessage = fetchError.message;
        console.log(`[MONTH-IMPORT] Fetch error: ${fetchError.message}`);
      }
    }
    
    // Determinar registros salvos
    let totalRecords = syncResult?.summary?.records || 0;
    
    // Se timeout, verificar banco
    if (errorMessage === 'Timeout') {
      await delay(5000);
      const { count: recordsCount } = await supabase
        .from('ads_daily_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project_id)
        .gte('date', since)
        .lte('date', until);
      
      if ((recordsCount || 0) > 0) {
        console.log(`[MONTH-IMPORT] Found ${recordsCount} records in DB after timeout - SUCCESS`);
        totalRecords = recordsCount || 0;
        hasError = false;
        errorMessage = null;
      }
    }
    
    // Determinar status final
    let status = hasError ? 'error' : 'success';
    
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
    
    console.log(`[MONTH-IMPORT] ${monthName} ${year} - status: ${status}, records: ${totalRecords}`);
    
    // Log de sync
    await supabase.from('sync_logs').insert({
      project_id,
      status,
      message: JSON.stringify({
        type: 'month_base_sync',
        month: `${year}-${month}`,
        month_name: `${monthName} ${year}`,
        records: totalRecords,
      }),
    });
    
    // ========================================================================
    // ENCADEAMENTO - USANDO AWAIT PARA GARANTIR QUE A REQUISIÇÃO SEJA ENVIADA
    // ========================================================================
    const effectiveMaxMonth = max_month || 12;
    const nextMonthData = getNextMonth(year, month);
    
    if (continue_chain && status === 'success' && nextMonthData) {
      // Verificar se próximo mês está dentro do limite
      if (nextMonthData.month <= effectiveMaxMonth || nextMonthData.year > year) {
        console.log(`[MONTH-IMPORT] Chaining to ${getMonthName(nextMonthData.month)} ${nextMonthData.year} in ${chainDelay/1000}s...`);
        
        await delay(chainDelay);
        
        // Próximo mês (base sync) - AWAIT para garantir que a requisição seja enviada
        try {
          const chainController = new AbortController();
          const chainTimeout = setTimeout(() => chainController.abort(), 5000); // 5s para iniciar
          
          const chainResponse = await fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
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
              phase: 'base',
            }),
            signal: chainController.signal,
          });
          clearTimeout(chainTimeout);
          
          console.log(`[MONTH-IMPORT] ✓ Chain initiated to ${getMonthName(nextMonthData.month)} ${nextMonthData.year} (status: ${chainResponse.status})`);
        } catch (chainErr: any) {
          // Se der timeout, tudo bem - a requisição foi enviada
          if (chainErr.name === 'AbortError') {
            console.log(`[MONTH-IMPORT] ✓ Chain request sent (async) to ${getMonthName(nextMonthData.month)} ${nextMonthData.year}`);
          } else {
            console.log(`[MONTH-IMPORT] Chain error: ${chainErr.message}`);
          }
        }
        
      } else {
        // ========================================================================
        // TODOS OS MESES IMPORTADOS - Iniciar Creative Sync
        // ========================================================================
        console.log(`[MONTH-IMPORT] 🎉 All months imported! Starting Creative Sync...`);
        
        await delay(5000);
        
        // Chamar fase de criativos - AWAIT para garantir envio
        try {
          const creativeController = new AbortController();
          const creativeTimeout = setTimeout(() => creativeController.abort(), 5000);
          
          await fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
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
              phase: 'creatives',
            }),
            signal: creativeController.signal,
          });
          clearTimeout(creativeTimeout);
          
          console.log(`[MONTH-IMPORT] ✓ Creative sync chain initiated`);
        } catch (creativeErr: any) {
          if (creativeErr.name === 'AbortError') {
            console.log(`[MONTH-IMPORT] ✓ Creative sync request sent (async)`);
          } else {
            console.log(`[MONTH-IMPORT] Creatives chain error: ${creativeErr.message}`);
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: status === 'success',
        phase: 'base',
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
