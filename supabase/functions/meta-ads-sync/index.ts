import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  project_id: string;
  ad_account_id: string;
  access_token?: string;
  date_preset?: string;
  time_range?: { since: string; until: string };
  period_key?: string;
  retry_count?: number;
  light_sync?: boolean;
  skip_image_cache?: boolean;
}

const BASE_DELAY_MS = 200;
const MAX_RETRIES = 3;
const VALIDATION_RETRY_DELAYS = [5000, 10000, 20000];

const TRACKED_FIELDS_CAMPAIGN = ['status', 'daily_budget', 'lifetime_budget', 'objective'];
const TRACKED_FIELDS_ADSET = ['status', 'daily_budget', 'lifetime_budget'];
const TRACKED_FIELDS_AD = ['status'];

// ===========================================================================================
// PRINCÍPIO ABSOLUTO: Este sistema é um ESPELHO EXATO do Gerenciador de Anúncios
// 
// O sistema DEVE usar EXCLUSIVAMENTE o campo "results" retornado pela API de Insights
// Este campo já representa o número correto baseado no objetivo da campanha, com:
// - Deduplicação aplicada pela Meta
// - Atribuição correta
// - Janela de conversão configurada
//
// É EXPRESSAMENTE PROIBIDO:
// - Somar o array "conversions"
// - Somar ou filtrar manualmente o array "actions"
// - Inferir conversões a partir de pixel, CAPI ou eventos
// - Criar lógica baseada em objective para recalcular números
//
// Se "results" for nulo ou zero, o sistema DEVE exibir zero, exatamente como o Gerenciador.
// ===========================================================================================

// Action types para métricas AUXILIARES (NÃO para conversions/results)
const MESSAGING_ACTION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d', 
  'onsite_conversion.messaging_first_reply', 
  'onsite_conversion.total_messaging_connection'
];

const PROFILE_VISIT_ACTION_TYPES = ['onsite_conversion.profile_view', 'ig_profile_visit', 'profile_visit', 'page_engagement', 'post_engagement'];

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

async function simpleFetch(url: string, options?: RequestInit, timeoutMs = 30000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Fetch failed' } };
  }
}

async function fetchWithRetry(url: string, entityName: string): Promise<any> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const data = await simpleFetch(url);
    if (!data.error) return data;
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

