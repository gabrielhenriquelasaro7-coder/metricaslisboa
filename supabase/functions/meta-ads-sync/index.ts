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

// Fields to track for optimization history
const TRACKED_FIELDS_CAMPAIGN = ['status', 'daily_budget', 'lifetime_budget', 'objective'];
const TRACKED_FIELDS_ADSET = ['status', 'daily_budget', 'lifetime_budget'];
const TRACKED_FIELDS_AD = ['status'];

interface OptimizationChange {
  project_id: string;
  entity_type: 'campaign' | 'adset' | 'ad';
  entity_id: string;
  entity_name: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  change_percentage: number | null;
}

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

// ============ IMAGE CACHING TO SUPABASE STORAGE ============
async function cacheCreativeImage(
  supabase: any,
  projectId: string,
  adId: string,
  imageUrl: string | null
): Promise<string | null> {
  if (!imageUrl) return null;
  
  try {
    // Check if we already have a cached version
    const fileName = `${projectId}/${adId}.jpg`;
    
    // Try to get existing file URL
    const { data: existingFile } = supabase.storage
      .from('creative-images')
      .getPublicUrl(fileName);
    
    // Try to download the image from Facebook
    const response = await fetch(imageUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    if (!response.ok) {
      console.log(`[IMAGE_CACHE] Failed to download image for ad ${adId}: ${response.status}`);
      return null;
    }
    
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('creative-images')
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: true,
      });
    
    if (uploadError) {
      console.log(`[IMAGE_CACHE] Upload error for ad ${adId}: ${uploadError.message}`);
      return null;
    }
    
    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('creative-images')
      .getPublicUrl(fileName);
    
    console.log(`[IMAGE_CACHE] Cached image for ad ${adId}`);
    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.log(`[IMAGE_CACHE] Error caching image for ad ${adId}: ${error}`);
    return null;
  }
}

// Batch cache images with concurrency limit
async function batchCacheImages(
  supabase: any,
  projectId: string,
  adsWithImages: Array<{ adId: string; imageUrl: string | null }>
): Promise<Map<string, string>> {
  const cachedUrls = new Map<string, string>();
  const BATCH_SIZE = 5; // Process 5 images at a time
  
  console.log(`[IMAGE_CACHE] Starting batch cache for ${adsWithImages.length} images`);
  
  for (let i = 0; i < adsWithImages.length; i += BATCH_SIZE) {
    const batch = adsWithImages.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(
      batch.map(async ({ adId, imageUrl }) => {
        const cachedUrl = await cacheCreativeImage(supabase, projectId, adId, imageUrl);
        return { adId, cachedUrl };
      })
    );
    
    for (const { adId, cachedUrl } of results) {
      if (cachedUrl) {
        cachedUrls.set(adId, cachedUrl);
      }
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < adsWithImages.length) {
      await delay(100);
    }
  }
  
  console.log(`[IMAGE_CACHE] Cached ${cachedUrls.size} images successfully`);
  return cachedUrls;
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

// ============ CHECK IF TOKEN EXPIRED ============
function isTokenExpiredError(data: any): boolean {
  if (!data?.error) return false;
  const errorCode = data.error.code;
  const errorSubcode = data.error.error_subcode;
  const errorMessage = (data.error.message || '').toLowerCase();
  
  // OAuth errors related to token expiration
  // Code 190: Invalid OAuth access token
  // Subcode 463: Token has expired
  // Subcode 467: Token has been invalidated
  return errorCode === 190 || 
         errorCode === '190' ||
         errorSubcode === 463 || 
         errorSubcode === 467 ||
         errorMessage.includes('access token') && (
           errorMessage.includes('expired') ||
           errorMessage.includes('invalid') ||
           errorMessage.includes('session')
         );
}

// ============ SEND TOKEN EXPIRY NOTIFICATION ============
async function sendTokenExpiryNotification(supabase: any): Promise<void> {
  try {
    // Get admin email from system_settings
    const { data: emailSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'admin_notification_email')
      .single();
    
    const adminEmail = emailSetting?.value;
    if (!adminEmail) {
      console.log('[TOKEN_EXPIRY] No admin email configured');
      return;
    }
    
    // Check if we already notified recently (within 1 hour)
    const { data: lastNotified } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'token_expiry_notified_at')
      .single();
    
    if (lastNotified?.value) {
      const lastNotifiedAt = new Date(lastNotified.value);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastNotifiedAt > hourAgo) {
        console.log('[TOKEN_EXPIRY] Already notified within the last hour');
        return;
      }
    }
    
    // Check if RESEND_API_KEY is configured
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.log('[TOKEN_EXPIRY] RESEND_API_KEY not configured, cannot send email');
      return;
    }
    
    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'V4 Dashboard <alerts@resend.dev>',
        to: [adminEmail],
        subject: '🚨 Token do Meta Ads Expirou - Ação Necessária',
        html: `
          <h1>Token do Meta Ads Expirou</h1>
          <p>O token de acesso do Meta Ads expirou e precisa ser renovado para continuar sincronizando os dados.</p>
          <h2>Como renovar:</h2>
          <ol>
            <li>Acesse o <a href="https://developers.facebook.com/tools/explorer/">Graph API Explorer</a></li>
            <li>Gere um novo token com as permissões necessárias</li>
            <li>Atualize o secret META_ACCESS_TOKEN no dashboard</li>
          </ol>
          <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
        `,
      }),
    });
    
    if (response.ok) {
      console.log('[TOKEN_EXPIRY] Email notification sent successfully');
      
      // Update last notified timestamp
      await supabase
        .from('system_settings')
        .update({ value: new Date().toISOString() })
        .eq('key', 'token_expiry_notified_at');
    } else {
      const errorData = await response.json();
      console.error('[TOKEN_EXPIRY] Failed to send email:', errorData);
    }
  } catch (error) {
    console.error('[TOKEN_EXPIRY] Error sending notification:', error);
  }
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

