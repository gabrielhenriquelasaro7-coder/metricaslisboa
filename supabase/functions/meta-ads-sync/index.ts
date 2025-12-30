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
// Lista COMPLETA de action_types que representam conversões/leads no Meta Ads
// Inclui TODOS os eventos de pixel, formulários, contatos e conversões customizadas
const CONVERSION_ACTION_TYPES = [
  // ========== LEADS - FORMULÁRIOS INSTANT (On-Facebook) ==========
  'lead',
  'leadgen.other',
  'leadgen_grouped',
  'onsite_conversion.lead_grouped',
  'on_facebook_lead',
  'onsite_web_lead',
  
  // ========== LEADS - PIXEL (Off-Facebook / Website) ==========
  'offsite_conversion.fb_pixel_lead',
  'offsite_conversion.fb_pixel_custom', // Eventos customizados do pixel
  
  // ========== CONTATOS - TODOS OS TIPOS ==========
  'contact',
  'contact_total',
  'contact_website',        // Contato no site (pixel)
  'contact_mobile_app',
  'contact_offline',
  'onsite_conversion.contact',
  'offsite_conversion.fb_pixel_contact', // Contato via pixel
  
  // ========== CONVERSAS / MENSAGENS ==========
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'messaging_conversation_started_7d',
  'messaging_first_reply',
  'onsite_conversion.messaging_blocked',
  'onsite_conversion.post_engagement',
  
  // ========== FORMULÁRIOS E REGISTROS ==========
  'onsite_conversion.flow_complete',
  'complete_registration',
  'offsite_conversion.fb_pixel_complete_registration',
  'submit_application',
  'offsite_conversion.fb_pixel_submit_application',
  'subscribe',
  'offsite_conversion.fb_pixel_subscribe',
  
  // ========== AGENDAMENTOS / SCHEDULES ==========
  'schedule',
  'offsite_conversion.fb_pixel_schedule',
  'onsite_conversion.schedule',
  
  // ========== INICIAR CHECKOUT / TRIAL ==========
  'start_trial',
  'offsite_conversion.fb_pixel_start_trial',
  'initiate_checkout',
  'offsite_conversion.fb_pixel_initiate_checkout',
  
  // ========== COMPRAS (E-commerce) ==========
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  
  // ========== APP INSTALLS ==========
  'app_install',
  'mobile_app_install',
  
  // ========== OUTROS EVENTOS DE CONVERSÃO ==========
  'add_to_cart',
  'offsite_conversion.fb_pixel_add_to_cart',
  'add_to_wishlist',
  'offsite_conversion.fb_pixel_add_to_wishlist',
  'view_content',
  'offsite_conversion.fb_pixel_view_content',
  'search',
  'offsite_conversion.fb_pixel_search',
  
  // ========== EVENTOS CUSTOMIZADOS (catch-all para pixel events) ==========
  // Estes capturam eventos customizados que não estão na lista acima
  'offsite_conversion.custom',
  'onsite_conversion.custom',
];

