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
}> {
  const campaigns: any[] = [];
  const adsets: any[] = [];
  const ads: any[] = [];

  // Fetch campaigns
  let url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'CAMPAIGNS');
    if (data.data) campaigns.push(...data.data);
    url = data.paging?.next || null;
  }

  // Fetch adsets
  url = `https://graph.facebook.com/v19.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget&limit=500&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADSETS');
    if (data.data) adsets.push(...data.data);
    url = data.paging?.next || null;
  }

  // Fetch ads
  url = `https://graph.facebook.com/v19.0/${adAccountId}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url}&limit=500&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADS');
    if (data.data) ads.push(...data.data);
    url = data.paging?.next || null;
  }

  console.log(`[ENTITIES] Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}`);
  return { campaigns, adsets, ads };
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
  
  const fields = 'ad_id,adset_id,campaign_id,date_start,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';
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
function extractConversions(insights: any): { conversions: number; conversionValue: number } {
  let conversions = 0, conversionValue = 0;
  const types = ['purchase', 'omni_purchase', 'lead', 'contact', 'offsite_conversion.fb_pixel_lead'];
  
  if (insights?.actions) {
    for (const t of types) {
      const a = insights.actions.find((x: any) => x.action_type === t);
      if (a && parseInt(a.value) > 0) { 
        conversions = parseInt(a.value); 
        break; 
      }
    }
  }
  if (insights?.action_values) {
    const pv = insights.action_values.find((x: any) => x.action_type === 'purchase' || x.action_type === 'omni_purchase');
    conversionValue = parseFloat(pv?.value || '0');
  }
  return { conversions, conversionValue };
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

    // STEP 1: Fetch all entities
    const entities = await fetchEntities(ad_account_id, token);
    
    if (entities.campaigns.length === 0) {
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      return new Response(JSON.stringify({ success: false, error: 'No campaigns found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build entity maps for quick lookup
    const campaignMap = new Map(entities.campaigns.map(c => [c.id, c]));
    const adsetMap = new Map(entities.adsets.map(a => [a.id, a]));
    const adMap = new Map(entities.ads.map(a => [a.id, a]));

    // STEP 2: Fetch daily insights (time_increment=1)
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);

    // STEP 3: Build daily records for ads_daily_metrics
    const dailyRecords: any[] = [];
    
    for (const [adId, dateMap] of dailyInsights) {
      const ad = adMap.get(adId);
      if (!ad) continue;
      
      const adset = adsetMap.get(ad.adset_id);
      const campaign = campaignMap.get(ad.campaign_id);
      
      for (const [dateKey, insights] of dateMap) {
        const { conversions, conversionValue } = extractConversions(insights);
        const spend = parseFloat(insights.spend || '0');
        const impressions = parseInt(insights.impressions || '0');
        const clicks = parseInt(insights.clicks || '0');
        const reach = parseInt(insights.reach || '0');
        
        dailyRecords.push({
          project_id,
          ad_account_id,
          date: dateKey,
          
          campaign_id: ad.campaign_id,
          campaign_name: campaign?.name || 'Unknown',
          campaign_status: campaign?.status || 'UNKNOWN',
          campaign_objective: campaign?.objective || null,
          
          adset_id: ad.adset_id,
          adset_name: adset?.name || 'Unknown',
          adset_status: adset?.status || 'UNKNOWN',
          
          ad_id: adId,
          ad_name: ad.name,
          ad_status: ad.status || 'UNKNOWN',
          
          creative_id: ad.creative?.id || null,
          creative_thumbnail: ad.creative?.thumbnail_url || null,
          
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
        adAggregates.set(record.ad_id, {
          id: record.ad_id,
          project_id,
          campaign_id: record.campaign_id,
          ad_set_id: record.adset_id,
          name: record.ad_name,
          status: record.ad_status,
          creative_id: record.creative_id,
          creative_thumbnail: record.creative_thumbnail,
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
