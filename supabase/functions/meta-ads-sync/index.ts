import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  project_id: string;
  ad_account_id: string;
  access_token?: string;
  // NOVA ARQUITETURA: Sempre usa time_increment=1
  // date_preset e time_range são mantidos apenas para calcular since/until
  date_preset?: string;
  time_range?: {
    since: string;
    until: string;
  };
  period_key?: string; // Mantido para compatibilidade com period_metrics
  retry_count?: number; // Contador de retries para validação anti-zero
}

// Constants
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000; // 15 minutos para retry
const VALIDATION_RETRY_DELAYS = [5000, 10000, 20000]; // Delays menores para retry imediato

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function extractId(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value.id) {
    return typeof value.id === 'string' ? value.id : String(value.id);
  }
  return null;
}

function isRateLimitError(data: any): boolean {
  if (!data?.error) return false;
  const errorCode = data.error.code;
  const errorMessage = data.error.message || '';
  return errorCode === 17 || 
         errorCode === '17' || 
         errorMessage.includes('User request limit reached') ||
         errorMessage.includes('rate limit') ||
         errorMessage.includes('too many calls');
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

async function fetchWithRetry(url: string, entityName: string, options?: RequestInit, timeoutMs = 30000): Promise<any> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const data = await simpleFetch(url, options, timeoutMs);
    
    if (!data.error) {
      return data;
    }
    
    // Log the error for debugging
    console.error(`[${entityName}] API Error:`, JSON.stringify(data.error));
    
    if (isRateLimitError(data)) {
      if (attempt < MAX_RETRIES) {
        const waitTime = VALIDATION_RETRY_DELAYS[attempt] || 30000;
        console.log(`[${entityName}] Rate limit, retry ${attempt + 1}/${MAX_RETRIES} in ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      }
    }
    
    lastError = data;
    break;
  }
  
  return lastError || { error: { message: 'Max retries exceeded' } };
}

// ============ FETCH ENTITIES ============
async function fetchEntities(adAccountId: string, token: string): Promise<{
  campaigns: any[];
  adsets: any[];
  ads: any[];
  adImageMap: Map<string, string>;
}> {
  const campaigns: any[] = [];
  const adsets: any[] = [];
  const ads: any[] = [];

  // Effective status filter for all statuses (URL encoded) - exclude DELETED as Meta API doesn't allow it
  const effectiveStatusFilter = encodeURIComponent('["ACTIVE","PAUSED","ARCHIVED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","PENDING_BILLING_INFO","CAMPAIGN_PAUSED","ADSET_PAUSED","IN_PROCESS","WITH_ISSUES"]');

  // Fetch campaigns - include all statuses
  let url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'CAMPAIGNS');
    if (data.data) campaigns.push(...data.data);
    url = data.paging?.next || null;
  }

  // Fetch adsets - include all statuses
  url = `https://graph.facebook.com/v19.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADSETS');
    if (data.data) adsets.push(...data.data);
    url = data.paging?.next || null;
  }

  // Fetch ads with creative fields for HD images - simplified to avoid data limit errors
  url = `https://graph.facebook.com/v19.0/${adAccountId}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url,image_url,image_hash}&limit=200&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADS');
    if (data.data) ads.push(...data.data);
    url = data.paging?.next || null;
  }

  // STEP 2: Fetch HD images for creatives that have image_hash
  const imageHashes: string[] = [];
  for (const ad of ads) {
    if (ad.creative?.image_hash) {
      imageHashes.push(ad.creative.image_hash);
    }
  }
  
  // Fetch adimages to get full HD URLs
  const adImageMap = new Map<string, string>();
  if (imageHashes.length > 0) {
    // Batch fetch images - Meta allows up to 50 hashes per request
    for (let i = 0; i < imageHashes.length; i += 50) {
      const batch = imageHashes.slice(i, i + 50);
      const hashesParam = batch.join(',');
      const imageUrl = `https://graph.facebook.com/v19.0/${adAccountId}/adimages?hashes=${encodeURIComponent(JSON.stringify(batch))}&fields=hash,url,url_128,original_width,original_height&access_token=${token}`;
      const imageData = await fetchWithRetry(imageUrl, 'ADIMAGES');
      
      if (imageData.data) {
        for (const img of imageData.data) {
          if (img.hash && img.url) {
            adImageMap.set(img.hash, img.url);
          }
        }
      }
    }
    console.log(`[ADIMAGES] Fetched ${adImageMap.size} HD image URLs`);
  }

  console.log(`[ENTITIES] Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}`);
  return { campaigns, adsets, ads, adImageMap };
}

