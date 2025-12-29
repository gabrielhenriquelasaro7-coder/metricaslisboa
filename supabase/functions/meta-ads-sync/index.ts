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

// LIMITS - Conservative to fit in 60s timeout
const MAX_CAMPAIGNS = 150;
const MAX_ADSETS = 300;
const MAX_ADS = 500;
const FUNCTION_TIMEOUT_MS = 50000; // Return before 55s to ensure response

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
  
  if (diffDays <= 7) return 'last_7d';
  if (diffDays <= 14) return 'last_14d';
  if (diffDays <= 30) return 'last_30d';
  if (diffDays <= 60) return 'last_60d';
  if (diffDays <= 90) return 'last_90d';
  return `custom_${diffDays}d`;
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch with retry on rate limit
async function fetchWithRetry(url: string, timeout = 10000, maxRetries = 2): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      
      // Handle rate limit - wait and retry
      if (data.error && (data.error.code === 17 || data.error.code === 4 || data.error.message?.includes('limit'))) {
        if (attempt < maxRetries) {
          const waitTime = (attempt + 1) * 5000; // 5s, 10s
          console.log(`[RATE LIMIT] Waiting ${waitTime/1000}s before retry...`);
          await delay(waitTime);
          continue;
        }
      }
      
      return data;
    } catch (error) {
      if (attempt < maxRetries) {
        await delay(2000);
        continue;
      }
      return { error: { message: 'Request timeout' } };
    }
  }
  return { error: { message: 'Max retries exceeded' } };
}

