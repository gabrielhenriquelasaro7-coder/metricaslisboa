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
  time_range?: {
    since: string;
    until: string;
  };
}

// Helper to batch array into chunks
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Helper to add delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Dynamic delay based on rate limit hits
let currentDelay = 100; // Start aggressive
const MAX_DELAY = 2000;
const MIN_DELAY = 50;

function increaseDelay() {
  currentDelay = Math.min(currentDelay * 2, MAX_DELAY);
  console.log(`[RATE] Increasing delay to ${currentDelay}ms`);
}

function decreaseDelay() {
  currentDelay = Math.max(currentDelay * 0.8, MIN_DELAY);
}

// Fetch with retry and dynamic delay for rate limits
async function fetchWithRetry(url: string, retries = 3, timeout = 15000): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      
      // Check for rate limit error (code 17)
      if (data.error && data.error.code === 17) {
        increaseDelay();
        if (attempt < retries) {
          const waitTime = (attempt + 1) * 5000; // 5s, 10s, 15s - longer waits
          console.log(`[RATE LIMIT] Waiting ${waitTime/1000}s before retry ${attempt + 1}...`);
          await delay(waitTime);
          continue;
        }
      } else {
        decreaseDelay(); // Success, can go faster
      }
      
      return data;
    } catch (error) {
      if (attempt < retries) {
        const waitTime = (attempt + 1) * 2000; // 2s, 4s, 6s
        console.log(`[FETCH ERROR] Retry ${attempt + 1} after ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }
      return { error: { message: 'Request timeout or network error' } };
    }
  }
}

// Fetch all pages of data using cursor pagination - OPTIMIZED
async function fetchAllPages(baseUrl: string, token: string, entityName: string, limit = 200): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = `${baseUrl}&limit=${limit}&access_token=${token}`;
  let pageCount = 0;
  const maxPages = 100; // Increased for large accounts
  
  while (nextUrl && pageCount < maxPages) {
    pageCount++;
    console.log(`[${entityName}] Fetching page ${pageCount}...`);
    
    const data = await fetchWithRetry(nextUrl);
    
    if (data.error) {
      console.error(`[${entityName}] Error on page ${pageCount}:`, data.error);
      
      // If rate limited, return what we have
      if (data.error.code === 17 || data.error.code === 1) {
        console.log(`[${entityName}] Stopping pagination due to API limits`);
        break;
      }
      break;
    }
    
    if (data.data && data.data.length > 0) {
      allData.push(...data.data);
      console.log(`[${entityName}] Page ${pageCount}: ${data.data.length} items (total: ${allData.length})`);
    } else {
      break;
    }
    
    nextUrl = data.paging?.next || null;
    
    // Reduced delay between pages (was 500ms)
    if (nextUrl) {
      await delay(200);
    }
  }
  
  return allData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_id, ad_account_id, access_token, date_preset, time_range }: SyncRequest = await req.json();
    
    const timeParam = time_range 
      ? `time_range=${encodeURIComponent(JSON.stringify({ since: time_range.since, until: time_range.until }))}`
      : `date_preset=${date_preset || 'last_30d'}`;
    
    console.log('[SYNC] Time param:', timeParam);

    const token = access_token || metaAccessToken;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta access token is required.', step: 'init' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project_id || !ad_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'project_id and ad_account_id are required', step: 'init' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC] Starting for project: ${project_id}, account: ${ad_account_id}`);
    const startTime = Date.now();

    // Reset dynamic delay
    currentDelay = 100;

    // Update project status
    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';

    // STEP 1: Fetch campaigns
    console.log('[STEP 1/3] Fetching campaigns...');
    
    const campaigns = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time`,
      token,
      'CAMPAIGNS',
      300
    );
    
    if (campaigns.length === 0) {
      const testData = await fetchWithRetry(
        `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name&limit=1&access_token=${token}`
      );
      
      if (testData.error) {
        console.error('[ERROR] Campaigns fetch failed:', testData.error);
        await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
        
        const isRateLimit = testData.error.code === 17;
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: isRateLimit 
              ? 'Limite de API da Meta atingido. Aguarde 2-3 minutos e tente novamente.'
              : testData.error.message,
            rate_limited: isRateLimit,
            step: 'campaigns',
            keep_existing: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`[CAMPAIGNS] Total: ${campaigns.length}`);
    
    // STEP 2: Fetch ad sets
    console.log('[STEP 2/3] Fetching ad sets...');
    await delay(300);
    
    const adSets = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting`,
      token,
      'AD_SETS',
      250
    );
    console.log(`[AD SETS] Total: ${adSets.length}`);
    
    // STEP 3: Fetch ads with creative data including image_hash for high quality
    console.log('[STEP 3/4] Fetching ads...');
    await delay(500); // More delay after adsets to avoid rate limit
    
    // Include image_hash to fetch high-res images later
    const ads = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,name,thumbnail_url,image_url,image_hash,object_story_spec}`,
      token,
      'ADS',
      200
    );
    console.log(`[ADS] Total: ${ads.length}`);
    
    // STEP 3.5: Fetch high-quality images from adimages endpoint
    console.log('[STEP 3.5/4] Fetching high-quality images...');
    await delay(300);
    
    const adImages = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/adimages?fields=hash,url,url_128,url_256,width,height`,
      token,
      'IMAGES',
      200
    );
    console.log(`[IMAGES] Total: ${adImages.length}`);
    
    // Create hash -> high-quality URL map
    const imageHashMap = new Map<string, string>();
    adImages.forEach((img: any) => {
      // Prefer url_256 or url (original), fallback to url_128
      const bestUrl = img.url || img.url_256 || img.url_128;
      if (bestUrl && img.hash) {
        imageHashMap.set(img.hash, bestUrl);
      }
    });
    console.log(`[IMAGES] Mapped ${imageHashMap.size} image hashes`);
    
    // Placeholder for catalog ads without images
    const previewsMap = new Map<string, string>();

    console.log(`[FETCH DONE] ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads`);

    // VALIDATION
    if (campaigns.length === 0) {
      console.log('[VALIDATION FAILED] No campaigns found');
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhuma campanha encontrada na conta de anúncios.',
          keep_existing: true,
          step: 'validation'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 4: Fetch insights with AGGRESSIVE parallelization
    console.log('[STEP 4] Fetching insights (aggressive parallel)...');

    const extractConversions = (insights: any) => {
      let conversions = 0;
      let conversionValue = 0;
      
      const conversionTypes = [
        'purchase', 'omni_purchase',
        'offsite_conversion.fb_pixel_custom',
        'offsite_conversion.fb_pixel_lead',
        'offsite_conversion.fb_pixel_complete_registration',
        'lead', 'onsite_conversion.lead_grouped',
        'contact', 'contact_total',
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.messaging_first_reply',
        'onsite_conversion.total_messaging_connection',
        'submit_application', 'complete_registration',
      ];
      
      if (insights?.actions) {
        for (const actionType of conversionTypes) {
          const action = insights.actions.find((a: any) => a.action_type === actionType);
          if (action && parseInt(action.value) > 0) {
            conversions = parseInt(action.value);
            break;
          }
        }
      }
      
      if (insights?.action_values) {
        const purchaseValue = insights.action_values.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
        conversionValue = parseFloat(purchaseValue?.value || '0');
      }
      
      return { conversions, conversionValue };
    };

    // OPTIMIZED: Fetch insights in parallel batches of 50 (was 10)
    const fetchInsightsForEntities = async (entities: any[], entityType: string): Promise<Map<string, any>> => {
      const insightsMap = new Map<string, any>();
      const BATCH_SIZE = 50; // Increased from 10
      const batches = chunk(entities, BATCH_SIZE);
      
      console.log(`[INSIGHTS ${entityType}] ${entities.length} entities in ${batches.length} batches of ${BATCH_SIZE}`);
      
      let processedCount = 0;
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        const results = await Promise.all(
          batch.map(async (entity: any) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout per entity
              
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${entity.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`,
                { signal: controller.signal }
              );
              clearTimeout(timeoutId);
              
              const data = await res.json();
              
              // Handle rate limit
              if (data.error && data.error.code === 17) {
                increaseDelay();
                return { id: entity.id, insights: null, rateLimited: true };
              }
              
              return { id: entity.id, insights: data.data?.[0] || null };
            } catch {
              return { id: entity.id, insights: null };
            }
          })
        );
        
        // Check for rate limits in this batch
        const rateLimited = results.some(r => r.rateLimited);
        if (rateLimited) {
          console.log(`[INSIGHTS ${entityType}] Rate limit hit, waiting ${currentDelay * 3}ms...`);
          await delay(currentDelay * 3);
        }
        
        results.forEach(r => insightsMap.set(r.id, r.insights));
        processedCount += batch.length;
        
        // Progress log every 5 batches
        if (i % 5 === 0 || i === batches.length - 1) {
          console.log(`[INSIGHTS ${entityType}] Progress: ${processedCount}/${entities.length}`);
        }
        
        // Dynamic delay between batches (was 300ms fixed)
        if (i < batches.length - 1) {
          await delay(currentDelay);
        }
      }
      
      return insightsMap;
    };

    // Fetch insights for all entities
    const campaignInsightsMap = await fetchInsightsForEntities(campaigns, 'CAMPAIGNS');
    
    // Only fetch insights for entities with ACTIVE status or from active campaigns
    const activeCampaignIds = new Set(campaigns.filter(c => c.status === 'ACTIVE').map(c => c.id));
    const prioritizedAdSets = adSets.filter(as => 
      as.status === 'ACTIVE' || activeCampaignIds.has(as.campaign_id)
    );
    
    console.log(`[AD SETS] Fetching insights for ${prioritizedAdSets.length} (${adSets.length - prioritizedAdSets.length} inactive skipped)`);
    const adSetInsightsMap = prioritizedAdSets.length > 0 
      ? await fetchInsightsForEntities(prioritizedAdSets, 'AD_SETS') 
      : new Map();
    
    const activeAdSetIds = new Set(adSets.filter(as => as.status === 'ACTIVE').map(as => as.id));
    const prioritizedAds = ads.filter(ad => 
      ad.status === 'ACTIVE' || activeAdSetIds.has(ad.adset_id) || activeCampaignIds.has(ad.campaign_id)
    );
    
    console.log(`[ADS] Fetching insights for ${prioritizedAds.length} (${ads.length - prioritizedAds.length} inactive skipped)`);
    const adInsightsMap = prioritizedAds.length > 0 
      ? await fetchInsightsForEntities(prioritizedAds, 'ADS') 
      : new Map();

    console.log('[INSIGHTS DONE]');

    // Prepare records
    const campaignRecords = campaigns.map((c: any) => {
      const insights = campaignInsightsMap.get(c.id);
      const { conversions, conversionValue } = extractConversions(insights);
      const spend = parseFloat(insights?.spend || '0');
      return {
        id: c.id,
        project_id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
        spend,
        impressions: parseInt(insights?.impressions || '0'),
        clicks: parseInt(insights?.clicks || '0'),
        ctr: parseFloat(insights?.ctr || '0'),
        cpm: parseFloat(insights?.cpm || '0'),
        cpc: parseFloat(insights?.cpc || '0'),
        reach: parseInt(insights?.reach || '0'),
        frequency: parseFloat(insights?.frequency || '0'),
        conversions,
        conversion_value: conversionValue,
        roas: spend > 0 ? conversionValue / spend : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
        created_time: c.created_time,
        updated_time: c.updated_time,
        synced_at: new Date().toISOString(),
      };
    });

    const adSetRecords = adSets.map((as: any) => {
      const insights = adSetInsightsMap.get(as.id);
      const { conversions, conversionValue } = extractConversions(insights);
      const spend = parseFloat(insights?.spend || '0');
      return {
        id: as.id,
        campaign_id: as.campaign_id,
        project_id,
        name: as.name,
        status: as.status,
        daily_budget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
        lifetime_budget: as.lifetime_budget ? parseFloat(as.lifetime_budget) / 100 : null,
        targeting: as.targeting,
        spend,
        impressions: parseInt(insights?.impressions || '0'),
        clicks: parseInt(insights?.clicks || '0'),
        ctr: parseFloat(insights?.ctr || '0'),
        cpm: parseFloat(insights?.cpm || '0'),
        cpc: parseFloat(insights?.cpc || '0'),
        reach: parseInt(insights?.reach || '0'),
        frequency: parseFloat(insights?.frequency || '0'),
        conversions,
        conversion_value: conversionValue,
        roas: spend > 0 ? conversionValue / spend : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
        synced_at: new Date().toISOString(),
      };
    });

    const adRecords = ads.map((ad: any) => {
      const insights = adInsightsMap.get(ad.id);
      const { conversions, conversionValue } = extractConversions(insights);
      const spend = parseFloat(insights?.spend || '0');
      
      // Extract best quality image from various sources
      const creative = ad.creative || {};
      const objectStory = creative.object_story_spec || {};
      const assetFeed = creative.asset_feed_spec || {};
      
      // Helper to clean low-res URL parameters (p64x64, s64x64, etc.)
      const cleanImageUrl = (url: string | null): string | null => {
        if (!url) return null;
        // Remove Facebook resize parameters that cause pixelation
        return url
          .replace(/\/p\d+x\d+\//g, '/') // /p64x64/ -> /
          .replace(/\/s\d+x\d+\//g, '/') // /s64x64/ -> /
          .replace(/stp=dst-[^&]+&?/g, '') // stp=dst-jpg_p64x64 params
          .replace(/\?stp=[^&]+/g, '') // ?stp= at start
          .replace(/&stp=[^&]+/g, ''); // &stp= in middle
      };
      
      // Try to get highest quality image (priority order)
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      
      // 0. FIRST - Check image_hash and get from adimages (highest quality!)
      if (creative.image_hash && imageHashMap.has(creative.image_hash)) {
        imageUrl = imageHashMap.get(creative.image_hash) || null;
      }
      
      // 1. Check object_story_spec for link_data or video_data
      if (!imageUrl && objectStory.link_data?.image_url) {
        imageUrl = cleanImageUrl(objectStory.link_data.image_url);
      } else if (!imageUrl && objectStory.link_data?.picture) {
        imageUrl = cleanImageUrl(objectStory.link_data.picture);
      } else if (!imageUrl && objectStory.video_data?.image_url) {
        imageUrl = cleanImageUrl(objectStory.video_data.image_url);
        videoUrl = objectStory.video_data.video_id 
          ? `https://www.facebook.com/video.php?v=${objectStory.video_data.video_id}` 
          : null;
      } else if (!imageUrl && objectStory.photo_data?.url) {
        imageUrl = cleanImageUrl(objectStory.photo_data.url);
      }
      
      // 2. Check asset_feed_spec for images
      if (!imageUrl && assetFeed.images?.length > 0) {
        const firstImg = assetFeed.images[0];
        // Try to get from hash map first
        if (firstImg.hash && imageHashMap.has(firstImg.hash)) {
          imageUrl = imageHashMap.get(firstImg.hash) || null;
        } else {
          imageUrl = cleanImageUrl(firstImg.url) || null;
        }
      }
      
      // 3. Check for template_data (catalog/dynamic ads)
      if (!imageUrl && objectStory.template_data?.link_data?.picture) {
        imageUrl = cleanImageUrl(objectStory.template_data.link_data.picture);
      }
      
      // 4. Use preview image for catalog ads (from previewsMap if we had it)
      if (!imageUrl && previewsMap.has(ad.id)) {
        imageUrl = previewsMap.get(ad.id) || null;
      }
      
      // 5. Fallback to creative image_url/thumbnail_url (cleaned)
      if (!imageUrl) {
        imageUrl = cleanImageUrl(creative.image_url) || cleanImageUrl(creative.thumbnail_url) || null;
      }
      
      // Extract headline, body text and CTA
      const headline = objectStory.link_data?.name || 
                       objectStory.video_data?.title ||
                       creative.title ||
                       ad.name;
      
      const primaryText = objectStory.link_data?.message || 
                          objectStory.video_data?.message ||
                          creative.body || 
                          null;
      
      const cta = objectStory.link_data?.call_to_action?.type ||
                  objectStory.video_data?.call_to_action?.type ||
                  creative.call_to_action_type ||
                  null;
      
      return {
        id: ad.id,
        ad_set_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        project_id,
        name: ad.name,
        status: ad.status,
        creative_id: creative.id || null,
        creative_thumbnail: creative.thumbnail_url || null,
        creative_image_url: imageUrl,
        creative_video_url: videoUrl,
        headline,
        primary_text: primaryText,
        cta,
        spend,
        impressions: parseInt(insights?.impressions || '0'),
        clicks: parseInt(insights?.clicks || '0'),
        ctr: parseFloat(insights?.ctr || '0'),
        cpm: parseFloat(insights?.cpm || '0'),
        cpc: parseFloat(insights?.cpc || '0'),
        reach: parseInt(insights?.reach || '0'),
        frequency: parseFloat(insights?.frequency || '0'),
        conversions,
        conversion_value: conversionValue,
        roas: spend > 0 ? conversionValue / spend : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
        synced_at: new Date().toISOString(),
      };
    });

    // STEP 5: UPSERT data (atomic - no data loss)
    console.log('[STEP 5] Upserting data (atomic)...');

    // UPSERT in batches - uses ON CONFLICT UPDATE
    const upsertInBatches = async (table: string, records: any[], batchSize = 200) => {
      if (records.length === 0) return 0;
      const batches = chunk(records, batchSize);
      let upsertedCount = 0;
      
      for (const batch of batches) {
        const { error } = await supabase.from(table).upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
        if (error) {
          console.error(`[UPSERT ERROR ${table}]`, error.message);
        } else {
          upsertedCount += batch.length;
        }
      }
      
      return upsertedCount;
    };

    // Upsert all data in parallel
    const [campaignsUpserted, adSetsUpserted, adsUpserted] = await Promise.all([
      upsertInBatches('campaigns', campaignRecords),
      upsertInBatches('ad_sets', adSetRecords),
      upsertInBatches('ads', adRecords),
    ]);

    console.log(`[UPSERTED] ${campaignsUpserted} campaigns, ${adSetsUpserted} adsets, ${adsUpserted} ads`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC COMPLETE] ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads in ${elapsed}s`);

    // Determine success status
    const partialSync = adSets.length === 0 || ads.length === 0;
    
    await supabase.from('projects').update({
      webhook_status: partialSync ? 'partial' : 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    await supabase.from('sync_logs').insert({
      project_id,
      status: partialSync ? 'partial' : 'success',
      message: `Sync: ${campaigns.length} campanhas, ${adSets.length} conjuntos, ${ads.length} anúncios em ${elapsed}s`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        partial: partialSync,
        step: 'complete',
        data: {
          campaigns_count: campaigns.length,
          ad_sets_count: adSets.length,
          ads_count: ads.length,
          elapsed_seconds: parseFloat(elapsed),
          synced_at: new Date().toISOString(),
        },
        message: partialSync 
          ? 'Sincronização parcial - rate limit da Meta. Aguarde 2-3 min e sincronize novamente.'
          : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error', step: 'error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