async function cacheCreativeImage(supabase: any, projectId: string, adId: string, imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const fileName = `${projectId}/${adId}.jpg`;
    const { data: existingFile } = await supabase.storage.from('creative-images').list(projectId, { limit: 1, search: `${adId}.jpg` });
    if (existingFile?.length > 0) {
      const { data: publicUrlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
      if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const imageBuffer = await response.arrayBuffer();
    if (imageBuffer.byteLength < 1024) return null;
    const { error: uploadError } = await supabase.storage.from('creative-images').upload(fileName, imageBuffer, { contentType: response.headers.get('content-type') || 'image/jpeg', upsert: true });
    if (uploadError) return null;
    const { data: publicUrlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
    return publicUrlData?.publicUrl || null;
  } catch { return null; }
}

async function fetchEntities(adAccountId: string, token: string, supabase?: any, projectId?: string, lightSync = false, skipImageCache = false): Promise<{
  campaigns: any[]; adsets: any[]; ads: any[]; adImageMap: Map<string, string>; videoThumbnailMap: Map<string, string>;
  creativeDataMap: Map<string, any>; cachedCreativeMap: Map<string, any>; adPreviewMap: Map<string, string>;
  immediateCache: Map<string, string>; tokenExpired?: boolean;
}> {
  const campaigns: any[] = [], adsets: any[] = [], ads: any[] = [];
  const cachedCreativeMap = new Map<string, any>();
  
  if (supabase && projectId) {
    try {
      const { data: existingAds } = await supabase.from('ads').select('id, creative_id, creative_thumbnail, creative_image_url, creative_video_url, cached_image_url, headline, primary_text, cta').eq('project_id', projectId);
      if (existingAds) for (const ad of existingAds) if (ad.creative_id && (ad.creative_thumbnail || ad.creative_image_url || ad.cached_image_url)) cachedCreativeMap.set(ad.id, { creative_id: ad.creative_id, thumbnail_url: ad.creative_thumbnail, image_url: ad.creative_image_url, video_url: ad.creative_video_url, cached_url: ad.cached_image_url, headline: ad.headline, primary_text: ad.primary_text, cta: ad.cta });
    } catch {}
  }

  const effectiveStatusFilter = encodeURIComponent('["ACTIVE","PAUSED","ARCHIVED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","PENDING_BILLING_INFO","CAMPAIGN_PAUSED","ADSET_PAUSED","IN_PROCESS","WITH_ISSUES"]');
  
  let url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'CAMPAIGNS'); if (isTokenExpiredError(data)) return { campaigns: [], adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), tokenExpired: true }; if (data.data) campaigns.push(...data.data); url = data.paging?.next || null; }
  
  url = `https://graph.facebook.com/v19.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'ADSETS'); if (isTokenExpiredError(data)) return { campaigns, adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), tokenExpired: true }; if (data.data) adsets.push(...data.data); url = data.paging?.next || null; }
  
  const adsFields = lightSync ? 'id,name,status,adset_id,campaign_id,creative{id,thumbnail_url}' : 'id,name,status,adset_id,campaign_id,creative{id,thumbnail_url,image_hash,body,title,call_to_action_type,object_story_spec{link_data{message,name,call_to_action,picture},video_data{message,title,call_to_action,video_id,image_hash}}}';
  url = `https://graph.facebook.com/v19.0/${adAccountId}/ads?fields=${adsFields}&limit=200&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'ADS'); if (isTokenExpiredError(data)) return { campaigns, adsets, ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), tokenExpired: true }; if (data.data) ads.push(...data.data); url = data.paging?.next || null; }

  console.log(`[ENTITIES] Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}`);
  
  const adImageMap = new Map<string, string>(), videoThumbnailMap = new Map<string, string>(), creativeDataMap = new Map<string, any>(), adPreviewMap = new Map<string, string>(), immediateCache = new Map<string, string>();
  
  if (lightSync) return { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap, cachedCreativeMap, adPreviewMap, immediateCache };

  // Fetch HD images
  const imageHashes = ads.filter(a => a.creative?.image_hash).map(a => a.creative.image_hash);
  for (let i = 0; i < imageHashes.length; i += 50) {
    const batch = imageHashes.slice(i, i + 50);
    const imageUrl = `https://graph.facebook.com/v19.0/${adAccountId}/adimages?hashes=${encodeURIComponent(JSON.stringify(batch))}&fields=hash,url&access_token=${token}`;
    const imageData = await fetchWithRetry(imageUrl, 'ADIMAGES');
    if (imageData.data) for (const img of imageData.data) if (img.hash && img.url) adImageMap.set(img.hash, img.url);
  }

  // Fetch video thumbnails (batch API)
  const videoIdsToFetch = ads.filter(a => a.creative?.object_story_spec?.video_data?.video_id && !cachedCreativeMap.has(a.id)).map(a => a.creative.object_story_spec.video_data.video_id);
  for (let i = 0; i < videoIdsToFetch.length; i += 50) {
    const batch = videoIdsToFetch.slice(i, i + 50);
    const batchRequests = batch.map(videoId => ({ method: 'GET', relative_url: `${videoId}?fields=id,picture,thumbnails{uri,height,width}` }));
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/?access_token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch: batchRequests }) });
      if (response.ok) {
        const results = await response.json();
        for (let j = 0; j < results.length; j++) if (results[j].code === 200 && results[j].body) { try { const d = JSON.parse(results[j].body); let thumb = d.picture; if (d.thumbnails?.data?.length) { const sorted = d.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0)); if (sorted[0]?.uri) thumb = sorted[0].uri; } if (thumb) videoThumbnailMap.set(batch[j], thumb); } catch {} }
      }
    } catch {}
  }

  // Fetch creatives (batch API)
  const creativeIdsToFetch = ads.filter(a => a.creative?.id && !cachedCreativeMap.has(a.id)).map(a => a.creative.id);
  for (let i = 0; i < creativeIdsToFetch.length; i += 50) {
    const batch = creativeIdsToFetch.slice(i, i + 50);
    const batchRequests = batch.map(creativeId => ({ method: 'GET', relative_url: `${creativeId}?fields=id,thumbnail_url,object_story_spec,body,title,call_to_action_type` }));
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/?access_token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch: batchRequests }) });
      if (response.ok) { const results = await response.json(); for (let j = 0; j < results.length; j++) if (results[j].code === 200 && results[j].body) { try { creativeDataMap.set(batch[j], JSON.parse(results[j].body)); } catch {} } }
    } catch {}
  }

  // Immediate image caching
  if (!skipImageCache && supabase && projectId) {
    const adsNeedingCache: Array<{ adId: string; imageUrl: string }> = [];
    for (const ad of ads) {
      const adId = String(ad.id);
      if (cachedCreativeMap.has(adId) && cachedCreativeMap.get(adId)?.cached_url) { immediateCache.set(adId, cachedCreativeMap.get(adId).cached_url); continue; }
      let freshImageUrl = ad.creative?.image_hash && adImageMap.has(ad.creative.image_hash) ? adImageMap.get(ad.creative.image_hash)! : null;
      if (!freshImageUrl && ad.creative?.id && creativeDataMap.has(ad.creative.id)) freshImageUrl = creativeDataMap.get(ad.creative.id)?.thumbnail_url;
      if (!freshImageUrl) { const videoId = ad.creative?.object_story_spec?.video_data?.video_id; if (videoId && videoThumbnailMap.has(videoId)) freshImageUrl = videoThumbnailMap.get(videoId)!; }
      if (!freshImageUrl && ad.creative?.thumbnail_url) freshImageUrl = ad.creative.thumbnail_url;
      if (freshImageUrl) adsNeedingCache.push({ adId, imageUrl: freshImageUrl });
    }
    for (let i = 0; i < adsNeedingCache.length; i += 10) {
      const batch = adsNeedingCache.slice(i, i + 10);
      const results = await Promise.all(batch.map(async ({ adId, imageUrl }) => ({ adId, cachedUrl: await cacheCreativeImage(supabase, projectId, adId, imageUrl) })));
      for (const { adId, cachedUrl } of results) if (cachedUrl) immediateCache.set(adId, cachedUrl);
      if (i + 10 < adsNeedingCache.length) await delay(50);
    }
    console.log(`[CACHE] Cached ${immediateCache.size} images`);
  }

  return { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap, cachedCreativeMap, adPreviewMap, immediateCache };
}