// Lista de action_types para valores de conversão (receita)
const VALUE_ACTION_TYPES = [
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'lead',
  'offsite_conversion.fb_pixel_lead',
  'contact',
  'contact_website',
  'offsite_conversion.fb_pixel_contact',
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
      // Default: last 90 days
      const now = new Date();
      until = now.toISOString().split('T')[0];
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 90);
      since = sinceDate.toISOString().split('T')[0];
    }
    
    const token = access_token || metaAccessToken;

    if (!token || !project_id || !ad_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC] Project: ${project_id}`);
    console.log(`[SYNC] Range: ${since} to ${until} (time_increment=1)`);
    console.log(`[SYNC] Retry count: ${retry_count}`);

    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    // ============ INSIGHTS-FIRST APPROACH ============
    // Busca insights diretamente - inclui dados de campanhas deletadas/arquivadas
    // que não aparecem mais na listagem de entidades
    
    // STEP 1: Fetch daily insights FIRST (time_increment=1)
    // Isso captura TODOS os dados históricos, incluindo de entidades deletadas
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);
    
    // Se não há insights, pode ser que realmente não houve atividade no período
    if (dailyInsights.size === 0) {
      console.log(`[SYNC] No insights found for period ${since} to ${until}`);
      // Não retornar erro - pode ser que não houve gasto no período
      await supabase.from('projects').update({ 
        webhook_status: 'success',
        last_sync_at: new Date().toISOString()
      }).eq('id', project_id);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No activity in period',
        data: {
          daily_records_count: 0,
          period: { since, until }
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // STEP 2: Fetch entities for enrichment (optional - for thumbnails and additional data)
    // Isso é opcional - mesmo sem entidades, os insights já têm todos os dados necessários
    let adImageMap = new Map<string, string>();
    let campaignMap = new Map<string, any>();
    let adsetMap = new Map<string, any>();
    let adMap = new Map<string, any>();
    
    try {
      const entities = await fetchEntities(ad_account_id, token);
      campaignMap = new Map(entities.campaigns.map(c => [c.id, c]));
      adsetMap = new Map(entities.adsets.map(a => [a.id, a]));
      adMap = new Map(entities.ads.map(a => [a.id, a]));
      adImageMap = entities.adImageMap;
      console.log(`[ENTITIES] Loaded for enrichment: ${entities.campaigns.length} campaigns, ${entities.ads.length} ads`);
    } catch (entityError) {
      console.log(`[ENTITIES] Could not fetch for enrichment, using insights data only:`, entityError);
      // Continue without entity enrichment - insights have all required data
    }

    // STEP 3: Build daily records - INSIGHTS-FIRST approach
    // Usa dados dos insights como fonte primária, entidades apenas para enriquecimento
    const dailyRecords: any[] = [];
    let logCounter = 0; // Log first 5 rows for debugging
    
    for (const [adId, dateMap] of dailyInsights) {
      // Tentar enriquecer com dados de entidades (opcional)
      const ad = adMap.get(adId);
      const adset = ad ? adsetMap.get(ad.adset_id) : null;
      const campaign = ad ? campaignMap.get(ad.campaign_id) : null;
      
      for (const [dateKey, insights] of dateMap) {
        // Log ALL action types for first 5 rows to help debug
        const shouldLog = logCounter < 5;
        if (shouldLog) logCounter++;
        
        const { conversions, conversionValue } = extractConversions(insights, shouldLog);
        const spend = parseFloat(insights.spend || '0');
        const impressions = parseInt(insights.impressions || '0');
        const clicks = parseInt(insights.clicks || '0');
        const reach = parseInt(insights.reach || '0');
        
        // INSIGHTS-FIRST: Usa dados dos insights como fonte primária
        // Os insights sempre contêm: ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name
        const adName = insights.ad_name || ad?.name || 'Unknown';
        const adsetId = extractId(insights.adset_id) || ad?.adset_id || '';
        const adsetName = insights.adset_name || adset?.name || 'Unknown';
        const campaignId = extractId(insights.campaign_id) || ad?.campaign_id || '';
        const campaignName = insights.campaign_name || campaign?.name || 'Unknown';
        
        // Get creative thumbnail from entity map if available
        let creativeThumbnail = null;
        let creativeId = null;
        if (ad) {
          creativeId = ad.creative?.id || null;
          const imageData = extractHdImageUrl(ad, adImageMap);
          creativeThumbnail = imageData.imageUrl || ad.creative?.thumbnail_url || null;
        }
        
        dailyRecords.push({
          project_id,
          ad_account_id,
          date: dateKey,
          
          campaign_id: campaignId,
          campaign_name: campaignName,
          campaign_status: campaign?.status || 'ARCHIVED', // Assume archived if not in entities
          campaign_objective: campaign?.objective || null,
          
          adset_id: adsetId,
          adset_name: adsetName,
          adset_status: adset?.status || 'ARCHIVED',
          
          ad_id: adId,
          ad_name: adName,
          ad_status: ad?.status || 'ARCHIVED',
          
          creative_id: creativeId,
          creative_thumbnail: creativeThumbnail,
          
          spend,
          impressions,
          clicks,
          reach,
          frequency: parseFloat(insights.frequency || '0'),
          
          ctr: parseFloat(insights.ctr || '0'),
          cpm: parseFloat(insights.cpm || '0'),
          cpc: parseFloat(insights.cpc || '0'),
          
          conversions,
          conversion_value: conversionValue,
          roas: spend > 0 ? conversionValue / spend : 0,
          cpa: conversions > 0 ? spend / conversions : 0,
          
          synced_at: new Date().toISOString(),
        });
      }
    }

    console.log(`[SYNC] Built ${dailyRecords.length} daily records`);

    // STEP 4: Validate data (ANTI-ZERO)
    const validation = validateSyncData(dailyRecords);
    
    if (!validation.isValid && retry_count < MAX_RETRIES) {
      console.log(`[VALIDATION] Data appears invalid (all zeros), scheduling retry ${retry_count + 1}/${MAX_RETRIES}`);
      
      await supabase.from('sync_logs').insert({
        project_id,
        status: 'retry_scheduled',
        message: JSON.stringify({
          reason: 'all_zeros',
          retry_count: retry_count + 1,
          records: dailyRecords.length,
        }),
      });
      
      await supabase.from('projects').update({ webhook_status: 'retry_pending' }).eq('id', project_id);
      
      // Em produção, agendaria o retry via cron ou queue
      // Aqui retornamos status para o caller fazer retry
      return new Response(
        JSON.stringify({ 
          success: false, 
          needs_retry: true, 
          retry_count: retry_count + 1,
          error: 'Data validation failed: all records have zero values' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 5: UPSERT to ads_daily_metrics
    let upsertCount = 0;
    for (const batch of chunk(dailyRecords, 200)) {
      const { error } = await supabase
        .from('ads_daily_metrics')
        .upsert(batch, { 
          onConflict: 'project_id,ad_id,date',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error('[UPSERT ERROR]', error);
      } else {
        upsertCount += batch.length;
      }
    }

    console.log(`[UPSERT] ${upsertCount} daily records saved`);

    // STEP 6: Also update aggregated tables for backward compatibility
    // Aggregate metrics across all dates for main tables
    const campaignAggregates = new Map<string, any>();
    const adsetAggregates = new Map<string, any>();
    const adAggregates = new Map<string, any>();
    
    for (const record of dailyRecords) {
      // Campaign aggregates
      if (!campaignAggregates.has(record.campaign_id)) {
        campaignAggregates.set(record.campaign_id, {
          id: record.campaign_id,
          project_id,
          name: record.campaign_name,
          status: record.campaign_status,
          objective: record.campaign_objective,
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          conversions: 0, conversion_value: 0,
        });
      }
      const ca = campaignAggregates.get(record.campaign_id);
      ca.spend += record.spend;
      ca.impressions += record.impressions;
      ca.clicks += record.clicks;
      ca.reach += record.reach;
      ca.conversions += record.conversions;
      ca.conversion_value += record.conversion_value;
      
      // Adset aggregates
      if (!adsetAggregates.has(record.adset_id)) {
        adsetAggregates.set(record.adset_id, {
          id: record.adset_id,
          project_id,
          campaign_id: record.campaign_id,
          name: record.adset_name,
          status: record.adset_status,
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          conversions: 0, conversion_value: 0,
        });
      }
      const asa = adsetAggregates.get(record.adset_id);
      asa.spend += record.spend;
      asa.impressions += record.impressions;
      asa.clicks += record.clicks;
      asa.reach += record.reach;
      asa.conversions += record.conversions;
      asa.conversion_value += record.conversion_value;
      
      // Ad aggregates
      if (!adAggregates.has(record.ad_id)) {
        // Get HD image URL from the ad map using adImageMap for highest quality
        const adEntity = adMap.get(record.ad_id);
        const { imageUrl, videoUrl } = extractHdImageUrl(adEntity || {}, adImageMap);
        
        adAggregates.set(record.ad_id, {
          id: record.ad_id,
          project_id,
          campaign_id: record.campaign_id,
          ad_set_id: record.adset_id,
          name: record.ad_name,
          status: record.ad_status,
          creative_id: record.creative_id,
          creative_thumbnail: record.creative_thumbnail,
          // Use HD image URL if available
          creative_image_url: imageUrl,
          creative_video_url: videoUrl,
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          conversions: 0, conversion_value: 0,
        });
      }
      const ada = adAggregates.get(record.ad_id);
      ada.spend += record.spend;
      ada.impressions += record.impressions;
      ada.clicks += record.clicks;
      ada.reach += record.reach;
      ada.conversions += record.conversions;
      ada.conversion_value += record.conversion_value;
    }
    
    // Calculate derived metrics and upsert
    const calculateMetrics = (agg: any) => ({
      ...agg,
      ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
      cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
      cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
      roas: agg.spend > 0 ? agg.conversion_value / agg.spend : 0,
      cpa: agg.conversions > 0 ? agg.spend / agg.conversions : 0,
      frequency: agg.reach > 0 ? agg.impressions / agg.reach : 0,
      synced_at: new Date().toISOString(),
    });
    
    const campaignRecords = Array.from(campaignAggregates.values()).map(calculateMetrics);
    const adsetRecords = Array.from(adsetAggregates.values()).map(calculateMetrics);
    const adRecords = Array.from(adAggregates.values()).map(calculateMetrics);
    
    // Upsert to main tables
    await Promise.all([
      supabase.from('campaigns').upsert(campaignRecords, { onConflict: 'id' }),
      supabase.from('ad_sets').upsert(adsetRecords, { onConflict: 'id' }),
      supabase.from('ads').upsert(adRecords, { onConflict: 'id' }),
    ]);
    
    console.log(`[AGGREGATE] Campaigns: ${campaignRecords.length}, Adsets: ${adsetRecords.length}, Ads: ${adRecords.length}`);

    // STEP 7: Save to period_metrics for backward compatibility
    if (period_key) {
      const periodRecords = [
        ...campaignRecords.map(r => ({ 
          project_id, 
          period_key, 
          entity_type: 'campaign', 
          entity_id: r.id, 
          entity_name: r.name, 
          status: r.status, 
          metrics: r, 
          synced_at: new Date().toISOString() 
        })),
        ...adsetRecords.map(r => ({ 
          project_id, 
          period_key, 
          entity_type: 'ad_set', 
          entity_id: r.id, 
          entity_name: r.name, 
          status: r.status, 
          metrics: r, 
          synced_at: new Date().toISOString() 
        })),
        ...adRecords.map(r => ({ 
          project_id, 
          period_key, 
          entity_type: 'ad', 
          entity_id: r.id, 
          entity_name: r.name, 
          status: r.status, 
          metrics: r, 
          synced_at: new Date().toISOString() 
        })),
      ];

      for (const batch of chunk(periodRecords, 200)) {
        await supabase.from('period_metrics').upsert(batch, { 
          onConflict: 'project_id,period_key,entity_type,entity_id' 
        });
      }
      console.log(`[PERIOD_METRICS] Saved ${periodRecords.length} records for period ${period_key}`);
    }

    // STEP 8: Update project status
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    await supabase.from('projects').update({ 
      webhook_status: 'success', 
      last_sync_at: new Date().toISOString() 
    }).eq('id', project_id);
    
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: JSON.stringify({ 
        period: period_key || 'full_sync',
        range: `${since} to ${until}`,
        daily_records: dailyRecords.length,
        campaigns: campaignRecords.length,
        adsets: adsetRecords.length,
        ads: adRecords.length,
        total_spend: validation.totalSpend.toFixed(2),
        elapsed: elapsed + 's' 
      }),
    });

    console.log(`[COMPLETE] ${dailyRecords.length} daily records in ${elapsed}s`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          period: period_key || 'full_sync',
          range: { since, until },
          daily_records_count: dailyRecords.length,
          campaigns_count: campaignRecords.length,
          ad_sets_count: adsetRecords.length,
          ads_count: adRecords.length,
          total_spend: validation.totalSpend,
          elapsed_seconds: parseFloat(elapsed)
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
