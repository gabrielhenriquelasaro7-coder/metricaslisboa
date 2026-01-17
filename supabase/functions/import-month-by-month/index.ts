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
  phase?: 'base' | 'creatives' | 'hd_images' | 'retry_failed';
  // Novo: suporte a importação em chunks (quinzenas/semanas)
  chunk?: 1 | 2 | 3 | 4; // 1=dias 1-7, 2=dias 8-15, 3=dias 16-23, 4=dias 24-fim
  use_chunks?: boolean; // Forçar uso de chunks para contas grandes
  force_light_sync?: boolean; // Se true, não faz creative sync após base sync
  safe_mode?: boolean; // Modo seguro (legado)
  parallel_next_month?: number; // Para sync paralelo de anos
  parallel_batch_size?: number;
  skip_on_error?: boolean; // Se true, continua para próximo mês se falhar
  failed_months?: Array<{ year: number; month: number }>; // Meses que falharam para retry
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

// Calcular range de datas para um chunk específico
function getChunkDateRange(year: number, month: number, chunk: 1 | 2 | 3 | 4): { since: string; until: string } {
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  
  let startDay: number, endDay: number;
  
  switch (chunk) {
    case 1: startDay = 1; endDay = 7; break;
    case 2: startDay = 8; endDay = 15; break;
    case 3: startDay = 16; endDay = 23; break;
    case 4: startDay = 24; endDay = lastDayOfMonth; break;
  }
  
  const since = formatDate(new Date(year, month - 1, startDay));
  const until = formatDate(new Date(year, month - 1, Math.min(endDay, lastDayOfMonth)));
  
  return { since, until };
}