async function fetchDailyInsights(adAccountId: string, token: string, since: string, until: string): Promise<Map<string, Map<string, any>>> {
  const dailyInsights = new Map<string, Map<string, any>>();
  
  // ===========================================================================================
  // CAMPO "results" - O ÚNICO campo que deve ser usado para conversions/leads/resultados
  // Este é o campo oficial que o Gerenciador de Anúncios usa para exibir "Resultados"
  // 
  // "actions" é mantido APENAS para métricas auxiliares (messaging, profile_visits)
  // "cost_per_result" é o custo por resultado oficial da Meta
  // ===========================================================================================
  const fields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,results,cost_per_result,action_values,actions';
  
  const timeRange = JSON.stringify({ since, until });
  let url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=ad&limit=500&access_token=${token}`;
  
  while (url) {
    const data = await fetchWithRetry(url, 'INSIGHTS');
    if (data.data) {
      for (const row of data.data) {
        const adId = extractId(row.ad_id);
        const dateKey = row.date_start;
        if (adId && dateKey) {
          if (!dailyInsights.has(adId)) dailyInsights.set(adId, new Map());
          dailyInsights.get(adId)!.set(dateKey, row);
        }
      }
    }
    url = data.paging?.next || null;
    if (url) await delay(200);
  }
  
  console.log(`[INSIGHTS] Rows fetched, Unique ads: ${dailyInsights.size}`);
  return dailyInsights;
}

// ===========================================================================================
// EXTRAÇÃO DE RESULTADOS - CAMPO "results" OFICIAL DA META
// ===========================================================================================
// Este sistema é um ESPELHO do Gerenciador de Anúncios.
// Usamos EXCLUSIVAMENTE o campo "results" retornado pela API.
// 
// O campo "results" já contém:
// - O número correto de conversões baseado no objetivo da campanha
// - Deduplicação aplicada pela Meta
// - Atribuição correta
// - Janela de conversão configurada
//
// NÃO calculamos, não somamos, não filtramos. Apenas espelhamos.
// ===========================================================================================
function extractResults(insights: any): { conversions: number; conversionValue: number; costPerResult: number } {
  let conversions = 0;
  let conversionValue = 0;
  let costPerResult = 0;
  
  // CAMPO PRINCIPAL: "results" - número oficial de resultados da Meta
  // Este é o ÚNICO campo que deve ser usado para exibir conversions/leads/resultados
  if (insights?.results && Array.isArray(insights.results)) {
    for (const result of insights.results) {
      conversions += parseInt(result.value) || 0;
    }
  }
  
  // CUSTO POR RESULTADO: "cost_per_result" - campo oficial da Meta
  if (insights?.cost_per_result && Array.isArray(insights.cost_per_result)) {
    for (const cpr of insights.cost_per_result) {
      const v = parseFloat(cpr.value) || 0;
      if (v > costPerResult) costPerResult = v; // Pegar o maior se houver múltiplos
    }
  }
  
  // VALOR DE CONVERSÃO: "action_values" - somar todos os valores
  // Este campo é usado para calcular ROAS
  if (insights?.action_values && Array.isArray(insights.action_values)) {
    for (const av of insights.action_values) {
      conversionValue += parseFloat(av.value) || 0;
    }
  }
  
  console.log(`[RESULTS] results=${conversions}, cost_per_result=${costPerResult.toFixed(2)}, conversion_value=${conversionValue.toFixed(2)}`);
  
  return { conversions, conversionValue, costPerResult };
}

// Extrair messaging replies - métricas auxiliares (não afeta conversions)
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

// Extrair profile visits - métricas auxiliares (não afeta conversions)
function extractProfileVisits(insights: any): number {
  if (!insights?.actions) return 0;
  let max = 0;
  for (const a of insights.actions) {
    const v = parseInt(a.value) || 0;
    if (PROFILE_VISIT_ACTION_TYPES.includes(a.action_type) && v > max) max = v;
  }
  return max;
}

function extractAdCopy(ad: any, creativeData?: any): { primaryText: string | null; headline: string | null; cta: string | null } {
  let primaryText: string | null = null, headline: string | null = null, cta: string | null = null;
  if (creativeData) { primaryText = creativeData.body || null; headline = creativeData.title || null; cta = creativeData.call_to_action_type || null; const s = creativeData.object_story_spec; if (s?.link_data) { if (!primaryText && s.link_data.message) primaryText = s.link_data.message; if (!headline && s.link_data.name) headline = s.link_data.name; if (!cta && s.link_data.call_to_action?.type) cta = s.link_data.call_to_action.type; } if (s?.video_data) { if (!primaryText && s.video_data.message) primaryText = s.video_data.message; if (!headline && s.video_data.title) headline = s.video_data.title; if (!cta && s.video_data.call_to_action?.type) cta = s.video_data.call_to_action.type; } }
  const c = ad?.creative; if (c) { if (!primaryText && c.body) primaryText = c.body; if (!headline && c.title) headline = c.title; if (!cta && c.call_to_action_type) cta = c.call_to_action_type; const s = c.object_story_spec; if (s?.link_data) { if (!primaryText && s.link_data.message) primaryText = s.link_data.message; if (!headline && s.link_data.name) headline = s.link_data.name; if (!cta && s.link_data.call_to_action?.type) cta = s.link_data.call_to_action.type; } if (s?.video_data) { if (!primaryText && s.video_data.message) primaryText = s.video_data.message; if (!headline && s.video_data.title) headline = s.video_data.title; if (!cta && s.video_data.call_to_action?.type) cta = s.video_data.call_to_action.type; } }
  return { primaryText, headline, cta };
}

function extractCreativeImage(ad: any, creativeData?: any, adImageMap?: Map<string, string>, videoThumbnailMap?: Map<string, string>): { imageUrl: string | null; videoUrl: string | null } {
  let imageUrl: string | null = null, videoUrl: string | null = null;
  if (creativeData) { if (creativeData.image_url) imageUrl = creativeData.image_url; if (!imageUrl && creativeData.thumbnail_url) imageUrl = creativeData.thumbnail_url; const s = creativeData.object_story_spec; if (s?.link_data) { if (!imageUrl && s.link_data.image_url) imageUrl = s.link_data.image_url; if (!imageUrl && s.link_data.picture) imageUrl = s.link_data.picture; } if (s?.video_data) { if (s.video_data.video_id && videoThumbnailMap?.has(s.video_data.video_id)) imageUrl = videoThumbnailMap.get(s.video_data.video_id)!; if (s.video_data.image_url) { videoUrl = s.video_data.image_url; if (!imageUrl) imageUrl = s.video_data.image_url; } } }
  const c = ad?.creative; if (c) { if (!imageUrl && c.image_hash && adImageMap?.has(c.image_hash)) imageUrl = adImageMap.get(c.image_hash)!; if (!imageUrl && c.image_url) imageUrl = c.image_url; if (!imageUrl && c.thumbnail_url) imageUrl = c.thumbnail_url; const videoId = c.object_story_spec?.video_data?.video_id; if (videoId && videoThumbnailMap?.has(videoId) && !imageUrl) imageUrl = videoThumbnailMap.get(videoId)!; }
  return { imageUrl, videoUrl };
}

function validateSyncData(records: any[]): { isValid: boolean; totalSpend: number; totalImpressions: number; totalConversions: number } {
  const totalSpend = records.reduce((s, r) => s + (r.spend || 0), 0);
  const totalImpressions = records.reduce((s, r) => s + (r.impressions || 0), 0);
  const totalConversions = records.reduce((s, r) => s + (r.conversions || 0), 0);
  const allZero = records.length > 0 && records.every(r => (r.spend || 0) === 0 && (r.impressions || 0) === 0 && (r.clicks || 0) === 0);
  return { isValid: !allZero || records.length === 0, totalSpend, totalImpressions, totalConversions };
}

async function detectAndRecordChanges(supabase: any, projectId: string, entityType: 'campaign' | 'adset' | 'ad', tableName: string, newRecords: any[], trackedFields: string[]): Promise<any[]> {
  const changes: any[] = [];
  if (newRecords.length === 0) return changes;
  const ids = newRecords.map(r => r.id);
  const { data: existingRecords } = await supabase.from(tableName).select('*').in('id', ids).eq('project_id', projectId);
  const existingMap = new Map((existingRecords || []).map((r: any) => [r.id, r]));
  for (const newRecord of newRecords) {
    const existing = existingMap.get(newRecord.id) as Record<string, any> | undefined;
    if (!existing) { changes.push({ project_id: projectId, entity_type: entityType, entity_id: newRecord.id, entity_name: newRecord.name || 'Unknown', field_changed: 'created', old_value: null, new_value: newRecord.status || 'ACTIVE', change_type: 'created', change_percentage: null }); continue; }
    for (const field of trackedFields) {
      const oldVal = existing[field], newVal = newRecord[field];
      if (oldVal === newVal || (oldVal == null && newVal == null)) continue;
      let changeType = 'modified', changePct: number | null = null;
      if (field === 'status') { changeType = oldVal === 'ACTIVE' && newVal !== 'ACTIVE' ? 'paused' : oldVal !== 'ACTIVE' && newVal === 'ACTIVE' ? 'activated' : 'status_change'; }
      else if (field.includes('budget')) { changeType = 'budget_change'; const oldNum = parseFloat(String(oldVal)) || 0, newNum = parseFloat(String(newVal)) || 0; if (oldNum > 0) changePct = ((newNum - oldNum) / oldNum) * 100; }
      changes.push({ project_id: projectId, entity_type: entityType, entity_id: newRecord.id, entity_name: newRecord.name || existing.name || 'Unknown', field_changed: field, old_value: oldVal != null ? String(oldVal) : null, new_value: newVal != null ? String(newVal) : null, change_type: changeType, change_percentage: changePct });
    }
  }
  return changes;
}

async function detectAndSendAnomalyAlerts(supabase: any, projectId: string, changes: any[], campaignMetrics: Map<string, any>, existingCampaigns: any[]): Promise<void> {
  const { data: alertConfigs } = await supabase.from('anomaly_alert_config').select('*').eq('project_id', projectId).eq('enabled', true);
  if (!alertConfigs?.length) return;
  const anomalies: any[] = [];
  const existingMetricsMap = new Map(existingCampaigns.map(c => [c.id, c]));
  for (const config of alertConfigs) {
    for (const change of changes) {
      if (change.change_type === 'paused') { const shouldAlert = (change.entity_type === 'campaign' && config.campaign_paused_alert) || (change.entity_type === 'adset' && config.ad_set_paused_alert) || (change.entity_type === 'ad' && config.ad_paused_alert); if (shouldAlert) anomalies.push({ project_id: projectId, anomaly_type: `${change.entity_type}_paused`, entity_type: change.entity_type, entity_id: change.entity_id, entity_name: change.entity_name, details: { old_status: change.old_value, new_status: change.new_value }, severity: 'warning' }); }
      if (change.change_type === 'budget_change' && config.budget_change_alert) anomalies.push({ project_id: projectId, anomaly_type: 'budget_change', entity_type: change.entity_type, entity_id: change.entity_id, entity_name: change.entity_name, details: { old_budget: change.old_value, new_budget: change.new_value, change_percentage: change.change_percentage }, severity: Math.abs(change.change_percentage || 0) > 50 ? 'critical' : 'warning' });
    }
    for (const [campaignId, newMetrics] of campaignMetrics.entries()) {
      const existing = existingMetricsMap.get(campaignId);
      if (!existing) continue;
      const oldCtr = existing.ctr || 0, newCtr = newMetrics.ctr || 0;
      if (oldCtr > 0 && newCtr > 0) { const ctrChange = ((newCtr - oldCtr) / oldCtr) * 100; if (ctrChange < -(config.ctr_drop_threshold || 20)) anomalies.push({ project_id: projectId, anomaly_type: 'ctr_drop', entity_type: 'campaign', entity_id: campaignId, entity_name: newMetrics.name || existing.name || 'Unknown', details: { old_ctr: oldCtr.toFixed(2), new_ctr: newCtr.toFixed(2), change_percentage: ctrChange.toFixed(1) }, severity: Math.abs(ctrChange) > 40 ? 'critical' : 'warning' }); }
      const oldCpa = existing.cpa || 0, newCpa = newMetrics.cpa || 0;
      if (oldCpa > 0 && newCpa > 0) { const cpaChange = ((newCpa - oldCpa) / oldCpa) * 100; if (cpaChange > (config.cpl_increase_threshold || 30)) anomalies.push({ project_id: projectId, anomaly_type: 'cpl_increase', entity_type: 'campaign', entity_id: campaignId, entity_name: newMetrics.name || existing.name || 'Unknown', details: { old_cpl: oldCpa.toFixed(2), new_cpl: newCpa.toFixed(2), change_percentage: cpaChange.toFixed(1) }, severity: cpaChange > 60 ? 'critical' : 'warning' }); }
    }
  }
  if (anomalies.length > 0) {
    await supabase.from('anomaly_alerts').insert(anomalies);
    console.log(`[ANOMALY] Saved ${anomalies.length} anomalies`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: SyncRequest = await req.json();
    const { project_id, ad_account_id, access_token, date_preset, time_range, retry_count = 0, light_sync = false, skip_image_cache = false } = body;
    
    let since: string, until: string;
    if (time_range) { since = time_range.since; until = time_range.until; }
    else { const today = new Date(); until = today.toISOString().split('T')[0]; const daysMap: Record<string, number> = { yesterday: 1, today: 0, last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90 }; const days = daysMap[date_preset || 'last_90d'] || 90; const sinceDate = new Date(today); sinceDate.setDate(sinceDate.getDate() - days); since = sinceDate.toISOString().split('T')[0]; }
    
    console.log(`[SYNC] Project: ${project_id}, Range: ${since} to ${until}, light_sync: ${light_sync}, skip_cache: ${skip_image_cache}`);
    const token = access_token || metaAccessToken;
    if (!token) throw new Error('No Meta access token available');
    
    const { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap, cachedCreativeMap, immediateCache, tokenExpired } = await fetchEntities(ad_account_id, token, supabase, project_id, light_sync, skip_image_cache);
    if (tokenExpired) return new Response(JSON.stringify({ success: false, error: 'Token do Meta expirou.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
    const campaignMap = new Map(campaigns.map(c => [extractId(c.id), c]));
    const adsetMap = new Map(adsets.map(a => [extractId(a.id), a]));
    const adMap = new Map(ads.map(a => [extractId(a.id), a]));
    
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);
    const dailyRecords: any[] = [];
    
    for (const [adId, dateMap] of dailyInsights) {
      for (const [date, insights] of dateMap) {
        const ad = adMap.get(adId);
        const adsetId = extractId(insights.adset_id), campaignId = extractId(insights.campaign_id);
        const adset = adsetId ? adsetMap.get(adsetId) : null;
        const campaign = campaignId ? campaignMap.get(campaignId) : null;
        
        // ===========================================================================================
        // EXTRAÇÃO DE RESULTADOS - USANDO EXCLUSIVAMENTE O CAMPO "results" DA API
        // Não calculamos, não somamos actions, não filtramos. Apenas espelhamos a Meta.
        // ===========================================================================================
        const { conversions, conversionValue, costPerResult } = extractResults(insights);
        const messagingReplies = extractMessagingReplies(insights);
        const profileVisits = extractProfileVisits(insights);
        
        const spend = parseFloat(insights.spend) || 0;
        const impressions = parseInt(insights.impressions) || 0;
        const clicks = parseInt(insights.clicks) || 0;
        const reach = parseInt(insights.reach) || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const frequency = reach > 0 ? impressions / reach : 0;
        // CPA: Usar o cost_per_result oficial da Meta, ou calcular se não disponível
        const cpa = costPerResult > 0 ? costPerResult : (conversions > 0 ? spend / conversions : 0);
        const roas = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0;
        
        const creativeData = ad?.creative?.id ? creativeDataMap.get(ad.creative.id) : null;
        const cachedData = cachedCreativeMap.get(adId);
        const { primaryText, headline, cta } = extractAdCopy(ad, creativeData);
        const { imageUrl } = extractCreativeImage(ad, creativeData, adImageMap, videoThumbnailMap);
        const cachedUrl = immediateCache.get(adId) || cachedData?.cached_url || null;
        
        dailyRecords.push({
          project_id,
          date,
          ad_account_id,
          campaign_id: campaignId || '',
          campaign_name: insights.campaign_name || campaign?.name || 'Unknown',
          campaign_status: campaign?.status || null,
          campaign_objective: campaign?.objective || null,
          adset_id: adsetId || '',
          adset_name: insights.adset_name || adset?.name || 'Unknown',
          adset_status: adset?.status || null,
          ad_id: adId,
          ad_name: insights.ad_name || ad?.name || 'Unknown',
          ad_status: ad?.status || null,
          creative_id: ad?.creative?.id || null,
          creative_thumbnail: imageUrl || cachedData?.thumbnail_url || null,
          cached_creative_thumbnail: cachedUrl,
          spend,
          impressions,
          clicks,
          reach,
          ctr,
          cpm,
          cpc,
          frequency,
          conversions, // VALOR OFICIAL DA API
          conversion_value: conversionValue,
          cpa,
          roas,
          messaging_replies: messagingReplies,
          profile_visits: profileVisits,
          synced_at: new Date().toISOString()
        });
      }
    }
    
    const validation = validateSyncData(dailyRecords);
    console.log(`[VALIDATION] Records: ${dailyRecords.length}, Spend: ${validation.totalSpend.toFixed(2)}, Conversions: ${validation.totalConversions}`);
    
    if (!validation.isValid && retry_count < 3) {
      console.log(`[VALIDATION] Invalid data, retry ${retry_count + 1}`);
      return new Response(JSON.stringify({ success: false, error: 'Validation failed', retry: true }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Upsert daily records
    if (dailyRecords.length > 0) {
      for (let i = 0; i < dailyRecords.length; i += 500) {
        const batch = dailyRecords.slice(i, i + 500);
        await supabase.from('ads_daily_metrics').upsert(batch, { onConflict: 'project_id,ad_id,date' });
      }
    }
    
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
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        conversions: 0,
        conversion_value: 0,
        messaging_replies: 0,
        profile_visits: 0,
        ...extra
      });
      
      if (!campaignMetrics.has(r.campaign_id)) {
        campaignMetrics.set(r.campaign_id, initMetric(r.campaign_id, r.campaign_name, { status: r.campaign_status, objective: r.campaign_objective }));
      }
      if (!adsetMetrics.has(r.adset_id)) {
        adsetMetrics.set(r.adset_id, initMetric(r.adset_id, r.adset_name, { status: r.adset_status, campaign_id: r.campaign_id }));
      }
      if (!adMetrics.has(r.ad_id)) {
        adMetrics.set(r.ad_id, initMetric(r.ad_id, r.ad_name, { status: r.ad_status, campaign_id: r.campaign_id, ad_set_id: r.adset_id, creative_id: r.creative_id, creative_thumbnail: r.creative_thumbnail, cached_image_url: r.cached_creative_thumbnail }));
      }
      
      // Aggregate
      for (const [map, id] of [[campaignMetrics, r.campaign_id], [adsetMetrics, r.adset_id], [adMetrics, r.ad_id]] as const) {
        const m = map.get(id);
        m.spend += r.spend;
        m.impressions += r.impressions;
        m.clicks += r.clicks;
        m.reach += r.reach;
        m.conversions += r.conversions;
        m.conversion_value += r.conversion_value;
        m.messaging_replies = (m.messaging_replies || 0) + (r.messaging_replies || 0);
        m.profile_visits = (m.profile_visits || 0) + (r.profile_visits || 0);
      }
    }
    
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
    
    const campaignRecords = Array.from(campaignMetrics.values()).map(calculateDerived);
    const adsetRecords = Array.from(adsetMetrics.values()).map(calculateDerived);
    const adRecords = Array.from(adMetrics.values()).map(calculateDerived);
    
    // Detect changes
    const allChanges: any[] = [];
    allChanges.push(...await detectAndRecordChanges(supabase, project_id, 'campaign', 'campaigns', campaignRecords, TRACKED_FIELDS_CAMPAIGN));
    allChanges.push(...await detectAndRecordChanges(supabase, project_id, 'adset', 'ad_sets', adsetRecords, TRACKED_FIELDS_ADSET));
    allChanges.push(...await detectAndRecordChanges(supabase, project_id, 'ad', 'ads', adRecords, TRACKED_FIELDS_AD));
    
    if (allChanges.length > 0) {
      await supabase.from('optimization_history').insert(allChanges);
      const { data: existingCampaigns } = await supabase.from('campaigns').select('id, name, ctr, cpa').eq('project_id', project_id);
      await detectAndSendAnomalyAlerts(supabase, project_id, allChanges, campaignMetrics, existingCampaigns || []);
    }
    
    // Upsert entities
    if (campaignRecords.length > 0) await supabase.from('campaigns').upsert(campaignRecords, { onConflict: 'id' });
    if (adsetRecords.length > 0) await supabase.from('ad_sets').upsert(adsetRecords, { onConflict: 'id' });
    if (adRecords.length > 0) await supabase.from('ads').upsert(adRecords, { onConflict: 'id' });
    
    await supabase.from('projects').update({ last_sync_at: new Date().toISOString() }).eq('id', project_id);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[COMPLETE] ${dailyRecords.length} records, ${validation.totalConversions} conversions in ${elapsed}s`);
    
    return new Response(JSON.stringify({
      success: true,
      records: dailyRecords.length,
      campaigns: campaignRecords.length,
      adsets: adsetRecords.length,
      ads: adRecords.length,
      validation,
      elapsed_seconds: elapsed
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[ERROR]', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
