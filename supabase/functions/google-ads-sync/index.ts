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
  loginCustomerId: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

async function getAccessToken(credentials: GoogleAdsCredentials): Promise<string> {
  console.log('Getting access token from Google...');
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error('Failed to get access token:', responseText);
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
  const loginId = credentials.loginCustomerId?.replace(/-/g, '') || '';
  const url = `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`;

  console.log(`Executing query for customer=${customerId}, login-customer-id=${loginId}`);
  console.log('Query:', query.substring(0, 150));

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': credentials.developerToken,
    'Content-Type': 'application/json',
  };
  if (loginId) headers['login-customer-id'] = loginId;

  const allResults: any[] = [];
  let pageToken: string | undefined;

  do {
    const body: any = { query };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) {
      const error = await response.text();
      console.error('Google Ads API error:', error);
      throw new Error(`Google Ads API error: ${error}`);
    }

    const data = await response.json();
    console.log(`Page returned ${data.results?.length || 0} results`);
    if (data.results) allResults.push(...data.results);
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Total results: ${allResults.length}`);
  return allResults;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateRange(days: number = 30): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
}

// ==================== SYNC CAMPAIGNS ====================
async function syncCampaigns(supabase: any, accessToken: string, credentials: GoogleAdsCredentials, projectId: string): Promise<void> {
  console.log('Syncing campaigns...');
  const { startDate, endDate } = getDateRange(30);

  const query = `
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type,
      campaign_budget.amount_micros, campaign_budget.type,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc, metrics.average_cpm
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);
  const map = new Map();

  for (const r of results) {
    const id = r.campaign?.id;
    if (!id) continue;
    const cost = parseInt(r.metrics?.costMicros || '0') / 1000000;
    const imp = parseInt(r.metrics?.impressions || '0');
    const cl = parseInt(r.metrics?.clicks || '0');
    const conv = Math.round(parseFloat(r.metrics?.conversions || '0'));
    const val = parseFloat(r.metrics?.conversionsValue || '0');

    if (map.has(id)) {
      const e = map.get(id);
      e.spend += cost; e.impressions += imp; e.clicks += cl; e.conversions += conv; e.conversion_value += val;
    } else {
      map.set(id, {
        id, project_id: projectId, name: r.campaign?.name || 'Unknown', status: r.campaign?.status || 'UNKNOWN',
        campaign_type: r.campaign?.advertisingChannelType, bidding_strategy: r.campaign?.biddingStrategyType,
        budget_amount: parseInt(r.campaignBudget?.amountMicros || '0') / 1000000, budget_type: r.campaignBudget?.type,
        start_date: null, end_date: null, spend: cost, impressions: imp, clicks: cl, conversions: conv,
        conversion_value: val, synced_at: new Date().toISOString(),
      });
    }
  }

  const campaigns = Array.from(map.values()).map(c => ({
    ...c,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
    cost_per_conversion: c.conversions > 0 ? c.spend / c.conversions : 0,
    roas: c.spend > 0 ? c.conversion_value / c.spend : 0,
  }));

  if (campaigns.length > 0) {
    const { error } = await supabase.from('google_campaigns').upsert(campaigns, { onConflict: 'id' });
    if (error) { console.error('Error upserting campaigns:', error); throw error; }
    console.log(`Synced ${campaigns.length} campaigns`);
  }
}

