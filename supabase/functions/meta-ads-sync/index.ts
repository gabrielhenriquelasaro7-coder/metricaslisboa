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
  use_async?: boolean; // Use async reports for large data
}

const MAX_CAMPAIGNS = 500;
const MAX_ADSETS = 1000;
const MAX_ADS = 2000;

// Batch API constants
const BATCH_SIZE = 50; // Meta allows up to 50 requests per batch
const ASYNC_THRESHOLD = 100; // Use async reports if entities > this

// Retry delays for rate limits
const RETRY_DELAYS = [10000, 20000, 40000, 80000];
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
    
    if (isRateLimitError(data)) {
      if (attempt < MAX_RETRIES) {
        const waitTime = RETRY_DELAYS[attempt];
        console.log(`[${entityName}] Rate limit, retry ${attempt + 1}/${MAX_RETRIES} in ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      } else {
        console.error(`[${entityName}] Rate limit: max retries exceeded`);
        lastError = data;
        break;
      }
    }
    
    return data;
  }
  
  return lastError || { error: { message: 'Max retries exceeded' } };
}

// ============ BATCH API IMPLEMENTATION ============
interface BatchRequest {
  method: string;
  relative_url: string;
}

interface BatchResponse {
  code: number;
  headers?: { name: string; value: string }[];
  body: string;
}

async function executeBatch(batchRequests: BatchRequest[], token: string, entityName: string): Promise<any[]> {
  const results: any[] = [];
  const batches = chunk(batchRequests, BATCH_SIZE);
  
  console.log(`[BATCH] ${entityName}: ${batchRequests.length} requests in ${batches.length} batches`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('batch', JSON.stringify(batch));
    
    const response = await fetchWithRetry(
      'https://graph.facebook.com/v19.0/',
      `${entityName}_BATCH_${i + 1}`,
      { method: 'POST', body: formData },
      60000 // 60s timeout for batch
    );
    
    if (Array.isArray(response)) {
      for (const item of response) {
        if (item?.body) {
          try {
            const parsed = JSON.parse(item.body);
            if (parsed.data) {
              results.push(...parsed.data);
            } else if (!parsed.error) {
              results.push(parsed);
            }
          } catch {
            // Skip unparseable responses
          }
        }
      }
    }
    
    // Small delay between batches
    if (i < batches.length - 1) {
      await delay(500);
    }
  }
  
  console.log(`[BATCH] ${entityName}: Got ${results.length} results`);
  return results;
}

// ============ ASYNC REPORTS IMPLEMENTATION ============
interface AsyncReportStatus {
  id: string;
  account_id: string;
  async_status: string;
  async_percent_completion: number;
}

async function createAsyncReport(
  adAccountId: string,
  token: string,
  timeRange: { since: string; until: string },
  level: 'campaign' | 'adset' | 'ad'
): Promise<string | null> {
  // Include entity IDs for mapping insights back to entities
  const levelFields: Record<string, string> = {
    campaign: 'campaign_id,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values',
    adset: 'adset_id,campaign_id,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values',
    ad: 'ad_id,adset_id,campaign_id,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values',
  };
  const fields = levelFields[level] || levelFields.campaign;
  
  const params = new URLSearchParams({
    access_token: token,
    fields,
    level,
    time_range: JSON.stringify(timeRange),
  });
  
  const response = await fetchWithRetry(
    `https://graph.facebook.com/v19.0/${adAccountId}/insights?${params}`,
    `ASYNC_CREATE_${level}`,
    { method: 'POST' },
    30000
  );
  
  if (response.report_run_id) {
    console.log(`[ASYNC] Created ${level} report: ${response.report_run_id}`);
    return response.report_run_id;
  }
  
  // If no async report created, data might be returned directly
  if (response.data) {
    console.log(`[ASYNC] ${level}: Direct data returned (${response.data.length} rows)`);
    return null;
  }
  
  console.log(`[ASYNC] Failed to create ${level} report:`, response.error?.message);
  return null;
}

async function pollAsyncReport(reportId: string, token: string, maxWaitMs = 300000): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await simpleFetch(
      `https://graph.facebook.com/v19.0/${reportId}?access_token=${token}`
    );
    
    if (response.error) {
      console.log(`[ASYNC POLL] Error: ${response.error.message}`);
      return false;
    }
    
    const status = response.async_status;
    const percent = response.async_percent_completion || 0;
    
    if (status === 'Job Completed') {
      console.log(`[ASYNC POLL] Report ${reportId} completed (${percent}%)`);
      return true;
    }
    
    if (status === 'Job Failed' || status === 'Job Skipped') {
      console.log(`[ASYNC POLL] Report ${reportId} failed: ${status}`);
      return false;
    }
    
    console.log(`[ASYNC POLL] ${reportId}: ${status} (${percent}%)`);
    await delay(pollInterval);
  }
  
  console.log(`[ASYNC POLL] Report ${reportId} timeout after ${maxWaitMs / 1000}s`);
  return false;
}

