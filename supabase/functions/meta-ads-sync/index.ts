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
// O número oficial de conversões SEMPRE vem do campo "results".
// Se "results" não existir ou vier vazio → conversões = 0.
// 
// NUNCA usar "actions" ou "conversions" para o número principal.
// O campo "actions" é usado APENAS para métricas auxiliares:
//   - messaging_replies (conversas iniciadas)
//   - profile_visits (visitas ao perfil)
// ===========================================================================================

// Action types para métricas AUXILIARES (não afetam conversions)
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
  
  // API v21.0 - Versão atualizada
  let url = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'CAMPAIGNS'); if (isTokenExpiredError(data)) return { campaigns: [], adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), tokenExpired: true }; if (data.data) campaigns.push(...data.data); url = data.paging?.next || null; }
  
  url = `https://graph.facebook.com/v21.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'ADSETS'); if (isTokenExpiredError(data)) return { campaigns, adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), tokenExpired: true }; if (data.data) adsets.push(...data.data); url = data.paging?.next || null; }
  
  const adsFields = lightSync ? 'id,name,status,adset_id,campaign_id,creative{id,thumbnail_url}' : 'id,name,status,adset_id,campaign_id,creative{id,thumbnail_url,image_hash,body,title,call_to_action_type,object_story_spec{link_data{message,name,call_to_action,picture},video_data{message,title,call_to_action,video_id,image_hash}}}';
  url = `https://graph.facebook.com/v21.0/${adAccountId}/ads?fields=${adsFields}&limit=200&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'ADS'); if (isTokenExpiredError(data)) return { campaigns, adsets, ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), tokenExpired: true }; if (data.data) ads.push(...data.data); url = data.paging?.next || null; }

  console.log(`[ENTITIES] Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}`);
  
  const adImageMap = new Map<string, string>(), videoThumbnailMap = new Map<string, string>(), creativeDataMap = new Map<string, any>(), adPreviewMap = new Map<string, string>(), immediateCache = new Map<string, string>();
  
  if (lightSync) return { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap, cachedCreativeMap, adPreviewMap, immediateCache };

  // Fetch HD images
  const imageHashes = ads.filter(a => a.creative?.image_hash).map(a => a.creative.image_hash);
  for (let i = 0; i < imageHashes.length; i += 50) {
    const batch = imageHashes.slice(i, i + 50);
    const imageUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adimages?hashes=${encodeURIComponent(JSON.stringify(batch))}&fields=hash,url&access_token=${token}`;
    const imageData = await fetchWithRetry(imageUrl, 'ADIMAGES');
    if (imageData.data) for (const img of imageData.data) if (img.hash && img.url) adImageMap.set(img.hash, img.url);
  }

  // Fetch video thumbnails (batch API)
  const videoIdsToFetch = ads.filter(a => a.creative?.object_story_spec?.video_data?.video_id && !cachedCreativeMap.has(a.id)).map(a => a.creative.object_story_spec.video_data.video_id);
  for (let i = 0; i < videoIdsToFetch.length; i += 50) {
    const batch = videoIdsToFetch.slice(i, i + 50);
    const batchRequests = batch.map(videoId => ({ method: 'GET', relative_url: `${videoId}?fields=id,picture,thumbnails{uri,height,width}` }));
    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/?access_token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch: batchRequests }) });
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
      const response = await fetch(`https://graph.facebook.com/v21.0/?access_token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch: batchRequests }) });
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
  // FONTE DE VERDADE - Campos oficiais do Gerenciador de Anúncios
  // 
  // results = número oficial de resultados (igual ao Gerenciador)
  // cost_per_result = CPA oficial da Meta
  // action_values = valor de conversão (para ROAS)
  // actions = métricas auxiliares (messaging, profile visits, leads, etc)
  // conversions = campo legado que às vezes tem dados quando results não tem
  // website_ctr = CTR de cliques no link (útil para diagnóstico)
  // ===========================================================================================
  // Campos que DEVEM ser retornados - incluindo actions para capturar leads
  const fields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values,conversions,cost_per_action_type,website_ctr,inline_link_clicks,outbound_clicks';
  
  const timeRange = JSON.stringify({ since, until });
  // IMPORTANTE: Adicionando action_breakdowns para garantir que actions seja retornado
  let url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=ad&limit=500&action_breakdowns=action_type&access_token=${token}`;
  
  let totalRows = 0;
  let firstRowLogged = false;
  
  while (url) {
    const data = await fetchWithRetry(url, 'INSIGHTS');
    if (data.data) {
      for (const row of data.data) {
        // DEBUG: Log detalhado do primeiro registro (OBRIGATÓRIO para validação)
        if (!firstRowLogged) {
          console.log(`[INSIGHTS] === SAMPLE ROW (primeira linha) ===`);
          console.log(`[INSIGHTS] KEYS: ${Object.keys(row).join(', ')}`);
          console.log(`[INSIGHTS] FULL results array: ${JSON.stringify(row.results)}`);
          console.log(`[INSIGHTS] FULL cost_per_result array: ${JSON.stringify(row.cost_per_result)}`);
          console.log(`[INSIGHTS] spend: ${row.spend}, impressions: ${row.impressions}, clicks: ${row.clicks}`);
          
          // Log detalhado de results para debug
          if (row.results) {
            for (const r of row.results) {
              console.log(`[INSIGHTS] results item: action_type=${r.action_type}, value=${r.value}, indicator=${r.indicator}`);
            }
          }
          
          // Log COMPLETO de actions para debug (CRÍTICO para diagnóstico)
          if (row.actions && row.actions.length > 0) {
            console.log(`[INSIGHTS] TOTAL actions count: ${row.actions.length}`);
            for (const action of row.actions) {
              console.log(`[INSIGHTS] action: type=${action.action_type}, value=${action.value}`);
            }
          } else {
            console.log(`[INSIGHTS] actions array is EMPTY or UNDEFINED`);
          }
          
          // Log de action_values
          if (row.action_values && row.action_values.length > 0) {
            console.log(`[INSIGHTS] action_values count: ${row.action_values.length}`);
            for (const av of row.action_values.slice(0, 5)) {
              console.log(`[INSIGHTS] action_value: type=${av.action_type}, value=${av.value}`);
            }
          }
          
          // Log DETALHADO de conversions (campo legado) - ver todos os action_types
          if (row.conversions && row.conversions.length > 0) {
            console.log(`[INSIGHTS] TOTAL conversions count: ${row.conversions.length}`);
            for (const c of row.conversions) {
              console.log(`[INSIGHTS] conversion: type=${c.action_type}, value=${c.value}`);
            }
          } else {
            console.log(`[INSIGHTS] conversions field is EMPTY or UNDEFINED`);
          }
          console.log(`[INSIGHTS] cost_per_conversion field: ${JSON.stringify(row.cost_per_conversion)}`);
          console.log(`[INSIGHTS] inline_link_clicks: ${row.inline_link_clicks}, outbound_clicks: ${JSON.stringify(row.outbound_clicks)}`);
          
          firstRowLogged = true;
        }
        
        const adId = extractId(row.ad_id);
        const dateKey = row.date_start;
        if (adId && dateKey) {
          if (!dailyInsights.has(adId)) dailyInsights.set(adId, new Map());
          dailyInsights.get(adId)!.set(dateKey, row);
          totalRows++;
        }
      }
    }
    url = data.paging?.next || null;
    if (url) await delay(200);
  }
  
  console.log(`[INSIGHTS] Total rows: ${totalRows}, Unique ads: ${dailyInsights.size}`);
  return dailyInsights;
}

// ===========================================================================================
// EXTRAÇÃO DE CONVERSÕES - FALLBACK HIERÁRQUICO
// ===========================================================================================
// 
// Ordem de prioridade (usa o PRIMEIRO que tiver valor > 0):
// 1. results (campo oficial do Gerenciador)
// 2. actions (filtrado por tipos de conversão)
// 3. 0 (se nada existir)
// 
// Uma vez detectada a fonte, usar APENAS ela para consistência.
// ===========================================================================================

// ===========================================================================================
// TIPOS DE CONVERSÃO SEPARADOS POR CATEGORIA
// 
// *** REGRA CRÍTICA DO GERENCIADOR DE ANÚNCIOS: ***
// O campo "Resultados" no Gerenciador pode mostrar diferentes tipos dependendo do objetivo:
// - Campanhas de LEAD: lead, contact, complete_registration
// - Campanhas de MENSAGEM: messaging_conversation_started_7d
// - Campanhas de VENDAS: purchase
// 
// TODOS são considerados "leads/conversões" para o dashboard!
// ===========================================================================================

// Tipos que contam como LEADS DE FORMULÁRIO (formulários de lead no site)
const FORM_LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
];

// Tipos que contam como CONTATO NO SITE (objetivo de cadastro/contato)
// Estes SÃO o "Resultado" para campanhas de CADASTRO/LEADS que não usam formulário Meta
const CONTACT_LEAD_ACTION_TYPES = [
  'contact_total',
  'contact_website', 
  'contact',
  'omni_complete_registration',
  'complete_registration',
  'submit_application',
  'submit_application_total',
];

// Tipos que contam como LEADS DE MENSAGEM (WhatsApp, Messenger, DM)
// APENAS messaging_conversation_started_7d - é o "Resultado" oficial para campanhas de mensagem
const MESSAGE_LEAD_ACTION_TYPES = [
  'messaging_conversation_started_7d',
  'onsite_conversion.messaging_conversation_started_7d',
];

// Tipos AUXILIARES de mensagem (NÃO são o resultado principal - evitar duplicação)
const MESSAGING_AUXILIARY_TYPES = [
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
  'messaging_first_reply',
  'total_messaging_connection',
];

// Tipos que contam como VENDAS/COMPRAS (receita)
const PURCHASE_ACTION_TYPES = [
  'purchase',
  'omni_purchase',
];

// Todos os tipos de LEADS (formulário + contato + mensagem)
const ALL_LEAD_ACTION_TYPES = [
  ...FORM_LEAD_ACTION_TYPES,
  ...CONTACT_LEAD_ACTION_TYPES,
  ...MESSAGE_LEAD_ACTION_TYPES,
];

// Todos os tipos de conversão (leads + vendas)
const CONVERSION_ACTION_TYPES = [
  ...ALL_LEAD_ACTION_TYPES,
  ...PURCHASE_ACTION_TYPES,
];

// Tipos de action_values que representam RECEITA REAL (para ROAS)
const REVENUE_ACTION_TYPES = [
  'purchase',
  'omni_purchase',
];

function extractConversions(row: any): { 
  conversions: number; 
  costPerResult: number; 
  conversionValue: number; 
  source: string;
  leadsCount: number;
  purchasesCount: number;
} {
  let conversions = 0;
  let costPerResult = 0;
  let conversionValue = 0;
  let source = 'none';
  let leadsCount = 0;
  let purchasesCount = 0;

  // ===========================================================================================
  // ESTRATÉGIA CORRIGIDA: Leads = formulários + contatos no site + mensagens iniciadas
  // 
  // O Gerenciador de Anúncios mostra como "Resultados" diferentes tipos dependendo do objetivo:
  // - Campanhas de formulário: lead / onsite_conversion.lead_grouped
  // - Campanhas de cadastro/contato: contact, complete_registration
  // - Campanhas de mensagem: messaging_conversation_started_7d
  // 
  // TODOS devem ser contados como "leads" no dashboard!
  // ===========================================================================================
  
  // FONTE 1: Campo "actions" - eventos filtrados por action_type
  // Coletamos todos os tipos separadamente para evitar duplicação
  let formLeadValue = 0;     // lead
  let formLeadGrouped = 0;   // onsite_conversion.lead_grouped
  let contactLeadValue = 0;  // contact_total, contact, complete_registration, etc.
  let messageLeadValue = 0;  // messaging_conversation_started_7d
  let messagePrefixed = 0;   // onsite_conversion.messaging_conversation_started_7d
  
  // PURCHASES: separar purchase e omni_purchase para evitar duplicação
  let purchaseValue = 0;      // purchase (pixel padrão)
  let omniPurchaseValue = 0;  // omni_purchase (consolidado - PRIORIDADE)
  
  if (Array.isArray(row.actions) && row.actions.length > 0) {
    for (const action of row.actions) {
      const actionType = action.action_type || '';
      const val = parseInt(action.value) || 0;
      if (val > 0) {
        // LEADS DE FORMULÁRIO META
        if (actionType === 'lead') {
          formLeadValue = val;
        } else if (actionType === 'onsite_conversion.lead_grouped') {
          formLeadGrouped = val;
        }
        // CONTATOS NO SITE (cadastros, formulários de contato)
        else if (CONTACT_LEAD_ACTION_TYPES.includes(actionType)) {
          // Evitar duplicação: pegar o maior valor entre os tipos de contato
          if (val > contactLeadValue) {
            contactLeadValue = val;
            console.log(`[CONTACT-LEAD] action_type=${actionType}, value=${val}`);
          }
        }
        // LEADS DE MENSAGEM (WhatsApp/Messenger/DM)
        else if (actionType === 'messaging_conversation_started_7d') {
          messageLeadValue = val;
        } else if (actionType === 'onsite_conversion.messaging_conversation_started_7d') {
          messagePrefixed = val;
        }
        // PURCHASES - capturar separadamente para não duplicar
        else if (actionType === 'purchase') {
          purchaseValue = val;
          console.log(`[PURCHASE-PIXEL] action_type=purchase, value=${val}`);
        } else if (actionType === 'omni_purchase') {
          omniPurchaseValue = val;
          console.log(`[PURCHASE-OMNI] action_type=omni_purchase, value=${val}`);
        }
      }
    }
    
    // PURCHASES: usar APENAS UM - omni_purchase tem prioridade (é o consolidado)
    // Se omni_purchase existe, usar ele; senão usar purchase
    purchasesCount = omniPurchaseValue > 0 ? omniPurchaseValue : purchaseValue;
    if (purchasesCount > 0) {
      console.log(`[PURCHASE-FINAL] value=${purchasesCount} (omni=${omniPurchaseValue}, pixel=${purchaseValue})`);
    }
    
    // LEADS DE FORMULÁRIO META: usar apenas UM dos tipos (evitar duplicação)
    const actualFormLeads = formLeadValue > 0 ? formLeadValue : formLeadGrouped;
    
    // LEADS DE MENSAGEM: usar apenas UM dos tipos (evitar duplicação)
    const actualMessageLeads = messagePrefixed > 0 ? messagePrefixed : messageLeadValue;
    
    // ===========================================================================================
    // REGRA CRÍTICA: Usar APENAS o tipo DOMINANTE de lead para evitar somar conversões secundárias
    // 
    // Exemplo: Uma campanha de "Leads no site" pode ter:
    //   - lead/contact: 87 (objetivo principal)
    //   - messaging_conversation_started_7d: 4 (conversão secundária)
    // 
    // NÃO devemos somar 87+4=91. Devemos usar apenas o maior: 87
    // ===========================================================================================
    
    // Identificar o tipo dominante (maior valor) e usar apenas ele
    const leadTypes = [
      { type: 'form', value: actualFormLeads },
      { type: 'contact', value: contactLeadValue },
      { type: 'message', value: actualMessageLeads },
    ].filter(t => t.value > 0).sort((a, b) => b.value - a.value);
    
    if (leadTypes.length > 0) {
      // Usar apenas o tipo dominante (maior valor)
      const dominant = leadTypes[0];
      leadsCount = dominant.value;
      source = 'actions';
      
      console.log(`[LEADS-DOMINANT] type=${dominant.type}, value=${dominant.value}`);
      
      // Se houver tipos secundários, logar mas NÃO somar
      if (leadTypes.length > 1) {
        const secondary = leadTypes.slice(1).map(t => `${t.type}=${t.value}`).join(', ');
        console.log(`[LEADS-SECONDARY-IGNORED] ${secondary} (not summed)`);
      }
    }
    
    // CONVERSIONS = leads + purchases
    conversions = leadsCount + purchasesCount;
  }

  // FONTE 2: Campo "conversions" - fallback se não veio de actions
  if (conversions === 0 && Array.isArray(row.conversions) && row.conversions.length > 0) {
    let formLeadConv = 0;
    let formLeadGroupedConv = 0;
    let contactLeadConv = 0;
    let messageLeadConv = 0;
    let messagePrefixedConv = 0;
    let purchaseConv = 0;
    let omniPurchaseConv = 0;
    
    for (const c of row.conversions) {
      const actionType = c.action_type || '';
      const val = parseInt(c.value) || 0;
      if (val > 0) {
        if (actionType === 'lead') {
          formLeadConv = val;
        } else if (actionType === 'onsite_conversion.lead_grouped') {
          formLeadGroupedConv = val;
        } else if (CONTACT_LEAD_ACTION_TYPES.includes(actionType)) {
          if (val > contactLeadConv) contactLeadConv = val;
        } else if (actionType === 'messaging_conversation_started_7d') {
          messageLeadConv = val;
        } else if (actionType === 'onsite_conversion.messaging_conversation_started_7d') {
          messagePrefixedConv = val;
        } else if (actionType === 'purchase') {
          purchaseConv = val;
        } else if (actionType === 'omni_purchase') {
          omniPurchaseConv = val;
        }
      }
    }
    
    const actualFormLeads = formLeadConv > 0 ? formLeadConv : formLeadGroupedConv;
    const actualMessageLeads = messagePrefixedConv > 0 ? messagePrefixedConv : messageLeadConv;
    
    // PURCHASES: usar APENAS UM - omni_purchase tem prioridade
    purchasesCount = omniPurchaseConv > 0 ? omniPurchaseConv : purchaseConv;
    
    // Usar apenas o tipo DOMINANTE de lead (mesmo princípio do campo actions)
    const leadTypesConv = [
      { type: 'form', value: actualFormLeads },
      { type: 'contact', value: contactLeadConv },
      { type: 'message', value: actualMessageLeads },
    ].filter(t => t.value > 0).sort((a, b) => b.value - a.value);
    
    if (leadTypesConv.length > 0) {
      leadsCount = leadTypesConv[0].value;
      source = 'conversions_filtered';
      console.log(`[LEADS-DOMINANT] conversions: type=${leadTypesConv[0].type}, value=${leadsCount}`);
      if (leadTypesConv.length > 1) {
        const secondary = leadTypesConv.slice(1).map(t => `${t.type}=${t.value}`).join(', ');
        console.log(`[LEADS-SECONDARY-IGNORED] conversions: ${secondary} (not summed)`);
      }
    }
    
    conversions = leadsCount + purchasesCount;
    
    if (purchasesCount > 0) {
      console.log(`[PURCHASE-FINAL] conversions: value=${purchasesCount} (omni=${omniPurchaseConv}, pixel=${purchaseConv})`);
    }
  }

  // CPA: Buscar no cost_per_action_type apenas para os tipos que queremos
  if (conversions > 0 && Array.isArray(row.cost_per_action_type) && row.cost_per_action_type.length > 0) {
    for (const cpa of row.cost_per_action_type) {
      const actionType = cpa.action_type || '';
      const isConversionAction = CONVERSION_ACTION_TYPES.includes(actionType);
      if (isConversionAction && cpa.value) {
        costPerResult = parseFloat(cpa.value) || 0;
        break;
      }
    }
  }
  
  // Se não veio CPA mas tem conversões, calcular
  if (costPerResult === 0 && conversions > 0) {
    const spend = parseFloat(row.spend) || 0;
    costPerResult = spend / conversions;
  }

  // Valor de conversão (para ROAS) - via action_values
  if (Array.isArray(row.action_values)) {
    for (const av of row.action_values) {
      const actionType = av.action_type || '';
      const isRevenueAction = REVENUE_ACTION_TYPES.includes(actionType);
      if (isRevenueAction) {
        const val = parseFloat(av.value) || 0;
        if (val > 0) {
          conversionValue += val;
          console.log(`[REVENUE] action_type=${actionType}, value=${val}`);
        }
      }
    }
  }

  // Log para debug
  if (conversions > 0) {
    console.log(`[CONVERSIONS] source=${source}, total=${conversions}, leads=${leadsCount}, purchases=${purchasesCount}, cpa=${costPerResult.toFixed(2)}`);
  }

  return { conversions, costPerResult, conversionValue, source, leadsCount, purchasesCount };
}

// Extrair messaging replies - métricas AUXILIARES (não afeta conversions)
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

// Extrair profile visits - métricas AUXILIARES (não afeta conversions)
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
        // EXTRAÇÃO COM FALLBACK HIERÁRQUICO: results → actions → 0
        // AGORA COM SEPARAÇÃO DE LEADS E PURCHASES
        // ===========================================================================================
        const { conversions, costPerResult, conversionValue, source, leadsCount, purchasesCount } = extractConversions(insights);
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
          conversions, // VALOR TOTAL (leads + purchases)
          conversion_value: conversionValue,
          cpa,
          roas,
          messaging_replies: messagingReplies,
          profile_visits: profileVisits,
          leads_count: leadsCount,
          purchases_count: purchasesCount,
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
      });

      // Campaign aggregation
      if (!campaignMetrics.has(r.campaign_id)) {
        const campaign = campaignMap.get(r.campaign_id);
        campaignMetrics.set(r.campaign_id, initMetric(r.campaign_id, r.campaign_name, { status: campaign?.status, objective: campaign?.objective }));
      }
      const cm = campaignMetrics.get(r.campaign_id);
      cm.spend += r.spend;
      cm.impressions += r.impressions;
      cm.clicks += r.clicks;
      cm.reach += r.reach;
      cm.conversions += r.conversions;
      cm.conversion_value += r.conversion_value;
      cm.messaging_replies += r.messaging_replies;
      cm.profile_visits += r.profile_visits;

      // Adset aggregation
      if (!adsetMetrics.has(r.adset_id)) {
        const adset = adsetMap.get(r.adset_id);
        adsetMetrics.set(r.adset_id, { ...initMetric(r.adset_id, r.adset_name, { status: adset?.status }), campaign_id: r.campaign_id, daily_budget: adset?.daily_budget, lifetime_budget: adset?.lifetime_budget });
      }
      const am = adsetMetrics.get(r.adset_id);
      am.spend += r.spend;
      am.impressions += r.impressions;
      am.clicks += r.clicks;
      am.reach += r.reach;
      am.conversions += r.conversions;
      am.conversion_value += r.conversion_value;
      am.messaging_replies += r.messaging_replies;
      am.profile_visits += r.profile_visits;

      // Ad aggregation
      if (!adMetrics.has(r.ad_id)) {
        const ad = adMap.get(r.ad_id);
        const creativeData = ad?.creative?.id ? creativeDataMap.get(ad.creative.id) : null;
        const cachedData = cachedCreativeMap.get(r.ad_id);
        const { primaryText, headline, cta } = extractAdCopy(ad, creativeData);
        const { imageUrl, videoUrl } = extractCreativeImage(ad, creativeData, adImageMap, videoThumbnailMap);
        const cachedUrl = immediateCache.get(r.ad_id) || cachedData?.cached_url || null;
        adMetrics.set(r.ad_id, { 
          ...initMetric(r.ad_id, r.ad_name, { status: ad?.status }), 
          campaign_id: r.campaign_id, 
          ad_set_id: r.adset_id,
          creative_id: ad?.creative?.id || null,
          creative_thumbnail: ad?.creative?.thumbnail_url || cachedData?.thumbnail_url || null,
          creative_image_url: imageUrl || cachedData?.image_url || null,
          creative_video_url: videoUrl || cachedData?.video_url || null,
          cached_image_url: cachedUrl,
          headline: headline || cachedData?.headline || null,
          primary_text: primaryText || cachedData?.primary_text || null,
          cta: cta || cachedData?.cta || null,
        });
      }
      const adm = adMetrics.get(r.ad_id);
      adm.spend += r.spend;
      adm.impressions += r.impressions;
      adm.clicks += r.clicks;
      adm.reach += r.reach;
      adm.conversions += r.conversions;
      adm.conversion_value += r.conversion_value;
      adm.messaging_replies += r.messaging_replies;
      adm.profile_visits += r.profile_visits;
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

    // Prepare records for upsert
    const campaignRecords = Array.from(campaignMetrics.values()).map(m => {
      const campaign = campaignMap.get(m.id);
      return calculateDerived({
        ...m,
        daily_budget: campaign?.daily_budget,
        lifetime_budget: campaign?.lifetime_budget,
      });
    });

    const adsetRecords = Array.from(adsetMetrics.values()).map(calculateDerived);
    const adRecords = Array.from(adMetrics.values()).map(calculateDerived);

    // Detect changes
    const { data: existingCampaigns } = await supabase.from('campaigns').select('*').eq('project_id', project_id);
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

    // Save changes to optimization_history
    if (allChanges.length > 0) {
      await supabase.from('optimization_history').insert(allChanges);
      console.log(`[CHANGES] Recorded ${allChanges.length} changes`);
    }

    // Detect anomalies
    await detectAndSendAnomalyAlerts(supabase, project_id, allChanges, campaignMetrics, existingCampaigns || []);

    // Upsert entities
    if (campaignRecords.length > 0) await supabase.from('campaigns').upsert(campaignRecords, { onConflict: 'id' });
    if (adsetRecords.length > 0) await supabase.from('ad_sets').upsert(adsetRecords, { onConflict: 'id' });
    if (adRecords.length > 0) await supabase.from('ads').upsert(adRecords, { onConflict: 'id' });

    // Update project sync time
    await supabase.from('projects').update({ last_sync_at: new Date().toISOString(), webhook_status: 'active' }).eq('id', project_id);

    const duration = Date.now() - startTime;
    console.log(`[SYNC] Completed in ${duration}ms - Records: ${dailyRecords.length}, Conversions: ${validation.totalConversions}`);

    return new Response(JSON.stringify({
      success: true,
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
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