// ==================== SYNC AD GROUPS ====================
async function syncAdGroups(supabase: any, accessToken: string, credentials: GoogleAdsCredentials, projectId: string): Promise<void> {
  console.log('Syncing ad groups...');
  const { startDate, endDate } = getDateRange(30);

  const query = `
    SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign, ad_group.cpc_bid_micros,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM ad_group
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND ad_group.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);
  const map = new Map();

  for (const r of results) {
    const id = r.adGroup?.id;
    if (!id) continue;
    const campaignId = (r.adGroup?.campaign || '').split('/').pop() || '';
    const cost = parseInt(r.metrics?.costMicros || '0') / 1000000;
    const imp = parseInt(r.metrics?.impressions || '0');
    const cl = parseInt(r.metrics?.clicks || '0');
    const conv = Math.round(parseFloat(r.metrics?.conversions || '0'));
    const val = parseFloat(r.metrics?.conversionsValue || '0');

    if (map.has(id)) {
      const e = map.get(id);
      e.spend += cost; e.impressions += imp; e.clicks += cl; e.conversions += conv; e.conversion_value += val;
    } else {
      map.set(id, {
        id, campaign_id: campaignId, project_id: projectId, name: r.adGroup?.name || 'Unknown',
        status: r.adGroup?.status || 'UNKNOWN', cpc_bid: parseInt(r.adGroup?.cpcBidMicros || '0') / 1000000,
        spend: cost, impressions: imp, clicks: cl, conversions: conv, conversion_value: val, synced_at: new Date().toISOString(),
      });
    }
  }

  const adGroups = Array.from(map.values()).map(ag => ({
    ...ag,
    ctr: ag.impressions > 0 ? (ag.clicks / ag.impressions) * 100 : 0,
    cpc: ag.clicks > 0 ? ag.spend / ag.clicks : 0,
    cpm: ag.impressions > 0 ? (ag.spend / ag.impressions) * 1000 : 0,
    cost_per_conversion: ag.conversions > 0 ? ag.spend / ag.conversions : 0,
    roas: ag.spend > 0 ? ag.conversion_value / ag.spend : 0,
  }));

  if (adGroups.length > 0) {
    const { error } = await supabase.from('google_ad_groups').upsert(adGroups, { onConflict: 'id' });
    if (error) { console.error('Error upserting ad groups:', error); throw error; }
    console.log(`Synced ${adGroups.length} ad groups`);
  }
}

// ==================== SYNC ADS ====================
async function syncAds(supabase: any, accessToken: string, credentials: GoogleAdsCredentials, projectId: string): Promise<void> {
  console.log('Syncing individual ads...');
  const { startDate, endDate } = getDateRange(30);

  const query = `
    SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status,
      ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.expanded_text_ad.headline_part1, ad_group_ad.ad.expanded_text_ad.headline_part2, ad_group_ad.ad.expanded_text_ad.description,
      ad_group.id, ad_group.campaign,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);
  const map = new Map();

  for (const r of results) {
    const adId = r.adGroupAd?.ad?.id;
    if (!adId) continue;
    const adGroupId = r.adGroup?.id || '';
    const campaignId = (r.adGroup?.campaign || '').split('/').pop() || '';
    const cost = parseInt(r.metrics?.costMicros || '0') / 1000000;
    const imp = parseInt(r.metrics?.impressions || '0');
    const cl = parseInt(r.metrics?.clicks || '0');
    const conv = Math.round(parseFloat(r.metrics?.conversions || '0'));
    const val = parseFloat(r.metrics?.conversionsValue || '0');

    // Extract headlines and descriptions
    let headlines: string[] = [];
    let descriptions: string[] = [];
    const rsa = r.adGroupAd?.ad?.responsiveSearchAd;
    if (rsa?.headlines) {
      headlines = rsa.headlines.map((h: any) => h.text).filter(Boolean);
    }
    if (rsa?.descriptions) {
      descriptions = rsa.descriptions.map((d: any) => d.text).filter(Boolean);
    }
    // Fallback to expanded text ad
    const eta = r.adGroupAd?.ad?.expandedTextAd;
    if (headlines.length === 0 && eta) {
      if (eta.headlinePart1) headlines.push(eta.headlinePart1);
      if (eta.headlinePart2) headlines.push(eta.headlinePart2);
    }
    if (descriptions.length === 0 && eta?.description) {
      descriptions.push(eta.description);
    }

    if (map.has(adId)) {
      const e = map.get(adId);
      e.spend += cost; e.impressions += imp; e.clicks += cl; e.conversions += conv; e.conversion_value += val;
    } else {
      map.set(adId, {
        id: adId, ad_group_id: adGroupId, campaign_id: campaignId, project_id: projectId,
        name: r.adGroupAd?.ad?.name || `Ad ${adId}`, status: r.adGroupAd?.status || 'UNKNOWN',
        ad_type: r.adGroupAd?.ad?.type || null,
        final_urls: r.adGroupAd?.ad?.finalUrls || null,
        headlines: headlines.length > 0 ? headlines : null,
        descriptions: descriptions.length > 0 ? descriptions : null,
        spend: cost, impressions: imp, clicks: cl, conversions: conv, conversion_value: val,
        synced_at: new Date().toISOString(),
      });
    }
  }

  const ads = Array.from(map.values()).map(a => ({
    ...a,
    ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
    cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
    cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
    cost_per_conversion: a.conversions > 0 ? a.spend / a.conversions : 0,
    roas: a.spend > 0 ? a.conversion_value / a.spend : 0,
  }));

  if (ads.length > 0) {
    const { error } = await supabase.from('google_ads').upsert(ads, { onConflict: 'id' });
    if (error) { console.error('Error upserting ads:', error); throw error; }
    console.log(`Synced ${ads.length} ads`);
  }
}

