import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

async function getAccessToken(credentials: GoogleAdsCredentials): Promise<string> {
  console.log('Getting access token from Google...');
  console.log('Client ID prefix:', credentials.clientId?.substring(0, 20) + '...');
  console.log('Refresh token prefix:', credentials.refreshToken?.substring(0, 15) + '...');
  
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: 'refresh_token',
  });
  
  console.log('Request body keys:', [...body.keys()].join(', '));
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error('Failed to get access token. Status:', response.status);
    console.error('Response:', responseText);
    throw new Error(`Failed to get access token: ${responseText}`);
  }

  const data: TokenResponse = JSON.parse(responseText);
  console.log('Access token obtained successfully');
  return data.access_token;
}

async function executeGoogleAdsQuery(
  accessToken: string,
  credentials: GoogleAdsCredentials,
  query: string
): Promise<any[]> {
  const customerId = credentials.customerId.replace(/-/g, '');
  const url = `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`;
  
  console.log('Executing Google Ads query:', query.substring(0, 100) + '...');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': credentials.developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Ads API error:', error);
    throw new Error(`Google Ads API error: ${error}`);
  }

  const results: any[] = [];
  const text = await response.text();
  
  // Parse streaming response (NDJSON format)
  const lines = text.split('\n').filter(line => line.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.results) {
        results.push(...parsed.results);
      }
    } catch (e) {
      // Skip non-JSON lines
    }
  }
  
  console.log(`Query returned ${results.length} results`);
  return results;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateRange(days: number = 30): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

async function syncCampaigns(
  supabase: any,
  accessToken: string,
  credentials: GoogleAdsCredentials,
  projectId: string
): Promise<void> {
  console.log('Syncing campaigns...');
  
  const { startDate, endDate } = getDateRange(30);
  
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign_budget.amount_micros,
      campaign_budget.type,
      campaign.start_date,
      campaign.end_date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.average_cpm
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);
  
  const campaignsMap = new Map();
  
  for (const result of results) {
    const campaignId = result.campaign?.id;
    if (!campaignId) continue;
    
    const existing = campaignsMap.get(campaignId);
    const costMicros = parseInt(result.metrics?.costMicros || '0');
    const impressions = parseInt(result.metrics?.impressions || '0');
    const clicks = parseInt(result.metrics?.clicks || '0');
    const conversions = parseFloat(result.metrics?.conversions || '0');
    const conversionValue = parseFloat(result.metrics?.conversionsValue || '0');
    
    if (existing) {
      existing.spend += costMicros / 1000000;
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.conversions += conversions;
      existing.conversion_value += conversionValue;
    } else {
      campaignsMap.set(campaignId, {
        id: campaignId,
        project_id: projectId,
        name: result.campaign?.name || 'Unknown',
        status: result.campaign?.status || 'UNKNOWN',
        campaign_type: result.campaign?.advertisingChannelType,
        bidding_strategy: result.campaign?.biddingStrategyType,
        budget_amount: parseInt(result.campaignBudget?.amountMicros || '0') / 1000000,
        budget_type: result.campaignBudget?.type,
        start_date: result.campaign?.startDate,
        end_date: result.campaign?.endDate,
        spend: costMicros / 1000000,
        impressions,
        clicks,
        conversions,
        conversion_value: conversionValue,
        synced_at: new Date().toISOString(),
      });
    }
  }
  
  const campaigns = Array.from(campaignsMap.values()).map(c => {
    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
    const cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
    const costPerConversion = c.conversions > 0 ? c.spend / c.conversions : 0;
    const roas = c.spend > 0 ? c.conversion_value / c.spend : 0;
    
    return {
      ...c,
      ctr,
      cpc,
      cpm,
      cost_per_conversion: costPerConversion,
      roas,
    };
  });
  
  if (campaigns.length > 0) {
    const { error } = await supabase
      .from('google_campaigns')
      .upsert(campaigns, { onConflict: 'id' });
    
    if (error) {
      console.error('Error upserting campaigns:', error);
      throw error;
    }
    
    console.log(`Synced ${campaigns.length} campaigns`);
  }
}

