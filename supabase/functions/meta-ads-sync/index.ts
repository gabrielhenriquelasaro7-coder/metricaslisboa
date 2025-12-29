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
  period_key?: string;
}

const MAX_CAMPAIGNS = 200;
const MAX_ADSETS = 400;
const MAX_ADS = 600;

// Exponential backoff retry delays (in ms): 30s, 60s, 120s, 240s
const RETRY_DELAYS = [30000, 60000, 120000, 240000];
const MAX_RETRIES = 4;

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

// Check if error is a rate limit error (code 17 or "User request limit reached")
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

async function simpleFetch(url: string, timeoutMs = 25000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Fetch failed' } };
  }
}

// Fetch with exponential backoff retry for rate limit errors
async function fetchWithRetry(url: string, entityName: string, timeoutMs = 25000): Promise<any> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const data = await simpleFetch(url, timeoutMs);
    
    if (!data.error) {
      return data;
    }
    
    // Check if it's a rate limit error
    if (isRateLimitError(data)) {
      if (attempt < MAX_RETRIES) {
        const waitTime = RETRY_DELAYS[attempt];
        console.log(`[${entityName}] Rate limit hit, retry ${attempt + 1}/${MAX_RETRIES} after ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      } else {
        console.error(`[${entityName}] Rate limit: max retries (${MAX_RETRIES}) exceeded`);
        lastError = data;
        break;
      }
    }
    
    // Not a rate limit error, return immediately
    return data;
  }
  
  return lastError || { error: { message: 'Max retries exceeded' } };
}

async function fetchAllPages(baseUrl: string, token: string, entityName: string, maxItems: number): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = `${baseUrl}&limit=100&access_token=${token}`;
  let pageCount = 0;
  const maxPages = Math.ceil(maxItems / 100);
  
  while (nextUrl && pageCount < maxPages && allData.length < maxItems) {
    pageCount++;
    const data = await fetchWithRetry(nextUrl, entityName);
    
    if (data.error) {
      console.error(`[${entityName}] Error:`, data.error.message);
      break;
    }
    
    if (data.data && data.data.length > 0) {
      allData.push(...data.data);
    } else {
      break;
    }
    
    nextUrl = data.paging?.next || null;
    // Increased delay between pages (1 second)
    if (nextUrl && allData.length < maxItems) await delay(1000);
  }
  
  console.log(`[${entityName}] Total: ${allData.length}`);
  return allData.slice(0, maxItems);
}

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

    const { project_id, ad_account_id, access_token, date_preset, time_range, period_key }: SyncRequest = await req.json();
    
    const timeParam = time_range 
      ? `time_range=${encodeURIComponent(JSON.stringify({ since: time_range.since, until: time_range.until }))}`
      : `date_preset=${date_preset || 'last_30d'}`;
    
    const finalPeriodKey = period_key || date_preset || 'last_30d';
    const token = access_token || metaAccessToken;

    if (!token || !project_id || !ad_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC] Period: ${finalPeriodKey}, Range: ${time_range?.since || date_preset} to ${time_range?.until || ''}`);

    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    // STEP 1: Fetch all entities with retry
    const campaigns = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget`,
      token, 'CAMPAIGNS', MAX_CAMPAIGNS
    );
    
    if (campaigns.length === 0) {
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      return new Response(JSON.stringify({ success: false, error: 'No campaigns' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await delay(2000); // Increased delay

    const adSets = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget`,
      token, 'AD_SETS', MAX_ADSETS
    );

    await delay(2000); // Increased delay

    const ads = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url}`,
      token, 'ADS', MAX_ADS
    );

    await delay(3000); // Delay before insights

    // STEP 2: Fetch insights using BATCH API with retry
    console.log(`[INSIGHTS] Fetching for ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads...`);
    
    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';
    const insightsMap = new Map<string, any>();
    
    // Fetch campaign insights with retry
    const campaignInsightsUrl = `https://graph.facebook.com/v19.0/${ad_account_id}/insights?fields=${insightsFields}&${timeParam}&level=campaign&access_token=${token}&limit=500`;
    const campaignInsights = await fetchWithRetry(campaignInsightsUrl, 'INSIGHTS_CAMPAIGN');
    if (campaignInsights.data) {
      for (const ins of campaignInsights.data) {
        if (ins.campaign_id) insightsMap.set(ins.campaign_id, ins);
      }
    }
    console.log(`[INSIGHTS] Campaigns: ${insightsMap.size}`);

    await delay(3000); // Increased delay between insight levels

    // Fetch adset insights with retry
    const adsetInsightsUrl = `https://graph.facebook.com/v19.0/${ad_account_id}/insights?fields=${insightsFields}&${timeParam}&level=adset&access_token=${token}&limit=500`;
    const adsetInsights = await fetchWithRetry(adsetInsightsUrl, 'INSIGHTS_ADSET');
    if (adsetInsights.data) {
      for (const ins of adsetInsights.data) {
        if (ins.adset_id) insightsMap.set(ins.adset_id, ins);
      }
    }
    console.log(`[INSIGHTS] Adsets: ${insightsMap.size}`);

    await delay(3000); // Increased delay

    // Fetch ad insights with retry
    const adInsightsUrl = `https://graph.facebook.com/v19.0/${ad_account_id}/insights?fields=${insightsFields}&${timeParam}&level=ad&access_token=${token}&limit=500`;
    const adInsights = await fetchWithRetry(adInsightsUrl, 'INSIGHTS_AD');
    if (adInsights.data) {
      for (const ins of adInsights.data) {
        if (ins.ad_id) insightsMap.set(ins.ad_id, ins);
      }
    }
    console.log(`[INSIGHTS] Total: ${insightsMap.size}`);

    // STEP 3: Build records
    const extractConversions = (insights: any) => {
      let conversions = 0, conversionValue = 0;
      const types = ['purchase', 'omni_purchase', 'lead', 'contact', 'offsite_conversion.fb_pixel_lead'];
      
      if (insights?.actions) {
        for (const t of types) {
          const a = insights.actions.find((x: any) => x.action_type === t);
          if (a && parseInt(a.value) > 0) { conversions = parseInt(a.value); break; }
        }
      }
      if (insights?.action_values) {
        const pv = insights.action_values.find((x: any) => x.action_type === 'purchase' || x.action_type === 'omni_purchase');
        conversionValue = parseFloat(pv?.value || '0');
      }
      return { conversions, conversionValue };
    };

    const buildRecord = (entity: any, entityType: string) => {
      const insights = insightsMap.get(entity.id);
      const { conversions, conversionValue } = extractConversions(insights);
      const spend = parseFloat(insights?.spend || '0');
      
      const base = {
        id: entity.id,
        project_id,
        name: entity.name,
        status: entity.status,
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

      if (entityType === 'campaign') {
        return { ...base, objective: entity.objective, daily_budget: entity.daily_budget ? parseFloat(entity.daily_budget) / 100 : null, lifetime_budget: entity.lifetime_budget ? parseFloat(entity.lifetime_budget) / 100 : null };
      } else if (entityType === 'adset') {
        return { ...base, campaign_id: entity.campaign_id, daily_budget: entity.daily_budget ? parseFloat(entity.daily_budget) / 100 : null, lifetime_budget: entity.lifetime_budget ? parseFloat(entity.lifetime_budget) / 100 : null, targeting: null };
      } else {
        return { ...base, ad_set_id: entity.adset_id, campaign_id: entity.campaign_id, creative_id: entity.creative?.id || null, creative_thumbnail: entity.creative?.thumbnail_url || null, creative_image_url: null, creative_video_url: null, headline: entity.name, primary_text: null, cta: null };
      }
    };

    const campaignRecords = campaigns.map(c => buildRecord(c, 'campaign'));
    const adSetRecords = adSets.map(as => buildRecord(as, 'adset'));
    const adRecords = ads.map(ad => buildRecord(ad, 'ad'));

    // STEP 4: Upsert to database
    const upsertBatch = async (table: string, records: any[]) => {
      if (records.length === 0) return 0;
      let count = 0;
      for (const batch of chunk(records, 200)) {
        const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
        if (!error) count += batch.length;
      }
      return count;
    };

    const [cCount, asCount, adCount] = await Promise.all([
      upsertBatch('campaigns', campaignRecords),
      upsertBatch('ad_sets', adSetRecords),
      upsertBatch('ads', adRecords),
    ]);

    console.log(`[UPSERT] ${cCount} campaigns, ${asCount} adsets, ${adCount} ads`);

    // STEP 5: Save period_metrics
    const periodRecords = [
      ...campaignRecords.map(r => ({ project_id, period_key: finalPeriodKey, entity_type: 'campaign', entity_id: r.id, entity_name: r.name, status: r.status, metrics: r, synced_at: new Date().toISOString() })),
      ...adSetRecords.map(r => ({ project_id, period_key: finalPeriodKey, entity_type: 'ad_set', entity_id: r.id, entity_name: r.name, status: r.status, metrics: r, synced_at: new Date().toISOString() })),
      ...adRecords.map(r => ({ project_id, period_key: finalPeriodKey, entity_type: 'ad', entity_id: r.id, entity_name: r.name, status: r.status, metrics: r, synced_at: new Date().toISOString() })),
    ];

    let periodCount = 0;
    for (const batch of chunk(periodRecords, 200)) {
      const { error } = await supabase.from('period_metrics').upsert(batch, { onConflict: 'project_id,period_key,entity_type,entity_id', ignoreDuplicates: false });
      if (!error) periodCount += batch.length;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[COMPLETE] ${finalPeriodKey}: ${campaigns.length}c/${adSets.length}as/${ads.length}ads, ${insightsMap.size} insights in ${elapsed}s`);

    await supabase.from('projects').update({ webhook_status: 'success', last_sync_at: new Date().toISOString() }).eq('id', project_id);
    
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: JSON.stringify({ period: finalPeriodKey, campaigns: campaigns.length, adsets: adSets.length, ads: ads.length, insights: insightsMap.size, elapsed: elapsed + 's' }),
    });

    return new Response(
      JSON.stringify({ success: true, data: { period: finalPeriodKey, campaigns_count: campaigns.length, ad_sets_count: adSets.length, ads_count: ads.length, insights_count: insightsMap.size, period_metrics_count: periodCount, elapsed_seconds: parseFloat(elapsed) } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC ERROR]', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
