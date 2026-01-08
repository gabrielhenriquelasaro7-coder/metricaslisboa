import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  project_id: string;
  ad_account_id: string;
  access_token?: string;
  date_preset?: string;
  time_range?: { since: string; until: string };
  period_key?: string;
  retry_count?: number;
  skip_creatives?: boolean;
}

const BASE_DELAY_MS = 200;
const MAX_RETRIES = 3;
const VALIDATION_RETRY_DELAYS = [5000, 10000, 20000];

const TRACKED_FIELDS_CAMPAIGN = ['status', 'daily_budget', 'lifetime_budget', 'objective'];
const TRACKED_FIELDS_ADSET = ['status', 'daily_budget', 'lifetime_budget'];
const TRACKED_FIELDS_AD = ['status'];

const MESSAGING_ACTION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d', 
  'onsite_conversion.messaging_first_reply', 
  'onsite_conversion.total_messaging_connection'
];

const PROFILE_VISIT_ACTION_TYPES = ['onsite_conversion.profile_view', 'ig_profile_visit', 'profile_visit', 'page_engagement', 'post_engagement'];

function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

function extractId(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value.id) return String(value.id);
  return null;
}

function isRateLimitError(data: any): boolean {
  if (!data?.error) return false;
  const code = data.error.code;
  const msg = data.error.message || '';
  return code === 17 || code === '17' || msg.includes('User request limit reached') || msg.includes('rate limit');
}

function isTokenExpiredError(data: any): boolean {
  if (!data?.error) return false;
  const code = data.error.code;
  const subcode = data.error.error_subcode;
  const msg = (data.error.message || '').toLowerCase();
  return code === 190 || code === '190' || subcode === 463 || subcode === 467 || (msg.includes('access token') && (msg.includes('expired') || msg.includes('invalid')));
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

async function fetchWithRetry(url: string, entityName: string): Promise<any> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const data = await simpleFetch(url);
    if (!data.error) {
      if ((!data.data || data.data.length === 0) && entityName !== 'ADCREATIVES') {
        console.log(`[${entityName}] Empty response - no data returned`);
      }
      return data;
    }
    console.log(`[${entityName}] API Error: ${JSON.stringify(data.error).substring(0, 300)}`);
    if (isTokenExpiredError(data)) return data;
    if (isRateLimitError(data) && attempt < MAX_RETRIES) {
      const waitTime = VALIDATION_RETRY_DELAYS[attempt] || 30000;
      console.log(`[${entityName}] Rate limit, retry ${attempt + 1}/${MAX_RETRIES} in ${waitTime / 1000}s...`);
      await delay(waitTime);
      continue;
    }
    return data;
  }
  return { error: { message: 'Max retries exceeded' } };
}

// ===========================================================================================
// ETAPA 1: BUSCAR ENTIDADES (CAMPANHAS, ADSETS, ADS) - VERSÃO LEVE
// Apenas IDs, nomes, status e budgets - SEM dados de criativos
// ===========================================================================================
async function fetchEntitiesLight(adAccountId: string, token: string): Promise<{
  campaigns: any[]; adsets: any[]; ads: any[]; tokenExpired?: boolean;
}> {
  const campaigns: any[] = [], adsets: any[] = [], ads: any[] = [];

  const effectiveStatusFilter = encodeURIComponent('["ACTIVE","PAUSED","ARCHIVED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","PENDING_BILLING_INFO","CAMPAIGN_PAUSED","ADSET_PAUSED","IN_PROCESS","WITH_ISSUES"]');
  
  // Campaigns
  let url = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'CAMPAIGNS');
    if (isTokenExpiredError(data)) return { campaigns: [], adsets: [], ads: [], tokenExpired: true };
    if (data.data) campaigns.push(...data.data);
    url = data.paging?.next || null;
  }
  
  // Adsets
  url = `https://graph.facebook.com/v22.0/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADSETS');
    if (isTokenExpiredError(data)) return { campaigns, adsets: [], ads: [], tokenExpired: true };
    if (data.data) adsets.push(...data.data);
    url = data.paging?.next || null;
  }
  
  // Ads - VERSÃO LEVE: só campos básicos + creative.id para buscar depois
  url = `https://graph.facebook.com/v22.0/${adAccountId}/ads?fields=id,name,status,adset_id,campaign_id,creative{id}&limit=500&effective_status=${effectiveStatusFilter}&access_token=${token}`;
  while (url) {
    const data = await fetchWithRetry(url, 'ADS');
    if (isTokenExpiredError(data)) return { campaigns, adsets, ads: [], tokenExpired: true };
    if (data.data) ads.push(...data.data);
    url = data.paging?.next || null;
  }

  console.log(`[ENTITIES-LIGHT] Campaigns: ${campaigns.length}, Adsets: ${adsets.length}, Ads: ${ads.length}`);
  return { campaigns, adsets, ads };
}

