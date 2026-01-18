import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================================================================
// NOVA ARQUITETURA DE SINCRONIZAÇÃO META ADS
// 
// 1️⃣ Month Base Sync (CORE) - syncMode: 'base'
//    - Responsabilidade: métricas + estrutura
//    - Range: mês inteiro (SEM divisão quinzenal/semanal)
//    - Busca: campaigns, adsets, ads (sem imagens HD)
//    - Insights: level=ad, campos básicos
//    - NÃO busca: creatives detalhados, image_hash, adimages
//    - Rápido e síncrono
//
// 2️⃣ Creative Sync (SEPARADO) - syncMode: 'creatives'
//    - Responsabilidade: conteúdo do anúncio
//    - Executar APÓS Month Base Sync
//    - SEM time_range
//    - Busca: creative_id, body, title, call_to_action, thumbnail_url (baixa resolução)
//    - NÃO busca: insights, métricas, imagens HD
//
// 3️⃣ HD Image Sync (ASSÍNCRONO) - syncMode: 'hd_images'
//    - Responsabilidade: imagens em alta resolução
//    - Executar em background
//    - Usa somente: adimages por image_hash
//    - Batch máximo: 20 hashes por request
//    - Delay entre requests: 30-60 segundos
//    - Retry com backoff exponencial
//    - Falhas NÃO interrompem o sistema
// ===========================================================================================

interface SyncRequest {
  project_id: string;
  ad_account_id?: string;
  access_token?: string;
  time_range?: { since: string; until: string };
  date_preset?: string;
  syncMode?: 'base' | 'creatives' | 'hd_images' | 'recache_hd' | 'story_hd';
  retry_count?: number;
  lite_mode?: boolean; // Skip entity fetch for large accounts
  specific_ad_ids?: string[]; // OTIMIZAÇÃO: buscar criativos/HD apenas desses ads
  force_recache?: boolean; // FORÇAR re-download mesmo se já tiver cache
}

const BASE_DELAY_MS = 200;
const MAX_RETRIES = 3;
const VALIDATION_RETRY_DELAYS = [5000, 10000, 20000];

const TRACKED_FIELDS_CAMPAIGN = ['status', 'objective'];
const TRACKED_FIELDS_ADSET = ['status', 'targeting'];
const TRACKED_FIELDS_AD = ['status', 'creative_image_url', 'creative_video_url', 'headline', 'primary_text', 'cta'];

const MESSAGING_ACTION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d', 
  'onsite_conversion.messaging_first_reply', 
  'onsite_conversion.total_messaging_connection'
];

const PROFILE_VISIT_ACTION_TYPES = ['ig_profile_visit', 'onsite_conversion.profile_view', 'profile_visit'];

function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

function extractId(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value.id) return String(value.id);
  return null;
}

function isRateLimitError(data: any): boolean {
  if (!data?.error) return false;
  const code = data.error.code;
  const msg = data.error.message || '';
  return code === 17 || code === '17' || msg.includes('User request limit reached') || msg.includes('rate limit');
}

function isTokenExpiredError(data: any): boolean {
  if (!data?.error) return false;
  const code = data.error.code;
  const subcode = data.error.error_subcode;
  const msg = (data.error.message || '').toLowerCase();
  return code === 190 || code === '190' || subcode === 463 || subcode === 467 || (msg.includes('access token') && (msg.includes('expired') || msg.includes('invalid')));
}

async function simpleFetch(url: string, options?: RequestInit, timeoutMs = 60000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Fetch failed';
    console.log(`[FETCH] Error: ${errMsg}`);
    return { error: { message: errMsg } };
  }
}

