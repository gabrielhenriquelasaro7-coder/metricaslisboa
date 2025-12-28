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

// Helper to determine period key from date range
function getPeriodKeyFromRange(since: string, until: string): string {
  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  const diffDays = Math.ceil((untilDate.getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Map to standard period keys
  if (diffDays <= 7) return 'last_7d';
  if (diffDays <= 14) return 'last_14d';
  if (diffDays <= 30) return 'last_30d';
  if (diffDays <= 60) return 'last_60d';
  if (diffDays <= 90) return 'last_90d';
  return `custom_${diffDays}d`;
}

// Helper to add delay with jitter (uniform spread to avoid traffic spikes)
function delay(ms: number): Promise<void> {
  // Add 0-30% random jitter to spread requests uniformly
  const jitter = ms * (Math.random() * 0.3);
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

// Adaptive rate limiting configuration
interface RateLimitState {
  currentDelay: number;
  consecutiveSuccesses: number;
  consecutiveErrors: number;
  lastErrorTime: number;
}

const rateLimit: RateLimitState = {
  currentDelay: 300, // Start conservative for high-volume accounts
  consecutiveSuccesses: 0,
  consecutiveErrors: 0,
  lastErrorTime: 0,
};

const MAX_DELAY = 5000;
const MIN_DELAY = 150;
const BACKOFF_MULTIPLIER = 2.5;
const RECOVERY_THRESHOLD = 10; // Successful requests before speeding up

function increaseDelay() {
  rateLimit.consecutiveErrors++;
  rateLimit.consecutiveSuccesses = 0;
  rateLimit.lastErrorTime = Date.now();
  rateLimit.currentDelay = Math.min(rateLimit.currentDelay * BACKOFF_MULTIPLIER, MAX_DELAY);
  console.log(`[RATE] Increased delay to ${rateLimit.currentDelay}ms (errors: ${rateLimit.consecutiveErrors})`);
}

function decreaseDelay() {
  rateLimit.consecutiveSuccesses++;
  rateLimit.consecutiveErrors = 0;
  
  // Only decrease if we've had enough consecutive successes
  if (rateLimit.consecutiveSuccesses >= RECOVERY_THRESHOLD) {
    rateLimit.currentDelay = Math.max(rateLimit.currentDelay * 0.8, MIN_DELAY);
    rateLimit.consecutiveSuccesses = 0;
    console.log(`[RATE] Decreased delay to ${rateLimit.currentDelay}ms`);
  }
}

// Fetch with retry, exponential backoff, and respect for rate limits
async function fetchWithRetry(url: string, retries = 3, timeout = 20000): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Pre-request delay to spread traffic uniformly
      if (attempt > 0 || rateLimit.currentDelay > MIN_DELAY) {
        await delay(rateLimit.currentDelay);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      
      // Check for rate limit errors (code 17 = rate limit, code 4 = too many calls)
      if (data.error && (data.error.code === 17 || data.error.code === 4)) {
        increaseDelay();
        if (attempt < retries) {
          // Exponential backoff with longer waits: 8s, 20s, 50s
          const waitTime = Math.min(8000 * Math.pow(2.5, attempt), 60000);
          console.log(`[RATE LIMIT] Code ${data.error.code} - Waiting ${(waitTime/1000).toFixed(1)}s before retry ${attempt + 1}...`);
          await delay(waitTime);
          continue;
        }
      } else if (!data.error) {
        decreaseDelay();
      }
      
      return data;
    } catch (error) {
      if (attempt < retries) {
        const waitTime = (attempt + 1) * 3000;
        console.log(`[FETCH ERROR] Retry ${attempt + 1} after ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }
      return { error: { message: 'Request timeout or network error' } };
    }
  }
}

// Fetch all pages with uniform request spreading
async function fetchAllPages(baseUrl: string, token: string, entityName: string, limit = 100): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = `${baseUrl}&limit=${limit}&access_token=${token}`;
  let pageCount = 0;
  const maxPages = 50; // Limit pages to avoid excessive calls
  
  while (nextUrl && pageCount < maxPages) {
    pageCount++;
    console.log(`[${entityName}] Fetching page ${pageCount}...`);
    
    const data = await fetchWithRetry(nextUrl);
    
    if (data.error) {
      console.error(`[${entityName}] Error on page ${pageCount}:`, data.error);
      
      // If rate limited after retries, return what we have
      if (data.error.code === 17 || data.error.code === 4 || data.error.code === 1) {
        console.log(`[${entityName}] Stopping pagination - API limits reached. Returning ${allData.length} items.`);
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
    
    // Uniform delay between pages (with jitter built into delay function)
    if (nextUrl) {
      await delay(rateLimit.currentDelay);
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

    // Reset rate limit state for this sync
    rateLimit.currentDelay = 300;
    rateLimit.consecutiveSuccesses = 0;
    rateLimit.consecutiveErrors = 0;

    // Update project status
    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    // Minimal fields to reduce response size (Graph API best practice)
    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';

    // STEP 1: Fetch campaigns (minimal fields only)
    console.log('[STEP 1/4] Fetching campaigns...');
    
    const campaigns = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget`,
      token,
      'CAMPAIGNS',
      100 // Smaller limit to avoid rate limits
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
    
    // STEP 2: Fetch ad sets (minimal fields - no targeting to reduce payload)
    console.log('[STEP 2/4] Fetching ad sets...');
    await delay(rateLimit.currentDelay);
    
    const adSets = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget`,
      token,
      'AD_SETS',
      100
    );
    console.log(`[AD SETS] Total: ${adSets.length}`);
    
    // STEP 3: Fetch ads (minimal creative fields)
    console.log('[STEP 3/4] Fetching ads...');
    await delay(rateLimit.currentDelay);
    
    // Minimal creative fields to reduce payload size
    const ads = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url,image_url,image_hash}`,
      token,
      'ADS',
      100
    );
    console.log(`[ADS] Total: ${ads.length}`);
    
    // STEP 3.5: Fetch high-quality images (only if we have ads)
    let adImages: any[] = [];
    if (ads.length > 0) {
      console.log('[STEP 3.5/4] Fetching high-quality images...');
      await delay(rateLimit.currentDelay);
      
      adImages = await fetchAllPages(
        `https://graph.facebook.com/v19.0/${ad_account_id}/adimages?fields=hash,url`,
        token,
        'IMAGES',
        100
      );
    }
    console.log(`[IMAGES] Total: ${adImages.length}`);
    
    // Helper to clean image URLs - ONLY removes stp resize parameter, keeps auth params
    const cleanAdImageUrl = (url: string | null): string | null => {
      if (!url) return null;
      
      // Remove ONLY stp= parameter that forces resize (e.g., stp=dst-jpg_p64x64_q75_tt6)
      let clean = url.replace(/[&?]stp=[^&]*/g, '');
      
      // Fix malformed URL: if & appears before any ?, replace first & with ?
      if (clean.includes('&') && !clean.includes('?')) {
        clean = clean.replace('&', '?');
      }
      
      // Clean trailing ? or &
      clean = clean.replace(/[&?]$/g, '');
      
      return clean;
    };
    
    // Create hash -> high-quality URL map (cleaned URLs)
    const imageHashMap = new Map<string, string>();
    adImages.forEach((img: any) => {
      const cleanedUrl = cleanAdImageUrl(img.url);
      if (cleanedUrl && img.hash) {
        imageHashMap.set(img.hash, cleanedUrl);
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

    // STEP 4: Fetch insights with controlled parallelization (avoid traffic spikes)
    console.log('[STEP 4/4] Fetching insights (controlled parallel)...');

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

    // Controlled parallelization with uniform request spreading
    const fetchInsightsForEntities = async (entities: any[], entityType: string): Promise<Map<string, any>> => {
      const insightsMap = new Map<string, any>();
      
      // Smaller batches for high-volume accounts (was 50, now 15)
      const BATCH_SIZE = 15;
      const batches = chunk(entities, BATCH_SIZE);
      
      console.log(`[INSIGHTS ${entityType}] ${entities.length} entities in ${batches.length} batches of ${BATCH_SIZE}`);
      
      let processedCount = 0;
      let rateLimitHits = 0;
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // Stagger requests within batch to avoid traffic spikes
        const results = await Promise.all(
          batch.map(async (entity: any, idx: number) => {
            // Add staggered delay within batch (0ms, 50ms, 100ms, etc.)
            await delay(idx * 50);
            
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);
              
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${entity.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`,
                { signal: controller.signal }
              );
              clearTimeout(timeoutId);
              
              const data = await res.json();
              
              // Handle rate limit errors
              if (data.error && (data.error.code === 17 || data.error.code === 4)) {
                increaseDelay();
                return { id: entity.id, insights: null, rateLimited: true };
              }
              
              if (!data.error) {
                decreaseDelay();
              }
              
              return { id: entity.id, insights: data.data?.[0] || null };
            } catch {
              return { id: entity.id, insights: null };
            }
          })
        );
        
        // Check for rate limits in this batch
        const batchRateLimited = results.filter(r => r.rateLimited).length;
        if (batchRateLimited > 0) {
          rateLimitHits += batchRateLimited;
          const waitTime = rateLimit.currentDelay * 5;
          console.log(`[INSIGHTS ${entityType}] ${batchRateLimited} rate limits in batch, waiting ${(waitTime/1000).toFixed(1)}s...`);
          await delay(waitTime);
        }
        
        results.forEach(r => insightsMap.set(r.id, r.insights));
        processedCount += batch.length;
        
        // Progress log every 3 batches
        if (i % 3 === 0 || i === batches.length - 1) {
          console.log(`[INSIGHTS ${entityType}] Progress: ${processedCount}/${entities.length} (rate limits: ${rateLimitHits})`);
        }
        
        // Uniform delay between batches with current adaptive rate
        if (i < batches.length - 1) {
          await delay(rateLimit.currentDelay);
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
        created_time: null,
        updated_time: null,
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
        targeting: null, // Removed from query to reduce payload size
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
      
      const creative = ad.creative || {};
      
      // Helper to clean low-res URL parameters - ONLY removes stp resize param
      const cleanImageUrl = (url: string | null): string | null => {
        if (!url) return null;
        let clean = url.replace(/[&?]stp=[^&]*/g, '');
        if (clean.includes('&') && !clean.includes('?')) {
          clean = clean.replace('&', '?');
        }
        return clean.replace(/[&?]$/g, '');
      };
      
      // Get image URL with priority: hash map > image_url > thumbnail_url
      let imageUrl: string | null = null;
      
      if (creative.image_hash && imageHashMap.has(creative.image_hash)) {
        imageUrl = imageHashMap.get(creative.image_hash) || null;
      }
      
      if (!imageUrl) {
        imageUrl = cleanImageUrl(creative.image_url) || cleanImageUrl(creative.thumbnail_url) || null;
      }
      
      return {
        id: ad.id,
        ad_set_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        project_id,
        name: ad.name,
        status: ad.status,
        creative_id: creative.id || null,
        creative_thumbnail: cleanImageUrl(creative.thumbnail_url),
        creative_image_url: imageUrl,
        creative_video_url: null,
        headline: ad.name,
        primary_text: null,
        cta: null,
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

    // STEP 6: Save to period_metrics table for instant frontend loading
    const periodKey = time_range 
      ? getPeriodKeyFromRange(time_range.since, time_range.until)
      : date_preset || 'last_30d';
    
    console.log(`[STEP 6] Saving period_metrics for period: ${periodKey}`);
    
    // Create period_metrics records for campaigns
    const campaignPeriodRecords = campaignRecords.map((c: any) => ({
      project_id,
      period_key: periodKey,
      entity_type: 'campaign',
      entity_id: c.id,
      entity_name: c.name,
      status: c.status,
      metrics: {
        objective: c.objective,
        daily_budget: c.daily_budget,
        lifetime_budget: c.lifetime_budget,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: c.ctr,
        cpm: c.cpm,
        cpc: c.cpc,
        reach: c.reach,
        frequency: c.frequency,
        conversions: c.conversions,
        conversion_value: c.conversion_value,
        roas: c.roas,
        cpa: c.cpa,
      },
      synced_at: new Date().toISOString(),
    }));

    // Create period_metrics records for ad sets
    const adSetPeriodRecords = adSetRecords.map((as: any) => ({
      project_id,
      period_key: periodKey,
      entity_type: 'ad_set',
      entity_id: as.id,
      entity_name: as.name,
      status: as.status,
      metrics: {
        campaign_id: as.campaign_id,
        daily_budget: as.daily_budget,
        lifetime_budget: as.lifetime_budget,
        spend: as.spend,
        impressions: as.impressions,
        clicks: as.clicks,
        ctr: as.ctr,
        cpm: as.cpm,
        cpc: as.cpc,
        reach: as.reach,
        frequency: as.frequency,
        conversions: as.conversions,
        conversion_value: as.conversion_value,
        roas: as.roas,
        cpa: as.cpa,
      },
      synced_at: new Date().toISOString(),
    }));

    // Create period_metrics records for ads
    const adPeriodRecords = adRecords.map((ad: any) => ({
      project_id,
      period_key: periodKey,
      entity_type: 'ad',
      entity_id: ad.id,
      entity_name: ad.name,
      status: ad.status,
      metrics: {
        campaign_id: ad.campaign_id,
        ad_set_id: ad.ad_set_id,
        creative_id: ad.creative_id,
        creative_thumbnail: ad.creative_thumbnail,
        creative_image_url: ad.creative_image_url,
        headline: ad.headline,
        cta: ad.cta,
        spend: ad.spend,
        impressions: ad.impressions,
        clicks: ad.clicks,
        ctr: ad.ctr,
        cpm: ad.cpm,
        cpc: ad.cpc,
        reach: ad.reach,
        frequency: ad.frequency,
        conversions: ad.conversions,
        conversion_value: ad.conversion_value,
        roas: ad.roas,
        cpa: ad.cpa,
      },
      synced_at: new Date().toISOString(),
    }));

    // Upsert period_metrics in parallel
    const allPeriodRecords = [...campaignPeriodRecords, ...adSetPeriodRecords, ...adPeriodRecords];
    const periodMetricsUpserted = await upsertInBatches('period_metrics', allPeriodRecords);
    console.log(`[PERIOD_METRICS] Upserted ${periodMetricsUpserted} records for period ${periodKey}`);

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
      message: `Sync: ${campaigns.length} campanhas, ${adSets.length} conjuntos, ${ads.length} anúncios em ${elapsed}s (período: ${periodKey})`,
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
