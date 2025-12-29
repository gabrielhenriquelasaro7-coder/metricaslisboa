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

// LIMITS - Conservative to avoid rate limits
const MAX_CAMPAIGNS = 200;
const MAX_ADSETS = 400;
const MAX_ADS = 600;

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to batch array into chunks
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Simple fetch with timeout
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

// Fetch pages with delays between requests
async function fetchAllPages(baseUrl: string, token: string, entityName: string, maxItems: number): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = `${baseUrl}&limit=100&access_token=${token}`;
  let pageCount = 0;
  const maxPages = Math.ceil(maxItems / 100);
  
  while (nextUrl && pageCount < maxPages && allData.length < maxItems) {
    pageCount++;
    console.log(`[${entityName}] Page ${pageCount}...`);
    
    const data = await simpleFetch(nextUrl);
    
    if (data.error) {
      console.error(`[${entityName}] Error:`, data.error.message);
      break;
    }
    
    if (data.data && data.data.length > 0) {
      allData.push(...data.data);
      console.log(`[${entityName}] Got ${allData.length} items`);
    } else {
      break;
    }
    
    nextUrl = data.paging?.next || null;
    
    if (nextUrl && allData.length < maxItems) {
      await delay(1000); // 1s delay between pages
    }
  }
  
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

    console.log(`[SYNC] Starting: ${project_id}, period: ${finalPeriodKey}`);
    if (time_range) {
      console.log(`[SYNC] Date range: ${time_range.since} to ${time_range.until}`);
    }

    // Update project status
    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    // ============ STEP 1: CAMPAIGNS ============
    console.log('[STEP 1/4] Fetching campaigns...');
    
    const campaigns = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget`,
      token,
      'CAMPAIGNS',
      MAX_CAMPAIGNS
    );
    
    console.log(`[CAMPAIGNS] Total: ${campaigns.length}`);
    
    if (campaigns.length === 0) {
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      return new Response(
        JSON.stringify({ success: false, error: 'No campaigns found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await delay(2000);

    // ============ STEP 2: AD SETS ============
    console.log('[STEP 2/4] Fetching ad sets...');
    
    const adSets = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget`,
      token,
      'AD_SETS',
      MAX_ADSETS
    );
    
    console.log(`[AD_SETS] Total: ${adSets.length}`);

    await delay(2000);

    // ============ STEP 3: ADS ============
    console.log('[STEP 3/4] Fetching ads...');
    
    const ads = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url}`,
      token,
      'ADS',
      MAX_ADS
    );
    
    console.log(`[ADS] Total: ${ads.length}`);

    await delay(2000);

    // ============ STEP 4: INSIGHTS (BATCH) ============
    console.log('[STEP 4/4] Fetching insights (batch)...');
    
    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';
    const insightsMap = new Map<string, any>();
    
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

    // Get ALL entity IDs for batch insights
    const allEntityIds = [
      ...campaigns.map(c => c.id),
      ...adSets.map(as => as.id),
      ...ads.map(ad => ad.id),
    ];
    
    console.log(`[INSIGHTS] Total entities: ${allEntityIds.length}`);
    
    // Fetch insights in batches of 50 using filtering
    const batches = chunk(allEntityIds, 50);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const idsFilter = batch.join(',');
      
      // Use the account-level insights with filtering by IDs
      const url = `https://graph.facebook.com/v19.0/${ad_account_id}/insights?fields=${insightsFields}&${timeParam}&level=ad&filtering=[{"field":"ad.id","operator":"IN","value":[${batch.map(id => `"${id}"`).join(',')}]}]&access_token=${token}`;
      
      const data = await simpleFetch(url);
      
      if (data.data) {
        for (const insight of data.data) {
          if (insight.ad_id) {
            insightsMap.set(insight.ad_id, insight);
          }
        }
      }
      
      // Also try campaign-level and adset-level for those entities
      const campaignIds = batch.filter(id => campaigns.some(c => c.id === id));
      const adSetIds = batch.filter(id => adSets.some(as => as.id === id));
      
      // Fetch campaign insights
      if (campaignIds.length > 0) {
        for (const cid of campaignIds) {
          const cData = await simpleFetch(
            `https://graph.facebook.com/v19.0/${cid}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`
          );
          if (cData.data?.[0]) {
            insightsMap.set(cid, cData.data[0]);
          }
          await delay(200);
        }
      }
      
      // Fetch adset insights
      if (adSetIds.length > 0) {
        for (const asid of adSetIds) {
          const asData = await simpleFetch(
            `https://graph.facebook.com/v19.0/${asid}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`
          );
          if (asData.data?.[0]) {
            insightsMap.set(asid, asData.data[0]);
          }
          await delay(200);
        }
      }
      
      console.log(`[INSIGHTS] Batch ${i + 1}/${batches.length}: ${insightsMap.size} total`);
      
      // Delay between batches
      if (i < batches.length - 1) {
        await delay(2000);
      }
    }
    
    console.log(`[INSIGHTS] Got ${insightsMap.size} insights total`);

    // ============ SAVE DATA ============
    console.log('[SAVING] Building records...');
    
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

    // ============ SAVE PERIOD METRICS ============
    console.log(`[PERIOD_METRICS] Saving for period: ${finalPeriodKey}`);
    
    const createPeriodRecord = (type: string, record: any) => ({
      project_id,
      period_key: finalPeriodKey,
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
        campaign_id: record.campaign_id,
        ad_set_id: record.ad_set_id,
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
    
    console.log(`[PERIOD_METRICS] Saved ${periodCount} records`);

    // ============ COMPLETE ============
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[COMPLETE] ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads in ${elapsed}s`);

    // Update project status
    await supabase.from('projects').update({
      webhook_status: 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    // Save sync log
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: JSON.stringify({
        period: finalPeriodKey,
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
          period: finalPeriodKey,
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
    console.error('[SYNC ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