// Fetch pages with strict limits
async function fetchLimited(baseUrl: string, token: string, entityName: string, maxItems: number): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = `${baseUrl}&limit=100&access_token=${token}`;
  let pageCount = 0;
  const maxPages = Math.ceil(maxItems / 100);
  
  while (nextUrl && pageCount < maxPages && allData.length < maxItems) {
    pageCount++;
    console.log(`[${entityName}] Page ${pageCount}...`);
    
    const data = await fetchWithRetry(nextUrl);
    
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
    
    // Small delay between pages
    if (nextUrl && allData.length < maxItems) {
      await delay(300);
    }
  }
  
  const limited = allData.slice(0, maxItems);
  console.log(`[${entityName}] Got ${limited.length}/${allData.length} items`);
  return limited;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Helper to check if we're running out of time
  const isTimedOut = () => (Date.now() - startTime) > FUNCTION_TIMEOUT_MS;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_id, ad_account_id, access_token, date_preset, time_range }: SyncRequest = await req.json();
    
    const timeParam = time_range 
      ? `time_range=${encodeURIComponent(JSON.stringify({ since: time_range.since, until: time_range.until }))}`
      : `date_preset=${date_preset || 'last_30d'}`;
    
    const periodKey = time_range 
      ? getPeriodKeyFromRange(time_range.since, time_range.until)
      : date_preset || 'last_30d';

    const token = access_token || metaAccessToken;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta access token is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project_id || !ad_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'project_id and ad_account_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC] Starting: ${project_id}, period: ${periodKey}`);

    // Update project status
    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    // Helper to save partial progress
    const saveProgress = async (step: string, counts: any) => {
      await supabase.from('sync_logs').insert({
        project_id,
        status: 'syncing',
        message: JSON.stringify({ step, period: periodKey, ...counts, elapsed: ((Date.now() - startTime) / 1000).toFixed(1) + 's' }),
      });
    };

    // ============ STEP 1: CAMPAIGNS ============
    console.log('[STEP 1/4] Campaigns...');
    
    const campaigns = await fetchLimited(
      `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget`,
      token,
      'CAMPAIGNS',
      MAX_CAMPAIGNS
    );
    
    if (campaigns.length === 0) {
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      return new Response(
        JSON.stringify({ success: false, error: 'No campaigns found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    await saveProgress('campaigns_fetched', { campaigns: campaigns.length });

    if (isTimedOut()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Timeout after campaigns', partial: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ STEP 2: AD SETS ============
    console.log('[STEP 2/4] Ad Sets...');
    
    const adSets = await fetchLimited(
      `https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget`,
      token,
      'AD_SETS',
      MAX_ADSETS
    );
    
    await saveProgress('adsets_fetched', { campaigns: campaigns.length, adsets: adSets.length });

    if (isTimedOut()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Timeout after adsets', partial: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ STEP 3: ADS (simplified - no images) ============
    console.log('[STEP 3/4] Ads...');
    
    const ads = await fetchLimited(
      `https://graph.facebook.com/v19.0/${ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url}`,
      token,
      'ADS',
      MAX_ADS
    );
    
    await saveProgress('ads_fetched', { campaigns: campaigns.length, adsets: adSets.length, ads: ads.length });

    if (isTimedOut()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Timeout after ads', partial: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ STEP 4: INSIGHTS (only for ACTIVE, sequential for speed) ============
    console.log('[STEP 4/4] Insights (ACTIVE only)...');
    
    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';
    
    const extractConversions = (insights: any) => {
      let conversions = 0;
      let conversionValue = 0;
      
      const conversionTypes = [
        'purchase', 'omni_purchase', 'lead', 'contact',
        'offsite_conversion.fb_pixel_lead',
        'onsite_conversion.messaging_conversation_started_7d',
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
        const purchaseValue = insights.action_values.find((a: any) => 
          a.action_type === 'purchase' || a.action_type === 'omni_purchase'
        );
        conversionValue = parseFloat(purchaseValue?.value || '0');
      }
      
      return { conversions, conversionValue };
    };

    // Fetch insights only for ACTIVE entities (much faster)
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
    const activeAdSets = adSets.filter(as => as.status === 'ACTIVE');
    const activeAds = ads.filter(ad => ad.status === 'ACTIVE');
    
    console.log(`[INSIGHTS] Active: ${activeCampaigns.length} campaigns, ${activeAdSets.length} adsets, ${activeAds.length} ads`);
    
    const insightsMap = new Map<string, any>();
    
    // Fetch insights in small batches with minimal delay
    const fetchInsightsSimple = async (entities: any[]) => {
      const batchSize = 10;
      for (let i = 0; i < entities.length && !isTimedOut(); i += batchSize) {
        const batch = entities.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (entity: any) => {
          const data = await fetchWithRetry(
            `https://graph.facebook.com/v19.0/${entity.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`,
            5000,
            1
          );
          if (data.data?.[0]) {
            insightsMap.set(entity.id, data.data[0]);
          }
        }));
        
        if (i + batchSize < entities.length) {
          await delay(200);
        }
      }
    };
    
    // Fetch insights for active entities only
    await fetchInsightsSimple(activeCampaigns);
    if (!isTimedOut()) await fetchInsightsSimple(activeAdSets);
    if (!isTimedOut()) await fetchInsightsSimple(activeAds);
    
    console.log(`[INSIGHTS] Got ${insightsMap.size} insights`);

    // ============ STEP 5: PREPARE AND SAVE DATA ============
    console.log('[STEP 5] Saving data...');
    
    const campaignRecords = campaigns.map((c: any) => {
      const insights = insightsMap.get(c.id);
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
        synced_at: new Date().toISOString(),
      };
    });

    const adSetRecords = adSets.map((as: any) => {
      const insights = insightsMap.get(as.id);
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
        targeting: null,
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
      const insights = insightsMap.get(ad.id);
      const { conversions, conversionValue } = extractConversions(insights);
      const spend = parseFloat(insights?.spend || '0');
      const creative = ad.creative || {};
      
      return {
        id: ad.id,
        ad_set_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        project_id,
        name: ad.name,
        status: ad.status,
        creative_id: creative.id || null,
        creative_thumbnail: creative.thumbnail_url || null,
        creative_image_url: null,
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

    // Upsert in batches
    const upsertBatch = async (table: string, records: any[]) => {
      if (records.length === 0) return 0;
      const batches = chunk(records, 200);
      let count = 0;
      
      for (const batch of batches) {
        const { error } = await supabase.from(table).upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
        if (!error) count += batch.length;
        else console.error(`[UPSERT ${table}]`, error.message);
      }
      
      return count;
    };

    const [cUpserted, asUpserted, adUpserted] = await Promise.all([
      upsertBatch('campaigns', campaignRecords),
      upsertBatch('ad_sets', adSetRecords),
      upsertBatch('ads', adRecords),
    ]);

    console.log(`[UPSERT] ${cUpserted} campaigns, ${asUpserted} adsets, ${adUpserted} ads`);

    // ============ STEP 6: PERIOD METRICS ============
    console.log('[STEP 6] Period metrics...');
    
    const createPeriodRecord = (type: string, record: any) => ({
      project_id,
      period_key: periodKey,
      entity_type: type,
      entity_id: record.id,
      entity_name: record.name,
      status: record.status,
      metrics: {
        spend: record.spend,
        impressions: record.impressions,
        clicks: record.clicks,
        ctr: record.ctr,
        cpm: record.cpm,
        cpc: record.cpc,
        reach: record.reach,
        frequency: record.frequency,
        conversions: record.conversions,
        conversion_value: record.conversion_value,
        roas: record.roas,
        cpa: record.cpa,
      },
      synced_at: new Date().toISOString(),
    });
    
    const periodRecords = [
      ...campaignRecords.map(r => createPeriodRecord('campaign', r)),
      ...adSetRecords.map(r => createPeriodRecord('ad_set', r)),
      ...adRecords.map(r => createPeriodRecord('ad', r)),
    ];
    
    // Upsert period metrics
    const periodBatches = chunk(periodRecords, 200);
    let periodCount = 0;
    for (const batch of periodBatches) {
      const { error } = await supabase.from('period_metrics').upsert(batch, { 
        onConflict: 'project_id,period_key,entity_type,entity_id',
        ignoreDuplicates: false 
      });
      if (!error) periodCount += batch.length;
    }
    
    console.log(`[PERIOD_METRICS] ${periodCount} records`);

    // ============ COMPLETE ============
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[COMPLETE] ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads in ${elapsed}s`);

    // Update project status
    await supabase.from('projects').update({
      webhook_status: 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    // Save final sync log
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: JSON.stringify({
        period: periodKey,
        campaigns: campaigns.length,
        adsets: adSets.length,
        ads: ads.length,
        insights: insightsMap.size,
        elapsed: elapsed + 's',
      }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          campaigns_count: campaigns.length,
          ad_sets_count: adSets.length,
          ads_count: ads.length,
          insights_count: insightsMap.size,
          period_metrics_count: periodCount,
          elapsed_seconds: parseFloat(elapsed),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
