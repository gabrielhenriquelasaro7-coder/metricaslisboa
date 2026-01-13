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
  syncMode?: 'base' | 'creatives' | 'hd_images';
  retry_count?: number;
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
  
  // Campos básicos conforme especificação
  const fields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values,conversions,cost_per_action_type,results,cost_per_result';
  
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
// ===========================================================================================
async function syncCreatives(supabase: any, projectId: string, adAccountId: string, token: string): Promise<{ updated: number; total: number }> {
  console.log(`[CREATIVE-SYNC] Starting for project ${projectId}`);
  
  // Buscar ads existentes que precisam de criativo
  const { data: existingAds, error: adsError } = await supabase
    .from('ads')
    .select('id, creative_id, headline, primary_text, cta, creative_thumbnail')
    .eq('project_id', projectId)
    .limit(500); // Limit to avoid timeout
  
  if (adsError) throw adsError;
  
  // Filtrar ads sem texto
  const adsNeedingCreative = (existingAds || []).filter((ad: any) => 
    !ad.headline || !ad.primary_text
  );
  
  console.log(`[CREATIVE-SYNC] Found ${existingAds?.length || 0} ads, ${adsNeedingCreative.length} need creative update`);
  
  if (adsNeedingCreative.length === 0) {
    return { updated: 0, total: 0 };
  }
  
  // Limit to 200 ads per sync to avoid timeout
  const adsToProcess = adsNeedingCreative.slice(0, 200);
  const adIds = adsToProcess.map((ad: any) => ad.id);
  let updatedCount = 0;
  const batchSize = 50;
  const totalBatches = Math.ceil(adIds.length / batchSize);
  
  // Buscar creative data da API em batches de 50
  for (let i = 0; i < adIds.length; i += batchSize) {
    const batchNumber = Math.floor(i / batchSize) + 1;
    const batch = adIds.slice(i, i + batchSize);
    const batchIds = batch.join(',');
    
    // Update progress for this batch (0-50% range for text phase)
    const progressPercent = Math.round((batchNumber / totalBatches) * 50);
    await updateSyncProgress(supabase, projectId, 'creatives', `Textos: batch ${batchNumber}/${totalBatches}`, progressPercent, 100);
    
    // Campos do creative
    const adsUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=id,creative{id,body,title,call_to_action_type,thumbnail_url,object_story_spec,asset_feed_spec}&access_token=${token}`;
    const adsData = await simpleFetch(adsUrl, undefined, 20000); // Reduced timeout
    
    if (adsData?.error) {
      console.log(`[CREATIVE-SYNC] Batch ${batchNumber} error: ${adsData.error.message?.substring(0, 100)}`);
      continue;
    }
    
    // Process batch in parallel
    const updatePromises: Promise<void>[] = [];
    
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
      
      // Thumbnail de baixa resolução
      if (creative.thumbnail_url) thumbnailUrl = creative.thumbnail_url;
      
      // Atualizar o ad no banco
      const updateData: any = {
        creative_id: creative.id || null,
        synced_at: new Date().toISOString()
      };
      
      if (primaryText) updateData.primary_text = primaryText;
      if (headline) updateData.headline = headline;
      if (cta) updateData.cta = cta;
      if (thumbnailUrl) updateData.creative_thumbnail = thumbnailUrl;
      
      updatePromises.push(
        supabase.from('ads').update(updateData).eq('id', adId)
          .then(() => { updatedCount++; })
          .catch((e: any) => console.log(`[CREATIVE-SYNC] Update error for ${adId}: ${e.message}`))
      );
    }
    
    // Wait for all updates in this batch
    await Promise.all(updatePromises);
    
    console.log(`[CREATIVE-SYNC] Batch ${batchNumber}/${totalBatches} processed`);
    if (i + batchSize < adIds.length) await delay(200); // Reduced delay
  }
  
  console.log(`[CREATIVE-SYNC] Completed - updated ${updatedCount} ads`);
  return { updated: updatedCount, total: adsToProcess.length };
}

// ===========================================================================================
// 3️⃣ HD IMAGE SYNC - Busca imagens em resolução adequada
// Campos válidos do AdCreative: thumbnail_url, object_story_spec
// Fallback: usar creative_thumbnail já salvo no banco
// ===========================================================================================
async function syncHDImages(supabase: any, projectId: string, adAccountId: string, token: string): Promise<{ cached: number; total: number; errors: number }> {
  console.log(`[HD-IMAGE-SYNC] Starting for project ${projectId}`);
  
  // Buscar ads que têm creative_thumbnail mas não têm cached_image_url
  const { data: adsNeedingCache, error: adsError } = await supabase
    .from('ads')
    .select('id, creative_id, creative_thumbnail')
    .eq('project_id', projectId)
    .is('cached_image_url', null)
    .not('creative_thumbnail', 'is', null)
    .limit(100);
  
  if (adsError) throw adsError;
  
  console.log(`[HD-IMAGE-SYNC] Found ${adsNeedingCache?.length || 0} ads with thumbnails needing cache`);
  
  if (!adsNeedingCache || adsNeedingCache.length === 0) {
    return { cached: 0, total: 0, errors: 0 };
  }
  
  let cachedCount = 0;
  let errorsCount = 0;
  
  // Mapa de creative_id -> melhor URL disponível (da API ou fallback)
  const adToUrlMap = new Map<string, string>();
  
  // Coletar creative IDs únicos para tentar buscar URLs melhores da API
  const creativeIds = [...new Set(adsNeedingCache.map((ad: any) => ad.creative_id).filter(Boolean))];
  
  if (creativeIds.length > 0) {
    console.log(`[HD-IMAGE-SYNC] Trying to fetch better URLs for ${creativeIds.length} creatives`);
    
    const batchSize = 50;
    for (let i = 0; i < creativeIds.length; i += batchSize) {
      const batch = creativeIds.slice(i, i + batchSize);
      const batchIds = batch.join(',');
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      await updateSyncProgress(supabase, projectId, 'hd_images', `Buscando URLs: batch ${batchNumber}`, 50, 100);
      
      // Usar apenas campos VÁLIDOS: thumbnail_url e object_story_spec
      const creativesUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=id,thumbnail_url,object_story_spec&access_token=${token}`;
      const creativesData = await simpleFetch(creativesUrl, undefined, 30000);
      
      if (!creativesData?.error) {
        for (const creativeId of batch) {
          const creativeIdStr = String(creativeId);
          const creative = (creativesData as Record<string, any>)[creativeIdStr];
          
          if (!creative) continue;
          
          let bestUrl: string | null = null;
          
          // 1. object_story_spec pode ter URLs de imagem em alta resolução
          if (creative.object_story_spec) {
            const oss = creative.object_story_spec;
            // link_data.picture geralmente é a melhor opção
            if (oss.link_data?.picture && !oss.link_data.picture.includes('p64x64')) {
              bestUrl = oss.link_data.picture;
            } else if (oss.video_data?.image_url && !oss.video_data.image_url.includes('p64x64')) {
              bestUrl = oss.video_data.image_url;
            } else if (oss.photo_data?.images?.[0]?.url) {
              bestUrl = oss.photo_data.images[0].url;
            }
          }
          
          // 2. thumbnail_url (geralmente pequeno, mas usável)
          if (!bestUrl && creative.thumbnail_url) {
            // Tentar modificar a URL para pegar resolução maior
            // Facebook thumbnails podem ter parâmetros de tamanho
            let thumbUrl = creative.thumbnail_url;
            // Remover limitações de tamanho da URL se existirem
            thumbUrl = thumbUrl.replace(/p64x64/g, 'p720x720');
            thumbUrl = thumbUrl.replace(/c0\.5000x0\.5000f_dst-emg0_p64x64/g, 'dst-jpg');
            bestUrl = thumbUrl;
          }
          
          if (bestUrl) {
            // Mapear para todos os ads que usam este creative
            for (const ad of adsNeedingCache) {
              if (String(ad.creative_id) === creativeIdStr) {
                adToUrlMap.set(ad.id, bestUrl);
              }
            }
          }
        }
      } else {
        console.log(`[HD-IMAGE-SYNC] API error (will use fallback): ${creativesData.error.message?.substring(0, 80)}`);
      }
      
      if (i + batchSize < creativeIds.length) {
        await delay(300);
      }
    }
  }
  
  console.log(`[HD-IMAGE-SYNC] Got ${adToUrlMap.size} better URLs from API`);
  
  // Para ads sem URL melhor, usar o creative_thumbnail já salvo
  for (const ad of adsNeedingCache) {
    if (!adToUrlMap.has(ad.id) && ad.creative_thumbnail) {
      adToUrlMap.set(ad.id, ad.creative_thumbnail);
    }
  }
  
  console.log(`[HD-IMAGE-SYNC] Total ${adToUrlMap.size} ads to cache (API + fallback)`);
  
  // Fazer cache das imagens
  const adsToCache = adsNeedingCache.filter((ad: any) => adToUrlMap.has(ad.id));
  
  for (let k = 0; k < adsToCache.length; k += 5) {
    const adBatch = adsToCache.slice(k, k + 5);
    const progressPercent = 60 + Math.round((k / adsToCache.length) * 40);
    await updateSyncProgress(supabase, projectId, 'hd_images', `Salvando: ${k}/${adsToCache.length}`, progressPercent, 100);
    
    const promises = adBatch.map(async (ad: any) => {
      const imageUrl = adToUrlMap.get(ad.id);
      if (!imageUrl) return;
      
      try {
        const cachedUrl = await cacheCreativeImage(supabase, projectId, ad.id, imageUrl);
        if (cachedUrl) {
          await supabase
            .from('ads')
            .update({ 
              cached_image_url: cachedUrl,
              creative_image_url: imageUrl,
              synced_at: new Date().toISOString()
            })
            .eq('id', ad.id);
          cachedCount++;
        }
      } catch (e) {
        console.log(`[HD-IMAGE-SYNC] Cache error for ad ${ad.id}: ${e}`);
        errorsCount++;
      }
    });
    await Promise.all(promises);
  }
  
  console.log(`[HD-IMAGE-SYNC] Completed - cached: ${cachedCount}, errors: ${errorsCount}`);
  return { cached: cachedCount, total: adsNeedingCache.length, errors: errorsCount };
}