// Verificar se a conta é grande (precisa de chunks)
async function isLargeAccount(supabase: any, projectId: string): Promise<boolean> {
  // Verificar quantidade de dados em qualquer mês anterior
  const { count } = await supabase
    .from('ads_daily_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);
  
  // Se já tem muitos registros, provavelmente é conta grande
  if ((count || 0) > 10000) return true;
  
  // Verificar número de ads
  const { count: adsCount } = await supabase
    .from('ads')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);
  
  return (adsCount || 0) > 200;
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
      chunk,
      use_chunks = false,
      force_light_sync = false,
      skip_on_error = true, // NOVO: por padrão, continua mesmo se falhar
      failed_months = [], // NOVO: lista de meses que falharam
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
    // FASE RETRY: Retentar meses que falharam
    // ========================================================================
    if (phase === 'retry_failed') {
      console.log(`[MONTH-IMPORT] 🔄 RETRY FAILED MONTHS for ${project.name}`);
      
      // Buscar meses com erro
      const { data: failedMonthsDb } = await supabase
        .from('project_import_months')
        .select('year, month')
        .eq('project_id', project_id)
        .eq('status', 'error')
        .order('year', { ascending: true })
        .order('month', { ascending: true });
      
      const monthsToRetry = failed_months.length > 0 ? failed_months : (failedMonthsDb || []);
      
      if (monthsToRetry.length === 0) {
        console.log(`[MONTH-IMPORT] No failed months to retry`);
        return new Response(
          JSON.stringify({ success: true, phase: 'retry_failed', message: 'No failed months' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[MONTH-IMPORT] Found ${monthsToRetry.length} failed months to retry`);
      
      // Retentar o primeiro mês da lista
      const firstFailed = monthsToRetry[0];
      const remainingFailed = monthsToRetry.slice(1);
      
      // Resetar status para pending (buscar retry_count atual primeiro)
      const { data: currentMonth } = await supabase
        .from('project_import_months')
        .select('retry_count')
        .eq('project_id', project_id)
        .eq('year', firstFailed.year)
        .eq('month', firstFailed.month)
        .maybeSingle();
      
      await supabase
        .from('project_import_months')
        .update({
          status: 'pending',
          error_message: null,
          retry_count: (currentMonth?.retry_count || 0) + 1,
        })
        .eq('project_id', project_id)
        .eq('year', firstFailed.year)
        .eq('month', firstFailed.month);
      
      // Chamar importação do mês com chunks menores
      try {
        await fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            project_id,
            year: firstFailed.year,
            month: firstFailed.month,
            ad_account_id: accountId,
            phase: 'base',
            use_chunks: true, // Forçar chunks no retry
            chunk: 1,
            continue_chain: remainingFailed.length > 0,
            skip_on_error: true,
            failed_months: remainingFailed, // Passar os restantes
          }),
        });
        console.log(`[MONTH-IMPORT] ✓ Retry initiated for ${getMonthName(firstFailed.month)} ${firstFailed.year}`);
      } catch (e) {
        console.log(`[MONTH-IMPORT] Retry call sent`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          phase: 'retry_failed',
          retrying: `${getMonthName(firstFailed.month)} ${firstFailed.year}`,
          remaining: remainingFailed.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ========================================================================
    // FASE 2: CREATIVE SYNC OTIMIZADO
    // - Busca ad_ids únicos do período recente (últimos 90 dias) no banco
    // - Passa essa lista para o meta-ads-sync para buscar criativos HD apenas desses
    // - MUITO mais rápido: em vez de 6700 ads, busca apenas ~50-200 ativos
    // ========================================================================
    if (phase === 'creatives') {
      console.log(`[MONTH-IMPORT] 📝 CREATIVE SYNC (OPTIMIZED) for ${project.name}`);
      
      // Buscar ad_ids únicos dos últimos 90 dias de métricas
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const since90 = ninetyDaysAgo.toISOString().split('T')[0];
      
      const { data: recentAds } = await supabase
        .from('ads_daily_metrics')
        .select('ad_id')
        .eq('project_id', project_id)
        .gte('date', since90)
        .gt('spend', 0); // Apenas ads com gasto
      
      // Extrair ad_ids únicos
      const uniqueAdIds = [...new Set((recentAds || []).map((r: any) => r.ad_id))];
      console.log(`[MONTH-IMPORT] Found ${uniqueAdIds.length} unique ads with activity in last 90 days`);
      
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
            specific_ad_ids: uniqueAdIds.length > 0 ? uniqueAdIds : undefined, // OTIMIZAÇÃO!
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const result = await syncResponse.json().catch(() => ({ success: true }));
        
        console.log(`[MONTH-IMPORT] ✓ Creative sync completed: ${result.creatives?.updated || 0} ads, optimized: ${result.optimized || false}`);
        
        // HD Images já são feitas dentro do syncMode: 'creatives'
        // Então não precisamos encadear mais nada
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            phase: 'creatives',
            updated: result.creatives?.updated || 0,
            optimized: result.optimized || false,
            specificAdsCount: uniqueAdIds.length,
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
    // Suporta chunks (semanas) para contas grandes
    // ========================================================================
    
    // Verificar se deve usar chunks (contas grandes)
    const shouldUseChunks = use_chunks || await isLargeAccount(supabase, project_id);
    const currentChunk = chunk || 1;
    
    const chunkLabel = shouldUseChunks ? ` [chunk ${currentChunk}/4]` : '';
    console.log(`[MONTH-IMPORT] 📊 BASE SYNC - ${monthName} ${year}${chunkLabel} for ${project.name}`);
    
    // Contar ads para delay de encadeamento
    const { count: adsCount } = await supabase
      .from('ads')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id);
    
    const chainDelay = calculateChainDelay(adsCount || 0);
    
    console.log(`[MONTH-IMPORT] Project: ${project.name} (${adsCount || 0} ads, chunks: ${shouldUseChunks})`);
    
    // Verificar se já está importando (apenas no chunk 1)
    const { data: existingMonth } = await supabase
      .from('project_import_months')
      .select('id, status, records_count')
      .eq('project_id', project_id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    
    // Se é chunk 1 e já está importando, skip
    if (currentChunk === 1 && existingMonth?.status === 'importing') {
      console.log(`[MONTH-IMPORT] ${monthName} ${year} already importing, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: 'Already importing', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Atualizar status para importing (apenas no chunk 1)
    if (currentChunk === 1) {
      if (existingMonth) {
        await supabase
          .from('project_import_months')
          .update({
            status: 'importing',
            started_at: new Date().toISOString(),
            error_message: null,
            records_count: 0,
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
    }
    
    // Calcular range de datas
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    let since: string, until: string;
    
    if (shouldUseChunks) {
      // Usar chunk específico (semana)
      const chunkRange = getChunkDateRange(year, month, currentChunk as 1 | 2 | 3 | 4);
      since = chunkRange.since;
      until = chunkRange.until;
      console.log(`[MONTH-IMPORT] Range: ${since} to ${until} (chunk ${currentChunk})`);
    } else {
      // Mês inteiro
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      since = formatDate(firstDay);
      until = formatDate(lastDay);
      console.log(`[MONTH-IMPORT] Range: ${since} to ${until} (full month)`);
    }
    
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
          lite_mode: shouldUseChunks, // Contas grandes usam lite_mode
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
    
    // Determinar registros salvos neste chunk
    let chunkRecords = syncResult?.summary?.records || 0;
    
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
        chunkRecords = recordsCount || 0;
        hasError = false;
        errorMessage = null;
      }
    }
    
    // Se usando chunks e deu erro, tentar com chunks menores
    if (hasError && !shouldUseChunks) {
      console.log(`[MONTH-IMPORT] Full month failed, retrying with chunks...`);
      
      // Resetar status e tentar com chunks
      await supabase
        .from('project_import_months')
        .update({
          status: 'pending',
          error_message: 'Retrying with chunks',
        })
        .eq('project_id', project_id)
        .eq('year', year)
        .eq('month', month);
      
      // Chamar novamente com chunks habilitados
      try {
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
            continue_chain,
            ad_account_id: accountId,
            max_month,
            phase: 'base',
            use_chunks: true,
            chunk: 1,
          }),
        });
      } catch (e) {
        console.log(`[MONTH-IMPORT] Chunk retry call sent`);
      }
      
      return new Response(
        JSON.stringify({ success: true, retrying_with_chunks: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Se usando chunks, acumular records e decidir próximo passo
    if (shouldUseChunks) {
      // Buscar total atual de records do mês
      const { data: monthData } = await supabase
        .from('project_import_months')
        .select('records_count')
        .eq('project_id', project_id)
        .eq('year', year)
        .eq('month', month)
        .single();
      
      const previousRecords = monthData?.records_count || 0;
      const totalRecords = previousRecords + chunkRecords;
      
      // Atualizar contagem parcial
      await supabase
        .from('project_import_months')
        .update({
          records_count: totalRecords,
          error_message: hasError ? errorMessage : null,
        })
        .eq('project_id', project_id)
        .eq('year', year)
        .eq('month', month);
      
      console.log(`[MONTH-IMPORT] ${monthName} ${year} chunk ${currentChunk} - records: ${chunkRecords} (total: ${totalRecords})`);
      
      // Se não é o último chunk e não deu erro, encadear próximo chunk
      if (!hasError && currentChunk < 4) {
        const nextChunk = (currentChunk + 1) as 1 | 2 | 3 | 4;
        console.log(`[MONTH-IMPORT] Chaining to chunk ${nextChunk}...`);
        
        await delay(2000);
        
        try {
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
              continue_chain,
              ad_account_id: accountId,
              max_month,
              phase: 'base',
              use_chunks: true,
              chunk: nextChunk,
            }),
          });
        } catch (e) {
          console.log(`[MONTH-IMPORT] Chunk ${nextChunk} call sent`);
        }
        
        return new Response(
          JSON.stringify({ success: true, phase: 'base', chunk: currentChunk, records: chunkRecords, next_chunk: nextChunk }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Último chunk ou erro - finalizar mês
      const status = hasError ? 'error' : 'success';
      await supabase
        .from('project_import_months')
        .update({
          status,
          completed_at: status === 'success' ? new Date().toISOString() : null,
          error_message: hasError ? errorMessage : null,
        })
        .eq('project_id', project_id)
        .eq('year', year)
        .eq('month', month);
      
      console.log(`[MONTH-IMPORT] ${monthName} ${year} - COMPLETED (chunks) - status: ${status}, total records: ${totalRecords}`);
      
      // Log de sync
      await supabase.from('sync_logs').insert({
        project_id,
        status,
        message: JSON.stringify({
          type: 'month_base_sync_chunked',
          month: `${year}-${month}`,
          month_name: `${monthName} ${year}`,
          records: totalRecords,
          chunks: 4,
        }),
      });
      
      // NOVA LÓGICA: Continuar encadeamento MESMO se falhar (skip_on_error)
      // Acumular meses com erro para retry no final
      const updatedFailedMonths = hasError 
        ? [...failed_months, { year, month }] 
        : failed_months;
      
      if (continue_chain) {
        const nextMonthData = getNextMonth(year, month);
        const effectiveMaxMonth = max_month || 12;
        
        if (nextMonthData && (nextMonthData.month <= effectiveMaxMonth || nextMonthData.year > year)) {
          // Continuar para próximo mês (independente de sucesso/erro se skip_on_error)
          if (status === 'success' || skip_on_error) {
            console.log(`[MONTH-IMPORT] Chaining to ${getMonthName(nextMonthData.month)} ${nextMonthData.year}... ${hasError ? '(previous failed, will retry later)' : ''}`);
            
            await delay(chainDelay);
            
            try {
              await fetch(`${supabaseUrl}/functions/v1/import-month-by-month`, {
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
                  use_chunks: true,
                  chunk: 1,
                  skip_on_error: true,
                  failed_months: updatedFailedMonths, // Passar meses que falharam
                }),
              });
            } catch (e) {
              console.log(`[MONTH-IMPORT] Next month chain sent`);
            }
          }
        } else {
          // Todos os meses tentados - verificar se há meses falhados para retry
          if (updatedFailedMonths.length > 0) {
            console.log(`[MONTH-IMPORT] 📋 Import complete! ${updatedFailedMonths.length} months failed, initiating retry...`);
            
            await delay(5000);
            
            try {
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
                  phase: 'retry_failed',
                  failed_months: updatedFailedMonths,
                }),
              });
            } catch (e) {
              console.log(`[MONTH-IMPORT] Retry failed months call sent`);
            }
          } else if (force_light_sync) {
            console.log(`[MONTH-IMPORT] 🎉 All months imported! (Light Sync - skipping creatives)`);
            
            await supabase.from('projects').update({
              last_sync_at: new Date().toISOString(),
            }).eq('id', project_id);
          } else {
            // HD Total - iniciar creative sync
            console.log(`[MONTH-IMPORT] 🎉 All months imported! Starting Creative Sync (HD)...`);
            await delay(5000);
            
            try {
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
              });
            } catch (e) {
              console.log(`[MONTH-IMPORT] Creative sync chain sent`);
            }
          }
        }
      }
      
      return new Response(
        JSON.stringify({ success: status === 'success', phase: 'base', month: `${monthName} ${year}`, records: totalRecords, chunked: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ========== MODO SEM CHUNKS (mês inteiro) ==========
    // Determinar status final
    let status = hasError ? 'error' : 'success';
    let totalRecords = chunkRecords;
    
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
    // ENCADEAMENTO COM SKIP-ON-ERROR
    // ========================================================================
    const effectiveMaxMonth = max_month || 12;
    const nextMonthData = getNextMonth(year, month);
    
    // Acumular meses que falharam
    const updatedFailedMonths = hasError 
      ? [...failed_months, { year, month }] 
      : failed_months;
    
    // Verificar se devemos continuar para próximo mês
    const hasNextMonth = nextMonthData && (nextMonthData.month <= effectiveMaxMonth || nextMonthData.year > year);
    const shouldContinue = continue_chain && (status === 'success' || skip_on_error);
    
    if (shouldContinue && hasNextMonth && nextMonthData) {
      console.log(`[MONTH-IMPORT] Chaining to ${getMonthName(nextMonthData.month)} ${nextMonthData.year} in ${chainDelay/1000}s... ${hasError ? '(previous failed, will retry later)' : ''}`);
      
      await delay(chainDelay);
      
      try {
        const chainController = new AbortController();
        const chainTimeout = setTimeout(() => chainController.abort(), 5000);
        
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
            skip_on_error: true,
            failed_months: updatedFailedMonths,
          }),
          signal: chainController.signal,
        });
        clearTimeout(chainTimeout);
        
        console.log(`[MONTH-IMPORT] ✓ Chain initiated to ${getMonthName(nextMonthData.month)} ${nextMonthData.year} (status: ${chainResponse.status})`);
      } catch (chainErr: any) {
        if (chainErr.name === 'AbortError') {
          console.log(`[MONTH-IMPORT] ✓ Chain request sent (async) to ${getMonthName(nextMonthData.month)} ${nextMonthData.year}`);
        } else {
          console.log(`[MONTH-IMPORT] Chain error: ${chainErr.message}`);
        }
      }
      
    } else if (continue_chain) {
      // ========================================================================
      // TODOS OS MESES TENTADOS - VERIFICAR SE HÁ FALHAS PARA RETRY
      // ========================================================================
      if (updatedFailedMonths.length > 0) {
        console.log(`[MONTH-IMPORT] 📋 Import complete! ${updatedFailedMonths.length} months failed, initiating retry...`);
        
        await delay(5000);
        
        try {
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
              phase: 'retry_failed',
              failed_months: updatedFailedMonths,
            }),
          });
          console.log(`[MONTH-IMPORT] ✓ Retry failed months initiated`);
        } catch (e) {
          console.log(`[MONTH-IMPORT] Retry call sent`);
        }
      } else if (force_light_sync) {
        console.log(`[MONTH-IMPORT] 🎉 All months imported! (Light Sync - skipping creatives)`);
        
        await supabase.from('projects').update({
          last_sync_at: new Date().toISOString(),
        }).eq('id', project_id);
      } else {
        console.log(`[MONTH-IMPORT] 🎉 All months imported! Starting Creative Sync (HD)...`);
        
        await delay(3000);
        
        try {
          const creativeController = new AbortController();
          const creativeTimeout = setTimeout(() => creativeController.abort(), 5000);
          
          await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
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
            signal: creativeController.signal,
          });
          clearTimeout(creativeTimeout);
          
          console.log(`[MONTH-IMPORT] ✓ Creative sync initiated directly`);
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