async function fetchWithRetry(url: string, entityName: string, customTimeoutMs?: number): Promise<any> {
  const timeoutMs = customTimeoutMs || (entityName === 'INSIGHTS' ? 120000 : 60000);
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const data = await simpleFetch(url, undefined, timeoutMs);
    if (!data.error) {
      if ((!data.data || data.data.length === 0) && entityName !== 'ADIMAGES') {
        console.log(`[${entityName}] Empty response - no data returned`);
      }
      return data;
    }
    
    const errMsg = data.error?.message || '';
    console.log(`[${entityName}] API Error (attempt ${attempt + 1}): ${JSON.stringify(data.error).substring(0, 300)}`);
    
    if (errMsg.includes('aborted') || errMsg.includes('timeout')) {
      if (attempt < MAX_RETRIES) {
        const waitTime = VALIDATION_RETRY_DELAYS[attempt] || 30000;
        console.log(`[${entityName}] Timeout, retry ${attempt + 1}/${MAX_RETRIES} in ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      }
    }
    
    if (isTokenExpiredError(data)) return data;
    if (isRateLimitError(data) && attempt < MAX_RETRIES) {
      const waitTime = VALIDATION_RETRY_DELAYS[attempt] || 30000;
      console.log(`[${entityName}] Rate limit, retry ${attempt + 1}/${MAX_RETRIES} in ${waitTime / 1000}s...`);
      await delay(waitTime);
      continue;
    }
    return data;
  }
  return { error: { message: 'Max retries exceeded' } };
}

// Helper to update sync progress
async function updateSyncProgress(supabase: any, projectId: string, step: string, message: string, current?: number, total?: number) {
  if (!projectId) return;
  try {
    const progress: Record<string, any> = { step, message, updated_at: new Date().toISOString() };
    if (current !== undefined) progress.current = current;
    if (total !== undefined) progress.total = total;
    await supabase.from('projects').update({ sync_progress: progress }).eq('id', projectId);
  } catch (e) {
    console.log(`[PROGRESS] Failed to update: ${e}`);
  }
}

// ===========================================================================================
// 1️⃣ MONTH BASE SYNC - Busca estrutura + métricas (SEM criativos HD)
// ===========================================================================================
async function fetchEntitiesBase(adAccountId: string, token: string): Promise<{
  campaigns: any[];
  adsets: any[];
  ads: any[];
  tokenExpired?: boolean;
}> {
  const campaigns: any[] = [], adsets: any[] = [], ads: any[] = [];

  const effectiveStatusFilter = encodeURIComponent('["ACTIVE","PAUSED","ARCHIVED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","PENDING_BILLING_INFO","CAMPAIGN_PAUSED","ADSET_PAUSED","IN_PROCESS","WITH_ISSUES"]');
  
  // Campaigns - campos básicos apenas
  let url: string | null = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'CAMPAIGNS');
    if (isTokenExpiredError(data)) return { campaigns: [], adsets: [], ads: [], tokenExpired: true };
    if (data.data) campaigns.push(...data.data);
    url = data.paging?.next || null;
  }
  
  // Adsets - campos básicos + targeting para tracking
  url = `https://graph.facebook.com/v22.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADSETS');
    if (isTokenExpiredError(data)) return { campaigns, adsets: [], ads: [], tokenExpired: true };
    if (data.data) adsets.push(...data.data);
    url = data.paging?.next || null;
  }
  
  // Ads - CAMPOS MÍNIMOS (sem creative detalhado)
  // Apenas id para vincular com insights
  url = `https://graph.facebook.com/v22.0/${adAccountId}/ads?fields=id,name,status,adset_id,campaign_id&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADS');
    if (isTokenExpiredError(data)) return { campaigns, adsets, ads: [], tokenExpired: true };
    if (data.data) ads.push(...data.data);
    url = data.paging?.next || null;
  }

  console.log(`[BASE-SYNC] Entities fetched - Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}`);
  
  return { campaigns, adsets, ads };
}

// Fetch daily insights - campos básicos apenas
// Divide em chunks de 7 dias para evitar erro 1504018 em contas grandes
async function fetchDailyInsights(adAccountId: string, token: string, since: string, until: string): Promise<Map<string, Map<string, any>>> {
  const dailyInsights = new Map<string, Map<string, any>>();
  
  // Campos básicos conforme especificação - incluindo instagram_profile_visits para campanhas de tráfego
  const fields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values,conversions,cost_per_action_type,results,cost_per_result,instagram_profile_visits';
  
  // Dividir período em chunks de 7 dias para evitar timeout da API
  const chunks = splitDateRangeIntoChunks(since, until, 7);
  console.log(`[INSIGHTS] Splitting ${since} to ${until} into ${chunks.length} chunks of max 7 days`);
  
  let totalRows = 0;
  
  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    console.log(`[INSIGHTS] Chunk ${chunkIdx + 1}/${chunks.length}: ${chunk.since} to ${chunk.until}`);
    
    const timeRange = JSON.stringify({ since: chunk.since, until: chunk.until });
    let url: string | null = `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=ad&limit=500&action_breakdowns=action_type&access_token=${token}`;
    
    let pageCount = 0;
    let chunkRows = 0;
    
    while (url) {
      pageCount++;
      
      const data = await fetchWithRetry(url, 'INSIGHTS', 120000);
      
      if (data.error) {
        console.log(`[INSIGHTS] Error on chunk ${chunkIdx + 1}, page ${pageCount}: ${data.error.message}`);
        // Continue to next chunk instead of failing completely
        break;
      }
      
      if (data.data) {
        for (const row of data.data) {
          const adId = extractId(row.ad_id);
          const dateKey = row.date_start;
          if (adId && dateKey) {
            if (!dailyInsights.has(adId)) dailyInsights.set(adId, new Map());
            dailyInsights.get(adId)!.set(dateKey, row);
            totalRows++;
            chunkRows++;
          }
        }
      }
      
      url = data.paging?.next || null;
      if (url) await delay(200);
    }
    
    console.log(`[INSIGHTS] Chunk ${chunkIdx + 1} completed: ${chunkRows} rows`);
    
    // Delay entre chunks para evitar rate limit
    if (chunkIdx < chunks.length - 1) {
      await delay(500);
    }
  }
  
  console.log(`[INSIGHTS] Total rows: ${totalRows}, Unique ads: ${dailyInsights.size}`);
  return dailyInsights;
}

// Helper: divide date range into chunks of N days
function splitDateRangeIntoChunks(since: string, until: string, maxDays: number): Array<{ since: string; until: string }> {
  const chunks: Array<{ since: string; until: string }> = [];
  const startDate = new Date(since);
  const endDate = new Date(until);
  
  let currentStart = new Date(startDate);
  
  while (currentStart <= endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + maxDays - 1);
    
    // Don't exceed the original end date
    if (currentEnd > endDate) {
      currentEnd.setTime(endDate.getTime());
    }
    
    chunks.push({
      since: currentStart.toISOString().split('T')[0],
      until: currentEnd.toISOString().split('T')[0]
    });
    
    // Move to next chunk
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return chunks;
}

// ===========================================================================================
// 2️⃣ CREATIVE SYNC - Busca conteúdo dos anúncios (SEM time_range, SEM métricas)
// Agora suporta 2 modos:
// - MODO PADRÃO: busca ads que precisam de criativo do banco
// - MODO OTIMIZADO: recebe lista de ad_ids específicos (dos insights) para buscar criativos
// ===========================================================================================
async function syncCreatives(
  supabase: any, 
  projectId: string, 
  adAccountId: string, 
  token: string,
  specificAdIds?: string[] // NOVO: lista específica de ad_ids (otimização)
): Promise<{ updated: number; total: number }> {
  console.log(`[CREATIVE-SYNC] Starting for project ${projectId}, specific ads: ${specificAdIds?.length || 'all'}`);
  
  let adsToProcess: { id: string; creative_id: string | null; headline: string | null; primary_text: string | null; cta: string | null; creative_thumbnail: string | null }[];
  
  if (specificAdIds && specificAdIds.length > 0) {
    // MODO OTIMIZADO: buscar criativos apenas dos ads específicos
    // Isso é MUITO mais rápido para contas grandes
    console.log(`[CREATIVE-SYNC] Optimized mode: fetching creatives for ${specificAdIds.length} specific ads`);
    
    // Dividir em batches de 200 para a query do banco
    const allAds: any[] = [];
    for (let i = 0; i < specificAdIds.length; i += 200) {
      const batchIds = specificAdIds.slice(i, i + 200);
      const { data: batchAds } = await supabase
        .from('ads')
        .select('id, creative_id, headline, primary_text, cta, creative_thumbnail')
        .eq('project_id', projectId)
        .in('id', batchIds);
      
      if (batchAds) allAds.push(...batchAds);
    }
    
    adsToProcess = allAds;
  } else {
    // MODO PADRÃO: buscar ads existentes que precisam de criativo
    const { data: existingAds, error: adsError } = await supabase
      .from('ads')
      .select('id, creative_id, headline, primary_text, cta, creative_thumbnail')
      .eq('project_id', projectId)
      .limit(500);
    
    if (adsError) throw adsError;
    
    // Filtrar ads sem texto
    adsToProcess = (existingAds || []).filter((ad: any) => 
      !ad.headline || !ad.primary_text
    );
  }
  
  console.log(`[CREATIVE-SYNC] Will process ${adsToProcess.length} ads`);
  
  if (adsToProcess.length === 0) {
    return { updated: 0, total: 0 };
  }
  
  // Limit to 300 ads per sync para não estourar timeout
  const adsToFetch = adsToProcess.slice(0, 300);
  const adIds = adsToFetch.map((ad: any) => ad.id);
  let updatedCount = 0;
  const batchSize = 50;
  const totalBatches = Math.ceil(adIds.length / batchSize);
  
  // Buscar creative data da API em batches de 50
  for (let i = 0; i < adIds.length; i += batchSize) {
    const batchNumber = Math.floor(i / batchSize) + 1;
    const batch = adIds.slice(i, i + batchSize);
    const batchIds = batch.join(',');
    
    // QUERY HD - thumbnail_url com parâmetros de resolução + object_story_spec para fallbacks
    // NOTA: "picture" e "image_url" NÃO existem no nível AdCreative - usar object_story_spec
    const adsUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=id,creative{id,body,title,call_to_action_type,thumbnail_url,object_story_spec,asset_feed_spec,effective_object_story_id}&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`;
    console.log(`[CREATIVE-SYNC] Batch ${batchNumber}: thumbnail_url + object_story_spec (HD 1080x1080)`);
    const adsData = await simpleFetch(adsUrl, undefined, 20000);
    
    if (adsData?.error) {
      console.log(`[CREATIVE-SYNC] Batch ${batchNumber} error: ${adsData.error.message?.substring(0, 100)}`);
      continue;
    }
    
    // Process batch - primeiro extrair dados, depois cachear imagens
    const adsToUpdate: { adId: string; updateData: any; thumbnailUrl: string | null }[] = [];
    
    for (const adId of batch) {
      const adData = adsData[adId];
      if (!adData?.creative) continue;
      
      const creative = adData.creative;
      let primaryText: string | null = null;
      let headline: string | null = null;
      let cta: string | null = null;
      let thumbnailUrl: string | null = null;
      
      // Extrair texto do asset_feed_spec (prioridade)
      if (creative.asset_feed_spec) {
        const afs = creative.asset_feed_spec;
        if (afs.bodies?.length > 0) primaryText = afs.bodies[0].text;
        if (afs.titles?.length > 0) headline = afs.titles[0].text;
        if (afs.call_to_action_types?.length > 0) cta = afs.call_to_action_types[0];
      }
      
      // Fallback para object_story_spec
      const oss = creative.object_story_spec;
      if (oss?.link_data) {
        if (!primaryText && oss.link_data.message) primaryText = oss.link_data.message;
        if (!headline && oss.link_data.name) headline = oss.link_data.name;
        if (!cta && oss.link_data.call_to_action?.type) cta = oss.link_data.call_to_action.type;
      }
      if (oss?.video_data) {
        if (!primaryText && oss.video_data.message) primaryText = oss.video_data.message;
        if (!headline && oss.video_data.title) headline = oss.video_data.title;
        if (!cta && oss.video_data.call_to_action?.type) cta = oss.video_data.call_to_action.type;
      }
      
      // Campos diretos do creative (fallback final)
      if (!primaryText && creative.body) primaryText = creative.body;
      if (!headline && creative.title) headline = creative.title;
      if (!cta && creative.call_to_action_type) cta = creative.call_to_action_type;
      
      // Imagem HD - ORDEM DE PRIORIDADE:
      // 1. thumbnail_url (já vem com 1080x1080 pelos parâmetros da query)
      if (creative.thumbnail_url) {
        thumbnailUrl = creative.thumbnail_url;
      }
      
      // 2. Fallback: imagens do object_story_spec (imagens originais)
      if (!thumbnailUrl && oss) {
        if (oss.link_data?.picture) thumbnailUrl = oss.link_data.picture;
        else if (oss.link_data?.image_url) thumbnailUrl = oss.link_data.image_url;
        else if (oss.video_data?.image_url) thumbnailUrl = oss.video_data.image_url;
        else if (oss.photo_data?.images?.[0]?.url) thumbnailUrl = oss.photo_data.images[0].url;
      }
      
      // LIMPAR URL - remover parâmetros de resize forçado (p64x64, etc)
      if (thumbnailUrl) {
        thumbnailUrl = thumbnailUrl.replace(/[&?]stp=[^&]*/gi, '');
        thumbnailUrl = thumbnailUrl.replace(/\/p\d+x\d+\//g, '/');
        thumbnailUrl = thumbnailUrl.replace(/\/s\d+x\d+\//g, '/');
        if (thumbnailUrl.includes('&') && !thumbnailUrl.includes('?')) {
          thumbnailUrl = thumbnailUrl.replace('&', '?');
        }
        thumbnailUrl = thumbnailUrl.replace(/[&?]$/g, '');
      }
      
      // Preparar dados de atualização
      const updateData: any = {
        creative_id: creative.id || null,
        synced_at: new Date().toISOString()
      };
      
      if (primaryText) updateData.primary_text = primaryText;
      if (headline) updateData.headline = headline;
      if (cta) updateData.cta = cta;
      if (thumbnailUrl) updateData.creative_thumbnail = thumbnailUrl;
      
      adsToUpdate.push({ adId, updateData, thumbnailUrl });
    }
    
    // FASE 2: Cachear imagens HD em paralelo (5 por vez) e salvar cached_image_url
    console.log(`[CREATIVE-SYNC] Caching ${adsToUpdate.filter(a => a.thumbnailUrl).length} HD images...`);
    
    for (let c = 0; c < adsToUpdate.length; c += 5) {
      const cacheBatch = adsToUpdate.slice(c, c + 5);
      
      await Promise.all(cacheBatch.map(async ({ adId, updateData, thumbnailUrl }) => {
        // Se tem thumbnail HD, fazer cache no Storage
        if (thumbnailUrl) {
          const cachedUrl = await cacheCreativeImage(supabase, projectId, adId, thumbnailUrl);
          if (cachedUrl) {
            updateData.cached_image_url = cachedUrl;
          }
        }
        
        // Atualizar o ad no banco
        await supabase.from('ads').update(updateData).eq('id', adId)
          .then(() => { updatedCount++; })
          .catch((e: any) => console.log(`[CREATIVE-SYNC] Update error for ${adId}: ${e.message}`));
      }));
    }
    
    console.log(`[CREATIVE-SYNC] Batch ${batchNumber}/${totalBatches} processed with HD cache`);
    if (i + batchSize < adIds.length) await delay(200);
  }
  
  console.log(`[CREATIVE-SYNC] Completed - updated ${updatedCount} ads`);
  return { updated: updatedCount, total: adsToFetch.length };
}

// ===========================================================================================
// 3️⃣ HD IMAGE SYNC - Busca imagens em HD usando thumbnail_url com width/height 1080
// 
// ESTRATÉGIA PRINCIPAL: Usar parâmetros thumbnail_width=1080 e thumbnail_height=1080
// na query de ads para obter thumbnails em alta resolução diretamente da API.
// 
// Fallbacks:
// 1. effective_object_story_id -> full_picture (imagem do post original)
// 2. object_story_spec -> link_data.picture, video_data.image_url
// 
// IMPORTANTE: Aceita imagens a partir de 500 bytes para não perder thumbnails válidas
// ===========================================================================================
// ===========================================================================================
// 3️⃣ HD IMAGE SYNC - Busca imagens em HD usando thumbnail_url com width/height 1080
// 
// ESTRATÉGIA OTIMIZADA:
// - Se specificAdIds fornecido: buscar HD apenas desses ads (otimização)
// - Se não: buscar HD de todos os ads sem cached_image_url (modo padrão)
// ===========================================================================================
async function syncHDImages(
  supabase: any, 
  projectId: string, 
  adAccountId: string, 
  token: string,
  specificAdIds?: string[] // NOVO: lista específica de ad_ids (otimização)
): Promise<{ cached: number; total: number; errors: number; pending: number; totalAds: number }> {
  console.log(`[HD-IMAGE-SYNC] Starting for project ${projectId}, specific ads: ${specificAdIds?.length || 'all'}`);
  
  // Primeiro, contar estatísticas gerais
  const { count: totalAds } = await supabase
    .from('ads')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);
  
  const { count: cachedAds } = await supabase
    .from('ads')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .not('cached_image_url', 'is', null);
  
  const pendingCount = (totalAds || 0) - (cachedAds || 0);
  console.log(`[HD-IMAGE-SYNC] Stats: ${cachedAds || 0}/${totalAds || 0} already cached, ${pendingCount} pending`);
  
  let adsNeedingCache: { id: string; creative_id: string | null; creative_thumbnail: string | null }[];
  
  if (specificAdIds && specificAdIds.length > 0) {
    // MODO OTIMIZADO: buscar HD apenas dos ads específicos que ainda não têm cache
    console.log(`[HD-IMAGE-SYNC] Optimized mode: checking ${specificAdIds.length} specific ads`);
    
    const allAds: any[] = [];
    for (let i = 0; i < specificAdIds.length; i += 200) {
      const batchIds = specificAdIds.slice(i, i + 200);
      const { data: batchAds } = await supabase
        .from('ads')
        .select('id, creative_id, creative_thumbnail')
        .eq('project_id', projectId)
        .in('id', batchIds)
        .is('cached_image_url', null);
      
      if (batchAds) allAds.push(...batchAds);
    }
    
    adsNeedingCache = allAds;
    console.log(`[HD-IMAGE-SYNC] Found ${adsNeedingCache.length} specific ads needing cache`);
  } else {
    // MODO PADRÃO: buscar ads que não têm cached_image_url
    const { data, error: adsError } = await supabase
      .from('ads')
      .select('id, creative_id, creative_thumbnail')
      .eq('project_id', projectId)
      .is('cached_image_url', null)
      .limit(200);
    
    if (adsError) throw adsError;
    adsNeedingCache = data || [];
  }
  
  if (adsNeedingCache.length === 0) {
    console.log(`[HD-IMAGE-SYNC] No ads to process`);
    return { cached: 0, total: 0, errors: 0, pending: pendingCount, totalAds: totalAds || 0 };
  }
  
  console.log(`[HD-IMAGE-SYNC] Processing ${adsNeedingCache.length} ads`);
  
  let cachedCount = 0;
  let errorsCount = 0;
  
  // ESTRATÉGIA NOVA: Buscar effective_object_story_id -> full_picture (SEMPRE HD)
  // Fallback: thumbnail_url com parâmetros HD
  const adIds = adsNeedingCache.map((ad: any) => ad.id);
  
  // Mapa de ad_id -> HD URL
  const adToHdUrlMap = new Map<string, string>();
  const adToCreativeIdMap = new Map<string, string>();
  
  // FASE 1: Buscar effective_object_story_id de todos os ads
  console.log(`[HD-IMAGE-SYNC] FASE 1: Buscando story_ids para imagens HD...`);
  const batchSize = 50;
  
  for (let i = 0; i < adIds.length; i += batchSize) {
    const batch = adIds.slice(i, i + batchSize);
    const batchIds = batch.join(',');
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(adIds.length / batchSize);
    
    await updateSyncProgress(supabase, projectId, 'hd_images', `Buscando story IDs: ${batchNumber}/${totalBatches}`, Math.round((batchNumber / totalBatches) * 20), 100);
    
    // Buscar creative com effective_object_story_id E thumbnail_url em HD
    const adsUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=id,creative{id,effective_object_story_id,thumbnail_url,object_story_spec}&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`;
    const adsData = await simpleFetch(adsUrl, undefined, 30000);
    
    if (adsData?.error) {
      console.log(`[HD-IMAGE-SYNC] Batch ${batchNumber} error: ${adsData.error.message?.substring(0, 100)}`);
      continue;
    }
    
    // Coletar story_ids para buscar full_picture
    const storyIds: string[] = [];
    const adToStoryMap = new Map<string, string>();
    
    for (const adId of batch) {
      const adData = (adsData as Record<string, any>)[adId];
      if (!adData?.creative) continue;
      
      const creative = adData.creative;
      if (creative.id) adToCreativeIdMap.set(adId, creative.id);
      
      // Prioridade 1: effective_object_story_id (imagem do post = HD)
      if (creative.effective_object_story_id) {
        storyIds.push(creative.effective_object_story_id);
        adToStoryMap.set(adId, creative.effective_object_story_id);
      }
      // Prioridade 2: thumbnail_url (já com 1080x1080)
      else if (creative.thumbnail_url) {
        adToHdUrlMap.set(adId, creative.thumbnail_url);
      }
      // Prioridade 3: imagem do object_story_spec
      else if (creative.object_story_spec) {
        const oss = creative.object_story_spec;
        if (oss.link_data?.picture) adToHdUrlMap.set(adId, oss.link_data.picture);
        else if (oss.video_data?.image_url) adToHdUrlMap.set(adId, oss.video_data.image_url);
      }
    }
    
    // Buscar full_picture dos story_ids (EM BATCH!)
    if (storyIds.length > 0) {
      const storyIdsStr = storyIds.join(',');
      const storiesUrl = `https://graph.facebook.com/v22.0/?ids=${storyIdsStr}&fields=id,full_picture,picture&access_token=${token}`;
      const storiesData = await simpleFetch(storiesUrl, undefined, 30000);
      
      if (!storiesData?.error) {
        for (const adId of batch) {
          const storyId = adToStoryMap.get(adId);
          if (storyId && storiesData[storyId]) {
            const story = storiesData[storyId];
            // full_picture é SEMPRE em HD!
            if (story.full_picture) {
              adToHdUrlMap.set(adId, story.full_picture);
            } else if (story.picture) {
              adToHdUrlMap.set(adId, story.picture);
            }
          }
        }
      }
    }
    
    if (i + batchSize < adIds.length) await delay(100);
  }
  
  console.log(`[HD-IMAGE-SYNC] Encontradas ${adToHdUrlMap.size} URLs HD`);
  
  // FASE 2: Cachear imagens HD usando as URLs coletadas
  console.log(`[HD-IMAGE-SYNC] FASE 2: Cacheando ${adToHdUrlMap.size} imagens HD...`);
  
  const adsWithUrls = adsNeedingCache.filter((ad: any) => adToHdUrlMap.has(ad.id));
  
  const cacheBatchSize = 5;
  for (let k = 0; k < adsWithUrls.length; k += cacheBatchSize) {
    const adBatch = adsWithUrls.slice(k, k + cacheBatchSize);
    const progressPercent = 20 + Math.round((k / adsWithUrls.length) * 70);
    await updateSyncProgress(supabase, projectId, 'hd_images', `Cacheando: ${k}/${adsWithUrls.length}`, progressPercent, 100);
    
    const promises = adBatch.map(async (ad: any) => {
      const hdUrl = adToHdUrlMap.get(ad.id);
      if (!hdUrl) return;
      
      try {
        const cachedUrl = await cacheCreativeImage(supabase, projectId, ad.id, hdUrl);
        if (cachedUrl) {
          await supabase.from('ads').update({ 
            cached_image_url: cachedUrl,
            creative_thumbnail: hdUrl,
            synced_at: new Date().toISOString()
          }).eq('id', ad.id);
          cachedCount++;
          console.log(`[HD-IMAGE-SYNC] ✓ Cached HD ${ad.id}`);
        } else {
          errorsCount++;
        }
      } catch (e) {
        console.log(`[HD-IMAGE-SYNC] Cache error for ${ad.id}: ${e}`);
        errorsCount++;
      }
    });
    
    await Promise.all(promises);
  }
  
  // FASE 3: Fallback para ads sem URL HD - tentar cacheCreativeImageRobust
  const adsWithoutHdUrl = adsNeedingCache.filter((ad: any) => !adToHdUrlMap.has(ad.id));
  if (adsWithoutHdUrl.length > 0) {
    console.log(`[HD-IMAGE-SYNC] FASE 3: Fallback para ${adsWithoutHdUrl.length} ads sem URL HD...`);
    
    for (let i = 0; i < adsWithoutHdUrl.length; i += batchSize) {
      const batch = adsWithoutHdUrl.slice(i, i + batchSize);
      const batchIds = batch.map((a: any) => a.id).join(',');
      
      // Tentar thumbnail_url HD como último recurso
      const adsUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=id,creative{id,thumbnail_url}&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`;
      const adsData = await simpleFetch(adsUrl, undefined, 30000);
      
      if (adsData?.error) continue;
      
      const cachePromises = batch.map(async (ad: any) => {
        const adData = (adsData as Record<string, any>)[ad.id];
        if (!adData?.creative?.thumbnail_url) return;
        
        const creativeId = adToCreativeIdMap.get(ad.id) || null;
        const cachedUrl = await cacheCreativeImageRobust(supabase, projectId, ad.id, adData.creative.thumbnail_url, creativeId, token);
        if (cachedUrl) {
          await supabase.from('ads').update({ 
            cached_image_url: cachedUrl,
            creative_thumbnail: adData.creative.thumbnail_url,
            synced_at: new Date().toISOString()
          }).eq('id', ad.id);
          cachedCount++;
        } else {
          errorsCount++;
        }
      });
      
      await Promise.all(cachePromises);
    }
  }
  
  const newPending = pendingCount - cachedCount;
  console.log(`[HD-IMAGE-SYNC] Completed - cached: ${cachedCount}, errors: ${errorsCount}, remaining: ${newPending}`);
  
  await updateSyncProgress(supabase, projectId, 'hd_images', `Concluído: ${cachedCount} imagens HD cacheadas`, 100, 100);
  
  return { cached: cachedCount, total: adsNeedingCache.length, errors: errorsCount, pending: newPending, totalAds: totalAds || 0 };
}

async function cacheCreativeImageRobust(
  supabase: any, 
  projectId: string, 
  adId: string, 
  imageUrl: string, 
  creativeId: string | null, 
  token: string
): Promise<string | null> {
  // Primeira tentativa
  let result = await cacheCreativeImage(supabase, projectId, adId, imageUrl);
  if (result) return result;
  
  // Se falhou com 403 e temos creativeId, tentar buscar imagem do post
  if (creativeId) {
    console.log(`[CACHE-RETRY] First attempt failed for ${adId}, trying alternatives`);
    try {
      // Buscar effective_object_story_id - usar thumbnail_width=1080 para HD
      const creativeUrl = `https://graph.facebook.com/v22.0/${creativeId}?fields=effective_object_story_id,thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`;
      const creativeData = await simpleFetch(creativeUrl, undefined, 10000);
      
      if (!creativeData?.error) {
        // Tentar imagem do post
        if (creativeData.effective_object_story_id) {
          const storyUrl = `https://graph.facebook.com/v22.0/${creativeData.effective_object_story_id}?fields=full_picture,picture&access_token=${token}`;
          const storyData = await simpleFetch(storyUrl, undefined, 10000);
          if (!storyData?.error && (storyData.full_picture || storyData.picture)) {
            const newUrl = storyData.full_picture || storyData.picture;
            console.log(`[CACHE-RETRY] Got story picture for ${adId}, trying...`);
            result = await cacheCreativeImage(supabase, projectId, adId, newUrl);
            if (result) return result;
          }
        }
        
        // Tentar thumbnail com resolução aumentada
        if (creativeData.thumbnail_url) {
          let thumbUrl = creativeData.thumbnail_url;
          thumbUrl = thumbUrl.replace(/p64x64/g, 'p720x720');
          thumbUrl = thumbUrl.replace(/s64x64/g, 's720x720');
          if (thumbUrl !== imageUrl) {
            console.log(`[CACHE-RETRY] Trying modified thumbnail for ${adId}...`);
            result = await cacheCreativeImage(supabase, projectId, adId, thumbUrl);
            if (result) return result;
          }
        }
      }
    } catch (e) {
      console.log(`[CACHE-RETRY] All attempts failed for ${adId}: ${e}`);
    }
  }
  
  return null;
}

