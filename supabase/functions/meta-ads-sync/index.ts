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

// Fetch with single retry for rate limits
async function fetchWithRetry(url: string): Promise<any> {
  const res = await fetch(url);
  const data = await res.json();
  
  // Check for rate limit error (code 17) - wait and retry once
  if (data.error && data.error.code === 17) {
    console.log('[RATE LIMIT] Waiting 3s before single retry...');
    await delay(3000);
    const retryRes = await fetch(url);
    return await retryRes.json();
  }
  
  return data;
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

    // Update project status
    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';

    // STEP 1: Fetch campaigns
    console.log('[STEP 1/3] Fetching campaigns...');
    
    const campaignsData = await fetchWithRetry(
      `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time&limit=500&access_token=${token}`
    );
    
    if (campaignsData.error) {
      console.error('[ERROR] Campaigns fetch failed:', campaignsData.error);
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      
      const isRateLimit = campaignsData.error.code === 17;
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: isRateLimit 
            ? 'Limite de API da Meta atingido. Aguarde 1-2 minutos e tente novamente.'
            : campaignsData.error.message,
          rate_limited: isRateLimit,
          step: 'campaigns',
          keep_existing: isRateLimit
        }),
        { status: isRateLimit ? 429 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const campaigns = campaignsData.data || [];
    console.log(`[CAMPAIGNS] Found ${campaigns.length}`);
    
    // STEP 2: Fetch ad sets
    console.log('[STEP 2/3] Fetching ad sets...');
    const adSetsData = await fetchWithRetry(
      `https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting&limit=500&access_token=${token}`
    );
    
    let adSets: any[] = [];
    let adSetsRateLimited = false;
    
    if (adSetsData.error) {
      console.error('[ERROR] AdSets fetch failed:', adSetsData.error);
      adSetsRateLimited = adSetsData.error.code === 17;
      
      if (adSetsRateLimited) {
        console.log('[RATE LIMIT] Ad sets rate limited, keeping existing data');
        await supabase.from('projects').update({ webhook_status: 'partial' }).eq('id', project_id);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Limite de API da Meta atingido. Usando dados existentes. Aguarde 2 minutos.',
            rate_limited: true,
            keep_existing: true,
            step: 'adsets'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      adSets = adSetsData.data || [];
    }
    console.log(`[AD SETS] Found ${adSets.length}`);
    
    // STEP 3: Fetch ads
    console.log('[STEP 3/3] Fetching ads...');
    const adsData = await fetchWithRetry(
      `https://graph.facebook.com/v19.0/${ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url,title,body,call_to_action_type,image_url}&limit=500&access_token=${token}`
    );
    
    let ads: any[] = [];
    
    if (adsData.error) {
      console.error('[ERROR] Ads fetch failed:', adsData.error);
      if (adsData.error.code === 17) {
        console.log('[RATE LIMIT] Ads rate limited, continuing with what we have');
      }
    } else {
      ads = adsData.data || [];
    }
    console.log(`[ADS] Found ${ads.length}`);

    console.log(`[FETCH DONE] ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads`);

    // VALIDATION: Need at least campaigns
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

    // STEP 4: Fetch insights (batch with minimal delays)
    console.log('[STEP 4] Fetching insights...');

    // Helper to extract conversions
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

    // Fetch insights in batches of 10 with 200ms delay
    const fetchInsightsForEntities = async (entities: any[]): Promise<Map<string, any>> => {
      const insightsMap = new Map<string, any>();
      const batches = chunk(entities, 10);
      
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (entity: any) => {
            try {
              const res = await fetch(`https://graph.facebook.com/v19.0/${entity.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`);
              const data = await res.json();
              return { id: entity.id, insights: data.data?.[0] || null };
            } catch {
              return { id: entity.id, insights: null };
            }
          })
        );
        results.forEach(r => insightsMap.set(r.id, r.insights));
        await delay(200);
      }
      
      return insightsMap;
    };

    // Fetch all insights
    const campaignInsightsMap = await fetchInsightsForEntities(campaigns);
    const adSetInsightsMap = adSets.length > 0 ? await fetchInsightsForEntities(adSets) : new Map();
    const adInsightsMap = ads.length > 0 ? await fetchInsightsForEntities(ads) : new Map();

    console.log('[INSIGHTS DONE]');

    // Prepare all records
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
      return {
        id: ad.id,
        ad_set_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        project_id,
        name: ad.name,
        status: ad.status,
        creative_id: ad.creative?.id,
        creative_thumbnail: ad.creative?.thumbnail_url,
        creative_image_url: ad.creative?.image_url || null,
        headline: ad.creative?.title,
        primary_text: ad.creative?.body,
        cta: ad.creative?.call_to_action_type,
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

    // STEP 5: Delete old data and insert new
    console.log('[STEP 5] Replacing data...');

    await Promise.all([
      supabase.from('ads').delete().eq('project_id', project_id),
      supabase.from('ad_sets').delete().eq('project_id', project_id),
      supabase.from('campaigns').delete().eq('project_id', project_id),
    ]);

    const insertResults = await Promise.all([
      campaignRecords.length > 0 ? supabase.from('campaigns').insert(campaignRecords) : Promise.resolve({ error: null }),
      adSetRecords.length > 0 ? supabase.from('ad_sets').insert(adSetRecords) : Promise.resolve({ error: null }),
      adRecords.length > 0 ? supabase.from('ads').insert(adRecords) : Promise.resolve({ error: null }),
    ]);

    const insertErrors = insertResults.filter(r => r.error);
    if (insertErrors.length > 0) {
      console.error('[INSERT ERRORS]', insertErrors.map(e => e.error));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC COMPLETE] ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads in ${elapsed}s`);

    await supabase.from('projects').update({
      webhook_status: 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: `Sync: ${campaigns.length} campanhas, ${adSets.length} conjuntos, ${ads.length} anúncios em ${elapsed}s`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        step: 'complete',
        data: {
          campaigns_count: campaigns.length,
          ad_sets_count: adSets.length,
          ads_count: ads.length,
          elapsed_seconds: parseFloat(elapsed),
          synced_at: new Date().toISOString(),
        },
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