async function fetchWithRetry(url: string, entityName: string, supabase?: any, options?: RequestInit, timeoutMs = 30000): Promise<any> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const data = await simpleFetch(url, options, timeoutMs);
    
    if (!data.error) {
      return data;
    }
    
    // Log the error for debugging
    console.error(`[${entityName}] API Error:`, JSON.stringify(data.error));
    
    // Check if token expired - notify admin
    if (isTokenExpiredError(data) && supabase) {
      console.error(`[${entityName}] Token expired! Sending notification...`);
      await sendTokenExpiryNotification(supabase);
      // Don't retry for token expiration
      return data;
    }
    
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
async function fetchEntities(adAccountId: string, token: string, supabase?: any): Promise<{
  campaigns: any[];
  adsets: any[];
  ads: any[];
  adImageMap: Map<string, string>;
  videoThumbnailMap: Map<string, string>;
  creativeDataMap: Map<string, any>;
  tokenExpired?: boolean;
}> {
  const campaigns: any[] = [];
  const adsets: any[] = [];
  const ads: any[] = [];

  console.log(`[ENTITIES] Starting fetch for account ${adAccountId}`);

  // Effective status filter for all statuses (URL encoded) - exclude DELETED as Meta API doesn't allow it
  const effectiveStatusFilter = encodeURIComponent('["ACTIVE","PAUSED","ARCHIVED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","PENDING_BILLING_INFO","CAMPAIGN_PAUSED","ADSET_PAUSED","IN_PROCESS","WITH_ISSUES"]');

  // Fetch campaigns - include all statuses
  console.log(`[CAMPAIGNS] Fetching campaigns...`);
  let url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'CAMPAIGNS', supabase);
    if (isTokenExpiredError(data)) {
      return { campaigns: [], adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), tokenExpired: true };
    }
    if (data.data) campaigns.push(...data.data);
    url = data.paging?.next || null;
  }
  console.log(`[CAMPAIGNS] Fetched ${campaigns.length} campaigns`);

  // Fetch adsets - include all statuses
  console.log(`[ADSETS] Fetching adsets...`);
  url = `https://graph.facebook.com/v19.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADSETS', supabase);
    if (isTokenExpiredError(data)) {
      return { campaigns, adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), tokenExpired: true };
    }
    if (data.data) adsets.push(...data.data);
    url = data.paging?.next || null;
  }
  console.log(`[ADSETS] Fetched ${adsets.length} adsets`);

  // Fetch ads with creative fields for HD images AND ad copy (primary_text, headline, cta)
  // object_story_spec contains the ad copy data: body (primary_text), title (headline), call_to_action
  // FIXED: Removed image_url from creative{} as it's not a valid field on the ads endpoint - use thumbnail_url and fetch full images via adimages endpoint
  console.log(`[ADS] Fetching ads with creative data...`);
  url = `https://graph.facebook.com/v19.0/${adAccountId}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url,image_hash,body,title,call_to_action_type,object_story_spec{link_data{message,name,call_to_action,picture},video_data{message,title,call_to_action,video_id,image_hash}}}&limit=200&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADS', supabase);
    if (isTokenExpiredError(data)) {
      return { campaigns, adsets, ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), tokenExpired: true };
    }
    if (data.data) {
      console.log(`[ADS] Batch received: ${data.data.length} ads`);
      // Log first ad creative data for debugging
      if (data.data.length > 0 && ads.length === 0) {
        const firstAd = data.data[0];
        console.log(`[ADS] Sample ad: id=${firstAd.id}, has_creative=${!!firstAd.creative}, creative_id=${firstAd.creative?.id || 'none'}`);
      }
      ads.push(...data.data);
    }
    url = data.paging?.next || null;
  }
  console.log(`[ADS] Total ads fetched: ${ads.length}`);

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
    console.log(`[ADIMAGES] Fetching HD images for ${imageHashes.length} hashes...`);
    // Batch fetch images - Meta allows up to 50 hashes per request
    for (let i = 0; i < imageHashes.length; i += 50) {
      const batch = imageHashes.slice(i, i + 50);
      const hashesParam = batch.join(',');
      const imageUrl = `https://graph.facebook.com/v19.0/${adAccountId}/adimages?hashes=${encodeURIComponent(JSON.stringify(batch))}&fields=hash,url,url_128,original_width,original_height&access_token=${token}`;
      const imageData = await fetchWithRetry(imageUrl, 'ADIMAGES', supabase);
      
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

  // STEP 3: Fetch HD video thumbnails for video ads
  const videoIds: string[] = [];
  const adToVideoMap = new Map<string, string>(); // ad_id -> video_id
  for (const ad of ads) {
    const videoId = ad.creative?.object_story_spec?.video_data?.video_id;
    if (videoId) {
      videoIds.push(videoId);
      adToVideoMap.set(ad.id, videoId);
    }
  }
  
  const videoThumbnailMap = new Map<string, string>(); // video_id -> thumbnail_url
  if (videoIds.length > 0) {
    console.log(`[VIDEOS] Found ${videoIds.length} videos, fetching HD thumbnails...`);
    
    // Fetch video thumbnails in batches - use picture field for HD thumbnail
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      
      // Fetch each video's thumbnail
      for (const videoId of batch) {
        try {
          const videoUrl = `https://graph.facebook.com/v19.0/${videoId}?fields=id,picture,thumbnails{uri,height,width}&access_token=${token}`;
          const videoData = await fetchWithRetry(videoUrl, 'VIDEO_THUMBNAIL', supabase);
          
          if (videoData && !videoData.error) {
            // Priority: Get largest thumbnail from thumbnails array, or use picture field
            let bestThumbnail = videoData.picture;
            
            if (videoData.thumbnails?.data && videoData.thumbnails.data.length > 0) {
              // Sort by height descending and get the largest
              const thumbnails = videoData.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
              if (thumbnails[0]?.uri) {
                bestThumbnail = thumbnails[0].uri;
              }
            }
            
            if (bestThumbnail) {
              videoThumbnailMap.set(videoId, bestThumbnail);
            }
          }
        } catch (err) {
          console.log(`[VIDEO_THUMBNAIL] Error fetching thumbnail for video ${videoId}`);
        }
      }
      
      // Small delay between batches
      if (i + 50 < videoIds.length) {
        await delay(100);
      }
    }
    console.log(`[VIDEOS] Fetched ${videoThumbnailMap.size} HD video thumbnails`);
  }

  // STEP 4: Fetch ad creatives directly using /adcreatives endpoint for better data
  // This is the OFFICIAL way to get creative assets per Meta API documentation
  const creativeDataMap = new Map<string, any>();
  const creativeIds: string[] = [];
  
  for (const ad of ads) {
    if (ad.creative?.id) {
      creativeIds.push(ad.creative.id);
    }
  }
  
  if (creativeIds.length > 0) {
    console.log(`[CREATIVES] Fetching ${creativeIds.length} creative details via /adcreatives endpoint...`);
    
    // Fetch creatives in batches of 50
    for (let i = 0; i < creativeIds.length; i += 50) {
      const batch = creativeIds.slice(i, i + 50);
      
      for (const creativeId of batch) {
        try {
          // Use the official adcreatives endpoint with all creative fields
          // FIXED: Removed image_url as it causes API error - use thumbnail_url and effective_object_story_id for images
          const creativeUrl = `https://graph.facebook.com/v19.0/${creativeId}?fields=id,name,thumbnail_url,object_story_spec,asset_feed_spec,body,title,call_to_action_type&access_token=${token}`;
          const creativeData = await fetchWithRetry(creativeUrl, 'CREATIVE', supabase);
          
          if (creativeData && !creativeData.error) {
            creativeDataMap.set(creativeId, creativeData);
            
            // Log first creative for debugging
            if (creativeDataMap.size === 1) {
              console.log(`[CREATIVES] Sample creative: id=${creativeId}, has_thumbnail=${!!creativeData.thumbnail_url}, has_image=${!!creativeData.image_url}, has_body=${!!creativeData.body}`);
            }
          }
        } catch (err) {
          console.log(`[CREATIVES] Error fetching creative ${creativeId}`);
        }
      }
      
      // Small delay between batches
      if (i + 50 < creativeIds.length) {
        await delay(100);
      }
    }
    console.log(`[CREATIVES] Fetched ${creativeDataMap.size} creative details`);
  }

  console.log(`[ENTITIES] FINAL: Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}, Creatives: ${creativeDataMap.size}`);
  return { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap };
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
// LISTA SUPER RESTRITIVA: Apenas LEADS REAIS conforme aparecem no Gerenciador de Anúncios do Meta
// EXCLUI: mensagens, conversas, tráfego Instagram, contatos genéricos, etc.