// ============ FETCH DAILY INSIGHTS (time_increment=1) ============
// OBRIGATÓRIO: Sempre usa time_increment=1 para dados diários granulares
async function fetchDailyInsights(
  adAccountId: string,
  token: string,
  since: string,
  until: string
): Promise<Map<string, Map<string, any>>> {
  // Map<ad_id, Map<date, insights>>
  const dailyInsights = new Map<string, Map<string, any>>();
  
  // Include ad_name, adset_name, campaign_name to avoid 'Unknown' issues
  const fields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';
  const timeRange = JSON.stringify({ since, until });
  
  // CRITICAL: time_increment=1 garante dados diários
  let url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=ad&limit=500&access_token=${token}`;
  
  let totalRows = 0;
  while (url) {
    const data = await fetchWithRetry(url, 'DAILY_INSIGHTS');
    
    if (data.data && data.data.length > 0) {
      for (const row of data.data) {
        const adId = extractId(row.ad_id);
        const dateKey = row.date_start; // YYYY-MM-DD
        
        if (adId && dateKey) {
          if (!dailyInsights.has(adId)) {
            dailyInsights.set(adId, new Map());
          }
          dailyInsights.get(adId)!.set(dateKey, row);
          totalRows++;
        }
      }
    }
    
    url = data.paging?.next || null;
    if (url) await delay(200);
  }
  
  console.log(`[DAILY_INSIGHTS] Total rows: ${totalRows}, Unique ads: ${dailyInsights.size}`);
  return dailyInsights;
}

// ============ EXTRACT CONVERSIONS ============
// LISTA RESTRITIVA: Apenas LEADS REAIS conforme aparecem no Gerenciador de Anúncios do Meta
// Dividido em categorias para clareza e manutenção

// LEADS REAIS - Formulários (Lead Ads / Instant Forms)
const LEAD_FORM_ACTIONS = [
  'lead',                                    // Lead genérico
  'leadgen.other',                           // Lead via formulário
  'leadgen_grouped',                         // Leads agrupados de formulários
  'onsite_conversion.lead_grouped',          // Leads on-Facebook agrupados
  'on_facebook_lead',                        // Lead no Facebook
];

// LEADS VIA PIXEL - "Lead no site" / "Leads no site"
const LEAD_PIXEL_ACTIONS = [
  'offsite_conversion.fb_pixel_lead',        // Lead via pixel (Lead no site)
  'onsite_web_lead',                         // Lead web onsite
];

// REGISTROS COMPLETOS - Contam como lead/conversão
const REGISTRATION_ACTIONS = [
  'complete_registration',                             // Cadastro completo
  'offsite_conversion.fb_pixel_complete_registration', // Cadastro via pixel
];

// CONTATOS VIA PIXEL - "Contato no site" 
// NOTA: Só conta se o objetivo da campanha for conversão de contato
const CONTACT_PIXEL_ACTIONS = [
  'offsite_conversion.fb_pixel_contact',     // Contato via pixel do site
];

// COMPRAS - Para campanhas de e-commerce
const PURCHASE_ACTIONS = [
  'purchase',                                // Compra genérica
  'omni_purchase',                           // Compra omnichannel
  'offsite_conversion.fb_pixel_purchase',    // Compra via pixel
];

// LISTA COMPLETA DE CONVERSÕES VÁLIDAS
// Inclui apenas o que aparece como "Resultados" no Gerenciador de Anúncios
const CONVERSION_ACTION_TYPES = [
  ...LEAD_FORM_ACTIONS,
  ...LEAD_PIXEL_ACTIONS,
  ...REGISTRATION_ACTIONS,
  ...CONTACT_PIXEL_ACTIONS,
  ...PURCHASE_ACTIONS,
];

// Lista de action_types para valores de conversão (receita)
const VALUE_ACTION_TYPES = [
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'lead',
  'offsite_conversion.fb_pixel_lead',
  'complete_registration',
  'offsite_conversion.fb_pixel_complete_registration',
];

function extractConversions(insights: any, logAllActions: boolean = false): { conversions: number; conversionValue: number } {
  let conversions = 0;
  let conversionValue = 0;
  
  // Track which action types we found for debugging
  const foundActions: string[] = [];
  const allActions: string[] = [];
  
  // Extrair conversões - SOMA todos os tipos encontrados
  // Mas evita dupla contagem usando um Set para tipos "grouped"
  if (insights?.actions && Array.isArray(insights.actions)) {
    const processedTypes = new Set<string>();
    
    for (const action of insights.actions) {
      const actionType = action.action_type;
      const actionValue = parseInt(action.value) || 0;
      
      // Log ALL action types for debugging (only first few rows)
      if (logAllActions && actionValue > 0) {
        allActions.push(`${actionType}:${actionValue}`);
      }
      
      if (CONVERSION_ACTION_TYPES.includes(actionType) && actionValue > 0) {
        // Evita dupla contagem: se já processamos o tipo "grouped", não processa o individual
        const baseType = actionType.replace('_grouped', '').replace('onsite_conversion.', '').replace('offsite_conversion.fb_pixel_', '').replace('offsite_conversion.', '');
        
        if (!processedTypes.has(baseType)) {
          conversions += actionValue;
          processedTypes.add(baseType);
          foundActions.push(`${actionType}:${actionValue}`);
        }
      }
    }
    
    // Log ALL actions from first few insights for debugging
    if (logAllActions && allActions.length > 0) {
      console.log(`[ALL_ACTIONS] ${allActions.join(', ')}`);
    }
  }
  
  // Log all found actions for debugging
  if (foundActions.length > 0) {
    console.log(`[CONVERSIONS] Found: ${foundActions.join(', ')}, Total: ${conversions}`);
  }
  
  // Extrair valor de conversão
  if (insights?.action_values && Array.isArray(insights.action_values)) {
    for (const av of insights.action_values) {
      if (VALUE_ACTION_TYPES.includes(av.action_type)) {
        const val = parseFloat(av.value) || 0;
        if (val > conversionValue) {
          conversionValue = val;
        }
      }
    }
  }
  
  return { conversions, conversionValue };
}

// ============ EXTRACT HD IMAGE URL ============
function extractHdImageUrl(ad: any, adImageMap: Map<string, string>): { imageUrl: string | null; videoUrl: string | null } {
  let imageUrl: string | null = null;
  let videoUrl: string | null = null;
  
  const creative = ad.creative;
  if (!creative) return { imageUrl, videoUrl };
  
  // Priority 1: Get HD URL from adimages API (highest quality - original resolution)
  if (creative.image_hash && adImageMap.has(creative.image_hash)) {
    imageUrl = adImageMap.get(creative.image_hash)!;
  }
  
  // Priority 2: Direct image_url from creative (full HD)
  if (!imageUrl && creative.image_url) {
    imageUrl = creative.image_url;
  }
  
  // Priority 3: Check asset_feed_spec for carousel/dynamic ads (HD images)
  if (!imageUrl && creative.asset_feed_spec) {
    const assets = creative.asset_feed_spec;
    if (assets.images && assets.images.length > 0) {
      // Get first image from carousel
      const firstImage = assets.images[0];
      if (firstImage.url) {
        imageUrl = firstImage.url;
      } else if (firstImage.hash && adImageMap.has(firstImage.hash)) {
        imageUrl = adImageMap.get(firstImage.hash)!;
      }
    }
  }
  
  // Priority 5: Check object_story_spec for image/video
  if (!imageUrl && creative.object_story_spec) {
    const spec = creative.object_story_spec;
    
    // Link data (single image ads)
    if (spec.link_data?.image_url) {
      imageUrl = spec.link_data.image_url;
    }
    if (!imageUrl && spec.link_data?.picture) {
      imageUrl = spec.link_data.picture;
    }
    
    // Check for image_hash in link_data
    if (!imageUrl && spec.link_data?.image_hash && adImageMap.has(spec.link_data.image_hash)) {
      imageUrl = adImageMap.get(spec.link_data.image_hash)!;
    }
    
    // Video data
    if (spec.video_data?.video_id) {
      // Use video thumbnail if available
      videoUrl = spec.video_data.image_url || null;
    }
    
    // Photo data
    if (!imageUrl && spec.photo_data?.url) {
      imageUrl = spec.photo_data.url;
    }
  }
  
  // Priority 6: Fallback to thumbnail (but try to get higher resolution)
  if (!imageUrl && creative.thumbnail_url) {
    // Remove resolution limiting parameters to try to get better quality
    let thumbnailUrl = creative.thumbnail_url;
    // Remove p64x64 or similar size constraints
    thumbnailUrl = thumbnailUrl.replace(/\/p\d+x\d+\//, '/');
    thumbnailUrl = thumbnailUrl.replace(/[?&]width=\d+/, '');
    thumbnailUrl = thumbnailUrl.replace(/[?&]height=\d+/, '');
    // Try to get larger size by modifying URL
    thumbnailUrl = thumbnailUrl.replace('_t.', '_n.'); // Facebook uses _t for thumb, _n for normal
    imageUrl = thumbnailUrl;
  }
  
  return { imageUrl, videoUrl };
}

// ============ VALIDATE DATA (ANTI-ZERO) ============
function validateSyncData(records: any[]): { isValid: boolean; totalSpend: number; totalImpressions: number } {
  const totalSpend = records.reduce((sum, r) => sum + (r.spend || 0), 0);
  const totalImpressions = records.reduce((sum, r) => sum + (r.impressions || 0), 0);
  
  // Se todos os registros têm spend=0, impressions=0, clicks=0 - dados inválidos
  const allZero = records.length > 0 && records.every(r => 
    (r.spend || 0) === 0 && 
    (r.impressions || 0) === 0 && 
    (r.clicks || 0) === 0
  );
  
  return {
    isValid: !allZero || records.length === 0,
    totalSpend,
    totalImpressions
  };
}

// ============ MAIN HANDLER ============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const { project_id, ad_account_id, access_token, date_preset, time_range, period_key, retry_count = 0 } = body;
    
    // Determine date range - PADRÃO: last_90d
    let since: string;
    let until: string;
    
    if (time_range) {
      since = time_range.since;
      until = time_range.until;
    } else {
      // Calculate date range from preset
      const today = new Date();
      until = today.toISOString().split('T')[0];
      
      const daysMap: { [key: string]: number } = {
        'yesterday': 1,
        'today': 0,
        'last_7d': 7,
        'last_14d': 14,
        'last_30d': 30,
        'last_90d': 90,
        'this_month': new Date(today.getFullYear(), today.getMonth(), today.getDate()).getDate(),
        'last_month': new Date(today.getFullYear(), today.getMonth(), 0).getDate() + today.getDate(),
      };
      
      const days = daysMap[date_preset || 'last_90d'] || 90;
      const sinceDate = new Date(today);
      sinceDate.setDate(sinceDate.getDate() - days);
      since = sinceDate.toISOString().split('T')[0];
    }

    console.log(`[SYNC] Project: ${project_id}`);
    console.log(`[SYNC] Range: ${since} to ${until} (time_increment=1)`);
    console.log(`[SYNC] Retry count: ${retry_count}`);

    const token = access_token || metaAccessToken;
    if (!token) {
      throw new Error('No Meta access token available');
    }

    // ========== STEP 1: Fetch entities (campaigns, adsets, ads) ==========
    const { campaigns, adsets, ads, adImageMap } = await fetchEntities(ad_account_id, token);
    
    // Build lookup maps
    const campaignMap = new Map(campaigns.map(c => [extractId(c.id), c]));
    const adsetMap = new Map(adsets.map(a => [extractId(a.id), a]));
    const adMap = new Map(ads.map(a => [extractId(a.id), a]));
    
    console.log(`[ENTITIES] Loaded for enrichment: ${campaignMap.size} campaigns, ${adMap.size} ads`);

    // ========== STEP 2: Fetch daily insights ==========
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);
    
    // ========== STEP 3: Build daily records from insights ==========
    const dailyRecords: any[] = [];
    let logCounter = 0;
    
    for (const [adId, dateMap] of dailyInsights) {
      for (const [date, insights] of dateMap) {
        const ad = adMap.get(adId);
        const adsetId = extractId(insights.adset_id);
        const campaignId = extractId(insights.campaign_id);
        const adset = adsetId ? adsetMap.get(adsetId) : null;
        const campaign = campaignId ? campaignMap.get(campaignId) : null;
        
        // Extract conversions with logging for first 10 rows
        const shouldLog = logCounter < 10 && (insights.actions?.length > 0);
        const { conversions, conversionValue } = extractConversions(insights, shouldLog);
        if (shouldLog && insights.actions?.length > 0) logCounter++;
        
        // Get HD image URL
        const { imageUrl, videoUrl } = ad ? extractHdImageUrl(ad, adImageMap) : { imageUrl: null, videoUrl: null };
        
        const spend = parseFloat(insights.spend) || 0;
        const impressions = parseInt(insights.impressions) || 0;
        const clicks = parseInt(insights.clicks) || 0;
        const reach = parseInt(insights.reach) || 0;
        
        // Calculate derived metrics
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const frequency = reach > 0 ? impressions / reach : 0;
        const cpa = conversions > 0 ? spend / conversions : 0;
        const roas = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0;
        
        dailyRecords.push({
          project_id,
          ad_account_id,
          date,
          campaign_id: campaignId || 'unknown',
          campaign_name: insights.campaign_name || campaign?.name || 'Unknown Campaign',
          campaign_status: campaign?.status || null,
          campaign_objective: campaign?.objective || null,
          adset_id: adsetId || 'unknown',
          adset_name: insights.adset_name || adset?.name || 'Unknown Adset',
          adset_status: adset?.status || null,
          ad_id: adId,
          ad_name: insights.ad_name || ad?.name || 'Unknown Ad',
          ad_status: ad?.status || null,
          creative_id: ad?.creative?.id || null,
          creative_thumbnail: imageUrl || ad?.creative?.thumbnail_url || null,
          spend,
          impressions,
          clicks,
          reach,
          ctr,
          cpm,
          cpc,
          frequency,
          conversions,
          conversion_value: conversionValue,
          cpa,
          roas,
          synced_at: new Date().toISOString(),
        });
      }
    }
    
    console.log(`[SYNC] Built ${dailyRecords.length} daily records`);

    // ========== STEP 4: Validate data (anti-zero) ==========
    const validation = validateSyncData(dailyRecords);
    
    if (!validation.isValid && retry_count < MAX_RETRIES) {
      console.log(`[VALIDATION] All data is zero, scheduling retry ${retry_count + 1}/${MAX_RETRIES}`);
      
      // Schedule retry with delay
      const retryDelayMs = VALIDATION_RETRY_DELAYS[retry_count] || 30000;
      await delay(retryDelayMs);
      
      // Re-invoke self with incremented retry count
      const retryResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          ...body,
          retry_count: retry_count + 1,
        }),
      });
      
      return retryResponse;
    }

    // ========== STEP 5: Upsert daily records ==========
    if (dailyRecords.length > 0) {
      const batches = chunk(dailyRecords, BATCH_SIZE);
      for (const batch of batches) {
        // Use proper unique constraint for upsert
        const { error } = await supabase
          .from('ads_daily_metrics')
          .upsert(batch, { 
            onConflict: 'project_id,ad_id,date',
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.error('[UPSERT] Error:', error.message);
          // Continue with next batch on error
        }
      }
      console.log(`[UPSERT] ${dailyRecords.length} daily records saved`);
    }

    // ========== STEP 6: Aggregate and update entity tables ==========
    // Group by campaign, adset, ad and sum metrics
    const campaignMetrics = new Map<string, any>();
    const adsetMetrics = new Map<string, any>();
    const adMetrics = new Map<string, any>();
    
    for (const record of dailyRecords) {
      // Aggregate campaigns
      if (!campaignMetrics.has(record.campaign_id)) {
        campaignMetrics.set(record.campaign_id, {
          id: record.campaign_id,
          project_id,
          name: record.campaign_name,
          status: record.campaign_status,
          objective: record.campaign_objective,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
          conversion_value: 0,
        });
      }
      const cm = campaignMetrics.get(record.campaign_id);
      cm.spend += record.spend;
      cm.impressions += record.impressions;
      cm.clicks += record.clicks;
      cm.reach += record.reach;
      cm.conversions += record.conversions;
      cm.conversion_value += record.conversion_value;
      
      // Aggregate adsets
      if (!adsetMetrics.has(record.adset_id)) {
        adsetMetrics.set(record.adset_id, {
          id: record.adset_id,
          project_id,
          campaign_id: record.campaign_id,
          name: record.adset_name,
          status: record.adset_status,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
          conversion_value: 0,
        });
      }
      const am = adsetMetrics.get(record.adset_id);
      am.spend += record.spend;
      am.impressions += record.impressions;
      am.clicks += record.clicks;
      am.reach += record.reach;
      am.conversions += record.conversions;
      am.conversion_value += record.conversion_value;
      
      // Aggregate ads
      if (!adMetrics.has(record.ad_id)) {
        adMetrics.set(record.ad_id, {
          id: record.ad_id,
          project_id,
          campaign_id: record.campaign_id,
          ad_set_id: record.adset_id,
          name: record.ad_name,
          status: record.ad_status,
          creative_id: record.creative_id,
          creative_thumbnail: record.creative_thumbnail,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
          conversion_value: 0,
        });
      }
      const adm = adMetrics.get(record.ad_id);
      adm.spend += record.spend;
      adm.impressions += record.impressions;
      adm.clicks += record.clicks;
      adm.reach += record.reach;
      adm.conversions += record.conversions;
      adm.conversion_value += record.conversion_value;
    }
    
    // Calculate derived metrics for aggregated data
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
    
    // Upsert campaigns
    if (campaignRecords.length > 0) {
      await supabase.from('campaigns').upsert(campaignRecords, { onConflict: 'id' });
    }
    
    // Upsert adsets
    if (adsetRecords.length > 0) {
      await supabase.from('ad_sets').upsert(adsetRecords, { onConflict: 'id' });
    }
    
    // Upsert ads
    if (adRecords.length > 0) {
      await supabase.from('ads').upsert(adRecords, { onConflict: 'id' });
    }
    
    console.log(`[AGGREGATE] Campaigns: ${campaignRecords.length}, Adsets: ${adsetRecords.length}, Ads: ${adRecords.length}`);

    // ========== STEP 7: Update project last_sync_at ==========
    await supabase
      .from('projects')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', project_id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[COMPLETE] ${dailyRecords.length} daily records in ${elapsed}s`);

    return new Response(
      JSON.stringify({
        success: true,
        records: dailyRecords.length,
        campaigns: campaignRecords.length,
        adsets: adsetRecords.length,
        ads: adRecords.length,
        validation,
        elapsed_seconds: elapsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ERROR]', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
