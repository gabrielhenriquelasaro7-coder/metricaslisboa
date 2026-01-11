import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  syncOnly?: 'campaigns' | 'adsets' | 'ads' | 'creatives';
}

const BASE_DELAY_MS = 200;
const MAX_RETRIES = 3;
const VALIDATION_RETRY_DELAYS = [5000, 10000, 20000];

// Track strategic changes only (no budget changes)
const TRACKED_FIELDS_CAMPAIGN = ['status', 'objective'];
const TRACKED_FIELDS_ADSET = ['status', 'targeting'];
const TRACKED_FIELDS_AD = ['status', 'creative_image_url', 'creative_video_url', 'headline', 'primary_text', 'cta'];

const MESSAGING_ACTION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d', 
  'onsite_conversion.messaging_first_reply', 
  'onsite_conversion.total_messaging_connection'
];

// Only include actual Instagram profile visit actions - NOT page_engagement or post_engagement
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
    if (!data.error) {
      if ((!data.data || data.data.length === 0) && entityName !== 'ADIMAGES') {
        console.log(`[${entityName}] Empty response - no data returned`);
      }
      return data;
    }
    console.log(`[${entityName}] API Error: ${JSON.stringify(data.error).substring(0, 300)}`);
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

async function cacheCreativeImage(supabase: any, projectId: string, adId: string, imageUrl: string | null, forceRefresh = false): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const fileName = `${projectId}/${adId}.jpg`;
    
    if (!forceRefresh) {
      const { data: existingFile } = await supabase.storage.from('creative-images').list(projectId, { limit: 1, search: `${adId}.jpg` });
      if (existingFile?.length > 0) {
        const fileSize = existingFile[0]?.metadata?.size || 0;
        if (fileSize > 10000) {
          const { data: publicUrlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
          if (publicUrlData?.publicUrl) {
            console.log(`[CACHE] Using existing HD cache (${fileSize} bytes): ${adId}`);
            return publicUrlData.publicUrl;
          }
        }
        console.log(`[CACHE] Existing file too small (${fileSize} bytes), re-caching: ${adId}`);
      }
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
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
        console.log(`[CACHE] Fetch failed (${response.status}) for ${adId}`);
        return null;
      }
      
      const imageBuffer = await response.arrayBuffer();
      
      if (imageBuffer.byteLength < 5000) {
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
      const isHD = imageBuffer.byteLength > 20000;
      console.log(`[CACHE] Cached ${isHD ? 'HD' : 'SD'} image (${imageBuffer.byteLength} bytes): ${adId}`);
      return publicUrlData?.publicUrl || null;
    } catch (e) {
      console.log(`[CACHE] Error for ${adId}: ${e}`);
      return null;
    }
  } catch (e) { 
    console.log(`[CACHE] Error caching ${adId}: ${e}`);
    return null; 
  }
}

// ===========================================================================================
// BUSCAR THUMBNAIL HD DO CRIATIVO
// Endpoint: https://graph.facebook.com/v22.0/<creative_id>
// Query params: fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080
// ===========================================================================================
async function fetchCreativeThumbnailHD(creativeId: string, token: string): Promise<string | null> {
  if (!creativeId) return null;
  
  try {
    const url = `https://graph.facebook.com/v22.0/${creativeId}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${token}`;
    const data = await simpleFetch(url, undefined, 10000);
    
    if (data?.thumbnail_url) {
      console.log(`[CREATIVE-HD] Got 1080px thumbnail for creative ${creativeId}`);
      return data.thumbnail_url;
    }
    
    return null;
  } catch (e) {
    console.log(`[CREATIVE-HD] Error fetching thumbnail for ${creativeId}: ${e}`);
    return null;
  }
}

// ===========================================================================================
// FLUXO CORRETO DE EXTRAÇÃO DE CRIATIVOS (CONFORME DOCUMENTAÇÃO META)
// 
// 1. Buscar ads com: creative{id,image_hash,object_story_spec,asset_feed_spec}
// 2. Extrair texto:
//    - PRIORIDADE: asset_feed_spec (bodies[].text, titles[].text, descriptions[].text)
//    - FALLBACK: object_story_spec.link_data (message, name, description)
// 3. Extrair imagem HD via endpoint do criativo com thumbnail_width=1080
// 4. FALLBACK: /adimages com fields=hash,url,url_1024
// ===========================================================================================