// LEADS REAIS - Formulários (Lead Ads / Instant Forms)
// Estes são os únicos leads que aparecem como "Resultados" no Gerenciador
// IMPORTANTE: O Meta reporta o mesmo lead em múltiplos action_types (lead, leadgen, on_facebook_lead)
// Por isso, usamos APENAS os tipos mais específicos para evitar dupla contagem
const LEAD_FORM_ACTIONS = [
  'leadgen.other',                           // Lead via formulário (formulário do Lead Ads)
  'on_facebook_lead',                        // Lead no Facebook (formulário no feed)
  // REMOVIDO 'lead' genérico pois é duplicado de on_facebook_lead na maioria dos casos
];

// LEADS VIA PIXEL - "Lead no site" / "Leads no site"
// Este é o PRINCIPAL para campanhas de tráfego/conversão
// O Meta Gerenciador mostra este como "Leads" na coluna de resultados
const LEAD_PIXEL_ACTIONS = [
  'offsite_conversion.fb_pixel_lead',        // Lead via pixel (Lead no site) - ÚNICO usado
  // REMOVIDO 'lead' genérico pois aparece duplicado junto com fb_pixel_lead
];

// REGISTROS COMPLETOS - Contam como lead/conversão
const REGISTRATION_ACTIONS = [
  'offsite_conversion.fb_pixel_complete_registration', // Cadastro via pixel (PRINCIPAL)
  // REMOVIDO 'complete_registration' genérico para evitar dupla contagem
];

// COMPRAS - Para campanhas de e-commerce
const PURCHASE_ACTIONS = [
  'offsite_conversion.fb_pixel_purchase',    // Compra via pixel (PRINCIPAL)
  'omni_purchase',                           // Compra omnichannel (alternativa)
  // REMOVIDO 'purchase' genérico para evitar dupla contagem
];

// MENSAGENS - Para campanhas de tráfego para WhatsApp/Messenger (Inside Sales)
// LISTA COMPLETA de todos os action_types relacionados a mensagens no Meta
// Referência: https://developers.facebook.com/docs/marketing-api/reference/ads-action-stats/
const MESSAGING_ACTION_TYPES = [
  // Conversas iniciadas / primeiras respostas (PRINCIPAL para campanhas de mensagem)
  'onsite_conversion.messaging_first_reply',              // Primeira resposta no Messenger
  'onsite_conversion.messaging_conversation_started_7d',  // Conversa iniciada (7 dias) - MAIS COMUM
  'onsite_conversion.messaging_conversation_started_1d',  // Conversa iniciada (1 dia)
  'onsite_conversion.messaging_reply',                    // Resposta no Messenger
  'onsite_conversion.messaging_user_depth_2_message_send', // Usuário enviou 2+ mensagens
  'onsite_conversion.messaging_user_depth_3_message_send', // Usuário enviou 3+ mensagens
  
  // Contatos diretos
  'contact',                                               // Contato genérico (pode ser WhatsApp)
  'contact_total',                                         // Total de contatos
  'contact_website',                                       // Contato via website
  'onsite_web_contact',                                    // Contato web
  
  // WhatsApp específico
  'onsite_conversion.click_to_whatsapp',                  // Clique para WhatsApp
  'onsite_conversion.post_engagement_whatsapp',           // Engajamento WhatsApp
  
  // Instagram Direct
  'onsite_conversion.instagram_messaging_reply',          // Resposta no Instagram Direct
  
  // Outros tipos de conversas
  'onsite_conversion.send_message',                       // Mensagem enviada
  'onsite_conversion.total_messaging_connection',         // Total de conexões de mensagem
];

// VISITAS AO PERFIL DO INSTAGRAM - Para campanhas de tráfego Instagram (Topo de Funil)
// Estas campanhas NÃO geram leads, a métrica principal é Visitas ao Perfil
// IMPORTANTE: O Meta pode retornar essas ações com diferentes nomes dependendo da versão da API
const PROFILE_VISIT_ACTION_TYPES = [
  'onsite_conversion.profile_view',                       // Visualização de perfil
  'ig_profile_visit',                                     // Visita ao perfil do Instagram
  'profile_visit',                                        // Visita ao perfil (genérico)
  'onsite_conversion.instagram_profile_view',             // Visualização de perfil Instagram
  'onsite_conversion.ig_profile_visit',                   // Alternativa IG profile visit
  'instagram_profile_view',                               // Alternativa simples
  'page_engagement',                                      // Engajamento na página (fallback)
  'post_engagement',                                      // Engajamento no post (fallback para campanhas de tráfego)
];