// ==================== SYNC KEYWORDS ====================
async function syncKeywords(supabase: any, accessToken: string, credentials: GoogleAdsCredentials, projectId: string): Promise<void> {
  console.log('Syncing keywords...');
  const { startDate, endDate } = getDateRange(30);

  const query = `
    SELECT keyword_view.resource_name,
      ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
      ad_group_criterion.status, ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.post_click_quality_score,
      ad_group_criterion.quality_info.search_predicted_ctr,
      ad_group.id, ad_group.name, ad_group.campaign,
      campaign.id, campaign.name,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value,
      metrics.search_impression_share
    FROM keyword_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);
  const map = new Map();

  for (const r of results) {
    const text = r.adGroupCriterion?.keyword?.text;
    if (!text) continue;
    const adGroupId = r.adGroup?.id || '';
    const campaignId = r.campaign?.id || '';
    const key = `${adGroupId}_${text}_${r.adGroupCriterion?.keyword?.matchType || ''}`;
    const cost = parseInt(r.metrics?.costMicros || '0') / 1000000;
    const imp = parseInt(r.metrics?.impressions || '0');
    const cl = parseInt(r.metrics?.clicks || '0');
    const conv = Math.round(parseFloat(r.metrics?.conversions || '0'));
    const val = parseFloat(r.metrics?.conversionsValue || '0');

    if (map.has(key)) {
      const e = map.get(key);
      e.spend += cost; e.impressions += imp; e.clicks += cl; e.conversions += conv; e.conversion_value += val;
    } else {
      map.set(key, {
        project_id: projectId, campaign_id: campaignId, campaign_name: r.campaign?.name,
        ad_group_id: adGroupId, ad_group_name: r.adGroup?.name,
        keyword_text: text, match_type: r.adGroupCriterion?.keyword?.matchType,
        status: r.adGroupCriterion?.status,
        quality_score: r.adGroupCriterion?.qualityInfo?.qualityScore || null,
        expected_ctr: r.adGroupCriterion?.qualityInfo?.searchPredictedCtr || null,
        ad_relevance: r.adGroupCriterion?.qualityInfo?.creativeQualityScore || null,
        landing_page_experience: r.adGroupCriterion?.qualityInfo?.postClickQualityScore || null,
        spend: cost, impressions: imp, clicks: cl, conversions: conv, conversion_value: val,
        search_impression_share: r.metrics?.searchImpressionShare ? parseFloat(r.metrics.searchImpressionShare) : null,
        synced_at: new Date().toISOString(),
      });
    }
  }

  const keywords = Array.from(map.values()).map(k => ({
    ...k,
    ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
    cpc: k.clicks > 0 ? k.spend / k.clicks : 0,
    cpm: k.impressions > 0 ? (k.spend / k.impressions) * 1000 : 0,
    cost_per_conversion: k.conversions > 0 ? k.spend / k.conversions : 0,
  }));

  if (keywords.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const { error } = await supabase.from('google_keywords').upsert(batch, { 
        onConflict: 'project_id,ad_group_id,keyword_text,match_type' 
      });
      if (error) { console.error('Error upserting keywords:', error); throw error; }
    }
    console.log(`Synced ${keywords.length} keywords`);
  }
}

// ==================== SYNC DEMOGRAPHICS ====================
async function syncDemographics(supabase: any, accessToken: string, credentials: GoogleAdsCredentials, projectId: string): Promise<void> {
  console.log('Syncing demographics...');
  const { startDate, endDate } = getDateRange(30);
  const allDemos: any[] = [];

  // Age
  try {
    const ageQuery = `
      SELECT segments.date, ad_group_criterion.age_range.type,
        metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
      FROM age_range_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'
    `;
    const ageResults = await executeGoogleAdsQuery(accessToken, credentials, ageQuery);
    for (const r of ageResults) {
      allDemos.push({
        project_id: projectId, date: r.segments?.date,
        breakdown_type: 'age', breakdown_value: r.adGroupCriterion?.ageRange?.type || 'UNKNOWN',
        spend: parseInt(r.metrics?.costMicros || '0') / 1000000,
        impressions: parseInt(r.metrics?.impressions || '0'),
        clicks: parseInt(r.metrics?.clicks || '0'),
        conversions: Math.round(parseFloat(r.metrics?.conversions || '0')),
        conversion_value: parseFloat(r.metrics?.conversionsValue || '0'),
        synced_at: new Date().toISOString(),
      });
    }
    console.log(`Got ${ageResults.length} age rows`);
  } catch (e) { console.error('Error fetching age data:', e); }

  // Gender
  try {
    const genderQuery = `
      SELECT segments.date, ad_group_criterion.gender.type,
        metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
      FROM gender_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'
    `;
    const genderResults = await executeGoogleAdsQuery(accessToken, credentials, genderQuery);
    for (const r of genderResults) {
      allDemos.push({
        project_id: projectId, date: r.segments?.date,
        breakdown_type: 'gender', breakdown_value: r.adGroupCriterion?.gender?.type || 'UNKNOWN',
        spend: parseInt(r.metrics?.costMicros || '0') / 1000000,
        impressions: parseInt(r.metrics?.impressions || '0'),
        clicks: parseInt(r.metrics?.clicks || '0'),
        conversions: Math.round(parseFloat(r.metrics?.conversions || '0')),
        conversion_value: parseFloat(r.metrics?.conversionsValue || '0'),
        synced_at: new Date().toISOString(),
      });
    }
    console.log(`Got ${genderResults.length} gender rows`);
  } catch (e) { console.error('Error fetching gender data:', e); }

  // Device
  try {
    const deviceQuery = `
      SELECT segments.date, segments.device,
        metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'
    `;
    const deviceResults = await executeGoogleAdsQuery(accessToken, credentials, deviceQuery);
    // Aggregate by date+device
    const deviceMap = new Map();
    for (const r of deviceResults) {
      const key = `${r.segments?.date}_${r.segments?.device}`;
      const cost = parseInt(r.metrics?.costMicros || '0') / 1000000;
      const imp = parseInt(r.metrics?.impressions || '0');
      const cl = parseInt(r.metrics?.clicks || '0');
      const conv = Math.round(parseFloat(r.metrics?.conversions || '0'));
      const val = parseFloat(r.metrics?.conversionsValue || '0');
      if (deviceMap.has(key)) {
        const e = deviceMap.get(key);
        e.spend += cost; e.impressions += imp; e.clicks += cl; e.conversions += conv; e.conversion_value += val;
      } else {
        deviceMap.set(key, {
          project_id: projectId, date: r.segments?.date,
          breakdown_type: 'device', breakdown_value: r.segments?.device || 'UNKNOWN',
          spend: cost, impressions: imp, clicks: cl, conversions: conv, conversion_value: val,
          synced_at: new Date().toISOString(),
        });
      }
    }
    allDemos.push(...Array.from(deviceMap.values()));
    console.log(`Got ${deviceMap.size} device rows`);
  } catch (e) { console.error('Error fetching device data:', e); }

  // Aggregate demos by date+type+value
  const demoMap = new Map();
  for (const d of allDemos) {
    const key = `${d.date}_${d.breakdown_type}_${d.breakdown_value}`;
    if (demoMap.has(key)) {
      const e = demoMap.get(key);
      e.spend += d.spend; e.impressions += d.impressions; e.clicks += d.clicks;
      e.conversions += d.conversions; e.conversion_value += d.conversion_value;
    } else {
      demoMap.set(key, { ...d });
    }
  }

  const demos = Array.from(demoMap.values());
  if (demos.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < demos.length; i += batchSize) {
      const batch = demos.slice(i, i + batchSize);
      const { error } = await supabase.from('google_demographic_insights').upsert(batch, {
        onConflict: 'project_id,date,breakdown_type,breakdown_value'
      });
      if (error) { console.error('Error upserting demographics:', error); throw error; }
    }
    console.log(`Synced ${demos.length} demographic rows`);
  }
}

// ==================== SYNC DAILY METRICS ====================
async function syncDailyMetrics(supabase: any, accessToken: string, credentials: GoogleAdsCredentials, projectId: string, days: number = 30): Promise<number> {
  console.log(`Syncing daily metrics for last ${days} days...`);
  const { startDate, endDate } = getDateRange(days);
  const customerId = credentials.customerId.replace(/-/g, '');

  const query = `
    SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
      ad_group.id, ad_group.name, ad_group.status,
      ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value,
      metrics.ctr, metrics.average_cpc, metrics.average_cpm
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status != 'REMOVED'
  `;

  const results = await executeGoogleAdsQuery(accessToken, credentials, query);

  const metricsToUpsert = results.map(r => {
    const cost = parseInt(r.metrics?.costMicros || '0') / 1000000;
    const imp = parseInt(r.metrics?.impressions || '0');
    const cl = parseInt(r.metrics?.clicks || '0');
    const conv = Math.round(parseFloat(r.metrics?.conversions || '0'));
    const val = parseFloat(r.metrics?.conversionsValue || '0');

    return {
      project_id: projectId, date: r.segments?.date, customer_id: customerId,
      campaign_id: r.campaign?.id || '', campaign_name: r.campaign?.name || 'Unknown',
      campaign_status: r.campaign?.status, campaign_type: r.campaign?.advertisingChannelType,
      ad_group_id: r.adGroup?.id || '', ad_group_name: r.adGroup?.name || 'Unknown', ad_group_status: r.adGroup?.status,
      ad_id: r.adGroupAd?.ad?.id || '', ad_name: r.adGroupAd?.ad?.name || 'Unknown Ad', ad_status: r.adGroupAd?.status,
      spend: cost, impressions: imp, clicks: cl, conversions: conv, conversion_value: val,
      ctr: imp > 0 ? (cl / imp) * 100 : 0, cpc: cl > 0 ? cost / cl : 0, cpm: imp > 0 ? (cost / imp) * 1000 : 0,
      cost_per_conversion: conv > 0 ? cost / conv : 0, roas: cost > 0 ? val / cost : 0,
      search_impression_share: null, synced_at: new Date().toISOString(),
    };
  }).filter(m => m.date && m.ad_id);

  if (metricsToUpsert.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < metricsToUpsert.length; i += batchSize) {
      const batch = metricsToUpsert.slice(i, i + batchSize);
      const { error } = await supabase.from('google_ads_daily_metrics').upsert(batch, {
        onConflict: 'project_id,date,ad_id', ignoreDuplicates: false
      });
      if (error) { console.error('Error upserting daily metrics:', error); throw error; }
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(metricsToUpsert.length / batchSize)}`);
    }
    console.log(`Synced ${metricsToUpsert.length} daily metrics`);
  }

  return metricsToUpsert.length;
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId, syncType = 'full', days = 30 } = await req.json();
    if (!projectId) throw new Error('projectId is required');

    console.log(`Starting Google Ads sync for project ${projectId}, type: ${syncType}`);

    const { data: project, error: projectError } = await supabase
      .from('projects').select('google_customer_id').eq('id', projectId).single();
    if (projectError) throw new Error('Project not found');

    const googleCustomerId = project?.google_customer_id;
    if (!googleCustomerId) throw new Error('Google Customer ID not configured for this project.');

    const credentials: GoogleAdsCredentials = {
      clientId: Deno.env.get('GOOGLE_ADS_CLIENT_ID')!,
      clientSecret: Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!,
      developerToken: Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
      refreshToken: Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN')!,
      customerId: googleCustomerId,
      loginCustomerId: Deno.env.get('GOOGLE_ADS_CUSTOMER_ID') || '',
    };

    if (!credentials.clientId || !credentials.clientSecret || !credentials.developerToken || !credentials.refreshToken) {
      throw new Error('Missing Google Ads MCC credentials.');
    }

    const accessToken = await getAccessToken(credentials);
    let recordsCount = 0;

    if (syncType === 'full' || syncType === 'campaigns') {
      await syncCampaigns(supabase, accessToken, credentials, projectId);
    }
    if (syncType === 'full' || syncType === 'ad_groups') {
      await syncAdGroups(supabase, accessToken, credentials, projectId);
    }
    if (syncType === 'full' || syncType === 'ads') {
      await syncAds(supabase, accessToken, credentials, projectId);
    }
    if (syncType === 'full' || syncType === 'keywords') {
      await syncKeywords(supabase, accessToken, credentials, projectId);
    }
    if (syncType === 'full' || syncType === 'demographics') {
      await syncDemographics(supabase, accessToken, credentials, projectId);
    }
    if (syncType === 'full' || syncType === 'metrics') {
      recordsCount = await syncDailyMetrics(supabase, accessToken, credentials, projectId, days);
    }

    await supabase.from('sync_logs').insert({
      project_id: projectId, status: 'success',
      message: `Google Ads sync completed. Type: ${syncType}, Records: ${recordsCount}`,
    });

    console.log('Google Ads sync completed successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Sync completed', recordsCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in google-ads-sync:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