// ===========================================================================================
// ETAPA 2: BUSCAR MÉTRICAS DIÁRIAS (INSIGHTS)
// ===========================================================================================
async function fetchDailyInsights(adAccountId: string, token: string, since: string, until: string): Promise<Map<string, Map<string, any>>> {
  const dailyInsights = new Map<string, Map<string, any>>();
  
  const fields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,results,cost_per_result,actions,action_values,conversions,cost_per_action_type';
  const timeRange = JSON.stringify({ since, until });
  let url = `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=ad&limit=500&action_breakdowns=action_type&access_token=${token}`;
  
  let totalRows = 0;
  
  while (url) {
    const data = await fetchWithRetry(url, 'INSIGHTS');
    if (data.data) {
      for (const row of data.data) {
        const adId = extractId(row.ad_id);
        const dateKey = row.date_start;
        if (adId && dateKey) {
          if (!dailyInsights.has(adId)) dailyInsights.set(adId, new Map());
          dailyInsights.get(adId)!.set(dateKey, row);
          totalRows++;
        }
      }
    }
    url = data.paging?.next || null;
    if (url) await delay(200);
  }
  
  console.log(`[INSIGHTS] Total rows: ${totalRows}, Unique ads: ${dailyInsights.size}`);
  return dailyInsights;
}