async function fetchEntities(adAccountId: string, token: string, supabase?: any, projectId?: string, lightSync = false, skipImageCache = false): Promise<{
  campaigns: any[]; adsets: any[]; ads: any[]; adImageMap: Map<string, string>; videoThumbnailMap: Map<string, string>;
  creativeDataMap: Map<string, any>; cachedCreativeMap: Map<string, any>; adPreviewMap: Map<string, string>;
  immediateCache: Map<string, string>; creativeThumbnailHDMap: Map<string, string>; tokenExpired?: boolean;
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
  
  // Campaigns - v22.0
  let url = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'CAMPAIGNS'); if (isTokenExpiredError(data)) return { campaigns: [], adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), creativeThumbnailHDMap: new Map(), tokenExpired: true }; if (data.data) campaigns.push(...data.data); url = data.paging?.next || null; }
  
  // Adsets - v22.0 - includes targeting for optimization tracking
  url = `https://graph.facebook.com/v22.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,promoted_object&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) { const data = await fetchWithRetry(url, 'ADSETS'); if (isTokenExpiredError(data)) return { campaigns, adsets: [], ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), creativeThumbnailHDMap: new Map(), tokenExpired: true }; if (data.data) adsets.push(...data.data); url = data.paging?.next || null; }
  
  // ADS - campos essenciais + creative para extração de texto e imagem
  // Inclui thumbnail_url, image_url, effective_object_story_id para fallback de imagens
  // body, title, call_to_action_type são campos diretos do creative para fallback de texto
  const adsFields = lightSync 
    ? 'id,name,status,adset_id,campaign_id,creative{id,object_story_spec,asset_feed_spec,thumbnail_url,body,title,call_to_action_type}'
    : 'id,name,status,adset_id,campaign_id,creative{id,image_hash,object_story_spec,asset_feed_spec,thumbnail_url,image_url,body,title,call_to_action_type}';
  url = `https://graph.facebook.com/v22.0/${adAccountId}/ads?fields=${adsFields}&limit=200&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  console.log(`[ADS-QUERY] ${lightSync ? 'LIGHT' : 'FULL'} SYNC - fetching ads...`);
  
  while (url) {
    const data = await fetchWithRetry(url, 'ADS'); 
    if (isTokenExpiredError(data)) return { campaigns, adsets, ads: [], adImageMap: new Map(), videoThumbnailMap: new Map(), creativeDataMap: new Map(), cachedCreativeMap, adPreviewMap: new Map(), immediateCache: new Map(), creativeThumbnailHDMap: new Map(), tokenExpired: true }; 
    if (data.data) ads.push(...data.data); 
    url = data.paging?.next || null; 
  }

  console.log(`[ENTITIES] Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}`);
  
  const adImageMap = new Map<string, string>(), videoThumbnailMap = new Map<string, string>(), creativeDataMap = new Map<string, any>(), adPreviewMap = new Map<string, string>(), immediateCache = new Map<string, string>(), creativeThumbnailHDMap = new Map<string, string>();
  
  // Mapear creatives dos ads
  for (const ad of ads) {
    if (ad.creative?.id) {
      creativeDataMap.set(ad.creative.id, ad.creative);
    }
  }
  
  // ===========================================================================================
  // FULL SYNC: Buscar imagens HD via /adimages endpoint
  // Isso retorna url_1024 que é a versão HD das imagens
  // ===========================================================================================
  if (!lightSync) {
    console.log(`[FULL-SYNC] Fetching HD images via /adimages endpoint...`);
    
    // Coletar todos os image_hash únicos dos ads
    const imageHashes = new Set<string>();
    for (const ad of ads) {
      const creative = ad.creative;
      if (creative?.image_hash) imageHashes.add(creative.image_hash);
      const oss = creative?.object_story_spec;
      if (oss?.link_data?.image_hash) imageHashes.add(oss.link_data.image_hash);
      if (oss?.photo_data?.image_hash) imageHashes.add(oss.photo_data.image_hash);
      if (oss?.video_data?.image_hash) imageHashes.add(oss.video_data.image_hash);
    }
    
    console.log(`[FULL-SYNC] Found ${imageHashes.size} unique image hashes`);
    
    // Buscar URLs HD via /adimages
    if (imageHashes.size > 0) {
      let adImagesUrl: string | null = `https://graph.facebook.com/v22.0/${adAccountId}/adimages?fields=hash,url,url_128,url_1024&limit=500&access_token=${token}`;
      
      while (adImagesUrl) {
        const data = await fetchWithRetry(adImagesUrl, 'ADIMAGES');
        if (data.data) {
          for (const img of data.data) {
            if (img.hash && imageHashes.has(img.hash)) {
              // Preferir url_1024 (HD), fallback para url
              const hdUrl = img.url_1024 || img.url;
              if (hdUrl) {
                adImageMap.set(img.hash, hdUrl);
              }
            }
          }
        }
        adImagesUrl = data.paging?.next || null;
      }
      
      console.log(`[FULL-SYNC] Mapped ${adImageMap.size} HD image URLs from /adimages`);
    }
    
    // Buscar video thumbnails HD
    const videoIds = new Set<string>();
    for (const ad of ads) {
      const videoId = ad.creative?.object_story_spec?.video_data?.video_id;
      if (videoId) videoIds.add(videoId);
    }
    
    if (videoIds.size > 0) {
      console.log(`[FULL-SYNC] Fetching thumbnails for ${videoIds.size} videos...`);
      
      // Buscar thumbnails em batches de 50
      const videoIdArray = Array.from(videoIds);
      for (let i = 0; i < videoIdArray.length; i += 50) {
        const batch = videoIdArray.slice(i, i + 50);
        const batchIds = batch.join(',');
        
        const videoUrl = `https://graph.facebook.com/v22.0/?ids=${batchIds}&fields=id,thumbnails{uri,width,height}&access_token=${token}`;
        const data = await simpleFetch(videoUrl, undefined, 15000);
        
        if (data && !data.error) {
          for (const videoId of batch) {
            const videoData = data[videoId];
            if (videoData?.thumbnails?.data?.length > 0) {
              // Pegar a maior thumbnail disponível
              const thumbnails = videoData.thumbnails.data.sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
              if (thumbnails[0]?.uri) {
                videoThumbnailMap.set(videoId, thumbnails[0].uri);
              }
            }
          }
        }
        
        if (i + 50 < videoIdArray.length) await delay(200);
      }
      
      console.log(`[FULL-SYNC] Mapped ${videoThumbnailMap.size} video thumbnails`);
    }
  }
  
  console.log(`[${lightSync ? 'LIGHT' : 'FULL'}-SYNC] Mapped ${creativeDataMap.size} creatives`);
  
  // DEBUG: Log do primeiro anúncio para verificar extração de texto
  if (ads.length > 0) {
    const firstAd = ads[0];
    const creative = firstAd.creative;
    
    let primaryText: string | null = null;
    let headline: string | null = null;
    let cta: string | null = null;
    
    // asset_feed_spec
    if (creative?.asset_feed_spec) {
      const afs = creative.asset_feed_spec;
      if (afs.bodies?.length > 0) primaryText = afs.bodies[0].text;
      if (afs.titles?.length > 0) headline = afs.titles[0].text;
      if (afs.call_to_action_types?.length > 0) cta = afs.call_to_action_types[0];
    }
    
    // object_story_spec (fallback)
    const oss = creative?.object_story_spec;
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
    
    console.log(`[LIGHT-DEBUG] First ad: ${firstAd.id}`);
    console.log(`[LIGHT-DEBUG] primary_text: ${primaryText?.substring(0, 60) || 'NULL'}`);
    console.log(`[LIGHT-DEBUG] headline: ${headline || 'NULL'}`);
    console.log(`[LIGHT-DEBUG] cta: ${cta || 'NULL'}`);
  }

  // ===========================================================================================
  // LOG OBRIGATÓRIO - DEBUG DO PRIMEIRO ANÚNCIO
  // ===========================================================================================
  if (ads.length > 0) {
    const firstAd = ads[0];
    const creative = firstAd.creative;
    const imageHash = creative?.image_hash;
    const hdUrl = imageHash ? adImageMap.get(imageHash) : null;
    
    // Extrair texto seguindo prioridade
    let primaryText: string | null = null;
    let headline: string | null = null;
    let description: string | null = null;
    
    // PRIORIDADE 1: asset_feed_spec
    if (creative?.asset_feed_spec) {
      const afs = creative.asset_feed_spec;
      if (afs.bodies?.length > 0) primaryText = afs.bodies[0].text;
      if (afs.titles?.length > 0) headline = afs.titles[0].text;
      if (afs.descriptions?.length > 0) description = afs.descriptions[0].text;
    }
    
    // FALLBACK: object_story_spec.link_data
    if (!primaryText || !headline) {
      const oss = creative?.object_story_spec;
      if (oss?.link_data) {
        if (!primaryText && oss.link_data.message) primaryText = oss.link_data.message;
        if (!headline && oss.link_data.name) headline = oss.link_data.name;
        if (!description && oss.link_data.description) description = oss.link_data.description;
      }
      if (oss?.video_data) {
        if (!primaryText && oss.video_data.message) primaryText = oss.video_data.message;
        if (!headline && oss.video_data.title) headline = oss.video_data.title;
      }
    }
    
    console.log(`[CREATIVE-DEBUG] ========== PRIMEIRO ANÚNCIO ==========`);
    console.log(`[CREATIVE-DEBUG] ad_id: ${firstAd.id}`);
    console.log(`[CREATIVE-DEBUG] image_hash: ${imageHash || 'NULL'}`);
    console.log(`[CREATIVE-DEBUG] url_1024: ${hdUrl?.substring(0, 80) || 'NULL'}`);
    console.log(`[CREATIVE-DEBUG] primary_text: ${primaryText?.substring(0, 80) || 'NULL'}`);
    console.log(`[CREATIVE-DEBUG] headline: ${headline || 'NULL'}`);
    console.log(`[CREATIVE-DEBUG] description: ${description || 'NULL'}`);
    console.log(`[CREATIVE-DEBUG] ===========================================`);
  }

  // ===========================================================================================
  // CACHE DE IMAGENS HD
  // Prioridade: 0) thumbnail HD via endpoint do criativo (1080x1080)
  //             1) image_hash via /adimages, 2) directImageUrls, 3) video thumbnail
  // ===========================================================================================
  if (!skipImageCache && supabase && projectId) {
    const adsNeedingCache: Array<{ adId: string; creativeId?: string; imageUrl?: string; source: string }> = [];
    
    // Primeiro, coletar todos os ads que precisam de cache e seus creative IDs
    for (const ad of ads) {
      const adId = String(ad.id);
      const cached = cachedCreativeMap.get(adId);
      
      if (cached?.cached_url) {
        immediateCache.set(adId, cached.cached_url);
        continue;
      }
      
      // Se tem creative ID, vamos tentar buscar thumbnail HD primeiro
      const creativeId = ad.creative?.id;
      if (creativeId) {
        adsNeedingCache.push({ adId, creativeId, source: 'creative_thumbnail_hd' });
      } else {
        // Fallback para métodos antigos
        let hdImageUrl: string | null = null;
        let source = '';
        
        const imageHash = ad.creative?.image_hash;
        if (imageHash && adImageMap.has(imageHash)) {
          hdImageUrl = adImageMap.get(imageHash)!;
          source = 'adimages_hash';
        }
        
        if (!hdImageUrl) {
          const oss = ad.creative?.object_story_spec;
          const ossHashes = [
            oss?.link_data?.image_hash,
            oss?.photo_data?.image_hash,
            oss?.video_data?.image_hash
          ].filter(Boolean);
          
          for (const h of ossHashes) {
            if (h && adImageMap.has(h)) {
              hdImageUrl = adImageMap.get(h)!;
              source = 'adimages_oss_hash';
              break;
            }
          }
        }
        
        if (!hdImageUrl && ad.creative?.object_story_spec) {
          const oss = ad.creative.object_story_spec;
          if (oss.photo_data?.url) {
            hdImageUrl = oss.photo_data.url;
            source = 'oss_photo_data';
          } else if (oss.link_data?.picture) {
            hdImageUrl = oss.link_data.picture;
            source = 'oss_link_data';
          }
        }
        
        if (!hdImageUrl) {
          const videoId = ad.creative?.object_story_spec?.video_data?.video_id;
          if (videoId && videoThumbnailMap.has(videoId)) {
            hdImageUrl = videoThumbnailMap.get(videoId)!;
            source = 'video_thumbnail';
          }
        }
        
        if (hdImageUrl) {
          adsNeedingCache.push({ adId, imageUrl: hdImageUrl, source });
        }
      }
    }
    
    // Log de fontes planejadas
    const sources = adsNeedingCache.reduce((acc, x) => {
      acc[x.source] = (acc[x.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[CACHE] Planned image sources: ${JSON.stringify(sources)}`);
    console.log(`[CACHE] Processing ${adsNeedingCache.length} ads for HD images...`);
    
    // Processar em batches de 5 para não sobrecarregar a API
    for (let i = 0; i < adsNeedingCache.length; i += 5) {
      const batch = adsNeedingCache.slice(i, i + 5);
      
      const results = await Promise.all(batch.map(async ({ adId, creativeId, imageUrl, source }) => {
        let finalImageUrl = imageUrl;
        let finalSource = source;
        
        // Se é creative_thumbnail_hd, buscar a URL primeiro
        if (source === 'creative_thumbnail_hd' && creativeId) {
          const hdUrl = await fetchCreativeThumbnailHD(creativeId, token);
          if (hdUrl) {
            finalImageUrl = hdUrl;
            creativeThumbnailHDMap.set(adId, hdUrl);
          } else {
            // Fallback: tentar outras fontes
            const ad = ads.find((a: any) => String(a.id) === adId);
            if (ad?.creative?.object_story_spec?.photo_data?.url) {
              finalImageUrl = ad.creative.object_story_spec.photo_data.url;
              finalSource = 'oss_photo_data_fallback';
            } else if (ad?.creative?.object_story_spec?.link_data?.picture) {
              finalImageUrl = ad.creative.object_story_spec.link_data.picture;
              finalSource = 'oss_link_data_fallback';
            }
          }
        }
        
        if (finalImageUrl) {
          const cachedUrl = await cacheCreativeImage(supabase, projectId, adId, finalImageUrl, false);
          return { adId, cachedUrl, source: finalSource };
        }
        return { adId, cachedUrl: null, source: finalSource };
      }));
      
      for (const { adId, cachedUrl } of results) {
        if (cachedUrl) immediateCache.set(adId, cachedUrl);
      }
      
      if (i + 5 < adsNeedingCache.length) await delay(100);
    }
    
    console.log(`[CACHE] Cached ${immediateCache.size} HD images total`);
  }

  return { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap, cachedCreativeMap, adPreviewMap, immediateCache, creativeThumbnailHDMap };
}

async function fetchDailyInsights(adAccountId: string, token: string, since: string, until: string): Promise<Map<string, Map<string, any>>> {
  const dailyInsights = new Map<string, Map<string, any>>();
  
  const fields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,results,cost_per_result,actions,action_values,conversions,cost_per_action_type,website_ctr,inline_link_clicks,outbound_clicks,instagram_profile_visits';
  
  const timeRange = JSON.stringify({ since, until });
  let url = `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=ad&limit=500&action_breakdowns=action_type&access_token=${token}`;
  
  let totalRows = 0;
  let firstRowLogged = false;
  
  while (url) {
    const data = await fetchWithRetry(url, 'INSIGHTS');
    if (data.data) {
      for (const row of data.data) {
        // Log ALL action_types from every row to find profile visits
        if (row.actions) {
          for (const a of row.actions) {
            // Log ALL action types to find the right one
            const lowerType = (a.action_type || '').toLowerCase();
            if (lowerType.includes('profile') || 
                lowerType.includes('visit') ||
                lowerType.includes('ig_') ||
                lowerType.includes('onsite_conversion.page') ||
                lowerType.includes('onsite_conversion.ig')) {
              console.log(`[INSIGHTS-PROFILE] campaign=${row.campaign_name?.substring(0,25)}, type=${a.action_type}, value=${a.value}`);
            }
          }
        }
        
        if (!firstRowLogged) {
          console.log(`[INSIGHTS] === SAMPLE ROW ===`);
          console.log(`[INSIGHTS] campaign: ${row.campaign_name}`);
          console.log(`[INSIGHTS] spend: ${row.spend}, impressions: ${row.impressions}`);
          if (row.actions) {
            // Log ALL actions from first row
            console.log(`[INSIGHTS] ALL action_types: ${row.actions.map((a: any) => a.action_type).join(', ')}`);
          }
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

// Tipos de conversão
const FORM_LEAD_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'fb_pixel_lead'];
const CONTACT_LEAD_ACTION_TYPES = ['contact_total', 'contact_website', 'contact', 'omni_complete_registration', 'complete_registration', 'submit_application', 'submit_application_total'];
const MESSAGE_LEAD_ACTION_TYPES = ['messaging_conversation_started_7d', 'onsite_conversion.messaging_conversation_started_7d'];
const PURCHASE_ACTION_TYPES = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase', 'onsite_web_app_purchase', 'web_in_store_purchase', 'web_app_in_store_purchase'];
const ALL_LEAD_ACTION_TYPES = [...FORM_LEAD_ACTION_TYPES, ...CONTACT_LEAD_ACTION_TYPES, ...MESSAGE_LEAD_ACTION_TYPES];
const CONVERSION_ACTION_TYPES = [...ALL_LEAD_ACTION_TYPES, ...PURCHASE_ACTION_TYPES];
const TRAFFIC_OBJECTIVES = ['OUTCOME_TRAFFIC', 'LINK_CLICKS', 'TRAFFIC', 'POST_ENGAGEMENT'];

const ENGAGEMENT_INDICATORS = ['post_engagement', 'page_engagement', 'post_reaction', 'post_interaction_gross', 'page_like', 'post_like', 'post_share', 'post_comment', 'link_click', 'video_view', 'landing_page_view'];

function extractConversions(row: any, campaignObjective?: string): { 
  conversions: number; 
  costPerResult: number; 
  conversionValue: number; 
  source: string;
  leadsCount: number;
  purchasesCount: number;
} {
  const isTrafficCampaign = campaignObjective && TRAFFIC_OBJECTIVES.includes(campaignObjective.toUpperCase());
  
  if (isTrafficCampaign) {
    return { conversions: 0, costPerResult: 0, conversionValue: 0, source: 'traffic_campaign', leadsCount: 0, purchasesCount: 0 };
  }
  
  let conversions = 0;
  let costPerResult = 0;
  let conversionValue = 0;
  let source = 'none';
  let leadsCount = 0;
  let purchasesCount = 0;

  // FONTE 1: Campo "results"
  if (Array.isArray(row.results) && row.results.length > 0) {
    let omniPurchaseCount = 0, purchaseCount = 0, pixelPurchaseCount = 0, otherPurchaseCount = 0;
    
    for (const result of row.results) {
      let actionType = result.action_type || result.indicator || '';
      if (actionType.startsWith('actions:')) actionType = actionType.replace('actions:', '');
      
      const val = parseInt(result.value || result.values?.[0]?.value) || 0;
      
      if (ENGAGEMENT_INDICATORS.includes(actionType)) continue;
      
      if (val > 0) {
        if (actionType === 'omni_purchase') omniPurchaseCount = val;
        else if (actionType === 'purchase') purchaseCount = val;
        else if (actionType === 'offsite_conversion.fb_pixel_purchase') pixelPurchaseCount = val;
        else if (PURCHASE_ACTION_TYPES.includes(actionType)) {
          if (val > otherPurchaseCount) otherPurchaseCount = val;
        } else if (ALL_LEAD_ACTION_TYPES.includes(actionType) || MESSAGE_LEAD_ACTION_TYPES.includes(actionType)) {
          leadsCount += val;
        }
      }
    }
    
    if (omniPurchaseCount > 0) purchasesCount = omniPurchaseCount;
    else if (purchaseCount > 0) purchasesCount = purchaseCount;
    else if (pixelPurchaseCount > 0) purchasesCount = pixelPurchaseCount;
    else if (otherPurchaseCount > 0) purchasesCount = otherPurchaseCount;
    
    if (leadsCount > 0 || purchasesCount > 0) {
      conversions = leadsCount + purchasesCount;
      source = 'results';
      
      if (Array.isArray(row.cost_per_result) && row.cost_per_result.length > 0) {
        const cpr = row.cost_per_result[0];
        if (cpr.value !== undefined) costPerResult = parseFloat(cpr.value) || 0;
        else if (Array.isArray(cpr.values) && cpr.values.length > 0) costPerResult = parseFloat(cpr.values[0]?.value) || 0;
      }
    }
  }
  
  // FONTE 2: Campo "actions" (fallback)
  if (conversions === 0 && Array.isArray(row.actions) && row.actions.length > 0) {
    let formLeadValue = 0, contactLeadValue = 0, messageLeadValue = 0, purchaseValue = 0, omniPurchaseValue = 0;
    
    for (const action of row.actions) {
      const actionType = action.action_type || '';
      const val = parseInt(action.value) || 0;
      if (val > 0) {
        if (actionType === 'lead' || actionType === 'onsite_conversion.lead_grouped') formLeadValue = val;
        else if (CONTACT_LEAD_ACTION_TYPES.includes(actionType) && val > contactLeadValue) contactLeadValue = val;
        else if (actionType === 'messaging_conversation_started_7d' || actionType === 'onsite_conversion.messaging_conversation_started_7d') messageLeadValue = val;
        else if (actionType === 'purchase') purchaseValue = val;
        else if (actionType === 'omni_purchase') omniPurchaseValue = val;
      }
    }
    
    purchasesCount = omniPurchaseValue > 0 ? omniPurchaseValue : purchaseValue;
    const maxLead = Math.max(formLeadValue, contactLeadValue, messageLeadValue);
    if (maxLead > 0) {
      leadsCount = maxLead;
      source = 'actions';
    }
    conversions = leadsCount + purchasesCount;
  }

  // FONTE 3: Campo "conversions" (fallback legado)
  if (conversions === 0 && Array.isArray(row.conversions) && row.conversions.length > 0) {
    let formLeadConv = 0, contactLeadConv = 0, messageLeadConv = 0, purchaseConv = 0, omniPurchaseConv = 0;
    
    for (const c of row.conversions) {
      const actionType = c.action_type || '';
      const val = parseInt(c.value) || 0;
      if (val > 0) {
        if (actionType === 'lead' || actionType === 'onsite_conversion.lead_grouped') formLeadConv = val;
        else if (CONTACT_LEAD_ACTION_TYPES.includes(actionType) && val > contactLeadConv) contactLeadConv = val;
        else if (actionType === 'messaging_conversation_started_7d' || actionType === 'onsite_conversion.messaging_conversation_started_7d') messageLeadConv = val;
        else if (actionType === 'purchase') purchaseConv = val;
        else if (actionType === 'omni_purchase') omniPurchaseConv = val;
      }
    }
    
    purchasesCount = omniPurchaseConv > 0 ? omniPurchaseConv : purchaseConv;
    const maxLeadConv = Math.max(formLeadConv, contactLeadConv, messageLeadConv);
    if (maxLeadConv > 0) {
      leadsCount = maxLeadConv;
      source = 'conversions_legacy';
    }
    conversions = leadsCount + purchasesCount;
  }

  // CPA
  if (conversions > 0 && Array.isArray(row.cost_per_action_type) && row.cost_per_action_type.length > 0) {
    for (const cpa of row.cost_per_action_type) {
      const actionType = cpa.action_type || '';
      if (CONVERSION_ACTION_TYPES.includes(actionType) && cpa.value) {
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
    let purchaseValue = 0, omniPurchaseValue = 0;
    for (const av of row.action_values) {
      const actionType = av.action_type || '';
      const val = parseFloat(av.value) || 0;
      if (actionType === 'omni_purchase' && val > 0) omniPurchaseValue = val;
      else if (actionType === 'purchase' && val > 0) purchaseValue = val;
    }
    conversionValue = omniPurchaseValue > 0 ? omniPurchaseValue : purchaseValue;
  }

  return { conversions, costPerResult, conversionValue, source, leadsCount, purchasesCount };
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
  // PRIORITY 1: Use the new instagram_profile_visits field (added Oct 2025)
  if (insights?.instagram_profile_visits) {
    return parseInt(insights.instagram_profile_visits) || 0;
  }
  
  // FALLBACK: Check actions for legacy action types
  if (!insights?.actions) return 0;
  let max = 0;
  for (const a of insights.actions) {
    const v = parseInt(a.value) || 0;
    if (PROFILE_VISIT_ACTION_TYPES.includes(a.action_type) && v > max) max = v;
  }
  return max;
}

// ===========================================================================================
// EXTRAÇÃO DE COPY - SEGUINDO PRIORIDADE CORRETA
// 
// PRIORIDADE 1: asset_feed_spec (anúncios dinâmicos)
//   - primary_text → asset_feed_spec.bodies[].text
//   - headline → asset_feed_spec.titles[].text
//   - description → asset_feed_spec.descriptions[].text
// 
// PRIORIDADE 2: object_story_spec.link_data (anúncios de imagem/link)
//   - primary_text → link_data.message
//   - headline → link_data.name
//   - description → link_data.description
// 
// PRIORIDADE 3: object_story_spec.video_data (anúncios de vídeo)
//   - primary_text → video_data.message
//   - headline → video_data.title
// ===========================================================================================
function extractAdCopy(ad: any, creativeData?: any): { primaryText: string | null; headline: string | null; description: string | null; cta: string | null } {
  let primaryText: string | null = null;
  let headline: string | null = null;
  let description: string | null = null;
  let cta: string | null = null;
  
  // Fonte de dados: preferir creative do ad diretamente, depois creativeData
  const creative = ad?.creative || creativeData;
  
  if (!creative) {
    return { primaryText, headline, description, cta };
  }
  
  // PRIORIDADE 0: Dados HD extraídos diretamente do /adcreatives endpoint
  // Esses dados são mais confiáveis porque vêm diretamente da query do creative
  if (creativeData?.hd_primary_text) primaryText = creativeData.hd_primary_text;
  if (creativeData?.hd_headline) headline = creativeData.hd_headline;
  if (creativeData?.hd_description) description = creativeData.hd_description;
  if (creativeData?.hd_cta) cta = creativeData.hd_cta;
  
  // Se já temos todos os dados do /adcreatives, retornar
  if (primaryText || headline || cta) {
    return { primaryText, headline, description, cta };
  }
  
  // PRIORIDADE 1: asset_feed_spec (anúncios dinâmicos)
  if (creative.asset_feed_spec) {
    const afs = creative.asset_feed_spec;
    if (afs.bodies?.length > 0) primaryText = afs.bodies[0].text;
    if (afs.titles?.length > 0) headline = afs.titles[0].text;
    if (afs.descriptions?.length > 0) description = afs.descriptions[0].text;
    if (afs.call_to_action_types?.length > 0) cta = afs.call_to_action_types[0];
  }
  
  // PRIORIDADE 2: object_story_spec.link_data
  const oss = creative.object_story_spec;
  if (oss?.link_data) {
    if (!primaryText && oss.link_data.message) primaryText = oss.link_data.message;
    if (!headline && oss.link_data.name) headline = oss.link_data.name;
    if (!description && oss.link_data.description) description = oss.link_data.description;
    if (!cta && oss.link_data.call_to_action?.type) cta = oss.link_data.call_to_action.type;
  }
  
  // PRIORIDADE 3: object_story_spec.video_data
  if (oss?.video_data) {
    if (!primaryText && oss.video_data.message) primaryText = oss.video_data.message;
    if (!headline && oss.video_data.title) headline = oss.video_data.title;
    if (!cta && oss.video_data.call_to_action?.type) cta = oss.video_data.call_to_action.type;
  }
  
  // PRIORIDADE 4: object_story_spec.photo_data
  if (oss?.photo_data) {
    if (!primaryText && oss.photo_data.message) primaryText = oss.photo_data.message;
    if (!primaryText && oss.photo_data.caption) primaryText = oss.photo_data.caption;
  }
  
  // Campos diretos do creative (fallback final)
  if (!primaryText && creative.body) primaryText = creative.body;
  if (!headline && creative.title) headline = creative.title;
  if (!cta && creative.call_to_action_type) cta = creative.call_to_action_type;
  
  return { primaryText, headline, description, cta };
}

// ===========================================================================================
// EXTRAÇÃO DE IMAGEM HD
// 
// PRIORIDADE:
// 1. image_hash via adImageMap (url_1024 do endpoint /adimages)
// 2. URLs diretas de object_story_spec (photo_data, link_data)
// 3. video thumbnail para anúncios de vídeo
// ===========================================================================================
function extractCreativeImage(ad: any, adImageMap?: Map<string, string>, videoThumbnailMap?: Map<string, string>): { imageUrl: string | null; videoUrl: string | null } {
  let imageUrl: string | null = null;
  let videoUrl: string | null = null;
  
  const creative = ad?.creative;
  const oss = creative?.object_story_spec;
  
  // PRIORIDADE 0: thumbnail_url e image_url direto do creative (mais confiável)
  if (creative?.thumbnail_url) {
    imageUrl = creative.thumbnail_url;
  }
  if (!imageUrl && creative?.image_url) {
    imageUrl = creative.image_url;
  }
  
  // PRIORIDADE 1: image_hash via adImageMap (url_1024 do endpoint /adimages)
  if (!imageUrl && creative?.image_hash && adImageMap?.has(creative.image_hash)) {
    imageUrl = adImageMap.get(creative.image_hash)!;
  }
  
  // image_hash de link_data, video_data ou photo_data
  if (!imageUrl && oss?.link_data?.image_hash && adImageMap?.has(oss.link_data.image_hash)) {
    imageUrl = adImageMap.get(oss.link_data.image_hash)!;
  }
  if (!imageUrl && oss?.video_data?.image_hash && adImageMap?.has(oss.video_data.image_hash)) {
    imageUrl = adImageMap.get(oss.video_data.image_hash)!;
  }
  if (!imageUrl && oss?.photo_data?.image_hash && adImageMap?.has(oss.photo_data.image_hash)) {
    imageUrl = adImageMap.get(oss.photo_data.image_hash)!;
  }
  
  // PRIORIDADE 2: URLs diretas de object_story_spec
  if (!imageUrl && oss?.photo_data?.url) {
    imageUrl = oss.photo_data.url;
  }
  if (!imageUrl && oss?.link_data?.picture) {
    imageUrl = oss.link_data.picture;
  }
  if (!imageUrl && oss?.link_data?.image_url) {
    imageUrl = oss.link_data.image_url;
  }
  
  // PRIORIDADE 3: Para vídeos, usar thumbnail HD ou image_url do video_data
  if (!imageUrl && oss?.video_data?.video_id) {
    if (videoThumbnailMap?.has(oss.video_data.video_id)) {
      imageUrl = videoThumbnailMap.get(oss.video_data.video_id)!;
    } else if (oss.video_data.image_url) {
      imageUrl = oss.video_data.image_url;
    }
    videoUrl = `https://www.facebook.com/${oss.video_data.video_id}`;
  }
  
  // PRIORIDADE 4: asset_feed_spec para anúncios dinâmicos
  if (!imageUrl && creative?.asset_feed_spec?.images?.length > 0) {
    const firstImage = creative.asset_feed_spec.images[0];
    if (firstImage.url) imageUrl = firstImage.url;
    else if (firstImage.url_tags) imageUrl = firstImage.url_tags;
  }
  
  return { imageUrl, videoUrl };
}

function validateSyncData(records: any[]): { isValid: boolean; totalSpend: number; totalImpressions: number; totalConversions: number } {
  const totalSpend = records.reduce((s, r) => s + (r.spend || 0), 0);
  const totalImpressions = records.reduce((s, r) => s + (r.impressions || 0), 0);
  const totalConversions = records.reduce((s, r) => s + (r.conversions || 0), 0);
  const allZero = records.length > 0 && records.every(r => (r.spend || 0) === 0 && (r.impressions || 0) === 0 && (r.clicks || 0) === 0);
  return { isValid: !allZero || records.length === 0, totalSpend, totalImpressions, totalConversions };
}

// Targeting comparison helper - extracts key targeting info for comparison
function summarizeTargeting(targeting: any): string | null {
  if (!targeting) return null;
  const parts: string[] = [];
  
  // Age and gender
  if (targeting.age_min || targeting.age_max) {
    parts.push(`idade:${targeting.age_min || 18}-${targeting.age_max || 65}`);
  }
  if (targeting.genders?.length) {
    parts.push(`genero:${targeting.genders.join(',')}`);
  }
  
  // Locations
  if (targeting.geo_locations) {
    const geo = targeting.geo_locations;
    const locs = [
      ...(geo.countries || []),
      ...(geo.cities?.map((c: any) => c.name || c.key) || []),
      ...(geo.regions?.map((r: any) => r.name || r.key) || [])
    ];
    if (locs.length) parts.push(`local:${locs.slice(0, 3).join(',')}`);
  }
  
  // Custom audiences
  if (targeting.custom_audiences?.length) {
    parts.push(`publicos:${targeting.custom_audiences.length}`);
  }
  if (targeting.excluded_custom_audiences?.length) {
    parts.push(`excluidos:${targeting.excluded_custom_audiences.length}`);
  }
  
  // Interests (flexible_spec)
  if (targeting.flexible_spec?.length) {
    let interestCount = 0;
    for (const spec of targeting.flexible_spec) {
      interestCount += (spec.interests?.length || 0) + (spec.behaviors?.length || 0);
    }
    if (interestCount > 0) parts.push(`interesses:${interestCount}`);
  }
  
  // Placements
  if (targeting.publisher_platforms?.length) {
    parts.push(`plataformas:${targeting.publisher_platforms.join(',')}`);
  }
  
  return parts.length > 0 ? parts.join('|') : null;
}

// Fetch activities from Meta API to get actor names (who made the change)
async function fetchActivities(adAccountId: string, token: string): Promise<Map<string, { actorName: string; eventTime: string }>> {
  const activityMap = new Map<string, { actorName: string; eventTime: string }>();
  
  try {
    // Fetch activities from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sinceTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);
    
    const url = `https://graph.facebook.com/v22.0/${adAccountId}/activities?fields=actor_id,actor_name,object_id,object_type,event_type,event_time&limit=500&since=${sinceTimestamp}&access_token=${token}`;
    
    const data = await fetchWithRetry(url, 'ACTIVITIES');
    
    if (data.data && Array.isArray(data.data)) {
      for (const activity of data.data) {
        if (activity.object_id && activity.actor_name) {
          // Use most recent activity for each object
          const existing = activityMap.get(String(activity.object_id));
          if (!existing || new Date(activity.event_time) > new Date(existing.eventTime)) {
            activityMap.set(String(activity.object_id), {
              actorName: activity.actor_name,
              eventTime: activity.event_time
            });
          }
        }
      }
      console.log(`[ACTIVITIES] Fetched ${data.data.length} activities, mapped ${activityMap.size} unique objects`);
    }
  } catch (error) {
    console.log(`[ACTIVITIES] Error fetching activities: ${error}`);
  }
  
  return activityMap;
}

async function detectAndRecordChanges(
  supabase: any, 
  projectId: string, 
  entityType: 'campaign' | 'adset' | 'ad', 
  tableName: string, 
  newRecords: any[], 
  trackedFields: string[],
  activityMap?: Map<string, { actorName: string; eventTime: string }>
): Promise<any[]> {
  const changes: any[] = [];
  if (newRecords.length === 0) return changes;
  
  const ids = newRecords.map(r => r.id);
  
  // Fetch existing records from the entity table
  const { data: existingRecords } = await supabase.from(tableName).select('*').in('id', ids).eq('project_id', projectId);
  const existingMap = new Map((existingRecords || []).map((r: any) => [r.id, r]));
  
  // Fetch recent changes (last 24h) to avoid duplicates
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  
  const { data: recentChanges } = await supabase
    .from('optimization_history')
    .select('entity_id, field_changed, new_value')
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .in('entity_id', ids)
    .gte('detected_at', oneDayAgo.toISOString());
  
  // Create a set of recent change keys to check for duplicates
  const recentChangeKeys = new Set(
    (recentChanges || []).map((c: any) => `${c.entity_id}:${c.field_changed}:${c.new_value}`)
  );
  
  for (const newRecord of newRecords) {
    const existing = existingMap.get(newRecord.id) as Record<string, any> | undefined;
    
    // Get actor name from activities
    const actorInfo = activityMap?.get(String(newRecord.id));
    const changedBy = actorInfo?.actorName || null;
    
    // New entity detection
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
          change_percentage: null,
          changed_by: changedBy
        }); 
      }
      continue; 
    }
    
    for (const field of trackedFields) {
      let oldVal = existing[field];
      let newVal = newRecord[field];
      
      // Special handling for targeting - compare summarized version
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
            change_percentage: null,
            changed_by: changedBy
          });
        }
        continue;
      }
      
      if (oldVal === newVal || (oldVal == null && newVal == null)) continue;
      
      // Check for duplicate
      const newValStr = newVal != null ? String(newVal) : null;
      const changeKey = `${newRecord.id}:${field}:${newValStr}`;
      if (recentChangeKeys.has(changeKey)) continue;
      
      let changeType = 'modified', changePct: number | null = null;
      
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
        change_percentage: changePct,
        changed_by: changedBy
      });
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
    let { project_id, ad_account_id, access_token, date_preset, time_range, retry_count = 0, light_sync = false, skip_image_cache = false, syncOnly } = body;
    
    // If ad_account_id not provided, fetch from project
    if (!ad_account_id && project_id) {
      const { data: project } = await supabase.from('projects').select('ad_account_id').eq('id', project_id).single();
      if (project?.ad_account_id) {
        ad_account_id = project.ad_account_id;
        console.log(`[SYNC] Retrieved ad_account_id from project: ${ad_account_id}`);
      }
    }
    
    if (!ad_account_id) {
      throw new Error('No ad_account_id provided and could not retrieve from project');
    }
    
    let since: string, until: string;
    if (time_range) { since = time_range.since; until = time_range.until; }
    else { const today = new Date(); until = today.toISOString().split('T')[0]; const daysMap: Record<string, number> = { yesterday: 1, today: 0, last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90 }; const days = daysMap[date_preset || 'last_90d'] || 90; const sinceDate = new Date(today); sinceDate.setDate(sinceDate.getDate() - days); since = sinceDate.toISOString().split('T')[0]; }
    
    console.log(`[SYNC] Project: ${project_id}, Range: ${since} to ${until}, light_sync: ${light_sync}, skip_cache: ${skip_image_cache}`);
    const token = access_token || metaAccessToken;
    if (!token) throw new Error('No Meta access token available');
    
    const { campaigns, adsets, ads, adImageMap, videoThumbnailMap, creativeDataMap, cachedCreativeMap, immediateCache, creativeThumbnailHDMap, tokenExpired } = await fetchEntities(ad_account_id, token, supabase, project_id, light_sync, skip_image_cache);
    if (tokenExpired) return new Response(JSON.stringify({ success: false, error: 'Token do Meta expirou.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
    console.log(`[DEBUG] Entities fetched - campaigns: ${campaigns.length}, adsets: ${adsets.length}, ads: ${ads.length}`);
    
    const campaignMap = new Map(campaigns.map(c => [extractId(c.id), c]));
    const adsetMap = new Map(adsets.map(a => [extractId(a.id), a]));
    const adMap = new Map(ads.map(a => [extractId(a.id), a]));
    
    console.log(`[DEBUG] Maps - campaignMap: ${campaignMap.size}, adsetMap: ${adsetMap.size}, adMap: ${adMap.size}`);
    
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);
    
    const dailyRecords: any[] = [];
    
    for (const [adId, dateMap] of dailyInsights) {
      for (const [date, insights] of dateMap) {
        const ad = adMap.get(adId);
        const adsetId = extractId(insights.adset_id), campaignId = extractId(insights.campaign_id);
        const adset = adsetId ? adsetMap.get(adsetId) : null;
        const campaign = campaignId ? campaignMap.get(campaignId) : null;
        
        const campaignObjective = campaign?.objective || null;
        const { conversions, costPerResult, conversionValue, source, leadsCount, purchasesCount } = extractConversions(insights, campaignObjective);
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
        const cpa = costPerResult > 0 ? costPerResult : (conversions > 0 ? spend / conversions : 0);
        const roas = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0;
        
        const { imageUrl } = extractCreativeImage(ad, adImageMap, videoThumbnailMap);
        const cachedData = cachedCreativeMap.get(adId);
        const cachedUrl = immediateCache.get(adId) || cachedData?.cached_url || null;
        
        // PRIORIDADE: 1) thumbnail HD via endpoint, 2) imageUrl do extractCreativeImage, 3) cached
        const hdThumbnail = creativeThumbnailHDMap.get(adId);
        
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
          creative_thumbnail: hdThumbnail || imageUrl || cachedData?.thumbnail_url || null,
          cached_creative_thumbnail: cachedUrl,
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
    
    // Update cached_creative_thumbnail
    if (immediateCache.size > 0) {
      console.log(`[CACHE] Updating ${immediateCache.size} cached thumbnails`);
      for (const [adId, cachedUrl] of immediateCache) {
        await supabase.from('ads_daily_metrics')
          .update({ cached_creative_thumbnail: cachedUrl })
          .eq('project_id', project_id)
          .eq('ad_id', adId)
          .is('cached_creative_thumbnail', null);
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
        adsetMetrics.set(r.adset_id, { 
          ...initMetric(r.adset_id, r.adset_name, { status: adset?.status }), 
          campaign_id: r.campaign_id, 
          daily_budget: adset?.daily_budget, 
          lifetime_budget: adset?.lifetime_budget,
          targeting: adset?.targeting || null,
        });
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
        const cachedData = cachedCreativeMap.get(r.ad_id);
        
        // Extração de copy e imagem usando as funções corretas
        const { primaryText, headline, description, cta } = extractAdCopy(ad);
        const { imageUrl, videoUrl } = extractCreativeImage(ad, adImageMap, videoThumbnailMap);
        const cachedUrl = immediateCache.get(r.ad_id) || cachedData?.cached_url || null;
        
        // PRIORIDADE: 1) thumbnail HD via endpoint, 2) imageUrl do extractCreativeImage, 3) cached
        const hdThumbnail = creativeThumbnailHDMap.get(r.ad_id);
        
        adMetrics.set(r.ad_id, { 
          ...initMetric(r.ad_id, r.ad_name, { status: ad?.status }), 
          campaign_id: r.campaign_id, 
          ad_set_id: r.adset_id,
          creative_id: ad?.creative?.id || null,
          creative_thumbnail: hdThumbnail || imageUrl || cachedData?.thumbnail_url || null,
          creative_image_url: hdThumbnail || imageUrl || cachedData?.image_url || null,
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

    console.log(`[AGGREGATE] Building records - campaigns: ${campaignMetrics.size}, adsets: ${adsetMetrics.size}, ads: ${adMetrics.size}`);
    
    // ===========================================================================================
    // IMPORTANTE: Incluir TODAS as entidades da API, mesmo sem métricas no período
    // Isso garante que status, nomes e outros campos sejam sempre atualizados
    // ===========================================================================================
    
    // Adicionar campanhas que não têm métricas mas foram retornadas pela API
    for (const [campaignId, campaign] of campaignMap) {
      if (campaignId && !campaignMetrics.has(campaignId)) {
        campaignMetrics.set(campaignId, {
          id: campaignId,
          name: campaign.name || 'Unknown',
          project_id,
          status: campaign.status,
          objective: campaign.objective,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
          conversion_value: 0,
          messaging_replies: 0,
          profile_visits: 0,
          daily_budget: campaign.daily_budget,
          lifetime_budget: campaign.lifetime_budget,
        });
      }
    }
    
    // Adicionar adsets que não têm métricas mas foram retornados pela API
    for (const [adsetId, adset] of adsetMap) {
      if (adsetId && !adsetMetrics.has(adsetId)) {
        adsetMetrics.set(adsetId, {
          id: adsetId,
          name: adset.name || 'Unknown',
          project_id,
          status: adset.status,
          campaign_id: extractId(adset.campaign_id),
          daily_budget: adset.daily_budget,
          lifetime_budget: adset.lifetime_budget,
          targeting: adset.targeting || null,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
          conversion_value: 0,
          messaging_replies: 0,
          profile_visits: 0,
        });
      }
    }
    
    // Adicionar ads que não têm métricas mas foram retornados pela API
    for (const [adId, ad] of adMap) {
      if (adId && !adMetrics.has(adId)) {
        const cachedData = cachedCreativeMap.get(adId);
        const { primaryText, headline, description, cta } = extractAdCopy(ad);
        const { imageUrl, videoUrl } = extractCreativeImage(ad, adImageMap, videoThumbnailMap);
        const cachedUrl = immediateCache.get(adId) || cachedData?.cached_url || null;
        const hdThumbnail = creativeThumbnailHDMap.get(adId);
        
        adMetrics.set(adId, {
          id: adId,
          name: ad.name || 'Unknown',
          project_id,
          status: ad.status,
          campaign_id: extractId(ad.campaign_id),
          ad_set_id: extractId(ad.adset_id),
          creative_id: ad.creative?.id || null,
          creative_thumbnail: hdThumbnail || imageUrl || cachedData?.thumbnail_url || null,
          creative_image_url: hdThumbnail || imageUrl || cachedData?.image_url || null,
          creative_video_url: videoUrl || cachedData?.video_url || null,
          cached_image_url: cachedUrl,
          headline: headline || cachedData?.headline || null,
          primary_text: primaryText || cachedData?.primary_text || null,
          cta: cta || cachedData?.cta || null,
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
          conversion_value: 0,
          messaging_replies: 0,
          profile_visits: 0,
        });
      }
    }
    
    console.log(`[AGGREGATE] After including all entities - campaigns: ${campaignMetrics.size}, adsets: ${adsetMetrics.size}, ads: ${adMetrics.size}`);
    
    const campaignRecords = Array.from(campaignMetrics.values()).map(m => {
      const campaign = campaignMap.get(m.id);
      return calculateDerived({
        ...m,
        status: campaign?.status || m.status,
        daily_budget: campaign?.daily_budget || m.daily_budget,
        lifetime_budget: campaign?.lifetime_budget || m.lifetime_budget,
      });
    });

    const adsetRecords = Array.from(adsetMetrics.values()).map(m => {
      const adset = adsetMap.get(m.id);
      const record = calculateDerived({
        ...m,
        status: adset?.status || m.status,
      });
      delete record.objective;
      return record;
    });
    
    const adRecords = Array.from(adMetrics.values()).map(m => {
      const ad = adMap.get(m.id);
      const record = calculateDerived({
        ...m,
        status: ad?.status || m.status,
      });
      delete record.objective;
      return record;
    });
    
    // Log sample ad with creative data
    if (adRecords.length > 0) {
      const sample = adRecords[0];
      console.log(`[CREATIVE-RESULT] Sample ad: headline="${sample.headline || 'NULL'}", primary_text="${sample.primary_text?.substring(0, 50) || 'NULL'}", cta="${sample.cta || 'NULL'}", has_image=${!!sample.creative_image_url}`);
    }

    // Fetch activities to get actor names (who made the change)
    const activityMap = await fetchActivities(ad_account_id, token);

    // Detect changes
    const { data: existingCampaigns } = await supabase.from('campaigns').select('*').eq('project_id', project_id);
    const allChanges: any[] = [];
    
    if (campaignRecords.length > 0) {
      const campaignChanges = await detectAndRecordChanges(supabase, project_id, 'campaign', 'campaigns', campaignRecords, TRACKED_FIELDS_CAMPAIGN, activityMap);
      allChanges.push(...campaignChanges);
    }
    if (adsetRecords.length > 0) {
      const adsetChanges = await detectAndRecordChanges(supabase, project_id, 'adset', 'ad_sets', adsetRecords, TRACKED_FIELDS_ADSET, activityMap);
      allChanges.push(...adsetChanges);
    }
    if (adRecords.length > 0) {
      const adChanges = await detectAndRecordChanges(supabase, project_id, 'ad', 'ads', adRecords, TRACKED_FIELDS_AD, activityMap);
      allChanges.push(...adChanges);
    }

    // Save changes to optimization_history
    if (allChanges.length > 0) {
      await supabase.from('optimization_history').insert(allChanges);
      console.log(`[CHANGES] Recorded ${allChanges.length} changes with actor info`);
    }

    // Detect anomalies
    await detectAndSendAnomalyAlerts(supabase, project_id, allChanges, campaignMetrics, existingCampaigns || []);

    // Upsert entities
    console.log(`[UPSERT] Starting entity upserts - campaigns: ${campaignRecords.length}, adsets: ${adsetRecords.length}, ads: ${adRecords.length}`);
    
    if (campaignRecords.length > 0) {
      const { error: campError } = await supabase.from('campaigns').upsert(campaignRecords, { onConflict: 'id' });
      if (campError) console.error(`[UPSERT] Campaign error:`, campError);
    }
    if (adsetRecords.length > 0) {
      const { error: adsetError } = await supabase.from('ad_sets').upsert(adsetRecords, { onConflict: 'id' });
      if (adsetError) console.error(`[UPSERT] Adset error:`, adsetError);
    }
    if (adRecords.length > 0) {
      console.log(`[UPSERT] Sample ad record:`, JSON.stringify(adRecords[0]));
      const { error: adsError } = await supabase.from('ads').upsert(adRecords, { onConflict: 'id' });
      if (adsError) console.error(`[UPSERT] Ads error:`, adsError);
      else console.log(`[UPSERT] Ads upserted successfully: ${adRecords.length}`);
    }

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