async function syncAdGroups(
  supabase: any,
  accessToken: string,
  credentials: GoogleAdsCredentials,
  projectId: string
): Promise<void> {
  console.log('Syncing ad groups...');
  
  const { startDate, endDate } = getDateRange(30);
  
  const query = `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.campaign,
      ad_group.cpc_bid_micros,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM ad_group
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND ad_group.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);
  
  const adGroupsMap = new Map();
  
  for (const result of results) {
    const adGroupId = result.adGroup?.id;
    if (!adGroupId) continue;
    
    const existing = adGroupsMap.get(adGroupId);
    const costMicros = parseInt(result.metrics?.costMicros || '0');
    const impressions = parseInt(result.metrics?.impressions || '0');
    const clicks = parseInt(result.metrics?.clicks || '0');
    const conversions = parseFloat(result.metrics?.conversions || '0');
    const conversionValue = parseFloat(result.metrics?.conversionsValue || '0');
    
    // Extract campaign ID from resource name
    const campaignResource = result.adGroup?.campaign || '';
    const campaignId = campaignResource.split('/').pop() || '';
    
    if (existing) {
      existing.spend += costMicros / 1000000;
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.conversions += conversions;
      existing.conversion_value += conversionValue;
    } else {
      adGroupsMap.set(adGroupId, {
        id: adGroupId,
        campaign_id: campaignId,
        project_id: projectId,
        name: result.adGroup?.name || 'Unknown',
        status: result.adGroup?.status || 'UNKNOWN',
        cpc_bid: parseInt(result.adGroup?.cpcBidMicros || '0') / 1000000,
        spend: costMicros / 1000000,
        impressions,
        clicks,
        conversions,
        conversion_value: conversionValue,
        synced_at: new Date().toISOString(),
      });
    }
  }
  
  const adGroups = Array.from(adGroupsMap.values()).map(ag => {
    const ctr = ag.impressions > 0 ? (ag.clicks / ag.impressions) * 100 : 0;
    const cpc = ag.clicks > 0 ? ag.spend / ag.clicks : 0;
    const cpm = ag.impressions > 0 ? (ag.spend / ag.impressions) * 1000 : 0;
    const costPerConversion = ag.conversions > 0 ? ag.spend / ag.conversions : 0;
    const roas = ag.spend > 0 ? ag.conversion_value / ag.spend : 0;
    
    return {
      ...ag,
      ctr,
      cpc,
      cpm,
      cost_per_conversion: costPerConversion,
      roas,
    };
  });
  
  if (adGroups.length > 0) {
    const { error } = await supabase
      .from('google_ad_groups')
      .upsert(adGroups, { onConflict: 'id' });
    
    if (error) {
      console.error('Error upserting ad groups:', error);
      throw error;
    }
    
    console.log(`Synced ${adGroups.length} ad groups`);
  }
}

async function syncDailyMetrics(
  supabase: any,
  accessToken: string,
  credentials: GoogleAdsCredentials,
  projectId: string,
  days: number = 30
): Promise<number> {
  console.log(`Syncing daily metrics for last ${days} days...`);
  
  const { startDate, endDate } = getDateRange(days);
  const customerId = credentials.customerId.replace(/-/g, '');
  
  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.average_cpm,
      metrics.search_impression_share
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);
  
  const metricsToUpsert = results.map(result => {
    const costMicros = parseInt(result.metrics?.costMicros || '0');
    const impressions = parseInt(result.metrics?.impressions || '0');
    const clicks = parseInt(result.metrics?.clicks || '0');
    const conversions = parseFloat(result.metrics?.conversions || '0');
    const conversionValue = parseFloat(result.metrics?.conversionsValue || '0');
    const spend = costMicros / 1000000;
    
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const costPerConversion = conversions > 0 ? spend / conversions : 0;
    const roas = spend > 0 ? conversionValue / spend : 0;
    
    return {
      project_id: projectId,
      date: result.segments?.date,
      customer_id: customerId,
      campaign_id: result.campaign?.id || '',
      campaign_name: result.campaign?.name || 'Unknown',
      campaign_status: result.campaign?.status,
      campaign_type: result.campaign?.advertisingChannelType,
      ad_group_id: result.adGroup?.id || '',
      ad_group_name: result.adGroup?.name || 'Unknown',
      ad_group_status: result.adGroup?.status,
      ad_id: result.adGroupAd?.ad?.id || '',
      ad_name: result.adGroupAd?.ad?.name || 'Unknown Ad',
      ad_status: result.adGroupAd?.status,
      spend,
      impressions,
      clicks,
      conversions,
      conversion_value: conversionValue,
      ctr,
      cpc,
      cpm,
      cost_per_conversion: costPerConversion,
      roas,
      search_impression_share: result.metrics?.searchImpressionShare,
      synced_at: new Date().toISOString(),
    };
  }).filter(m => m.date && m.ad_id);
  
  if (metricsToUpsert.length > 0) {
    // Upsert in batches of 500
    const batchSize = 500;
    for (let i = 0; i < metricsToUpsert.length; i += batchSize) {
      const batch = metricsToUpsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('google_ads_daily_metrics')
        .upsert(batch, { 
          onConflict: 'project_id,date,ad_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error('Error upserting daily metrics batch:', error);
        throw error;
      }
      
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(metricsToUpsert.length / batchSize)}`);
    }
    
    console.log(`Synced ${metricsToUpsert.length} daily metrics`);
  }
  
  return metricsToUpsert.length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId, syncType = 'full', days = 30 } = await req.json();

    if (!projectId) {
      throw new Error('projectId is required');
    }

    console.log(`Starting Google Ads sync for project ${projectId}, type: ${syncType}`);

    // Get project to fetch google_customer_id
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('google_customer_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Error fetching project:', projectError);
      throw new Error('Project not found');
    }

    const googleCustomerId = project?.google_customer_id;
    if (!googleCustomerId) {
      throw new Error('Google Customer ID not configured for this project. Please add it in project settings.');
    }

    // Get credentials from environment (MCC credentials are global)
    const credentials: GoogleAdsCredentials = {
      clientId: Deno.env.get('GOOGLE_ADS_CLIENT_ID')!,
      clientSecret: Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!,
      developerToken: Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
      refreshToken: Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN')!,
      customerId: googleCustomerId, // Use project's customer ID
    };

    // Validate credentials
    if (!credentials.clientId || !credentials.clientSecret || !credentials.developerToken || 
        !credentials.refreshToken) {
      throw new Error('Missing Google Ads MCC credentials. Please configure all required secrets.');
    }

    // Get access token
    const accessToken = await getAccessToken(credentials);

    let recordsCount = 0;

    // Sync based on type
    if (syncType === 'full' || syncType === 'campaigns') {
      await syncCampaigns(supabase, accessToken, credentials, projectId);
    }
    
    if (syncType === 'full' || syncType === 'ad_groups') {
      await syncAdGroups(supabase, accessToken, credentials, projectId);
    }
    
    if (syncType === 'full' || syncType === 'metrics') {
      recordsCount = await syncDailyMetrics(supabase, accessToken, credentials, projectId, days);
    }

    // Log sync
    await supabase.from('sync_logs').insert({
      project_id: projectId,
      status: 'success',
      message: `Google Ads sync completed. Type: ${syncType}, Records: ${recordsCount}`,
    });

    console.log('Google Ads sync completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sync completed',
        recordsCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in google-ads-sync:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
