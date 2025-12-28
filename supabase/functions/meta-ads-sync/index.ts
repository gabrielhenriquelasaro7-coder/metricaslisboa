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
    
    console.log('Using time parameter:', timeParam);

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

    console.log(`[FAST SYNC] Starting for project: ${project_id}, account: ${ad_account_id}`);
    const startTime = Date.now();

    // Update project status
    await supabase.from('projects').update({ webhook_status: 'syncing' }).eq('id', project_id);

    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';

    // STEP 1: Fetch ALL data SEQUENTIALLY to avoid rate limits
    console.log('[STEP 1] Fetching campaigns, adsets, and ads sequentially...');
    
    // Fetch campaigns first
    const campaignsRes = await fetch(`https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time&limit=500&access_token=${token}`);
    const campaignsData = await campaignsRes.json();
    
    if (campaignsData.error) {
      console.error('[ERROR] Campaigns fetch failed:', campaignsData.error);
      await supabase.from('projects').update({ webhook_status: 'error' }).eq('id', project_id);
      return new Response(
        JSON.stringify({ success: false, error: campaignsData.error.message, rate_limited: campaignsData.error.code === 17 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const campaigns = campaignsData.data || [];
    console.log(`[CAMPAIGNS] Found ${campaigns.length}`);
    
    // Add delay before fetching ad sets to avoid rate limits
    await delay(1000);
    
    // Fetch ad sets
    const adSetsRes = await fetch(`https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting&limit=500&access_token=${token}`);
    const adSetsData = await adSetsRes.json();
    
    let adSets: any[] = [];
    let adSetsError = false;
    if (adSetsData.error) {
      console.error('[ERROR] AdSets fetch failed:', adSetsData.error);
      adSetsError = true;
      // Try to continue, but we'll need to handle missing ad sets
    } else {
      adSets = adSetsData.data || [];
    }
    console.log(`[AD SETS] Found ${adSets.length}`);
    
    // Add delay before fetching ads
    await delay(1000);
    
    // Fetch ads
    const adsRes = await fetch(`https://graph.facebook.com/v19.0/${ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,thumbnail_url,title,body,call_to_action_type,image_url}&limit=500&access_token=${token}`);
    const adsData = await adsRes.json();
    
    let ads: any[] = [];
    let adsError = false;
    if (adsData.error) {
      console.error('[ERROR] Ads fetch failed:', adsData.error);
      adsError = true;
    } else {
      ads = adsData.data || [];
    }
    console.log(`[ADS] Found ${ads.length}`);

    console.log(`[STEP 1 DONE] Found ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads`);

    // STEP 2: Fetch insights for all entities
    console.log('[STEP 2] Fetching insights...');

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

    // Fetch insights in small batches with delays
    const fetchInsightsForEntities = async (entities: any[], entityType: string): Promise<Map<string, any>> => {
      const insightsMap = new Map<string, any>();
      const batches = chunk(entities, 5); // Small batches
      
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
        await delay(200); // Small delay between batches
      }
      
      return insightsMap;
    };

    // Fetch all insights
    const campaignInsightsMap = await fetchInsightsForEntities(campaigns, 'campaigns');
    const adSetInsightsMap = adSets.length > 0 ? await fetchInsightsForEntities(adSets, 'adsets') : new Map();
    const adInsightsMap = ads.length > 0 ? await fetchInsightsForEntities(ads, 'ads') : new Map();

    console.log('[STEP 2 DONE] All insights fetched');

    // STEP 3: DELETE OLD DATA AND UPSERT NEW DATA
    // This ensures we only show data for the current sync period
    console.log('[STEP 3] Clearing old data and upserting new data...');

    // Delete all existing data for this project BEFORE inserting new data
    // This ensures metrics are always for the selected period
    await Promise.all([
      supabase.from('campaigns').delete().eq('project_id', project_id),
      supabase.from('ad_sets').delete().eq('project_id', project_id),
      supabase.from('ads').delete().eq('project_id', project_id),
    ]);
    console.log('[STEP 3] Old data deleted');

    // Prepare campaign data
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

    // Prepare adset data
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

    // Prepare ad data
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

    // Insert all new data
    const insertResults = await Promise.all([
      campaignRecords.length > 0 ? supabase.from('campaigns').insert(campaignRecords) : Promise.resolve({ error: null }),
      adSetRecords.length > 0 ? supabase.from('ad_sets').insert(adSetRecords) : Promise.resolve({ error: null }),
      adRecords.length > 0 ? supabase.from('ads').insert(adRecords) : Promise.resolve({ error: null }),
    ]);

    // Check for insert errors
    const insertErrors = insertResults.filter(r => r.error);
    if (insertErrors.length > 0) {
      console.error('[INSERT ERRORS]', insertErrors.map(e => e.error));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC COMPLETE] ${campaigns.length} campaigns, ${adSets.length} adsets, ${ads.length} ads in ${elapsed}s`);

    // Update project status
    await supabase.from('projects').update({
      webhook_status: 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: `Sync: ${campaigns.length} campanhas, ${adSets.length} conjuntos, ${ads.length} anúncios em ${elapsed}s`,
    });

    // Return warning if ad sets couldn't be fetched
    const warnings = [];
    if (adSetsError) warnings.push('Ad sets could not be fetched due to API rate limits');
    if (adsError) warnings.push('Ads could not be fetched due to API rate limits');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          campaigns_count: campaigns.length,
          ad_sets_count: adSets.length,
          ads_count: ads.length,
          elapsed_seconds: parseFloat(elapsed),
          synced_at: new Date().toISOString(),
          warnings: warnings.length > 0 ? warnings : undefined,
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