// ===========================================================================================
// ETAPA 3: BUSCAR CRIATIVOS (THUMBNAIL + TEXTO) - SEPARADO DAS MÉTRICAS
// Usa batch API para eficiência
// ===========================================================================================
async function fetchCreativeDetails(creativeIds: string[], token: string): Promise<Map<string, {
  thumbnailUrl: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
}>> {
  const creativeDataMap = new Map<string, any>();
  
  if (creativeIds.length === 0) return creativeDataMap;
  
  console.log(`[CREATIVES] Fetching ${creativeIds.length} creatives via batch API...`);
  
  for (let i = 0; i < creativeIds.length; i += 50) {
    const batch = creativeIds.slice(i, i + 50);
    
    const batchRequests = batch.map(creativeId => ({
      method: 'GET',
      relative_url: `${creativeId}?fields=id,thumbnail_url,body,title,call_to_action_type,object_story_spec,asset_feed_spec`
    }));
    
    try {
      const response = await fetch(`https://graph.facebook.com/v22.0/?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batchRequests })
      });
      
      if (response.ok) {
        const results = await response.json();
        for (let j = 0; j < results.length; j++) {
          if (results[j].code === 200 && results[j].body) {
            try {
              const d = JSON.parse(results[j].body);
              const creativeId = batch[j];
              
              // Extrair thumbnail - SIMPLES, sem HD
              let thumbnailUrl = d.thumbnail_url || null;
              
              // Extrair textos
              let primaryText: string | null = null;
              let headline: string | null = null;
              let description: string | null = null;
              let cta: string | null = d.call_to_action_type || null;
              
              // PRIORIDADE 1: asset_feed_spec
              const afs = d.asset_feed_spec;
              if (afs) {
                if (afs.bodies?.length && afs.bodies[0]?.text) primaryText = afs.bodies[0].text;
                if (afs.titles?.length && afs.titles[0]?.text) headline = afs.titles[0].text;
                if (afs.descriptions?.length && afs.descriptions[0]?.text) description = afs.descriptions[0].text;
                if (afs.call_to_action_types?.length) cta = afs.call_to_action_types[0];
              }
              
              // PRIORIDADE 2: object_story_spec
              const oss = d.object_story_spec;
              if (oss?.link_data) {
                if (!primaryText && oss.link_data.message) primaryText = oss.link_data.message;
                if (!headline && oss.link_data.name) headline = oss.link_data.name;
                if (!description && oss.link_data.description) description = oss.link_data.description;
                if (!cta && oss.link_data.call_to_action?.type) cta = oss.link_data.call_to_action.type;
                if (!thumbnailUrl && oss.link_data.picture) thumbnailUrl = oss.link_data.picture;
              }
              if (oss?.video_data) {
                if (!primaryText && oss.video_data.message) primaryText = oss.video_data.message;
                if (!headline && oss.video_data.title) headline = oss.video_data.title;
                if (!cta && oss.video_data.call_to_action?.type) cta = oss.video_data.call_to_action.type;
              }
              if (oss?.photo_data) {
                if (!primaryText && oss.photo_data.message) primaryText = oss.photo_data.message;
                if (!thumbnailUrl && oss.photo_data.url) thumbnailUrl = oss.photo_data.url;
              }
              
              // Fallback: campos diretos
              if (!primaryText && d.body) primaryText = d.body;
              if (!headline && d.title) headline = d.title;
              
              creativeDataMap.set(creativeId, { thumbnailUrl, primaryText, headline, description, cta });
            } catch {}
          }
        }
      }
    } catch (e) {
      console.log(`[CREATIVES] Batch error: ${e}`);
    }
    
    if (i + 50 < creativeIds.length) await delay(100);
  }
  
  console.log(`[CREATIVES] Fetched data for ${creativeDataMap.size} creatives`);
  return creativeDataMap;
}

// ===========================================================================================
// EXTRAÇÃO DE CONVERSÕES
// ===========================================================================================
const ALL_LEAD_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'leadgen_grouped', 'offsite_conversion.fb_pixel_lead'];
const CONTACT_LEAD_ACTION_TYPES = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection', 'link_click', 'landing_page_view'];
const MESSAGE_LEAD_ACTION_TYPES = ['onsite_conversion.messaging_first_reply'];
const PURCHASE_ACTION_TYPES = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
const CONVERSION_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'leadgen_grouped', 'purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_lead', 'offsite_conversion.fb_pixel_purchase'];

function extractConversions(row: any, campaignObjective?: string | null): { conversions: number; costPerResult: number; conversionValue: number; source: string; leadsCount: number; purchasesCount: number } {
  let conversions = 0, costPerResult = 0, conversionValue = 0;
  let source = '', leadsCount = 0, purchasesCount = 0;
  
  // FONTE 1: Campo "results"
  if (Array.isArray(row.results) && row.results.length > 0) {
    let omniPurchaseCount = 0, purchaseCount = 0, pixelPurchaseCount = 0, otherPurchaseCount = 0;
    
    for (const result of row.results) {
      const actionType = result.action_type || '';
      const val = parseInt(result.value) || 0;
      if (val > 0) {
        if (actionType === 'omni_purchase') omniPurchaseCount = val;
        else if (actionType === 'purchase') purchaseCount = val;
        else if (actionType === 'offsite_conversion.fb_pixel_purchase') pixelPurchaseCount = val;
        else if (PURCHASE_ACTION_TYPES.includes(actionType)) {
          if (val > otherPurchaseCount) otherPurchaseCount = val;
        } else if (ALL_LEAD_ACTION_TYPES.includes(actionType) || MESSAGE_LEAD_ACTION_TYPES.includes(actionType)) {
          leadsCount += val;
        }
      }
    }
    
    if (omniPurchaseCount > 0) purchasesCount = omniPurchaseCount;
    else if (purchaseCount > 0) purchasesCount = purchaseCount;
    else if (pixelPurchaseCount > 0) purchasesCount = pixelPurchaseCount;
    else if (otherPurchaseCount > 0) purchasesCount = otherPurchaseCount;
    
    if (leadsCount > 0 || purchasesCount > 0) {
      conversions = leadsCount + purchasesCount;
      source = 'results';
      
      if (Array.isArray(row.cost_per_result) && row.cost_per_result.length > 0) {
        const cpr = row.cost_per_result[0];
        if (cpr.value !== undefined) costPerResult = parseFloat(cpr.value) || 0;
        else if (Array.isArray(cpr.values) && cpr.values.length > 0) costPerResult = parseFloat(cpr.values[0]?.value) || 0;
      }
    }
  }
  
  // FONTE 2: Campo "actions"
  if (conversions === 0 && Array.isArray(row.actions) && row.actions.length > 0) {
    let formLeadValue = 0, contactLeadValue = 0, messageLeadValue = 0, purchaseValue = 0, omniPurchaseValue = 0;
    
    for (const action of row.actions) {
      const actionType = action.action_type || '';
      const val = parseInt(action.value) || 0;
      if (val > 0) {
        if (actionType === 'lead' || actionType === 'onsite_conversion.lead_grouped') formLeadValue = val;
        else if (CONTACT_LEAD_ACTION_TYPES.includes(actionType) && val > contactLeadValue) contactLeadValue = val;
        else if (actionType === 'messaging_conversation_started_7d' || actionType === 'onsite_conversion.messaging_conversation_started_7d') messageLeadValue = val;
        else if (actionType === 'purchase') purchaseValue = val;
        else if (actionType === 'omni_purchase') omniPurchaseValue = val;
      }
    }
    
    purchasesCount = omniPurchaseValue > 0 ? omniPurchaseValue : purchaseValue;
    const maxLead = Math.max(formLeadValue, contactLeadValue, messageLeadValue);
    if (maxLead > 0) {
      leadsCount = maxLead;
      source = 'actions';
    }
    conversions = leadsCount + purchasesCount;
  }

  // FONTE 3: Campo "conversions"
  if (conversions === 0 && Array.isArray(row.conversions) && row.conversions.length > 0) {
    let formLeadConv = 0, contactLeadConv = 0, messageLeadConv = 0, purchaseConv = 0, omniPurchaseConv = 0;
    
    for (const c of row.conversions) {
      const actionType = c.action_type || '';
      const val = parseInt(c.value) || 0;
      if (val > 0) {
        if (actionType === 'lead' || actionType === 'onsite_conversion.lead_grouped') formLeadConv = val;
        else if (CONTACT_LEAD_ACTION_TYPES.includes(actionType) && val > contactLeadConv) contactLeadConv = val;
        else if (actionType === 'messaging_conversation_started_7d' || actionType === 'onsite_conversion.messaging_conversation_started_7d') messageLeadConv = val;
        else if (actionType === 'purchase') purchaseConv = val;
        else if (actionType === 'omni_purchase') omniPurchaseConv = val;
      }
    }
    
    purchasesCount = omniPurchaseConv > 0 ? omniPurchaseConv : purchaseConv;
    const maxLeadConv = Math.max(formLeadConv, contactLeadConv, messageLeadConv);
    if (maxLeadConv > 0) {
      leadsCount = maxLeadConv;
      source = 'conversions_legacy';
    }
    conversions = leadsCount + purchasesCount;
  }

  // CPA
  if (conversions > 0 && Array.isArray(row.cost_per_action_type) && row.cost_per_action_type.length > 0) {
    for (const cpa of row.cost_per_action_type) {
      const actionType = cpa.action_type || '';
      if (CONVERSION_ACTION_TYPES.includes(actionType) && cpa.value) {
        costPerResult = parseFloat(cpa.value) || 0;
        break;
      }
    }
  }
  
  if (costPerResult === 0 && conversions > 0) {
    const spend = parseFloat(row.spend) || 0;
    costPerResult = spend / conversions;
  }

  // Valor de conversão
  if (Array.isArray(row.action_values)) {
    let purchaseValue = 0, omniPurchaseValue = 0;
    for (const av of row.action_values) {
      const actionType = av.action_type || '';
      const val = parseFloat(av.value) || 0;
      if (actionType === 'omni_purchase' && val > 0) omniPurchaseValue = val;
      else if (actionType === 'purchase' && val > 0) purchaseValue = val;
    }
    conversionValue = omniPurchaseValue > 0 ? omniPurchaseValue : purchaseValue;
  }

  return { conversions, costPerResult, conversionValue, source, leadsCount, purchasesCount };
}

function extractMessagingReplies(insights: any): number {
  if (!insights?.actions) return 0;
  let c7d = 0, total = 0, first = 0;
  for (const a of insights.actions) {
    const v = parseInt(a.value) || 0;
    if (a.action_type === 'onsite_conversion.messaging_conversation_started_7d') c7d = v;
    else if (a.action_type === 'onsite_conversion.total_messaging_connection') total = v;
    else if (a.action_type === 'onsite_conversion.messaging_first_reply') first = v;
  }
  return c7d > 0 ? c7d : Math.max(total, first);
}

function extractProfileVisits(insights: any): number {
  if (!insights?.actions) return 0;
  let max = 0;
  for (const a of insights.actions) {
    const v = parseInt(a.value) || 0;
    if (PROFILE_VISIT_ACTION_TYPES.includes(a.action_type) && v > max) max = v;
  }
  return max;
}

function validateSyncData(records: any[]): { isValid: boolean; totalSpend: number; totalImpressions: number; totalConversions: number } {
  const totalSpend = records.reduce((s, r) => s + (r.spend || 0), 0);
  const totalImpressions = records.reduce((s, r) => s + (r.impressions || 0), 0);
  const totalConversions = records.reduce((s, r) => s + (r.conversions || 0), 0);
  const allZero = records.length > 0 && records.every(r => (r.spend || 0) === 0 && (r.impressions || 0) === 0 && (r.clicks || 0) === 0);
  return { isValid: !allZero || records.length === 0, totalSpend, totalImpressions, totalConversions };
}

async function detectAndRecordChanges(supabase: any, projectId: string, entityType: 'campaign' | 'adset' | 'ad', tableName: string, newRecords: any[], trackedFields: string[]): Promise<any[]> {
  const changes: any[] = [];
  if (newRecords.length === 0) return changes;
  const ids = newRecords.map(r => r.id);
  const { data: existingRecords } = await supabase.from(tableName).select('*').in('id', ids).eq('project_id', projectId);
  const existingMap = new Map((existingRecords || []).map((r: any) => [r.id, r]));
  for (const newRecord of newRecords) {
    const existing = existingMap.get(newRecord.id) as Record<string, any> | undefined;
    if (!existing) { changes.push({ project_id: projectId, entity_type: entityType, entity_id: newRecord.id, entity_name: newRecord.name || 'Unknown', field_changed: 'created', old_value: null, new_value: newRecord.status || 'ACTIVE', change_type: 'created', change_percentage: null }); continue; }
    for (const field of trackedFields) {
      const oldVal = existing[field], newVal = newRecord[field];
      if (oldVal === newVal || (oldVal == null && newVal == null)) continue;
      let changeType = 'modified', changePct: number | null = null;
      if (field === 'status') { changeType = oldVal === 'ACTIVE' && newVal !== 'ACTIVE' ? 'paused' : oldVal !== 'ACTIVE' && newVal === 'ACTIVE' ? 'activated' : 'status_change'; }
      else if (field.includes('budget')) { changeType = 'budget_change'; const oldNum = parseFloat(String(oldVal)) || 0, newNum = parseFloat(String(newVal)) || 0; if (oldNum > 0) changePct = ((newNum - oldNum) / oldNum) * 100; }
      changes.push({ project_id: projectId, entity_type: entityType, entity_id: newRecord.id, entity_name: newRecord.name || existing.name || 'Unknown', field_changed: field, old_value: oldVal != null ? String(oldVal) : null, new_value: newVal != null ? String(newVal) : null, change_type: changeType, change_percentage: changePct });
    }
  }
  return changes;
}

async function detectAndSendAnomalyAlerts(supabase: any, projectId: string, changes: any[], campaignMetrics: Map<string, any>, existingCampaigns: any[]): Promise<void> {
  const { data: alertConfigs } = await supabase.from('anomaly_alert_config').select('*').eq('project_id', projectId).eq('enabled', true);
  if (!alertConfigs?.length) return;
  const anomalies: any[] = [];
  const existingMetricsMap = new Map(existingCampaigns.map(c => [c.id, c]));
  for (const config of alertConfigs) {
    for (const change of changes) {
      if (change.change_type === 'paused') { const shouldAlert = (change.entity_type === 'campaign' && config.campaign_paused_alert) || (change.entity_type === 'adset' && config.ad_set_paused_alert) || (change.entity_type === 'ad' && config.ad_paused_alert); if (shouldAlert) anomalies.push({ project_id: projectId, anomaly_type: `${change.entity_type}_paused`, entity_type: change.entity_type, entity_id: change.entity_id, entity_name: change.entity_name, details: { old_status: change.old_value, new_status: change.new_value }, severity: 'warning' }); }
      if (change.change_type === 'budget_change' && config.budget_change_alert) anomalies.push({ project_id: projectId, anomaly_type: 'budget_change', entity_type: change.entity_type, entity_id: change.entity_id, entity_name: change.entity_name, details: { old_budget: change.old_value, new_budget: change.new_value, change_percentage: change.change_percentage }, severity: Math.abs(change.change_percentage || 0) > 50 ? 'critical' : 'warning' });
    }
    for (const [campaignId, newMetrics] of campaignMetrics.entries()) {
      const existing = existingMetricsMap.get(campaignId);
      if (!existing) continue;
      const oldCtr = existing.ctr || 0, newCtr = newMetrics.ctr || 0;
      if (oldCtr > 0 && newCtr > 0) { const ctrChange = ((newCtr - oldCtr) / oldCtr) * 100; if (ctrChange < -(config.ctr_drop_threshold || 20)) anomalies.push({ project_id: projectId, anomaly_type: 'ctr_drop', entity_type: 'campaign', entity_id: campaignId, entity_name: newMetrics.name || existing.name || 'Unknown', details: { old_ctr: oldCtr.toFixed(2), new_ctr: newCtr.toFixed(2), change_percentage: ctrChange.toFixed(1) }, severity: Math.abs(ctrChange) > 40 ? 'critical' : 'warning' }); }
      const oldCpa = existing.cpa || 0, newCpa = newMetrics.cpa || 0;
      if (oldCpa > 0 && newCpa > 0) { const cpaChange = ((newCpa - oldCpa) / oldCpa) * 100; if (cpaChange > (config.cpl_increase_threshold || 30)) anomalies.push({ project_id: projectId, anomaly_type: 'cpl_increase', entity_type: 'campaign', entity_id: campaignId, entity_name: newMetrics.name || existing.name || 'Unknown', details: { old_cpl: oldCpa.toFixed(2), new_cpl: newCpa.toFixed(2), change_percentage: cpaChange.toFixed(1) }, severity: cpaChange > 60 ? 'critical' : 'warning' }); }
    }
  }
  if (anomalies.length > 0) {
    await supabase.from('anomaly_alerts').insert(anomalies);
    console.log(`[ANOMALY] Saved ${anomalies.length} anomalies`);
  }
}

// ===========================================================================================
// BUSCAR SALDO DA CONTA META ADS
// ===========================================================================================
async function fetchAccountBalance(adAccountId: string, token: string): Promise<{
  balance: number | null;
  currency: string | null;
  fundingSource: any | null;
}> {
  try {
    // Buscar informações da conta incluindo saldo e funding_source_details
    const url = `https://graph.facebook.com/v22.0/${adAccountId}?fields=balance,amount_spent,currency,funding_source_details,account_status&access_token=${token}`;
    const data = await simpleFetch(url);
    
    if (data.error) {
      console.log(`[BALANCE] Error fetching balance: ${JSON.stringify(data.error).substring(0, 200)}`);
      return { balance: null, currency: null, fundingSource: null };
    }
    
    // O balance retornado pela API está em centavos
    const balanceInCents = parseInt(data.balance) || 0;
    const balance = balanceInCents / 100;
    const currency = data.currency || 'BRL';
    
    console.log(`[BALANCE] Account ${adAccountId}: ${balance} ${currency}`);
    
    return {
      balance,
      currency,
      fundingSource: data.funding_source_details || null
    };
  } catch (error) {
    console.error('[BALANCE] Error:', error);
    return { balance: null, currency: null, fundingSource: null };
  }
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: SyncRequest = await req.json();
    const { project_id, ad_account_id, access_token, date_preset, time_range, retry_count = 0, skip_creatives = false } = body;
    
    let since: string, until: string;
    if (time_range) { since = time_range.since; until = time_range.until; }
    else { const today = new Date(); until = today.toISOString().split('T')[0]; const daysMap: Record<string, number> = { yesterday: 1, today: 0, last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90 }; const days = daysMap[date_preset || 'last_90d'] || 90; const sinceDate = new Date(today); sinceDate.setDate(sinceDate.getDate() - days); since = sinceDate.toISOString().split('T')[0]; }
    
    console.log(`[SYNC] Project: ${project_id}, Range: ${since} to ${until}, skip_creatives: ${skip_creatives}`);
    const token = access_token || metaAccessToken;
    if (!token) throw new Error('No Meta access token available');
    
    // ===========================================================================================
    // ETAPA 1: BUSCAR ENTIDADES (LEVE)
    // ===========================================================================================
    const { campaigns, adsets, ads, tokenExpired } = await fetchEntitiesLight(ad_account_id, token);
    if (tokenExpired) return new Response(JSON.stringify({ success: false, error: 'Token do Meta expirou.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
    const campaignMap = new Map(campaigns.map(c => [extractId(c.id), c]));
    const adsetMap = new Map(adsets.map(a => [extractId(a.id), a]));
    const adMap = new Map(ads.map(a => [extractId(a.id), a]));
    
    // ===========================================================================================
    // ETAPA 2: BUSCAR MÉTRICAS (INSIGHTS) - CRÍTICO, SALVAR PRIMEIRO
    // ===========================================================================================
    const dailyInsights = await fetchDailyInsights(ad_account_id, token, since, until);
    
    const dailyRecords: any[] = [];
    
    for (const [adId, dateMap] of dailyInsights) {
      for (const [date, insights] of dateMap) {
        const ad = adMap.get(adId);
        const adsetId = extractId(insights.adset_id), campaignId = extractId(insights.campaign_id);
        const adset = adsetId ? adsetMap.get(adsetId) : null;
        const campaign = campaignId ? campaignMap.get(campaignId) : null;
        
        const campaignObjective = campaign?.objective || null;
        const { conversions, costPerResult, conversionValue, leadsCount, purchasesCount } = extractConversions(insights, campaignObjective);
        const messagingReplies = extractMessagingReplies(insights);
        const profileVisits = extractProfileVisits(insights);
        
        const spend = parseFloat(insights.spend) || 0;
        const impressions = parseInt(insights.impressions) || 0;
        const clicks = parseInt(insights.clicks) || 0;
        const reach = parseInt(insights.reach) || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const frequency = reach > 0 ? impressions / reach : 0;
        const cpa = costPerResult > 0 ? costPerResult : (conversions > 0 ? spend / conversions : 0);
        const roas = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0;
        
        dailyRecords.push({
          project_id,
          date,
          ad_account_id,
          campaign_id: campaignId || '',
          campaign_name: insights.campaign_name || campaign?.name || 'Unknown',
          campaign_status: campaign?.status || null,
          campaign_objective: campaign?.objective || null,
          adset_id: adsetId || '',
          adset_name: insights.adset_name || adset?.name || 'Unknown',
          adset_status: adset?.status || null,
          ad_id: adId,
          ad_name: insights.ad_name || ad?.name || 'Unknown',
          ad_status: ad?.status || null,
          creative_id: ad?.creative?.id || null,
          spend,
          impressions,
          clicks,
          reach,
          ctr,
          cpm,
          cpc,
          frequency,
          conversions,
          conversion_value: conversionValue,
          cpa,
          roas,
          messaging_replies: messagingReplies,
          profile_visits: profileVisits,
          leads_count: leadsCount,
          purchases_count: purchasesCount,
          synced_at: new Date().toISOString()
        });
      }
    }
    
    const validation = validateSyncData(dailyRecords);
    console.log(`[VALIDATION] Records: ${dailyRecords.length}, Spend: R$${validation.totalSpend.toFixed(2)}, Conversions: ${validation.totalConversions}`);
    
    if (!validation.isValid && retry_count < 3) {
      console.log(`[VALIDATION] Invalid data, retry ${retry_count + 1}`);
      return new Response(JSON.stringify({ success: false, error: 'Validation failed', retry: true }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // SALVAR MÉTRICAS DIÁRIAS IMEDIATAMENTE
    if (dailyRecords.length > 0) {
      for (let i = 0; i < dailyRecords.length; i += 500) {
        const batch = dailyRecords.slice(i, i + 500);
        await supabase.from('ads_daily_metrics').upsert(batch, { onConflict: 'project_id,ad_id,date' });
      }
      console.log(`[UPSERT] Saved ${dailyRecords.length} daily metrics`);
    }
    
    // ===========================================================================================
    // ETAPA 3: BUSCAR CRIATIVOS (SEPARADO) - SE NÃO SKIP
    // ===========================================================================================
    const creativeDataMap = new Map<string, any>();
    
    if (!skip_creatives && ads.length > 0) {
      const creativeIds = ads.map(a => a.creative?.id).filter(Boolean).map(String);
      const uniqueCreativeIds = [...new Set(creativeIds)];
      
      if (uniqueCreativeIds.length > 0) {
        const fetchedCreatives = await fetchCreativeDetails(uniqueCreativeIds, token);
        
        // Mapear creative_id -> ad_id para atualizar
        for (const ad of ads) {
          const creativeId = ad.creative?.id ? String(ad.creative.id) : null;
          if (creativeId && fetchedCreatives.has(creativeId)) {
            creativeDataMap.set(String(ad.id), fetchedCreatives.get(creativeId));
          }
        }
      }
    }
    
    // ===========================================================================================
    // AGREGAR MÉTRICAS PARA ENTIDADES
    // ===========================================================================================
    const campaignMetrics = new Map<string, any>();
    const adsetMetrics = new Map<string, any>();
    const adMetrics = new Map<string, any>();
    
    for (const r of dailyRecords) {
      const initMetric = (id: string, name: string, extra: any) => ({
        id,
        name,
        project_id,
        status: extra.status,
        objective: extra.objective,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        conversions: 0,
        conversion_value: 0,
        messaging_replies: 0,
        profile_visits: 0,
      });

      // Campaign aggregation
      if (!campaignMetrics.has(r.campaign_id)) {
        const campaign = campaignMap.get(r.campaign_id);
        campaignMetrics.set(r.campaign_id, initMetric(r.campaign_id, r.campaign_name, { status: campaign?.status, objective: campaign?.objective }));
      }
      const cm = campaignMetrics.get(r.campaign_id);
      cm.spend += r.spend;
      cm.impressions += r.impressions;
      cm.clicks += r.clicks;
      cm.reach += r.reach;
      cm.conversions += r.conversions;
      cm.conversion_value += r.conversion_value;
      cm.messaging_replies += r.messaging_replies;
      cm.profile_visits += r.profile_visits;

      // Adset aggregation
      if (!adsetMetrics.has(r.adset_id)) {
        const adset = adsetMap.get(r.adset_id);
        adsetMetrics.set(r.adset_id, { ...initMetric(r.adset_id, r.adset_name, { status: adset?.status }), campaign_id: r.campaign_id, daily_budget: adset?.daily_budget, lifetime_budget: adset?.lifetime_budget });
      }
      const am = adsetMetrics.get(r.adset_id);
      am.spend += r.spend;
      am.impressions += r.impressions;
      am.clicks += r.clicks;
      am.reach += r.reach;
      am.conversions += r.conversions;
      am.conversion_value += r.conversion_value;
      am.messaging_replies += r.messaging_replies;
      am.profile_visits += r.profile_visits;

      // Ad aggregation
      if (!adMetrics.has(r.ad_id)) {
        const ad = adMap.get(r.ad_id);
        const creativeData = creativeDataMap.get(r.ad_id);
        
        adMetrics.set(r.ad_id, { 
          ...initMetric(r.ad_id, r.ad_name, { status: ad?.status }), 
          campaign_id: r.campaign_id, 
          ad_set_id: r.adset_id,
          creative_id: ad?.creative?.id || null,
          creative_thumbnail: creativeData?.thumbnailUrl || null,
          creative_image_url: creativeData?.thumbnailUrl || null, // Usando thumbnail como imagem
          headline: creativeData?.headline || null,
          primary_text: creativeData?.primaryText || null,
          cta: creativeData?.cta || null,
        });
      }
      const adm = adMetrics.get(r.ad_id);
      adm.spend += r.spend;
      adm.impressions += r.impressions;
      adm.clicks += r.clicks;
      adm.reach += r.reach;
      adm.conversions += r.conversions;
      adm.conversion_value += r.conversion_value;
      adm.messaging_replies += r.messaging_replies;
      adm.profile_visits += r.profile_visits;
    }

    // Calculate derived metrics
    const calculateDerived = (m: any) => {
      m.ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
      m.cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
      m.cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
      m.frequency = m.reach > 0 ? m.impressions / m.reach : 0;
      m.cpa = m.conversions > 0 ? m.spend / m.conversions : 0;
      m.roas = m.spend > 0 && m.conversion_value > 0 ? m.conversion_value / m.spend : 0;
      m.synced_at = new Date().toISOString();
      return m;
    };

    const campaignRecords = Array.from(campaignMetrics.values()).map(m => {
      const campaign = campaignMap.get(m.id);
      return calculateDerived({
        ...m,
        daily_budget: campaign?.daily_budget,
        lifetime_budget: campaign?.lifetime_budget,
      });
    });

    const adsetRecords = Array.from(adsetMetrics.values()).map(m => {
      const record = calculateDerived(m);
      delete record.objective;
      return record;
    });
    
    const adRecords = Array.from(adMetrics.values()).map(m => {
      const record = calculateDerived(m);
      delete record.objective;
      return record;
    });
    
    // Log sample
    if (adRecords.length > 0) {
      const sample = adRecords[0];
      console.log(`[CREATIVE-RESULT] Sample: headline="${sample.headline || 'NULL'}", primary_text="${sample.primary_text?.substring(0, 50) || 'NULL'}", cta="${sample.cta || 'NULL'}", has_image=${!!sample.creative_image_url}`);
    }

    // Detect changes
    const { data: existingCampaigns } = await supabase.from('campaigns').select('*').eq('project_id', project_id);
    const allChanges: any[] = [];
    
    if (campaignRecords.length > 0) {
      const campaignChanges = await detectAndRecordChanges(supabase, project_id, 'campaign', 'campaigns', campaignRecords, TRACKED_FIELDS_CAMPAIGN);
      allChanges.push(...campaignChanges);
    }
    if (adsetRecords.length > 0) {
      const adsetChanges = await detectAndRecordChanges(supabase, project_id, 'adset', 'ad_sets', adsetRecords, TRACKED_FIELDS_ADSET);
      allChanges.push(...adsetChanges);
    }
    if (adRecords.length > 0) {
      const adChanges = await detectAndRecordChanges(supabase, project_id, 'ad', 'ads', adRecords, TRACKED_FIELDS_AD);
      allChanges.push(...adChanges);
    }

    // Save changes
    if (allChanges.length > 0) {
      await supabase.from('optimization_history').insert(allChanges);
      console.log(`[CHANGES] Recorded ${allChanges.length} changes`);
    }

    // Detect anomalies
    await detectAndSendAnomalyAlerts(supabase, project_id, allChanges, campaignMetrics, existingCampaigns || []);

    // Upsert entities
    console.log(`[UPSERT] Starting entity upserts - campaigns: ${campaignRecords.length}, adsets: ${adsetRecords.length}, ads: ${adRecords.length}`);
    
    if (campaignRecords.length > 0) {
      const { error: campError } = await supabase.from('campaigns').upsert(campaignRecords, { onConflict: 'id' });
      if (campError) console.error(`[UPSERT] Campaign error:`, campError);
    }
    if (adsetRecords.length > 0) {
      const { error: adsetError } = await supabase.from('ad_sets').upsert(adsetRecords, { onConflict: 'id' });
      if (adsetError) console.error(`[UPSERT] Adset error:`, adsetError);
    }
    if (adRecords.length > 0) {
      const { error: adsError } = await supabase.from('ads').upsert(adRecords, { onConflict: 'id' });
      if (adsError) console.error(`[UPSERT] Ads error:`, adsError);
    }

    // ===========================================================================================
    // BUSCAR E SALVAR SALDO DA CONTA
    // ===========================================================================================
    const accountBalanceData = await fetchAccountBalance(ad_account_id, token);
    
    // Update project sync time AND account balance
    const projectUpdate: any = { 
      last_sync_at: new Date().toISOString(), 
      webhook_status: 'active' 
    };
    
    if (accountBalanceData.balance !== null) {
      projectUpdate.account_balance = accountBalanceData.balance;
      projectUpdate.account_balance_updated_at = new Date().toISOString();
      console.log(`[BALANCE] Updated project balance: ${accountBalanceData.balance}`);
    }
    
    await supabase.from('projects').update(projectUpdate).eq('id', project_id);

    const duration = Date.now() - startTime;
    console.log(`[SYNC] Completed in ${duration}ms - Records: ${dailyRecords.length}, Creatives: ${creativeDataMap.size}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        records: dailyRecords.length,
        campaigns: campaignRecords.length,
        adsets: adsetRecords.length,
        ads: adRecords.length,
        creatives: creativeDataMap.size,
        spend: validation.totalSpend,
        conversions: validation.totalConversions,
        changes: allChanges.length,
        duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[SYNC] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