// Cache de imagem HD - NOVA LÓGICA: aceita imagens >= 5KB para não perder thumbnails válidas
// Imagens do Meta em PNG podem ser pequenas mesmo em boa qualidade
async function cacheCreativeImage(supabase: any, projectId: string, adId: string, imageUrl: string, forceRecache: boolean = false): Promise<string | null> {
  if (!imageUrl) return null;
  
  // THRESHOLD MÍNIMO REDUZIDO: 5KB (Meta retorna PNGs comprimidos que são pequenos mas com boa qualidade)
  const MIN_SIZE = 5000;
  
  try {
    const fileName = `${projectId}/${adId}.jpg`;
    
    // Verificar se já existe com tamanho adequado
    if (!forceRecache) {
      const { data: existingFile } = await supabase.storage.from('creative-images').list(projectId, { limit: 1, search: `${adId}.jpg` });
      if (existingFile?.length > 0) {
        const fileSize = existingFile[0]?.metadata?.size || 0;
        if (fileSize >= MIN_SIZE) {
          const { data: publicUrlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
          if (publicUrlData?.publicUrl) {
            console.log(`[CACHE] Already exists (${Math.round(fileSize/1024)}KB): ${adId}`);
            return publicUrlData.publicUrl;
          }
        } else {
          console.log(`[CACHE] Existing too small (${Math.round(fileSize/1024)}KB), re-caching: ${adId}`);
        }
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(imageUrl, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
        'Accept': 'image/*',
        'Referer': 'https://www.facebook.com/'
      }, 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`[CACHE] Fetch failed (${response.status}) for ${adId}: ${imageUrl.substring(0, 80)}`);
      return null;
    }
    
    const imageBuffer = await response.arrayBuffer();
    
    // Mínimo reduzido para 5KB
    if (imageBuffer.byteLength < MIN_SIZE) {
      console.log(`[CACHE] Too small (${Math.round(imageBuffer.byteLength/1024)}KB < 5KB): ${adId} - Rejecting`);
      return null;
    }
    
    const { error: uploadError } = await supabase.storage.from('creative-images').upload(fileName, imageBuffer, { 
      contentType: response.headers.get('content-type') || 'image/jpeg', 
      upsert: true 
    });
    
    if (uploadError) {
      console.log(`[CACHE] Upload error for ${adId}: ${uploadError.message}`);
      return null;
    }
    
    const { data: publicUrlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
    console.log(`[CACHE] Cached (${Math.round(imageBuffer.byteLength/1024)}KB): ${adId}`);
    return publicUrlData?.publicUrl || null;
  } catch (e) { 
    console.log(`[CACHE] Error caching ${adId}: ${e}`);
    return null; 
  }
}

// ===========================================================================================
// 5️⃣ RECACHE ALL HD - Força re-download de TODAS as imagens usando permalink_url
// ===========================================================================================
async function recacheAllHD(
  supabase: any, 
  projectId: string, 
  adAccountId: string, 
  token: string
): Promise<{ cached: number; total: number; skipped: number; errors: number }> {
  console.log(`[RECACHE-HD] Starting force recache for project ${projectId}`);
  
  // Buscar TODOS os ads (não apenas os sem cache)
  const { data: allAds, error: adsError } = await supabase
    .from('ads')
    .select('id')
    .eq('project_id', projectId);
  
  if (adsError) throw adsError;
  
  const ads = allAds || [];
  console.log(`[RECACHE-HD] Total ads to process: ${ads.length}`);
  
  let cached = 0, skipped = 0, errors = 0;
  const adIds = ads.map((a: any) => a.id);
  
  // Mapa de image_hash -> permalink_url
  const hashToUrlMap = new Map<string, string>();
  const adToHashMap = new Map<string, string>();
  
  // FASE 1: Buscar image_hashes de todos os ads
  const batchSize = 50;
  console.log(`[RECACHE-HD] FASE 1: Coletando image_hashes...`);
  
  for (let i = 0; i < adIds.length; i += batchSize) {
    const batch = adIds.slice(i, i + batchSize);
    const batchIds = batch.join(',');
    
    const adsUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=id,creative{id,image_hash,object_story_spec}&access_token=${token}`;
    const adsData = await simpleFetch(adsUrl, undefined, 30000);
    
    if (adsData?.error) {
      console.log(`[RECACHE-HD] Hash batch error: ${adsData.error.message?.substring(0, 100)}`);
      continue;
    }
    
    for (const adId of batch) {
      const adData = (adsData as Record<string, any>)[adId];
      if (!adData?.creative) continue;
      
      const creative = adData.creative;
      let imageHash: string | null = null;
      
      if (creative.image_hash) {
        imageHash = creative.image_hash;
      } else if (creative.object_story_spec) {
        const oss = creative.object_story_spec;
        if (oss.link_data?.image_hash) imageHash = oss.link_data.image_hash;
        else if (oss.photo_data?.images?.[0]?.hash) imageHash = oss.photo_data.images[0].hash;
      }
      
      if (imageHash) {
        adToHashMap.set(adId, imageHash);
      }
    }
    
    if (i + batchSize < adIds.length) await delay(100);
  }
  
  const allHashes = new Set(adToHashMap.values());
  console.log(`[RECACHE-HD] Encontrados ${allHashes.size} hashes únicos para ${adToHashMap.size} ads`);
  
  // FASE 2: Buscar permalink_url via /adimages
  if (allHashes.size > 0) {
    console.log(`[RECACHE-HD] FASE 2: Buscando URLs permanentes HD...`);
    
    const hashArray = Array.from(allHashes);
    const cleanAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    
    for (let i = 0; i < hashArray.length; i += batchSize) {
      const hashBatch = hashArray.slice(i, i + batchSize);
      const hashesParam = hashBatch.map(h => `"${h}"`).join(',');
      
      const adimagesUrl = `https://graph.facebook.com/v22.0/${cleanAccountId}/adimages?hashes=[${hashesParam}]&fields=hash,permalink_url&access_token=${token}`;
      const adimagesData = await simpleFetch(adimagesUrl, undefined, 30000);
      
      if (!adimagesData?.error && adimagesData?.data) {
        for (const img of adimagesData.data) {
          if (img.hash && img.permalink_url) {
            hashToUrlMap.set(img.hash, img.permalink_url);
          }
        }
      } else {
        console.log(`[RECACHE-HD] Adimages batch error: ${adimagesData?.error?.message?.substring(0, 100)}`);
      }
      
      if (i + batchSize < hashArray.length) await delay(100);
    }
    
    console.log(`[RECACHE-HD] Obtidas ${hashToUrlMap.size} URLs permanentes HD`);
  }
  
  // FASE 3: Re-cachear todas as imagens com forceRecache=true
  console.log(`[RECACHE-HD] FASE 3: Re-cacheando imagens em HD...`);
  
  const adsWithUrls = ads.filter((ad: any) => {
    const hash = adToHashMap.get(ad.id);
    return hash && hashToUrlMap.has(hash);
  });
  
  console.log(`[RECACHE-HD] ${adsWithUrls.length} ads com URLs HD disponíveis`);
  
  const cacheBatchSize = 5;
  for (let k = 0; k < adsWithUrls.length; k += cacheBatchSize) {
    const adBatch = adsWithUrls.slice(k, k + cacheBatchSize);
    
    const promises = adBatch.map(async (ad: any) => {
      const hash = adToHashMap.get(ad.id);
      if (!hash) return;
      
      const permalinkUrl = hashToUrlMap.get(hash);
      if (!permalinkUrl) return;
      
      try {
        // FORÇA re-cache (ignora existentes pequenos)
        const cachedUrl = await cacheCreativeImage(supabase, projectId, ad.id, permalinkUrl, true);
        if (cachedUrl) {
          await supabase.from('ads').update({ 
            cached_image_url: cachedUrl,
            creative_thumbnail: permalinkUrl,
            synced_at: new Date().toISOString()
          }).eq('id', ad.id);
          cached++;
        } else {
          errors++;
        }
      } catch (e) {
        console.log(`[RECACHE-HD] Error for ${ad.id}: ${e}`);
        errors++;
      }
    });
    
    await Promise.all(promises);
    
    if (k % 50 === 0) {
      console.log(`[RECACHE-HD] Progress: ${k}/${adsWithUrls.length} (cached: ${cached}, errors: ${errors})`);
    }
  }
  
  // Ads sem hash ficam como skipped
  skipped = ads.length - adsWithUrls.length;
  
  console.log(`[RECACHE-HD] Complete - Cached: ${cached}, Skipped: ${skipped}, Errors: ${errors}`);
  return { cached, total: ads.length, skipped, errors };
}

// ===========================================================================================
// 6️⃣ CACHE VIA STORY ID - Busca imagens HD via effective_object_story_id (fallback)
// Para ads sem image_hash (vídeos, dinâmicos, posts promovidos)
// ATUALIZADO: Suporta specific_ad_ids e force_recache para sync individual
// ===========================================================================================
async function cacheViaStoryId(
  supabase: any, 
  projectId: string, 
  adAccountId: string, 
  token: string,
  specificAdIds?: string[], // NOVO: lista específica de ad_ids
  forceRecache?: boolean // NOVO: forçar re-download mesmo se já tiver cache
): Promise<{ cached: number; total: number; skipped: number; errors: number }> {
  console.log(`[STORY-HD] Starting story-based HD cache for project ${projectId}, specific: ${specificAdIds?.length || 'all'}, force: ${forceRecache}`);
  
  let ads: { id: string; cached_image_url: string | null }[];
  
  if (specificAdIds && specificAdIds.length > 0) {
    // MODO ESPECÍFICO: buscar apenas os ads solicitados
    const allAds: any[] = [];
    for (let i = 0; i < specificAdIds.length; i += 200) {
      const batchIds = specificAdIds.slice(i, i + 200);
      const { data: batchAds } = await supabase
        .from('ads')
        .select('id, cached_image_url')
        .eq('project_id', projectId)
        .in('id', batchIds);
      
      if (batchAds) allAds.push(...batchAds);
    }
    
    // Se forceRecache, processar todos; senão, apenas os sem cache
    ads = forceRecache ? allAds : allAds.filter((ad: any) => !ad.cached_image_url);
    console.log(`[STORY-HD] Specific mode: ${allAds.length} found, ${ads.length} to process (force: ${forceRecache})`);
  } else {
    // MODO PADRÃO: buscar ads SEM cached_image_url
    const { data: adsWithoutHD, error: adsError } = await supabase
      .from('ads')
      .select('id, cached_image_url')
      .eq('project_id', projectId);
    
    if (adsError) throw adsError;
    
    // Filtrar apenas ads sem cache HD (ou todos se forceRecache)
    ads = forceRecache 
      ? (adsWithoutHD || []) 
      : (adsWithoutHD || []).filter((ad: any) => !ad.cached_image_url);
    console.log(`[STORY-HD] Standard mode: ${adsWithoutHD?.length || 0} total, ${ads.length} to process`);
  }
  
  if (ads.length === 0) {
    return { cached: 0, total: 0, skipped: 0, errors: 0 };
  }
  
  let cached = 0, skipped = 0, errors = 0;
  const adIds = ads.map((a: any) => a.id);
  const batchSize = 50;
  
  // Mapa de adId -> image URL HD
  const storyImageMap = new Map<string, string>();
  
  // FASE 1: Buscar creative_id de cada ad e depois buscar thumbnail_url DIRETO do creative
  // IMPORTANTE: URLs de thumbnail_url retornadas junto com o Ad podem estar expiradas (403)
  // A solução é buscar o creative_id e depois fazer request DIRETO ao creative endpoint
  console.log(`[STORY-HD] FASE 1: Buscando creative IDs...`);
  
  // Mapa adId -> creativeId
  const adToCreativeMap = new Map<string, string>();
  
  for (let i = 0; i < adIds.length; i += batchSize) {
    const batch = adIds.slice(i, i + batchSize);
    const batchIds = batch.join(',');
    
    // Primeiro: buscar creative IDs
    const adsUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=creative{id}&access_token=${token}`;
    const adsData = await simpleFetch(adsUrl, undefined, 30000);
    
    if (adsData?.error) {
      console.log(`[STORY-HD] Batch error getting creative IDs: ${adsData.error.message?.substring(0, 100)}`);
      continue;
    }
    
    for (const adId of batch) {
      const adData = (adsData as Record<string, any>)[adId];
      const creativeId = adData?.creative?.id;
      if (creativeId) {
        adToCreativeMap.set(adId, creativeId);
      }
    }
    
    if (i + batchSize < adIds.length) await delay(100);
  }
  
  console.log(`[STORY-HD] Encontrados ${adToCreativeMap.size} creative IDs`);
  
  // FASE 1.5: Buscar thumbnail_url DIRETO do creative endpoint (URL fresca, não expira)
  console.log(`[STORY-HD] FASE 1.5: Buscando thumbnail_url DIRETAMENTE do creative endpoint (1080x1080)...`);
  
  const creativeIds = Array.from(adToCreativeMap.values());
  const creativeToUrlMap = new Map<string, string>();
  
  for (let i = 0; i < creativeIds.length; i += batchSize) {
    const creativeBatch = creativeIds.slice(i, i + batchSize);
    const creativeIdsStr = creativeBatch.join(',');
    
    // Query DIRETA ao creative endpoint com 1080x1080!
    const creativesUrl = `https://graph.facebook.com/v22.0/?ids=${creativeIdsStr}&fields=id,thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`;
    console.log(`[STORY-HD] Fetching ${creativeBatch.length} creatives with thumbnail_width=1080, thumbnail_height=1080`);
    
    const creativesData = await simpleFetch(creativesUrl, undefined, 30000);
    
    if (creativesData?.error) {
      console.log(`[STORY-HD] Creatives batch error: ${creativesData.error.message?.substring(0, 100)}`);
      continue;
    }
    
    for (const creativeId of creativeBatch) {
      const creativeData = (creativesData as Record<string, any>)[creativeId];
      if (creativeData?.thumbnail_url) {
        // URL fresca diretamente do creative endpoint!
        creativeToUrlMap.set(creativeId, creativeData.thumbnail_url);
        console.log(`[STORY-HD] ✓ Fresh HD URL for creative ${creativeId}`);
      }
    }
    
    if (i + batchSize < creativeIds.length) await delay(100);
  }
  
  // Mapear de volta para adIds
  for (const [adId, creativeId] of adToCreativeMap.entries()) {
    const hdUrl = creativeToUrlMap.get(creativeId);
    if (hdUrl) {
      storyImageMap.set(adId, hdUrl);
      console.log(`[STORY-HD] ✓ HD URL for ad ${adId}: ${hdUrl.substring(0, 80)}...`);
    }
  }
  
  console.log(`[STORY-HD] Encontradas ${storyImageMap.size} URLs de imagem`);
  
  // FASE 2: Cachear as imagens encontradas
  console.log(`[STORY-HD] FASE 2: Cacheando imagens...`);
  
  const adsWithUrls = ads.filter((ad: any) => storyImageMap.has(ad.id));
  console.log(`[STORY-HD] ${adsWithUrls.length} ads com URLs disponíveis`);
  
  const cacheBatchSize = 5;
  for (let k = 0; k < adsWithUrls.length; k += cacheBatchSize) {
    const adBatch = adsWithUrls.slice(k, k + cacheBatchSize);
    
    const promises = adBatch.map(async (ad: any) => {
      const imageUrl = storyImageMap.get(ad.id);
      if (!imageUrl) return;
      
      try {
        const cachedUrl = await cacheCreativeImage(supabase, projectId, ad.id, imageUrl, forceRecache || true);
        if (cachedUrl) {
          await supabase.from('ads').update({ 
            cached_image_url: cachedUrl,
            creative_thumbnail: imageUrl,
            synced_at: new Date().toISOString()
          }).eq('id', ad.id);
          cached++;
        } else {
          errors++;
        }
      } catch (e) {
        console.log(`[STORY-HD] Error for ${ad.id}: ${e}`);
        errors++;
      }
    });
    
    await Promise.all(promises);
    
    if (k % 50 === 0) {
      console.log(`[STORY-HD] Progress: ${k}/${adsWithUrls.length} (cached: ${cached}, errors: ${errors})`);
    }
  }
  
  skipped = ads.length - adsWithUrls.length;
  
  console.log(`[STORY-HD] Complete - Cached: ${cached}, Skipped: ${skipped}, Errors: ${errors}`);
  return { cached, total: ads.length, skipped, errors };
}

// Tipos de conversão
const FORM_LEAD_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'fb_pixel_lead'];
const CONTACT_LEAD_ACTION_TYPES = ['contact_total', 'contact_website', 'contact', 'omni_complete_registration', 'complete_registration', 'submit_application', 'submit_application_total'];
const MESSAGE_LEAD_ACTION_TYPES = ['messaging_conversation_started_7d', 'onsite_conversion.messaging_conversation_started_7d'];
// NOVO: Ligações (Phone Calls) - também contam como leads
const PHONE_CALL_ACTION_TYPES = ['onsite_web_app_call_confirm', 'call_confirm', 'onsite_conversion.call_confirm', 'phone_call', 'click_to_call'];
const PURCHASE_ACTION_TYPES = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'];
const INITIATE_CHECKOUT_ACTION_TYPES = ['initiate_checkout', 'omni_initiated_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'onsite_conversion.initiate_checkout'];
// Tipos de pixel customizado que também contam como leads
const PIXEL_CUSTOM_LEAD_TYPES = ['offsite_conversion.fb_pixel_custom'];

const ALL_LEAD_ACTION_TYPES = [...FORM_LEAD_ACTION_TYPES, ...CONTACT_LEAD_ACTION_TYPES, ...MESSAGE_LEAD_ACTION_TYPES, ...PHONE_CALL_ACTION_TYPES, ...PIXEL_CUSTOM_LEAD_TYPES];
const CONVERSION_ACTION_TYPES = [...ALL_LEAD_ACTION_TYPES, ...PURCHASE_ACTION_TYPES, ...INITIATE_CHECKOUT_ACTION_TYPES];
const TRAFFIC_OBJECTIVES = ['OUTCOME_TRAFFIC', 'LINK_CLICKS', 'TRAFFIC', 'POST_ENGAGEMENT'];

function extractConversions(row: any, campaignObjective?: string): { 
  conversions: number; 
  costPerResult: number; 
  conversionValue: number; 
  source: string;
  leadsCount: number;
  purchasesCount: number;
  initiateCheckoutCount: number;
} {
  const isTrafficCampaign = campaignObjective && TRAFFIC_OBJECTIVES.includes(campaignObjective.toUpperCase());
  
  if (isTrafficCampaign) {
    return { conversions: 0, costPerResult: 0, conversionValue: 0, source: 'traffic_campaign', leadsCount: 0, purchasesCount: 0, initiateCheckoutCount: 0 };
  }
  
  let conversions = 0, costPerResult = 0, conversionValue = 0;
  let source = 'none', leadsCount = 0, purchasesCount = 0, initiateCheckoutCount = 0;

  // FONTE 0 (NOVA!): Campo "conversions" - Meta envia contact_website/contact_total aqui!
  if (Array.isArray(row.conversions) && row.conversions.length > 0) {
    for (const conv of row.conversions) {
      const actionType = conv.action_type || '';
      const val = parseInt(conv.value) || 0;
      if (val > 0) {
        if (CONTACT_LEAD_ACTION_TYPES.includes(actionType)) {
          leadsCount = Math.max(leadsCount, val);
          console.log(`[CONVERSIONS-FIELD] Found ${actionType}: ${val}`);
        } else if (ALL_LEAD_ACTION_TYPES.includes(actionType)) {
          leadsCount = Math.max(leadsCount, val);
        } else if (PURCHASE_ACTION_TYPES.includes(actionType)) {
          purchasesCount = Math.max(purchasesCount, val);
        }
      }
    }
    
    if (leadsCount > 0 || purchasesCount > 0) {
      conversions = leadsCount + purchasesCount;
      source = 'conversions_field';
    }
  }

  // FONTE 1: Campo "results"
  if (conversions === 0 && Array.isArray(row.results) && row.results.length > 0) {
    for (const result of row.results) {
      const actionType = result.action_type || '';
      const val = parseInt(result.value) || 0;
      if (val > 0) {
        if (PURCHASE_ACTION_TYPES.includes(actionType)) purchasesCount = Math.max(purchasesCount, val);
        else if (ALL_LEAD_ACTION_TYPES.includes(actionType)) leadsCount = Math.max(leadsCount, val);
        else if (INITIATE_CHECKOUT_ACTION_TYPES.includes(actionType)) initiateCheckoutCount = Math.max(initiateCheckoutCount, val);
      }
    }
    
    if (leadsCount > 0 || purchasesCount > 0) {
      conversions = leadsCount + purchasesCount;
      source = 'results';
      
      if (Array.isArray(row.cost_per_result) && row.cost_per_result.length > 0) {
        const cpr = row.cost_per_result[0];
        if (cpr.value !== undefined) costPerResult = parseFloat(cpr.value) || 0;
      }
    }
  }
  
  // FONTE 2: Campo "actions" (fallback)
  if (conversions === 0 && Array.isArray(row.actions) && row.actions.length > 0) {
    for (const action of row.actions) {
      const actionType = action.action_type || '';
      const val = parseInt(action.value) || 0;
      if (val > 0) {
        if (actionType === 'lead' || actionType === 'onsite_conversion.lead_grouped') leadsCount = val;
        else if (CONTACT_LEAD_ACTION_TYPES.includes(actionType)) leadsCount = Math.max(leadsCount, val);
        else if (MESSAGE_LEAD_ACTION_TYPES.includes(actionType)) leadsCount = Math.max(leadsCount, val);
        else if (PHONE_CALL_ACTION_TYPES.includes(actionType)) {
          leadsCount = Math.max(leadsCount, val);
          console.log(`[PHONE-CALL] Found ${actionType}: ${val}`);
        }
        else if (PIXEL_CUSTOM_LEAD_TYPES.includes(actionType)) leadsCount = Math.max(leadsCount, val);
        else if (PURCHASE_ACTION_TYPES.includes(actionType)) purchasesCount = Math.max(purchasesCount, val);
        else if (INITIATE_CHECKOUT_ACTION_TYPES.includes(actionType)) initiateCheckoutCount = Math.max(initiateCheckoutCount, val);
      }
    }
    
    if (leadsCount > 0 || purchasesCount > 0 || initiateCheckoutCount > 0) {
      source = 'actions';
      conversions = leadsCount + purchasesCount + initiateCheckoutCount;
    }
  }

  // CPA
  if (conversions > 0 && Array.isArray(row.cost_per_action_type)) {
    for (const cpa of row.cost_per_action_type) {
      if (CONVERSION_ACTION_TYPES.includes(cpa.action_type || '') && cpa.value) {
        costPerResult = parseFloat(cpa.value) || 0;
        break;
      }
    }
  }
  
  if (costPerResult === 0 && conversions > 0) {
    const spend = parseFloat(row.spend) || 0;
    costPerResult = spend / conversions;
  }

  // Valor de conversão (ROAS)
  if (Array.isArray(row.action_values)) {
    for (const av of row.action_values) {
      const actionType = av.action_type || '';
      const val = parseFloat(av.value) || 0;
      if ((actionType === 'omni_purchase' || actionType === 'purchase') && val > 0) {
        conversionValue = val;
        break;
      }
    }
  }

  return { conversions, costPerResult, conversionValue, source, leadsCount, purchasesCount, initiateCheckoutCount };
}

function extractMessagingReplies(insights: any): number {
  if (!insights?.actions) return 0;
  let c7d = 0, total = 0, first = 0;
  for (const a of insights.actions) {
    const v = parseInt(a.value) || 0;
    if (a.action_type === 'onsite_conversion.messaging_conversation_started_7d') c7d = v;
    else if (a.action_type === 'onsite_conversion.total_messaging_connection') total = v;
    else if (a.action_type === 'onsite_conversion.messaging_first_reply') first = v;
  }
  return c7d > 0 ? c7d : Math.max(total, first);
}

function extractProfileVisits(insights: any): number {
  if (insights?.instagram_profile_visits) {
    return parseInt(insights.instagram_profile_visits) || 0;
  }
  if (!insights?.actions) return 0;
  let max = 0;
  for (const a of insights.actions) {
    const v = parseInt(a.value) || 0;
    if (PROFILE_VISIT_ACTION_TYPES.includes(a.action_type) && v > max) max = v;
  }
  return max;
}

function validateSyncData(records: any[]): { isValid: boolean; totalSpend: number; totalImpressions: number; totalConversions: number } {
  const totalSpend = records.reduce((s, r) => s + (r.spend || 0), 0);
  const totalImpressions = records.reduce((s, r) => s + (r.impressions || 0), 0);
  const totalConversions = records.reduce((s, r) => s + (r.conversions || 0), 0);
  
  // CORREÇÃO: Dados com spend/impressions zero são VÁLIDOS (campanha pausada, sem gasto no período)
  // Só é inválido se tiver MUITOS registros e TODOS forem zero (provável erro de API)
  // Se tiver poucos registros (< 10), aceitar mesmo com zeros
  const allZero = records.length > 0 && records.every(r => (r.spend || 0) === 0 && (r.impressions || 0) === 0 && (r.clicks || 0) === 0);
  const isLikelyApiError = allZero && records.length >= 10; // Só considerar erro se muitos registros zerados
  
  return { isValid: !isLikelyApiError, totalSpend, totalImpressions, totalConversions };
}

function summarizeTargeting(targeting: any): string | null {
  if (!targeting) return null;
  const parts: string[] = [];
  
  if (targeting.age_min || targeting.age_max) {
    parts.push(`idade:${targeting.age_min || 18}-${targeting.age_max || 65}`);
  }
  if (targeting.genders?.length) {
    parts.push(`genero:${targeting.genders.join(',')}`);
  }
  if (targeting.geo_locations) {
    const geo = targeting.geo_locations;
    const locs = [
      ...(geo.countries || []),
      ...(geo.cities?.map((c: any) => c.name || c.key) || []),
      ...(geo.regions?.map((r: any) => r.name || r.key) || [])
    ];
    if (locs.length) parts.push(`local:${locs.slice(0, 3).join(',')}`);
  }
  if (targeting.custom_audiences?.length) {
    parts.push(`publicos:${targeting.custom_audiences.length}`);
  }
  if (targeting.flexible_spec?.length) {
    let interestCount = 0;
    for (const spec of targeting.flexible_spec) {
      interestCount += (spec.interests?.length || 0) + (spec.behaviors?.length || 0);
    }
    if (interestCount > 0) parts.push(`interesses:${interestCount}`);
  }
  
  return parts.length > 0 ? parts.join('|') : null;
}

async function detectAndRecordChanges(
  supabase: any, 
  projectId: string, 
  entityType: 'campaign' | 'adset' | 'ad', 
  tableName: string, 
  newRecords: any[], 
  trackedFields: string[]
): Promise<any[]> {
  const changes: any[] = [];
  if (newRecords.length === 0) return changes;
  
  const ids = newRecords.map(r => r.id);
  
  const { data: existingRecords } = await supabase.from(tableName).select('*').in('id', ids).eq('project_id', projectId);
  const existingMap = new Map((existingRecords || []).map((r: any) => [r.id, r]));
  
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  
  const { data: recentChanges } = await supabase
    .from('optimization_history')
    .select('entity_id, field_changed, new_value')
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .in('entity_id', ids)
    .gte('detected_at', oneDayAgo.toISOString());
  
  const recentChangeKeys = new Set(
    (recentChanges || []).map((c: any) => `${c.entity_id}:${c.field_changed}:${c.new_value}`)
  );
  
  for (const newRecord of newRecords) {
    const existing = existingMap.get(newRecord.id) as Record<string, any> | undefined;
    
    if (!existing) {
      const changeKey = `${newRecord.id}:created:${newRecord.status || 'ACTIVE'}`;
      if (!recentChangeKeys.has(changeKey)) {
        changes.push({ 
          project_id: projectId, 
          entity_type: entityType, 
          entity_id: newRecord.id, 
          entity_name: newRecord.name || 'Unknown', 
          field_changed: 'created', 
          old_value: null, 
          new_value: newRecord.status || 'ACTIVE', 
          change_type: 'created', 
          change_percentage: null
        }); 
      }
      continue; 
    }
    
    for (const field of trackedFields) {
      let oldVal = existing[field];
      let newVal = newRecord[field];
      
      if (field === 'targeting') {
        const oldSummary = summarizeTargeting(oldVal);
        const newSummary = summarizeTargeting(newVal);
        
        if (oldSummary === newSummary) continue;
        
        const changeKey = `${newRecord.id}:targeting:${newSummary}`;
        if (!recentChangeKeys.has(changeKey)) {
          changes.push({ 
            project_id: projectId, 
            entity_type: entityType, 
            entity_id: newRecord.id, 
            entity_name: newRecord.name || existing.name || 'Unknown', 
            field_changed: 'targeting', 
            old_value: oldSummary, 
            new_value: newSummary, 
            change_type: 'targeting_change', 
            change_percentage: null
          });
        }
        continue;
      }
      
      if (oldVal === newVal || (oldVal == null && newVal == null)) continue;
      
      const newValStr = newVal != null ? String(newVal) : null;
      const changeKey = `${newRecord.id}:${field}:${newValStr}`;
      if (recentChangeKeys.has(changeKey)) continue;
      
      let changeType = 'modified';
      
      if (field === 'status') { 
        changeType = oldVal === 'ACTIVE' && newVal !== 'ACTIVE' ? 'paused' : oldVal !== 'ACTIVE' && newVal === 'ACTIVE' ? 'activated' : 'status_change'; 
      } else if (field === 'objective') {
        changeType = 'objective_change';
      } else if (['creative_image_url', 'creative_video_url', 'headline', 'primary_text', 'cta'].includes(field)) {
        changeType = 'creative_change';
      }
      
      changes.push({ 
        project_id: projectId, 
        entity_type: entityType, 
        entity_id: newRecord.id, 
        entity_name: newRecord.name || existing.name || 'Unknown', 
        field_changed: field, 
        old_value: oldVal != null ? String(oldVal) : null, 
        new_value: newValStr, 
        change_type: changeType, 
        change_percentage: null
      });
    }
  }
  return changes;
}

// ===========================================================================================
// MAIN HANDLER
// ===========================================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: SyncRequest = await req.json();
    let { project_id, ad_account_id, access_token, time_range, date_preset, syncMode = 'base', retry_count = 0, lite_mode = false, specific_ad_ids, force_recache = false } = body;
    
    // Buscar ad_account_id do projeto se não fornecido
    if (!ad_account_id && project_id) {
      const { data: project } = await supabase.from('projects').select('ad_account_id').eq('id', project_id).single();
      if (project?.ad_account_id) {
        ad_account_id = project.ad_account_id;
      }
    }
    
    if (!ad_account_id) {
      throw new Error('No ad_account_id provided');
    }
    
    const token = access_token || metaAccessToken;
    if (!token) throw new Error('No Meta access token available');
    
    console.log(`[SYNC] Mode: ${syncMode}, Project: ${project_id}, Specific ads: ${specific_ad_ids?.length || 'all'}`);
    
    // ===========================================================================================
    // 2️⃣ CREATIVE SYNC MODE (busca texto + depois HD automaticamente)
    // Agora suporta specific_ad_ids para otimização (buscar criativos apenas de ads ativos)
    // ===========================================================================================
    if (syncMode === 'creatives') {
      console.log(`[SYNC] Starting CREATIVE SYNC for project ${project_id}, specific ads: ${specific_ad_ids?.length || 'all'}`);
      
      // Etapa 1: Buscar texto (headline, primary_text, cta, thumbnail HD 1080x1080)
      await updateSyncProgress(supabase, project_id, 'creatives', 'Etapa 1/2: Buscando textos e thumbnails HD...', 0, 100);
      const creativeResult = await syncCreatives(supabase, project_id, ad_account_id, token, specific_ad_ids);
      console.log(`[SYNC] Creative text sync completed: ${creativeResult.updated} ads updated`);
      
      // Etapa 2: Buscar imagens HD (cache em storage)
      await updateSyncProgress(supabase, project_id, 'hd_images', 'Etapa 2/2: Cacheando imagens em alta resolução...', 50, 100);
      const hdResult = await syncHDImages(supabase, project_id, ad_account_id, token, specific_ad_ids);
      console.log(`[SYNC] HD image sync completed: ${hdResult.cached}/${hdResult.total} images cached`);
      
      const cachedNow = hdResult.totalAds - hdResult.pending;
      await updateSyncProgress(supabase, project_id, 'complete', `Criativos: ${creativeResult.updated} textos, ${cachedNow}/${hdResult.totalAds} imagens (${hdResult.cached} novas)`, 100, 100);
      
      return new Response(JSON.stringify({ 
        success: true, 
        syncMode: 'creatives',
        optimized: !!specific_ad_ids,
        specificAdsCount: specific_ad_ids?.length || 0,
        creatives: {
          updated: creativeResult.updated,
          total: creativeResult.total
        },
        hdImages: {
          cached: hdResult.cached,
          total: hdResult.total,
          errors: hdResult.errors,
          pending: hdResult.pending,
          totalAds: hdResult.totalAds
        },
        duration: Date.now() - startTime
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // ===========================================================================================
    // 3️⃣ HD IMAGE SYNC MODE (ASSÍNCRONO)
    // ===========================================================================================
    if (syncMode === 'hd_images') {
      console.log(`[SYNC] Starting HD IMAGE SYNC for project ${project_id}`);
      await updateSyncProgress(supabase, project_id, 'hd_images', 'Buscando imagens em alta resolução...', 1, 2);
      
      const result = await syncHDImages(supabase, project_id, ad_account_id, token);
      
      const cachedTotal = result.totalAds - result.pending;
      await updateSyncProgress(supabase, project_id, 'complete', `Imagens HD: ${cachedTotal}/${result.totalAds} (${result.cached} novas)`, 2, 2);
      
      return new Response(JSON.stringify({ 
        success: true, 
        syncMode: 'hd_images',
        cached: result.cached,
        total: result.total,
        errors: result.errors,
        pending: result.pending,
        totalAds: result.totalAds,
        duration: Date.now() - startTime
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // ===========================================================================================
    // 4️⃣ RECACHE HD MODE - FORÇA RECACHE DE TODAS AS IMAGENS (substituir pequenas)
    // ===========================================================================================
    if (syncMode === 'recache_hd') {
      console.log(`[SYNC] Starting RECACHE HD for project ${project_id} - forcing HD quality`);
      await updateSyncProgress(supabase, project_id, 'recache_hd', 'Re-cacheando imagens em HD (forçando qualidade)...', 1, 100);
      
      const result = await recacheAllHD(supabase, project_id, ad_account_id, token);
      
      await updateSyncProgress(supabase, project_id, 'complete', `Recache HD: ${result.cached}/${result.total} atualizadas`, 100, 100);
      
      return new Response(JSON.stringify({ 
        success: true, 
        syncMode: 'recache_hd',
        cached: result.cached,
        total: result.total,
        skipped: result.skipped,
        errors: result.errors,
        duration: Date.now() - startTime
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // ===========================================================================================
    // 5️⃣ STORY HD MODE - Busca imagens HD via story ID (para ads sem image_hash)
    // ATUALIZADO: Suporta specific_ad_ids e force_recache para sync individual
    // ===========================================================================================
    if (syncMode === 'story_hd') {
      console.log(`[SYNC] Starting STORY HD for project ${project_id} - specific: ${specific_ad_ids?.length || 'all'}, force: ${force_recache}`);
      await updateSyncProgress(supabase, project_id, 'story_hd', 'Buscando imagens HD via posts originais...', 1, 100);
      
      const result = await cacheViaStoryId(supabase, project_id, ad_account_id, token, specific_ad_ids, force_recache);
      
      await updateSyncProgress(supabase, project_id, 'complete', `Story HD: ${result.cached}/${result.total} cacheadas`, 100, 100);
      
      return new Response(JSON.stringify({ 
        success: true, 
        syncMode: 'story_hd',
        cached: result.cached,
        total: result.total,
        skipped: result.skipped,
        errors: result.errors,
        duration: Date.now() - startTime
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // ===========================================================================================
    // 1️⃣ MONTH BASE SYNC MODE (DEFAULT)
    // ===========================================================================================
    let since: string, until: string;
    if (time_range) { 
      since = time_range.since; 
      until = time_range.until; 
    } else { 
      const today = new Date(); 
      until = today.toISOString().split('T')[0]; 
      const daysMap: Record<string, number> = { yesterday: 1, today: 0, last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90 }; 
      const days = daysMap[date_preset || 'last_90d'] || 90; 
      const sinceDate = new Date(today); 
      sinceDate.setDate(sinceDate.getDate() - days); 
      since = sinceDate.toISOString().split('T')[0]; 
    }
    
    console.log(`[BASE-SYNC] Project: ${project_id}, Range: ${since} to ${until}, Lite: ${lite_mode}`);
    
    let campaigns: any[] = [], adsets: any[] = [], ads: any[] = [];
    let campaignMap = new Map<string, any>();
    let adsetMap = new Map<string, any>();
    let adMap = new Map<string, any>();
    
    // Step 1: Fetch entities (apenas se NÃO for lite_mode)
    if (!lite_mode) {
      await updateSyncProgress(supabase, project_id, 'campaigns', 'Buscando campanhas, conjuntos e anúncios...', 1, 5);
      
      const entities = await fetchEntitiesBase(ad_account_id, token);
      campaigns = entities.campaigns;
      adsets = entities.adsets;
      ads = entities.ads;
      
      if (entities.tokenExpired) {
        await updateSyncProgress(supabase, project_id, 'error', 'Token do Meta expirou');
        return new Response(JSON.stringify({ success: false, error: 'Token do Meta expirou.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Step 2: Build maps
      await updateSyncProgress(supabase, project_id, 'processing', `Processando ${campaigns.length} campanhas, ${adsets.length} conjuntos, ${ads.length} anúncios...`, 2, 5);
      
      campaignMap = new Map(campaigns.filter(c => extractId(c.id)).map(c => [extractId(c.id)!, c]));
      adsetMap = new Map(adsets.filter(a => extractId(a.id)).map(a => [extractId(a.id)!, a]));
      adMap = new Map(ads.filter(a => extractId(a.id)).map(a => [extractId(a.id)!, a]));
    } else {
      console.log(`[BASE-SYNC] LITE MODE: Skipping entity fetch, using insights data only`);
      await updateSyncProgress(supabase, project_id, 'insights', 'Modo lite: buscando apenas métricas...', 1, 3);
    }
    
    // Step 3: Fetch insights (métricas diárias)
    await updateSyncProgress(supabase, project_id, 'insights', 'Buscando métricas diárias...', 3, 5);
    
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);
    
    const dailyRecords: any[] = [];
    
    for (const [adId, dateMap] of dailyInsights) {
      for (const [date, insights] of dateMap) {
        const ad = adMap.get(adId);
        const adsetId = extractId(insights.adset_id);
        const campaignId = extractId(insights.campaign_id);
        const adset = adsetId ? adsetMap.get(adsetId) : null;
        const campaign = campaignId ? campaignMap.get(campaignId) : null;
        
        const campaignObjective = campaign?.objective || insights.campaign_objective;
        const { conversions, costPerResult, conversionValue, leadsCount, purchasesCount, initiateCheckoutCount } = extractConversions(insights, campaignObjective);
        const messagingReplies = extractMessagingReplies(insights);
        const profileVisits = extractProfileVisits(insights);
        
        const spend = parseFloat(insights.spend) || 0;
        const impressions = parseInt(insights.impressions) || 0;
        const clicks = parseInt(insights.clicks) || 0;
        const reach = parseInt(insights.reach) || 0;
        
        dailyRecords.push({
          // id é gerado automaticamente pelo banco (gen_random_uuid)
          project_id,
          ad_account_id,
          date,
          ad_id: adId,
          ad_name: insights.ad_name || ad?.name || 'Unknown',
          ad_status: ad?.status,
          adset_id: extractId(insights.adset_id),
          adset_name: insights.adset_name || adset?.name || 'Unknown',
          adset_status: adset?.status,
          campaign_id: extractId(insights.campaign_id),
          campaign_name: insights.campaign_name || campaign?.name || 'Unknown',
          campaign_status: campaign?.status,
          campaign_objective: campaignObjective,
          spend,
          impressions,
          clicks,
          reach,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          frequency: reach > 0 ? impressions / reach : 0,
          conversions,
          conversion_value: conversionValue,
          cpa: conversions > 0 ? spend / conversions : 0,
          roas: spend > 0 && conversionValue > 0 ? conversionValue / spend : 0,
          messaging_replies: messagingReplies,
          profile_visits: profileVisits,
          leads_count: leadsCount,
          purchases_count: purchasesCount,
          initiate_checkout_count: initiateCheckoutCount,
          synced_at: new Date().toISOString()
        });
      }
    }
    
    const validation = validateSyncData(dailyRecords);
    console.log(`[VALIDATION] Records: ${dailyRecords.length}, Spend: R$${validation.totalSpend.toFixed(2)}, Conversions: ${validation.totalConversions}`);
    
    if (!validation.isValid && retry_count < 3) {
      console.log(`[VALIDATION] Invalid data, retry ${retry_count + 1}`);
      return new Response(JSON.stringify({ success: false, error: 'Validation failed', retry: true }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Step 4: Upsert daily records
    await updateSyncProgress(supabase, project_id, 'saving', `Salvando ${dailyRecords.length} registros diários...`, 4, 5);
    
    let savedCount = 0;
    let saveErrors: string[] = [];
    
    if (dailyRecords.length > 0) {
      for (let i = 0; i < dailyRecords.length; i += 500) {
        const batch = dailyRecords.slice(i, i + 500);
        const { error: upsertError, count } = await supabase
          .from('ads_daily_metrics')
          .upsert(batch, { 
            onConflict: 'project_id,ad_id,date',  // Usa constraint única correta
            ignoreDuplicates: false 
          })
          .select();
        
        if (upsertError) {
          console.log(`[UPSERT ERROR] Batch ${Math.floor(i/500) + 1}: ${upsertError.message}`);
          saveErrors.push(upsertError.message);
        } else {
          savedCount += batch.length;
        }
      }
    }
    
    if (saveErrors.length > 0) {
      console.log(`[UPSERT] Errors: ${saveErrors.slice(0, 3).join('; ')}`);
    }
    console.log(`[UPSERT] Saved ${savedCount}/${dailyRecords.length} records`);
    
    // Aggregate metrics for entities
    const campaignMetrics = new Map<string, any>();
    const adsetMetrics = new Map<string, any>();
    const adMetrics = new Map<string, any>();
    
    for (const r of dailyRecords) {
      const initMetric = (id: string, name: string, extra: any) => ({
        id,
        name,
        project_id,
        status: extra.status,
        objective: extra.objective,
        spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, messaging_replies: 0, profile_visits: 0,
      });

      if (!campaignMetrics.has(r.campaign_id)) {
        const campaign = campaignMap.get(r.campaign_id);
        campaignMetrics.set(r.campaign_id, initMetric(r.campaign_id, r.campaign_name, { status: campaign?.status, objective: campaign?.objective }));
      }
      const cm = campaignMetrics.get(r.campaign_id);
      cm.spend += r.spend; cm.impressions += r.impressions; cm.clicks += r.clicks; cm.reach += r.reach;
      cm.conversions += r.conversions; cm.conversion_value += r.conversion_value; cm.messaging_replies += r.messaging_replies; cm.profile_visits += r.profile_visits;

      if (!adsetMetrics.has(r.adset_id)) {
        const adset = adsetMap.get(r.adset_id);
        adsetMetrics.set(r.adset_id, { ...initMetric(r.adset_id, r.adset_name, { status: adset?.status }), campaign_id: r.campaign_id, daily_budget: adset?.daily_budget, lifetime_budget: adset?.lifetime_budget, targeting: adset?.targeting || null });
      }
      const am = adsetMetrics.get(r.adset_id);
      am.spend += r.spend; am.impressions += r.impressions; am.clicks += r.clicks; am.reach += r.reach;
      am.conversions += r.conversions; am.conversion_value += r.conversion_value; am.messaging_replies += r.messaging_replies; am.profile_visits += r.profile_visits;

      if (!adMetrics.has(r.ad_id)) {
        const ad = adMap.get(r.ad_id);
        adMetrics.set(r.ad_id, { ...initMetric(r.ad_id, r.ad_name, { status: ad?.status }), campaign_id: r.campaign_id, ad_set_id: r.adset_id });
      }
      const adm = adMetrics.get(r.ad_id);
      adm.spend += r.spend; adm.impressions += r.impressions; adm.clicks += r.clicks; adm.reach += r.reach;
      adm.conversions += r.conversions; adm.conversion_value += r.conversion_value; adm.messaging_replies += r.messaging_replies; adm.profile_visits += r.profile_visits;
    }

    // Include all entities from API even without metrics
    for (const [campaignId, campaign] of campaignMap) {
      if (campaignId && !campaignMetrics.has(campaignId)) {
        campaignMetrics.set(campaignId, {
          id: campaignId, name: campaign.name || 'Unknown', project_id, status: campaign.status, objective: campaign.objective,
          spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, messaging_replies: 0, profile_visits: 0,
          daily_budget: campaign.daily_budget, lifetime_budget: campaign.lifetime_budget,
        });
      }
    }
    
    for (const [adsetId, adset] of adsetMap) {
      if (adsetId && !adsetMetrics.has(adsetId)) {
        adsetMetrics.set(adsetId, {
          id: adsetId, name: adset.name || 'Unknown', project_id, status: adset.status,
          campaign_id: extractId(adset.campaign_id), daily_budget: adset.daily_budget, lifetime_budget: adset.lifetime_budget, targeting: adset.targeting || null,
          spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, messaging_replies: 0, profile_visits: 0,
        });
      }
    }
    
    for (const [adId, ad] of adMap) {
      if (adId && !adMetrics.has(adId)) {
        adMetrics.set(adId, {
          id: adId, name: ad.name || 'Unknown', project_id, status: ad.status,
          campaign_id: extractId(ad.campaign_id), ad_set_id: extractId(ad.adset_id),
          spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, messaging_replies: 0, profile_visits: 0,
        });
      }
    }

    // Calculate derived metrics
    const calculateDerived = (m: any) => {
      m.ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
      m.cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
      m.cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
      m.frequency = m.reach > 0 ? m.impressions / m.reach : 0;
      m.cpa = m.conversions > 0 ? m.spend / m.conversions : 0;
      m.roas = m.spend > 0 && m.conversion_value > 0 ? m.conversion_value / m.spend : 0;
      m.synced_at = new Date().toISOString();
      return m;
    };

    const campaignRecords = Array.from(campaignMetrics.values()).map(m => {
      const campaign = campaignMap.get(m.id);
      return calculateDerived({ ...m, status: campaign?.status || m.status, daily_budget: campaign?.daily_budget || m.daily_budget, lifetime_budget: campaign?.lifetime_budget || m.lifetime_budget });
    });

    const adsetRecords = Array.from(adsetMetrics.values()).map(m => {
      const adset = adsetMap.get(m.id);
      const record = calculateDerived({ ...m, status: adset?.status || m.status });
      delete record.objective;
      return record;
    });
    
    const adRecords = Array.from(adMetrics.values()).map(m => {
      const ad = adMap.get(m.id);
      const record = calculateDerived({ ...m, status: ad?.status || m.status });
      delete record.objective;
      return record;
    });

    // Detect changes
    const allChanges: any[] = [];
    if (campaignRecords.length > 0) {
      const campaignChanges = await detectAndRecordChanges(supabase, project_id, 'campaign', 'campaigns', campaignRecords, TRACKED_FIELDS_CAMPAIGN);
      allChanges.push(...campaignChanges);
    }
    if (adsetRecords.length > 0) {
      const adsetChanges = await detectAndRecordChanges(supabase, project_id, 'adset', 'ad_sets', adsetRecords, TRACKED_FIELDS_ADSET);
      allChanges.push(...adsetChanges);
    }
    if (adRecords.length > 0) {
      const adChanges = await detectAndRecordChanges(supabase, project_id, 'ad', 'ads', adRecords, TRACKED_FIELDS_AD);
      allChanges.push(...adChanges);
    }

    if (allChanges.length > 0) {
      await supabase.from('optimization_history').insert(allChanges);
      console.log(`[CHANGES] Recorded ${allChanges.length} changes`);
    }

    // Upsert entities
    console.log(`[UPSERT] Starting - campaigns: ${campaignRecords.length}, adsets: ${adsetRecords.length}, ads: ${adRecords.length}`);
    
    if (campaignRecords.length > 0) {
      await supabase.from('campaigns').upsert(campaignRecords, { onConflict: 'id' });
    }
    if (adsetRecords.length > 0) {
      await supabase.from('ad_sets').upsert(adsetRecords, { onConflict: 'id' });
    }
    if (adRecords.length > 0) {
      await supabase.from('ads').upsert(adRecords, { onConflict: 'id' });
    }

    // Step 5: Complete
    const duration = Date.now() - startTime;
    await supabase.from('projects').update({ 
      last_sync_at: new Date().toISOString(), 
      webhook_status: 'active',
      sync_progress: { step: 'complete', message: `Base sync concluído em ${Math.round(duration / 1000)}s`, current: 5, total: 5 }
    }).eq('id', project_id);

    console.log(`[BASE-SYNC] Completed in ${duration}ms - Records: ${dailyRecords.length}`);

    return new Response(JSON.stringify({
      success: true,
      syncMode: 'base',
      summary: {
        records: dailyRecords.length,
        campaigns: campaignRecords.length,
        adsets: adsetRecords.length,
        ads: adRecords.length,
        spend: validation.totalSpend,
        conversions: validation.totalConversions,
        changes: allChanges.length,
        duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[SYNC] Error:', error);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const body = await req.clone().json().catch(() => ({}));
      if (body.project_id) {
        await supabase.from('projects').update({ 
          sync_progress: { step: 'error', message: error instanceof Error ? error.message : 'Erro desconhecido' }
        }).eq('id', body.project_id);
      }
    } catch {}
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