// LISTA COMPLETA DE CONVERSÕES VÁLIDAS
// NÃO INCLUI: contact, messaging, conversations, onsite_web_lead, leadgen_grouped, etc.
// Esses tipos causam dupla contagem ou não são leads reais
const CONVERSION_ACTION_TYPES = [
  ...LEAD_FORM_ACTIONS,
  ...LEAD_PIXEL_ACTIONS,
  ...REGISTRATION_ACTIONS,
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

// Mapeamento de action_types para uma categoria base para evitar dupla contagem
// SIMPLIFICADO: Apenas 3 categorias (lead_form, lead_pixel, registration, purchase)
// Cada categoria usa APENAS UM action_type específico para evitar duplicação
function normalizeActionTypeToBase(actionType: string): string {
  // LEADS VIA FORMULÁRIO (Lead Ads) - categoria separada
  if (actionType === 'on_facebook_lead' ||
      actionType === 'leadgen.other') {
    return 'lead_form';
  }
  
  // LEADS VIA PIXEL (Lead no site) - categoria separada
  if (actionType === 'offsite_conversion.fb_pixel_lead') {
    return 'lead_pixel';
  }
  
  // REGISTROS - apenas pixel
  if (actionType === 'offsite_conversion.fb_pixel_complete_registration') {
    return 'registration';
  }
  
  // COMPRAS - pixel tem prioridade
  if (actionType === 'offsite_conversion.fb_pixel_purchase') {
    return 'purchase_pixel';
  }
  if (actionType === 'omni_purchase') {
    return 'purchase_omni';
  }
  
  // Default: retorna o próprio tipo (será ignorado se não estiver na lista)
  return actionType;
}

function extractConversions(insights: any, logAllActions: boolean = false): { conversions: number; conversionValue: number } {
  let conversions = 0;
  let conversionValue = 0;
  
  // Track which action types we found for debugging
  const foundActions: string[] = [];
  const allActions: string[] = [];
  
  // Extrair conversões - SOMA todos os tipos encontrados
  // Mas evita dupla contagem usando normalização para categoria base
  if (insights?.actions && Array.isArray(insights.actions)) {
    // Map para guardar o maior valor de cada categoria base
    const categoryValues = new Map<string, { value: number; actionType: string }>();
    
    for (const action of insights.actions) {
      const actionType = action.action_type;
      const actionValue = parseInt(action.value) || 0;
      
      // Log ALL action types for debugging (only first few rows)
      if (logAllActions && actionValue > 0) {
        allActions.push(`${actionType}:${actionValue}`);
      }
      
      if (CONVERSION_ACTION_TYPES.includes(actionType) && actionValue > 0) {
        // Normaliza para categoria base para evitar dupla contagem
        const baseCategory = normalizeActionTypeToBase(actionType);
        
        // Guarda apenas o maior valor para cada categoria
        const existing = categoryValues.get(baseCategory);
        if (!existing || actionValue > existing.value) {
          categoryValues.set(baseCategory, { value: actionValue, actionType });
        }
      }
    }
    
    // Soma os valores de cada categoria (sem dupla contagem)
    for (const [category, { value, actionType }] of categoryValues) {
      conversions += value;
      foundActions.push(`${actionType}:${value}`);
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

// ============ EXTRACT MESSAGING METRICS ============
// For Inside Sales campaigns that use WhatsApp/Messenger traffic
// O Meta Ads Manager mostra "Conversas por mensagem" que corresponde a messaging_conversation_started_7d
function extractMessagingReplies(insights: any, logActions: boolean = false): number {
  let messagingReplies = 0;
  const foundMessages: string[] = [];
  
  if (insights?.actions && Array.isArray(insights.actions)) {
    // PRIORIDADE: O Meta mostra messaging_conversation_started_7d como resultado principal
    // Se não tiver, usamos total_messaging_connection ou first_reply
    let conversationStarted7d = 0;
    let totalMessagingConnection = 0;
    let firstReply = 0;
    
    for (const action of insights.actions) {
      const actionType = action.action_type;
      const actionValue = parseInt(action.value) || 0;
      
      if (actionValue > 0) {
        // Log all messaging-related actions for debugging
        if (MESSAGING_ACTION_TYPES.includes(actionType)) {
          foundMessages.push(`${actionType}:${actionValue}`);
        }
        
        // Captura os valores específicos
        if (actionType === 'onsite_conversion.messaging_conversation_started_7d') {
          conversationStarted7d = actionValue;
        } else if (actionType === 'onsite_conversion.total_messaging_connection') {
          totalMessagingConnection = actionValue;
        } else if (actionType === 'onsite_conversion.messaging_first_reply') {
          firstReply = actionValue;
        }
      }
    }
    
    // Prioridade: usar messaging_conversation_started_7d (o que o Meta mostra como resultado)
    // Fallback: total_messaging_connection ou first_reply (pegar o maior)
    if (conversationStarted7d > 0) {
      messagingReplies = conversationStarted7d;
    } else {
      messagingReplies = Math.max(totalMessagingConnection, firstReply);
    }
  }
  
  // Log found messaging actions for debugging
  if (foundMessages.length > 0 && logActions) {
    console.log(`[MESSAGING] Found: ${foundMessages.join(', ')}, Using: ${messagingReplies}`);
  }
  
  return messagingReplies;
}

// ============ EXTRACT PROFILE VISITS (Instagram Traffic Campaigns) ============
// Para campanhas de tráfego para Instagram (Topo de Funil)
// Estas campanhas NÃO geram leads/CPL - a métrica principal é Visitas ao Perfil
function extractProfileVisits(insights: any, logActions: boolean = false, campaignObjective?: string): number {
  let profileVisits = 0;
  const foundActions: string[] = [];
  const allActionsDebug: string[] = [];
  
  if (insights?.actions && Array.isArray(insights.actions)) {
    for (const action of insights.actions) {
      const actionType = action.action_type;
      const actionValue = parseInt(action.value) || 0;
      
      // Log ALL actions for debugging (first few rows only)
      if (actionValue > 0 && logActions) {
        allActionsDebug.push(`${actionType}:${actionValue}`);
      }
      
      if (actionValue > 0 && PROFILE_VISIT_ACTION_TYPES.includes(actionType)) {
        foundActions.push(`${actionType}:${actionValue}`);
        // Pega o maior valor (evita dupla contagem)
        if (actionValue > profileVisits) {
          profileVisits = actionValue;
        }
      }
    }
  }
  
  // Log ALL actions for debugging traffic campaigns (helps identify new action types)
  if (logActions && allActionsDebug.length > 0 && campaignObjective === 'OUTCOME_TRAFFIC') {
    console.log(`[TRAFFIC_CAMPAIGN_ACTIONS] All actions: ${allActionsDebug.join(', ')}`);
  }
  
  // Log found profile visit actions for debugging
  if (foundActions.length > 0 && logActions) {
    console.log(`[PROFILE_VISITS] Found: ${foundActions.join(', ')}, Using: ${profileVisits}`);
  }
  
  return profileVisits;
}

// ============ CHECK IF CAMPAIGN IS INSTAGRAM TRAFFIC (Top of Funnel) ============
// Campanhas com objective OUTCOME_TRAFFIC ou OUTCOME_ENGAGEMENT são topo de funil
// Não devem mostrar Leads/CPL, e sim Visitas ao Perfil
function isInstagramTrafficCampaign(objective: string | null): boolean {
  if (!objective) return false;
  const trafficObjectives = ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'REACH', 'BRAND_AWARENESS'];
  return trafficObjectives.includes(objective.toUpperCase());
}

// ============ EXTRACT HD IMAGE URL ============
function extractHdImageUrl(ad: any, adImageMap: Map<string, string>, videoThumbnailMap?: Map<string, string>): { imageUrl: string | null; videoUrl: string | null } {
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
  
  // Priority 4: Check object_story_spec for image/video
  if (creative.object_story_spec) {
    const spec = creative.object_story_spec;
    
    // Link data (single image ads)
    if (!imageUrl && spec.link_data?.image_url) {
      imageUrl = spec.link_data.image_url;
    }
    if (!imageUrl && spec.link_data?.picture) {
      imageUrl = spec.link_data.picture;
    }
    
    // Check for image_hash in link_data
    if (!imageUrl && spec.link_data?.image_hash && adImageMap.has(spec.link_data.image_hash)) {
      imageUrl = adImageMap.get(spec.link_data.image_hash)!;
    }
    
    // Video data - IMPROVED: Use HD thumbnail from videoThumbnailMap
    if (spec.video_data?.video_id) {
      const videoId = spec.video_data.video_id;
      
      // First priority: Use HD thumbnail fetched from Videos API
      if (videoThumbnailMap && videoThumbnailMap.has(videoId)) {
        imageUrl = videoThumbnailMap.get(videoId)!;
        console.log(`[VIDEO] Using HD thumbnail for video ${videoId}`);
      }
      // Fallback: Use video_data.image_url from object_story_spec
      else if (!imageUrl && spec.video_data.image_url) {
        imageUrl = spec.video_data.image_url;
      }
      
      // Mark this as a video ad
      videoUrl = videoId;
    }
    
    // Photo data
    if (!imageUrl && spec.photo_data?.url) {
      imageUrl = spec.photo_data.url;
    }
  }
  
  // Priority 5: Fallback to thumbnail (but aggressively clean resize parameters)
  if (!imageUrl && creative.thumbnail_url) {
    let thumbnailUrl = creative.thumbnail_url;
    
    // AGGRESSIVE URL CLEANING - Remove ALL resize parameters
    // Remove stp parameter (e.g., stp=dst-jpg_p64x64_q75_tt6 or stp=c0.5000x0.5000f_dst-emg0_p64x64_q75_tt6)
    thumbnailUrl = thumbnailUrl.replace(/[&?]stp=[^&]*/g, '');
    
    // Remove size constraints in path
    thumbnailUrl = thumbnailUrl.replace(/\/p\d+x\d+\//g, '/');
    thumbnailUrl = thumbnailUrl.replace(/\/s\d+x\d+\//g, '/');
    
    // Remove query params for width/height
    thumbnailUrl = thumbnailUrl.replace(/[&?]width=\d+/gi, '');
    thumbnailUrl = thumbnailUrl.replace(/[&?]height=\d+/gi, '');
    
    // Try to get larger size by modifying URL patterns
    thumbnailUrl = thumbnailUrl.replace('_t.', '_n.'); // Facebook uses _t for thumb, _n for normal
    thumbnailUrl = thumbnailUrl.replace('_s.', '_n.'); // _s is small, _n is normal
    
    // Fix malformed URL: if & appears before any ?, replace first & with ?
    if (thumbnailUrl.includes('&') && !thumbnailUrl.includes('?')) {
      thumbnailUrl = thumbnailUrl.replace('&', '?');
    }
    
    // Clean trailing ? or &
    thumbnailUrl = thumbnailUrl.replace(/[&?]$/g, '');
    
    imageUrl = thumbnailUrl;
  }
  
  return { imageUrl, videoUrl };
}

// ============ EXTRACT AD COPY (PRIMARY TEXT, HEADLINE, CTA) ============
// Can extract from ad object or from creativeData fetched directly from /adcreatives endpoint
function extractAdCopy(ad: any, creativeData?: any): { primaryText: string | null; headline: string | null; cta: string | null } {
  let primaryText: string | null = null;
  let headline: string | null = null;
  let cta: string | null = null;
  
  // First try creativeData from /adcreatives endpoint (more reliable)
  if (creativeData) {
    if (creativeData.body) {
      primaryText = creativeData.body;
    }
    if (creativeData.title) {
      headline = creativeData.title;
    }
    if (creativeData.call_to_action_type) {
      cta = creativeData.call_to_action_type;
    }
    
    // Extract from object_story_spec in creativeData
    const storySpec = creativeData.object_story_spec;
    if (storySpec) {
      if (storySpec.link_data) {
        if (!primaryText && storySpec.link_data.message) {
          primaryText = storySpec.link_data.message;
        }
        if (!headline && storySpec.link_data.name) {
          headline = storySpec.link_data.name;
        }
        if (!cta && storySpec.link_data.call_to_action?.type) {
          cta = storySpec.link_data.call_to_action.type;
        }
      }
      
      if (storySpec.video_data) {
        if (!primaryText && storySpec.video_data.message) {
          primaryText = storySpec.video_data.message;
        }
        if (!headline && storySpec.video_data.title) {
          headline = storySpec.video_data.title;
        }
        if (!cta && storySpec.video_data.call_to_action?.type) {
          cta = storySpec.video_data.call_to_action.type;
        }
      }
    }
  }
  
  // Fallback to ad's embedded creative data
  const creative = ad?.creative;
  if (creative && (!primaryText || !headline || !cta)) {
    if (!primaryText && creative.body) {
      primaryText = creative.body;
    }
    if (!headline && creative.title) {
      headline = creative.title;
    }
    if (!cta && creative.call_to_action_type) {
      cta = creative.call_to_action_type;
    }
    
    // Extract from object_story_spec (more detailed)
    const storySpec = creative.object_story_spec;
    if (storySpec) {
      if (storySpec.link_data) {
        if (!primaryText && storySpec.link_data.message) {
          primaryText = storySpec.link_data.message;
        }
        if (!headline && storySpec.link_data.name) {
          headline = storySpec.link_data.name;
        }
        if (!cta && storySpec.link_data.call_to_action?.type) {
          cta = storySpec.link_data.call_to_action.type;
        }
      }
      
      if (storySpec.video_data) {
        if (!primaryText && storySpec.video_data.message) {
          primaryText = storySpec.video_data.message;
        }
        if (!headline && storySpec.video_data.title) {
          headline = storySpec.video_data.title;
        }
        if (!cta && storySpec.video_data.call_to_action?.type) {
          cta = storySpec.video_data.call_to_action.type;
        }
      }
    }
  }
  
  return { primaryText, headline, cta };
}

// ============ EXTRACT CREATIVE IMAGE FROM CREATIVE DATA ============
function extractCreativeImage(ad: any, creativeData?: any, adImageMap?: Map<string, string>, videoThumbnailMap?: Map<string, string>): { imageUrl: string | null; videoUrl: string | null } {
  let imageUrl: string | null = null;
  let videoUrl: string | null = null;
  
  // First try creativeData from /adcreatives endpoint
  if (creativeData) {
    // Direct image_url from creative
    if (creativeData.image_url) {
      imageUrl = creativeData.image_url;
    }
    // Thumbnail as fallback
    if (!imageUrl && creativeData.thumbnail_url) {
      imageUrl = creativeData.thumbnail_url;
    }
    
    // Try object_story_spec for images
    const storySpec = creativeData.object_story_spec;
    if (storySpec) {
      if (storySpec.link_data) {
        if (!imageUrl && storySpec.link_data.image_url) {
          imageUrl = storySpec.link_data.image_url;
        }
        if (!imageUrl && storySpec.link_data.picture) {
          imageUrl = storySpec.link_data.picture;
        }
      }
      
      if (storySpec.video_data) {
        if (storySpec.video_data.video_id && videoThumbnailMap) {
          const videoThumbnail = videoThumbnailMap.get(storySpec.video_data.video_id);
          if (videoThumbnail) {
            imageUrl = videoThumbnail;
          }
        }
        if (storySpec.video_data.image_url) {
          videoUrl = storySpec.video_data.image_url;
          if (!imageUrl) {
            imageUrl = storySpec.video_data.image_url;
          }
        }
      }
    }
  }
  
  // Fallback to ad's embedded creative data and HD image maps
  const creative = ad?.creative;
  if (creative) {
    // Try HD image from adImageMap (highest quality)
    if (!imageUrl && creative.image_hash && adImageMap) {
      const hdImage = adImageMap.get(creative.image_hash);
      if (hdImage) {
        imageUrl = hdImage;
      }
    }
    
    // Try image_url from creative
    if (!imageUrl && creative.image_url) {
      imageUrl = creative.image_url;
    }
    
    // Try thumbnail_url as fallback
    if (!imageUrl && creative.thumbnail_url) {
      imageUrl = creative.thumbnail_url;
    }
    
    // Video thumbnail from map
    const videoId = creative.object_story_spec?.video_data?.video_id;
    if (videoId && videoThumbnailMap) {
      const videoThumbnail = videoThumbnailMap.get(videoId);
      if (videoThumbnail && !imageUrl) {
        imageUrl = videoThumbnail;
      }
    }
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

// ============ DETECT CHANGES FOR OPTIMIZATION HISTORY ============
async function detectAndRecordChanges(
  supabase: any,
  projectId: string,
  entityType: 'campaign' | 'adset' | 'ad',
  tableName: string,
  newRecords: any[],
  trackedFields: string[]
): Promise<OptimizationChange[]> {
  const changes: OptimizationChange[] = [];
  
  if (newRecords.length === 0) return changes;
  
  // Fetch existing records
  const ids = newRecords.map(r => r.id);
  const { data: existingRecords, error } = await supabase
    .from(tableName)
    .select('*')
    .in('id', ids)
    .eq('project_id', projectId);
  
  if (error) {
    console.error(`[CHANGES] Error fetching existing ${entityType}s:`, error.message);
    return changes;
  }
  
  const existingMap = new Map((existingRecords || []).map((r: any) => [r.id, r]));
  
  for (const newRecord of newRecords) {
    const existing = existingMap.get(newRecord.id) as Record<string, any> | undefined;
    
    if (!existing) {
      // New entity - record as "created"
      changes.push({
        project_id: projectId,
        entity_type: entityType,
        entity_id: newRecord.id,
        entity_name: newRecord.name || 'Unknown',
        field_changed: 'created',
        old_value: null,
        new_value: newRecord.status || 'ACTIVE',
        change_type: 'created',
        change_percentage: null,
      });
      continue;
    }
    
    // Check tracked fields for changes
    for (const field of trackedFields) {
      const oldValue = existing[field] as string | number | null | undefined;
      const newValue = newRecord[field] as string | number | null | undefined;
      
      // Skip if both are null/undefined or equal
      if (oldValue === newValue) continue;
      if (oldValue == null && newValue == null) continue;
      
      // Determine change type
      let changeType = 'modified';
      let changePercentage: number | null = null;
      
      if (field === 'status') {
        if (oldValue === 'ACTIVE' && newValue !== 'ACTIVE') {
          changeType = 'paused';
        } else if (oldValue !== 'ACTIVE' && newValue === 'ACTIVE') {
          changeType = 'activated';
        } else {
          changeType = 'status_change';
        }
      } else if (field.includes('budget')) {
        changeType = 'budget_change';
        const oldNum = parseFloat(String(oldValue)) || 0;
        const newNum = parseFloat(String(newValue)) || 0;
        if (oldNum > 0) {
          changePercentage = ((newNum - oldNum) / oldNum) * 100;
        }
      }
      
      changes.push({
        project_id: projectId,
        entity_type: entityType,
        entity_id: newRecord.id,
        entity_name: newRecord.name || (existing.name as string) || 'Unknown',
        field_changed: field,
        old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue != null ? String(newValue) : null,
        change_type: changeType,
        change_percentage: changePercentage,
      });
    }
  }
  
  return changes;
}

// ============ DETECT AND SEND ANOMALY ALERTS ============
interface AnomalyAlert {
  project_id: string;
  anomaly_type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'critical';
}

async function detectAndSendAnomalyAlerts(
  supabase: any,
  projectId: string,
  changes: OptimizationChange[],
  campaignMetrics: Map<string, any>,
  existingCampaigns: any[]
): Promise<void> {
  // Fetch alert configs for this project
  const { data: alertConfigs, error: configError } = await supabase
    .from('anomaly_alert_config')
    .select('*')
    .eq('project_id', projectId)
    .eq('enabled', true);
  
  if (configError || !alertConfigs || alertConfigs.length === 0) {
    return; // No active alert configs
  }
  
  console.log(`[ANOMALY] Found ${alertConfigs.length} active alert configs`);
  
  const anomalies: AnomalyAlert[] = [];
  
  // Create lookup for existing campaign metrics
  const existingMetricsMap = new Map(existingCampaigns.map(c => [c.id, c]));
  
  for (const config of alertConfigs) {
    // Check for paused entities in changes
    for (const change of changes) {
      if (change.change_type === 'paused') {
        const shouldAlert = 
          (change.entity_type === 'campaign' && config.campaign_paused_alert) ||
          (change.entity_type === 'adset' && config.ad_set_paused_alert) ||
          (change.entity_type === 'ad' && config.ad_paused_alert);
        
        if (shouldAlert) {
          anomalies.push({
            project_id: projectId,
            anomaly_type: `${change.entity_type}_paused`,
            entity_type: change.entity_type,
            entity_id: change.entity_id,
            entity_name: change.entity_name,
            details: { old_status: change.old_value, new_status: change.new_value },
            severity: 'warning',
          });
        }
      }
      
      // Check budget changes
      if (change.change_type === 'budget_change' && config.budget_change_alert) {
        anomalies.push({
          project_id: projectId,
          anomaly_type: 'budget_change',
          entity_type: change.entity_type,
          entity_id: change.entity_id,
          entity_name: change.entity_name,
          details: { 
            old_budget: change.old_value, 
            new_budget: change.new_value,
            change_percentage: change.change_percentage 
          },
          severity: Math.abs(change.change_percentage || 0) > 50 ? 'critical' : 'warning',
        });
      }
    }
    
    // Check for CTR drop and CPL increase
    for (const [campaignId, newMetrics] of campaignMetrics.entries()) {
      const existing = existingMetricsMap.get(campaignId);
      if (!existing) continue;
      
      // CTR Drop
      const oldCtr = existing.ctr || 0;
      const newCtr = newMetrics.ctr || 0;
      if (oldCtr > 0 && newCtr > 0) {
        const ctrChange = ((newCtr - oldCtr) / oldCtr) * 100;
        if (ctrChange < -(config.ctr_drop_threshold || 20)) {
          anomalies.push({
            project_id: projectId,
            anomaly_type: 'ctr_drop',
            entity_type: 'campaign',
            entity_id: campaignId,
            entity_name: newMetrics.name || existing.name || 'Unknown',
            details: { 
              old_ctr: oldCtr.toFixed(2), 
              new_ctr: newCtr.toFixed(2),
              change_percentage: ctrChange.toFixed(1)
            },
            severity: Math.abs(ctrChange) > 40 ? 'critical' : 'warning',
          });
        }
      }
      
      // CPL Increase
      const oldCpa = existing.cpa || 0;
      const newCpa = newMetrics.cpa || 0;
      if (oldCpa > 0 && newCpa > 0) {
        const cpaChange = ((newCpa - oldCpa) / oldCpa) * 100;
        if (cpaChange > (config.cpl_increase_threshold || 30)) {
          anomalies.push({
            project_id: projectId,
            anomaly_type: 'cpl_increase',
            entity_type: 'campaign',
            entity_id: campaignId,
            entity_name: newMetrics.name || existing.name || 'Unknown',
            details: { 
              old_cpl: oldCpa.toFixed(2), 
              new_cpl: newCpa.toFixed(2),
              change_percentage: cpaChange.toFixed(1)
            },
            severity: cpaChange > 60 ? 'critical' : 'warning',
          });
        }
      }
    }
    
    // Send alerts if any anomalies detected
    if (anomalies.length > 0) {
      console.log(`[ANOMALY] Detected ${anomalies.length} anomalies`);
      
      // Save anomalies to database
      const { error: insertError } = await supabase
        .from('anomaly_alerts')
        .insert(anomalies);
      
      if (insertError) {
        console.error('[ANOMALY] Error saving alerts:', insertError.message);
      }
      
      // Send WhatsApp notification
      if (config.instance_id && config.phone_number) {
        try {
          const message = formatAnomalyMessage(anomalies);
          
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
          const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              instanceId: config.instance_id,
              phone: config.phone_number,
              message: message,
              messageType: 'anomaly_alert',
              targetType: config.target_type,
              groupId: config.group_id,
            }),
          });
          
          if (response.ok) {
            console.log('[ANOMALY] WhatsApp alert sent successfully');
            // Update last_alert_at
            await supabase
              .from('anomaly_alert_config')
              .update({ last_alert_at: new Date().toISOString() })
              .eq('id', config.id);
          } else {
            console.error('[ANOMALY] Failed to send WhatsApp alert:', await response.text());
          }
        } catch (err) {
          console.error('[ANOMALY] Error sending WhatsApp alert:', err);
        }
      }
    }
  }
}

function formatAnomalyMessage(anomalies: AnomalyAlert[]): string {
  const emoji: Record<string, string> = {
    ctr_drop: '📉',
    cpl_increase: '💸',
    campaign_paused: '⏸️',
    adset_paused: '⏸️',
    ad_paused: '⏸️',
    budget_change: '💰',
  };
  
  const severity_emoji: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };
  
  let message = '🔔 *ALERTAS DE ANOMALIA*\n\n';
  
  for (const anomaly of anomalies) {
    const icon = emoji[anomaly.anomaly_type] || '📊';
    const sev = severity_emoji[anomaly.severity] || '';
    
    message += `${icon} ${sev} *${anomaly.entity_name}*\n`;
    
    switch (anomaly.anomaly_type) {
      case 'ctr_drop':
        message += `CTR caiu ${anomaly.details.change_percentage}%\n`;
        message += `${anomaly.details.old_ctr}% → ${anomaly.details.new_ctr}%\n`;
        break;
      case 'cpl_increase':
        message += `CPL aumentou ${anomaly.details.change_percentage}%\n`;
        message += `R$ ${anomaly.details.old_cpl} → R$ ${anomaly.details.new_cpl}\n`;
        break;
      case 'campaign_paused':
      case 'adset_paused':
      case 'ad_paused':
        message += `Status: ${anomaly.details.old_status} → ${anomaly.details.new_status}\n`;
        break;
      case 'budget_change':
        message += `Orçamento alterado ${anomaly.details.change_percentage?.toFixed(0)}%\n`;
        message += `R$ ${anomaly.details.old_budget} → R$ ${anomaly.details.new_budget}\n`;
        break;
    }
    
    message += '\n';
  }
  
  message += `_${new Date().toLocaleString('pt-BR')}_`;
  
  return message;
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
    const { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap, tokenExpired } = await fetchEntities(ad_account_id, token, supabase);
    
    // Check if token expired
    if (tokenExpired) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token do Meta expirou. Uma notificação foi enviada para o administrador.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build lookup maps
    const campaignMap = new Map(campaigns.map(c => [extractId(c.id), c]));
    const adsetMap = new Map(adsets.map(a => [extractId(a.id), a]));
    const adMap = new Map(ads.map(a => [extractId(a.id), a]));
    
    console.log(`[ENTITIES] Loaded for enrichment: ${campaignMap.size} campaigns, ${adMap.size} ads, ${creativeDataMap.size} creatives`);

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
        let { conversions, conversionValue } = extractConversions(insights, shouldLog);
        if (shouldLog && insights.actions?.length > 0) logCounter++;
        
        // Extract messaging metrics for Inside Sales campaigns (log first 20 rows with actions)
        const messagingReplies = extractMessagingReplies(insights, logCounter < 20);
        
        // Extract profile visits for Instagram Traffic campaigns (top of funnel)
        const campaignObjective = campaign?.objective || null;
        const profileVisits = extractProfileVisits(insights, logCounter < 20, campaignObjective);
        
        // Check if this is an Instagram Traffic campaign (top of funnel)
        const isTrafficCampaign = isInstagramTrafficCampaign(campaignObjective);
        
        // IMPORTANTE: Para campanhas de tráfego Instagram (topo de funil):
        // - NÃO usar leads/CPL
        // - A métrica principal é Visitas ao Perfil
        if (isTrafficCampaign && profileVisits > 0) {
          // Para campanhas de tráfego, NÃO convertemos visitas em leads
          // As visitas são armazenadas separadamente
          console.log(`[TRAFFIC_CAMPAIGN] Ad ${adId}: ${profileVisits} profile visits (not counting as leads)`);
        } else if (conversions === 0 && messagingReplies > 0) {
          // IMPORTANTE: Se não há conversões tradicionais mas há messaging_replies,
          // usar messaging_replies como lead (para campanhas de mensagem/tráfego WhatsApp)
          console.log(`[MESSAGING_AS_LEAD] Ad ${adId}: Using ${messagingReplies} messaging_replies as conversions`);
          conversions = messagingReplies;
        }
        
        // Get HD image URL (including video thumbnails)
        const { imageUrl, videoUrl } = ad ? extractHdImageUrl(ad, adImageMap, videoThumbnailMap) : { imageUrl: null, videoUrl: null };
        
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
          campaign_objective: campaignObjective,
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
          messaging_replies: messagingReplies,
          profile_visits: profileVisits,
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

    // ========== STEP 4.5: Cache creative images BEFORE upserting daily records ==========
    // Get unique ads with images to cache
    const uniqueAdImages = new Map<string, string>();
    for (const record of dailyRecords) {
      if (record.creative_thumbnail && !uniqueAdImages.has(record.ad_id)) {
        uniqueAdImages.set(record.ad_id, record.creative_thumbnail);
      }
    }
    
    const adsToCache = Array.from(uniqueAdImages.entries()).map(([adId, imageUrl]) => ({
      adId,
      imageUrl,
    }));
    
    let cachedUrlsMap = new Map<string, string>();
    if (adsToCache.length > 0) {
      console.log(`[IMAGE_CACHE] Found ${adsToCache.length} unique ads with images to cache`);
      cachedUrlsMap = await batchCacheImages(supabase, project_id, adsToCache);
      
      // Update daily records with cached thumbnails
      for (const record of dailyRecords) {
        const cachedUrl = cachedUrlsMap.get(record.ad_id);
        if (cachedUrl) {
          record.cached_creative_thumbnail = cachedUrl;
        }
      }
      console.log(`[IMAGE_CACHE] Cached ${cachedUrlsMap.size} images before upsert`);
    }

    // ========== STEP 5: Upsert daily records (now with cached thumbnails) ==========
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
    // First, fetch existing ads to preserve creative data for ads not in entities
    const existingAdIds = [...new Set(dailyRecords.map(r => r.ad_id))];
    let existingAdsMap = new Map<string, any>();
    
    if (existingAdIds.length > 0) {
      const { data: existingAds } = await supabase
        .from('ads')
        .select('id, creative_id, creative_thumbnail, creative_image_url, creative_video_url, cached_image_url, primary_text, headline, cta')
        .eq('project_id', project_id)
        .in('id', existingAdIds);
      
      if (existingAds) {
        existingAdsMap = new Map(existingAds.map(a => [a.id, a]));
        console.log(`[PRESERVE] Loaded ${existingAdsMap.size} existing ads for creative preservation`);
      }
    }
    
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
          profile_visits: 0,
        });
      }
      const cm = campaignMetrics.get(record.campaign_id);
      cm.spend += record.spend;
      cm.impressions += record.impressions;
      cm.clicks += record.clicks;
      cm.reach += record.reach;
      cm.conversions += record.conversions;
      cm.conversion_value += record.conversion_value;
      cm.profile_visits += record.profile_visits || 0;
      
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
          profile_visits: 0,
        });
      }
      const am = adsetMetrics.get(record.adset_id);
      am.spend += record.spend;
      am.impressions += record.impressions;
      am.clicks += record.clicks;
      am.reach += record.reach;
      am.conversions += record.conversions;
      am.conversion_value += record.conversion_value;
      am.profile_visits += record.profile_visits || 0;
      
      // Aggregate ads
      if (!adMetrics.has(record.ad_id)) {
        // Find the original ad to extract ad copy and HD image
        // Note: record.ad_id is a string, ads[].id might be number or string
        const originalAd = ads.find(a => String(a.id) === String(record.ad_id));
        
        // Get creative data from the /adcreatives endpoint (more reliable)
        const creativeId = originalAd?.creative?.id;
        const creativeData = creativeId ? creativeDataMap.get(creativeId) : null;
        
        // If we can't find the ad in entities, try to get existing data from DB
        // This preserves creative data for archived/deleted ads
        let existingCreativeData = null;
        if (!originalAd) {
          console.log(`[DEBUG] Ad ${record.ad_id} not found in ${ads.length} entities, will check existing data`);
          existingCreativeData = existingAdsMap?.get(record.ad_id);
          if (existingCreativeData) {
            console.log(`[DEBUG] Found existing creative data for ad ${record.ad_id}`);
          }
        }
        
        // Extract ad copy using both creativeData (primary) and ad (fallback)
        const { primaryText, headline, cta } = extractAdCopy(originalAd, creativeData);
        
        // Extract creative image using both sources
        const { imageUrl: hdImageUrl, videoUrl } = extractCreativeImage(originalAd, creativeData, adImageMap, videoThumbnailMap);
        
        // Log if we found ad copy data
        if (primaryText || headline || cta || hdImageUrl) {
          console.log(`[AD_DATA] Ad ${record.ad_id}: image=${hdImageUrl ? 'yes' : 'no'}, headline="${headline?.substring(0, 30) || 'null'}", cta="${cta || 'null'}"`);
        }
        
        // Use extracted data, or fallback to existing data from DB, or use daily record data
        adMetrics.set(record.ad_id, {
          id: record.ad_id,
          project_id,
          campaign_id: record.campaign_id,
          ad_set_id: record.adset_id,
          name: record.ad_name,
          status: record.ad_status,
          creative_id: creativeId || record.creative_id || existingCreativeData?.creative_id,
          creative_thumbnail: hdImageUrl || record.creative_thumbnail || existingCreativeData?.creative_thumbnail,
          creative_image_url: hdImageUrl || record.creative_thumbnail || existingCreativeData?.creative_image_url,
          creative_video_url: videoUrl || existingCreativeData?.creative_video_url,
          cached_image_url: existingCreativeData?.cached_image_url, // PRESERVE cached URL
          primary_text: primaryText || existingCreativeData?.primary_text,
          headline: headline || existingCreativeData?.headline,
          cta: cta || existingCreativeData?.cta,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
          conversion_value: 0,
          profile_visits: 0,
        });
      }
      const adm = adMetrics.get(record.ad_id);
      adm.spend += record.spend;
      adm.impressions += record.impressions;
      adm.clicks += record.clicks;
      adm.reach += record.reach;
      adm.conversions += record.conversions;
      adm.conversion_value += record.conversion_value;
      adm.profile_visits += record.profile_visits || 0;
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
    // Use cached URLs from Step 4.5 for ad records
    let adRecords = Array.from(adMetrics.values()).map(ad => {
      const derived = calculateDerived(ad);
      const cachedUrl = cachedUrlsMap.get(ad.id);
      if (cachedUrl) {
        derived.cached_image_url = cachedUrl;
      }
      return derived;
    });
    
    // ========== STEP 6.1: Detect changes for optimization history ==========
    const allChanges: OptimizationChange[] = [];
    
    // Detect campaign changes
    const campaignChanges = await detectAndRecordChanges(
      supabase, project_id, 'campaign', 'campaigns', campaignRecords, TRACKED_FIELDS_CAMPAIGN
    );
    allChanges.push(...campaignChanges);
    
    // Detect adset changes
    const adsetChanges = await detectAndRecordChanges(
      supabase, project_id, 'adset', 'ad_sets', adsetRecords, TRACKED_FIELDS_ADSET
    );
    allChanges.push(...adsetChanges);
    
    // Detect ad changes
    const adChanges = await detectAndRecordChanges(
      supabase, project_id, 'ad', 'ads', adRecords, TRACKED_FIELDS_AD
    );
    allChanges.push(...adChanges);
    
    // Save all changes to optimization_history
    if (allChanges.length > 0) {
      const { error: historyError } = await supabase
        .from('optimization_history')
        .insert(allChanges);
      
      if (historyError) {
        console.error('[CHANGES] Error saving optimization history:', historyError.message);
      } else {
        console.log(`[CHANGES] Recorded ${allChanges.length} changes (campaigns: ${campaignChanges.length}, adsets: ${adsetChanges.length}, ads: ${adChanges.length})`);
      }
      
      // Detect and send anomaly alerts
      // Get existing campaigns for CTR/CPL comparison
      const { data: existingCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, ctr, cpa')
        .eq('project_id', project_id);
      
      await detectAndSendAnomalyAlerts(
        supabase,
        project_id,
        allChanges,
        campaignMetrics,
        existingCampaigns || []
      );
    }
    
    // ========== STEP 6.2: Upsert entity tables ==========
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