async function fetchAsyncResults(reportId: string, token: string): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = 
    `https://graph.facebook.com/v19.0/${reportId}/insights?access_token=${token}&limit=500`;
  
  while (nextUrl) {
    const response = await simpleFetch(nextUrl);
    
    if (response.data && response.data.length > 0) {
      results.push(...response.data);
    }
    
    nextUrl = response.paging?.next || null;
    if (nextUrl) await delay(200);
  }
  
  console.log(`[ASYNC RESULTS] Report ${reportId}: ${results.length} rows`);
  return results;
}

// ============ OPTIMIZED INSIGHTS FETCH ============
async function fetchInsightsOptimized(
  adAccountId: string,
  token: string,
  timeRange: { since: string; until: string },
  entityCounts: { campaigns: number; adsets: number; ads: number }
): Promise<Map<string, any>> {
  const insightsMap = new Map<string, any>();
  const totalEntities = entityCounts.campaigns + entityCounts.adsets + entityCounts.ads;
  const useAsync = totalEntities > ASYNC_THRESHOLD;
  
  console.log(`[INSIGHTS] Total entities: ${totalEntities}, using ${useAsync ? 'ASYNC' : 'BATCH'} mode`);
  
  const timeParam = `time_range=${encodeURIComponent(JSON.stringify(timeRange))}`;
  // IMPORTANT: Include entity IDs in fields so we can map insights back to entities
  const baseFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';
  const campaignFields = `campaign_id,${baseFields}`;
  const adsetFields = `adset_id,campaign_id,${baseFields}`;
  const adFields = `ad_id,adset_id,campaign_id,${baseFields}`;
  
  if (useAsync) {
    // Use Async Reports for large data volumes
    const levels: ('campaign' | 'adset' | 'ad')[] = ['campaign', 'adset', 'ad'];
    
    // Create all reports in parallel
    const reportPromises = levels.map(level => createAsyncReport(adAccountId, token, timeRange, level));
    const reportIds = await Promise.all(reportPromises);
    
    // Poll all reports in parallel
    const pollPromises = reportIds.map((id, i) => 
      id ? pollAsyncReport(id, token) : Promise.resolve(true)
    );
    const pollResults = await Promise.all(pollPromises);
    
    // Fetch results for completed reports
    for (let i = 0; i < levels.length; i++) {
      const reportId = reportIds[i];
      const pollSuccess = pollResults[i];
      
      if (reportId && pollSuccess) {
        const results = await fetchAsyncResults(reportId, token);
        for (const ins of results) {
          // Try all possible ID fields - Meta returns different field names depending on level
          const id = ins.campaign_id || ins.adset_id || ins.ad_id || ins.id;
          if (id) insightsMap.set(id, ins);
        }
      } else if (!reportId) {
        // Fallback to direct fetch if no async report was created
        const levelName = levels[i];
        const levelFieldsMap: Record<string, string> = {
          campaign: campaignFields,
          adset: adsetFields,
          ad: adFields,
        };
        const levelField = levelFieldsMap[levelName];
        const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=${levelField}&${timeParam}&level=${levelName}&access_token=${token}&limit=500`;
        const response = await fetchWithRetry(url, `INSIGHTS_${levelName.toUpperCase()}`);
        if (response.data) {
          for (const ins of response.data) {
            const id = ins.campaign_id || ins.adset_id || ins.ad_id;
            if (id) insightsMap.set(id, ins);
          }
        }
      }
    }
  } else {
    // Use Batch API for smaller data volumes
    const batchRequests: BatchRequest[] = [
      { method: 'GET', relative_url: `${adAccountId}/insights?fields=${campaignFields}&${timeParam}&level=campaign&limit=500` },
      { method: 'GET', relative_url: `${adAccountId}/insights?fields=${adsetFields}&${timeParam}&level=adset&limit=500` },
      { method: 'GET', relative_url: `${adAccountId}/insights?fields=${adFields}&${timeParam}&level=ad&limit=500` },
    ];
    
    const results = await executeBatch(batchRequests, token, 'INSIGHTS');
    
    for (const ins of results) {
      // Try all possible ID fields - Meta returns different field names depending on level
      const id = ins.campaign_id || ins.adset_id || ins.ad_id || ins.id;
      if (id) {
        insightsMap.set(id, ins);
      } else {
        // Log first unmatched insight for debugging
        if (insightsMap.size === 0) {
          console.log(`[INSIGHTS DEBUG] Sample insight keys: ${Object.keys(ins).join(', ')}`);
        }
      }
    }
  }
  
  console.log(`[INSIGHTS] Total mapped: ${insightsMap.size}`);
  return insightsMap;
}

// ============ OPTIMIZED ENTITY FETCH WITH BATCH ============
async function fetchEntitiesOptimized(
  adAccountId: string,
  token: string
): Promise<{ campaigns: any[]; adsets: any[]; ads: any[] }> {
  // Use Batch API to fetch all entity types in parallel
  const batchRequests: BatchRequest[] = [
    { method: 'GET', relative_url: `${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500` },
    { method: 'GET', relative_url: `${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget&limit=500` },
    { method: 'GET', relative_url: `${adAccountId}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url}&limit=500` },
  ];
  
  const formData = new FormData();
  formData.append('access_token', token);
  formData.append('batch', JSON.stringify(batchRequests));
  
  const response = await fetchWithRetry(
    'https://graph.facebook.com/v19.0/',
    'ENTITIES_BATCH',
    { method: 'POST', body: formData },
    60000
  );
  
  const campaigns: any[] = [];
  const adsets: any[] = [];
  const ads: any[] = [];
  
  if (Array.isArray(response)) {
    for (let i = 0; i < response.length; i++) {
      const item = response[i];
      if (item?.body) {
        try {
          const parsed = JSON.parse(item.body);
          if (parsed.data) {
            if (i === 0) campaigns.push(...parsed.data);
            else if (i === 1) adsets.push(...parsed.data);
            else if (i === 2) ads.push(...parsed.data);
          }
        } catch {
          // Skip unparseable responses
        }
      }
    }
  }
  
  // Handle pagination for large accounts
  const fetchRemainingPages = async (
    endpoint: string,
    existing: any[],
    max: number,
    token: string,
    name: string
  ): Promise<any[]> => {
    if (existing.length >= max) return existing.slice(0, max);
    
    // Check if there's pagination in the original response
    let nextUrl: string | null = null;
    
    // Try to get next page URL from the batch response
    const idx = endpoint.includes('campaigns') ? 0 : endpoint.includes('adsets') ? 1 : 2;
    if (Array.isArray(response) && response[idx]?.body) {
      try {
        const parsed = JSON.parse(response[idx].body);
        nextUrl = parsed.paging?.next || null;
      } catch {}
    }
    
    while (nextUrl && existing.length < max) {
      const pageData = await fetchWithRetry(nextUrl, `${name}_PAGE`);
      if (pageData.data && pageData.data.length > 0) {
        existing.push(...pageData.data);
      } else {
        break;
      }
      nextUrl = pageData.paging?.next || null;
      if (nextUrl) await delay(300);
    }
    
    return existing.slice(0, max);
  };
  
  const [finalCampaigns, finalAdsets, finalAds] = await Promise.all([
    fetchRemainingPages('campaigns', campaigns, MAX_CAMPAIGNS, token, 'CAMPAIGNS'),
    fetchRemainingPages('adsets', adsets, MAX_ADSETS, token, 'ADSETS'),
    fetchRemainingPages('ads', ads, MAX_ADS, token, 'ADS'),
  ]);
  
  console.log(`[ENTITIES] Campaigns: ${finalCampaigns.length}, Adsets: ${finalAdsets.length}, Ads: ${finalAds.length}`);
  
  return { campaigns: finalCampaigns, adsets: finalAdsets, ads: finalAds };
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

    const { project_id, ad_account_id, access_token, date_preset, time_range, period_key }: SyncRequest = await req.json();
    
    const timeRange = time_range || { 
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      until: new Date().toISOString().split('T')[0]
    };
    
    const finalPeriodKey = period_key || date_preset || 'last_30d';
    const token = access_token || metaAccessToken;

    if (!token || !project_id || !ad_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC] Period: ${finalPeriodKey}, Range: ${timeRange.since} to ${timeRange.until}`);

    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    // STEP 1: Fetch all entities using optimized batch
    const entities = await fetchEntitiesOptimized(ad_account_id, token);
    
    if (entities.campaigns.length === 0) {
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      return new Response(JSON.stringify({ success: false, error: 'No campaigns found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // STEP 2: Fetch insights using optimized method (batch or async)
    const insightsMap = await fetchInsightsOptimized(
      ad_account_id,
      token,
      timeRange,
      {
        campaigns: entities.campaigns.length,
        adsets: entities.adsets.length,
        ads: entities.ads.length,
      }
    );

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

    const campaignRecords = entities.campaigns.map(c => buildRecord(c, 'campaign'));
    const adSetRecords = entities.adsets.map(as => buildRecord(as, 'adset'));
    const adRecords = entities.ads.map(ad => buildRecord(ad, 'ad'));

    // STEP 4: Upsert to database in parallel
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
    console.log(`[COMPLETE] ${finalPeriodKey}: ${entities.campaigns.length}c/${entities.adsets.length}as/${entities.ads.length}ads, ${insightsMap.size} insights in ${elapsed}s`);

    await supabase.from('projects').update({ webhook_status: 'success', last_sync_at: new Date().toISOString() }).eq('id', project_id);
    
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: JSON.stringify({ period: finalPeriodKey, campaigns: entities.campaigns.length, adsets: entities.adsets.length, ads: entities.ads.length, insights: insightsMap.size, elapsed: elapsed + 's' }),
    });

    return new Response(
      JSON.stringify({ success: true, data: { period: finalPeriodKey, campaigns_count: entities.campaigns.length, ad_sets_count: entities.adsets.length, ads_count: entities.ads.length, insights_count: insightsMap.size, period_metrics_count: periodCount, elapsed_seconds: parseFloat(elapsed) } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC ERROR]', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