// Cache de imagem HD
async function cacheCreativeImage(supabase: any, projectId: string, adId: string, imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const fileName = `${projectId}/${adId}.jpg`;
    
    // Verificar se já existe com tamanho adequado
    const { data: existingFile } = await supabase.storage.from('creative-images').list(projectId, { limit: 1, search: `${adId}.jpg` });
    if (existingFile?.length > 0) {
      const fileSize = existingFile[0]?.metadata?.size || 0;
      if (fileSize > 5000) {
        const { data: publicUrlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout
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
    
    // Reduced minimum size to 3KB (some valid images can be small)
    if (imageBuffer.byteLength < 3000) {
      console.log(`[CACHE] Image too small (${imageBuffer.byteLength} bytes): ${adId}`);
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
    console.log(`[CACHE] Cached HD image (${Math.round(imageBuffer.byteLength/1024)}KB): ${adId}`);
    return publicUrlData?.publicUrl || null;
  } catch (e) { 
    console.log(`[CACHE] Error caching ${adId}: ${e}`);
    return null; 
  }
}

// Tipos de conversão
const FORM_LEAD_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'fb_pixel_lead'];
const CONTACT_LEAD_ACTION_TYPES = ['contact_total', 'contact_website', 'contact', 'omni_complete_registration', 'complete_registration', 'submit_application', 'submit_application_total'];
const MESSAGE_LEAD_ACTION_TYPES = ['messaging_conversation_started_7d', 'onsite_conversion.messaging_conversation_started_7d'];
const PURCHASE_ACTION_TYPES = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'];
const INITIATE_CHECKOUT_ACTION_TYPES = ['initiate_checkout', 'omni_initiated_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'onsite_conversion.initiate_checkout'];

const ALL_LEAD_ACTION_TYPES = [...FORM_LEAD_ACTION_TYPES, ...CONTACT_LEAD_ACTION_TYPES, ...MESSAGE_LEAD_ACTION_TYPES];
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

  // FONTE 1: Campo "results"
  if (Array.isArray(row.results) && row.results.length > 0) {
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
  const allZero = records.length > 0 && records.every(r => (r.spend || 0) === 0 && (r.impressions || 0) === 0 && (r.clicks || 0) === 0);
  return { isValid: !allZero || records.length === 0, totalSpend, totalImpressions, totalConversions };
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
    let { project_id, ad_account_id, access_token, time_range, date_preset, syncMode = 'base', retry_count = 0 } = body;
    
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
    
    console.log(`[SYNC] Mode: ${syncMode}, Project: ${project_id}`);
    
    // ===========================================================================================
    // 2️⃣ CREATIVE SYNC MODE (busca texto + depois HD automaticamente)
    // ===========================================================================================
    if (syncMode === 'creatives') {
      console.log(`[SYNC] Starting CREATIVE SYNC for project ${project_id}`);
      
      // Etapa 1: Buscar texto (headline, primary_text, cta, thumbnail baixa res)
      await updateSyncProgress(supabase, project_id, 'creatives', 'Etapa 1/2: Buscando textos dos anúncios...', 0, 100);
      const creativeResult = await syncCreatives(supabase, project_id, ad_account_id, token);
      console.log(`[SYNC] Creative text sync completed: ${creativeResult.updated} ads updated`);
      
      // Etapa 2: Buscar imagens HD
      await updateSyncProgress(supabase, project_id, 'hd_images', 'Etapa 2/2: Buscando imagens em alta resolução...', 50, 100);
      const hdResult = await syncHDImages(supabase, project_id, ad_account_id, token);
      console.log(`[SYNC] HD image sync completed: ${hdResult.cached}/${hdResult.total} images cached`);
      
      await updateSyncProgress(supabase, project_id, 'complete', `Criativos: ${creativeResult.updated} textos, ${hdResult.cached} imagens HD`, 100, 100);
      
      return new Response(JSON.stringify({ 
        success: true, 
        syncMode: 'creatives',
        creatives: {
          updated: creativeResult.updated,
          total: creativeResult.total
        },
        hdImages: {
          cached: hdResult.cached,
          total: hdResult.total,
          errors: hdResult.errors
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
      
      await updateSyncProgress(supabase, project_id, 'complete', `Imagens HD: ${result.cached}/${result.total}`, 2, 2);
      
      return new Response(JSON.stringify({ 
        success: true, 
        syncMode: 'hd_images',
        cached: result.cached,
        total: result.total,
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
    
    console.log(`[BASE-SYNC] Project: ${project_id}, Range: ${since} to ${until}`);
    
    // Step 1: Fetch entities (estrutura básica)
    await updateSyncProgress(supabase, project_id, 'campaigns', 'Buscando campanhas, conjuntos e anúncios...', 1, 5);
    
    const { campaigns, adsets, ads, tokenExpired } = await fetchEntitiesBase(ad_account_id, token);
    
    if (tokenExpired) {
      await updateSyncProgress(supabase, project_id, 'error', 'Token do Meta expirou');
      return new Response(JSON.stringify({ success: false, error: 'Token do Meta expirou.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Step 2: Build maps
    await updateSyncProgress(supabase, project_id, 'processing', `Processando ${campaigns.length} campanhas, ${adsets.length} conjuntos, ${ads.length} anúncios...`, 2, 5);
    
    const campaignMap = new Map(campaigns.map(c => [extractId(c.id), c]));
    const adsetMap = new Map(adsets.map(a => [extractId(a.id), a]));
    const adMap = new Map(ads.map(a => [extractId(a.id), a]));
    
    // Step 3: Fetch insights (métricas diárias)
    await updateSyncProgress(supabase, project_id, 'insights', 'Buscando métricas diárias...', 3, 5);
    
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);
    
    const dailyRecords: any[] = [];
    
    for (const [adId, dateMap] of dailyInsights) {
      for (const [date, insights] of dateMap) {
        const ad = adMap.get(adId);
        const adset = adsetMap.get(extractId(insights.adset_id));
        const campaign = campaignMap.get(extractId(insights.campaign_id));
        
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
            onConflict: 'id',  // Use ID único ao invés de constraint composta
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
