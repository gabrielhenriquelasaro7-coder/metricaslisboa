import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  project_id: string;
  ad_account_id?: string;
  access_token?: string;
  time_range?: {
    since: string;
    until: string;
  };
}

const BREAKDOWNS = ['gender', 'age', 'device_platform', 'publisher_platform'] as const;

// Ensure ad account ID has act_ prefix
function normalizeAdAccountId(id: string): string {
  if (!id) return '';
  return id.startsWith('act_') ? id : `act_${id}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, entityName: string, maxRetries = 3): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (data.error) {
        console.error(`[${entityName}] API Error:`, JSON.stringify(data.error));
        
        // Check for rate limit
        if (data.error.code === 17 || data.error.message?.includes('rate limit')) {
          if (attempt < maxRetries) {
            const waitTime = (attempt + 1) * 10000;
            console.log(`[${entityName}] Rate limit, retry ${attempt + 1}/${maxRetries} in ${waitTime / 1000}s...`);
            await delay(waitTime);
            continue;
          }
        }
        return data;
      }
      
      return data;
    } catch (error) {
      console.error(`[${entityName}] Fetch error:`, error);
      if (attempt < maxRetries) {
        await delay(5000);
        continue;
      }
      return { error: { message: error instanceof Error ? error.message : 'Fetch failed' } };
    }
  }
  return { error: { message: 'Max retries exceeded' } };
}

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

async function fetchDemographicInsights(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
  breakdown: string
): Promise<any[]> {
  const results: any[] = [];
  
  const fields = 'date_start,spend,impressions,clicks,reach,actions,action_values';
  const timeRange = JSON.stringify({ since, until });
  
  // time_increment=1 para dados diários
  let url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&breakdowns=${breakdown}&limit=500&access_token=${token}`;
  
  let totalRows = 0;
  while (url) {
    const data = await fetchWithRetry(url, `DEMO_${breakdown.toUpperCase()}`);
    
    if (data.data && data.data.length > 0) {
      for (const row of data.data) {
        results.push({
          date: row.date_start,
          breakdown_type: breakdown,
          breakdown_value: row[breakdown] || 'unknown',
          spend: parseFloat(row.spend || '0'),
          impressions: parseInt(row.impressions || '0'),
          clicks: parseInt(row.clicks || '0'),
          reach: parseInt(row.reach || '0'),
          ...extractConversions(row),
        });
        totalRows++;
      }
    }
    
    url = data.paging?.next || null;
    if (url) await delay(200);
  }
  
  console.log(`[DEMO_${breakdown.toUpperCase()}] Fetched ${totalRows} rows`);
  return results;
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

    const body: SyncRequest = await req.json();
    const { project_id, access_token, time_range } = body;
    let { ad_account_id } = body;
    
    const token = access_token || metaAccessToken;

    if (!token || !project_id) {
      console.error('[SYNC_DEMOGRAPHICS] Missing required parameters');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters (project_id and token)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no ad_account_id provided, fetch from project
    if (!ad_account_id) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('ad_account_id')
        .eq('id', project_id)
        .single();

      if (projectError || !project?.ad_account_id) {
        console.error('[SYNC_DEMOGRAPHICS] Could not fetch project ad_account_id:', projectError);
        return new Response(
          JSON.stringify({ success: false, error: 'Could not get ad_account_id from project' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      ad_account_id = project.ad_account_id;
    }

    // Ensure proper ad account format
    const normalizedAccountId = normalizeAdAccountId(ad_account_id as string);
    
    // Determine date range - default: last 90 days
    let since: string;
    let until: string;
    
    if (time_range) {
      since = time_range.since;
      until = time_range.until;
    } else {
      const now = new Date();
      until = now.toISOString().split('T')[0];
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 90);
      since = sinceDate.toISOString().split('T')[0];
    }

    console.log(`[SYNC_DEMOGRAPHICS] Project: ${project_id}`);
    console.log(`[SYNC_DEMOGRAPHICS] Account: ${normalizedAccountId}`);
    console.log(`[SYNC_DEMOGRAPHICS] Range: ${since} to ${until}`);

    // Fetch demographic data for each breakdown
    const allRecords: any[] = [];
    
    for (const breakdown of BREAKDOWNS) {
      console.log(`[SYNC_DEMOGRAPHICS] Fetching ${breakdown}...`);
      const records = await fetchDemographicInsights(normalizedAccountId, token, since, until, breakdown);
      
      // Add project_id to each record
      for (const record of records) {
        allRecords.push({
          project_id,
          date: record.date,
          breakdown_type: record.breakdown_type,
          breakdown_value: record.breakdown_value,
          spend: record.spend,
          impressions: record.impressions,
          clicks: record.clicks,
          reach: record.reach,
          conversions: record.conversions,
          conversion_value: record.conversionValue,
          synced_at: new Date().toISOString(),
        });
      }
      
      // Small delay between breakdown types to avoid rate limits
      await delay(500);
    }

    console.log(`[SYNC_DEMOGRAPHICS] Total records: ${allRecords.length}`);

    if (allRecords.length === 0) {
      console.log('[SYNC_DEMOGRAPHICS] No demographic data found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No demographic data found for the period',
          records_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert in batches of 100
    const BATCH_SIZE = 100;
    let upsertedCount = 0;
    
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      
      const { error: upsertError } = await supabase
        .from('demographic_insights')
        .upsert(batch, { 
          onConflict: 'project_id,date,breakdown_type,breakdown_value',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error('[SYNC_DEMOGRAPHICS] Upsert error:', upsertError);
      } else {
        upsertedCount += batch.length;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC_DEMOGRAPHICS] Completed: ${upsertedCount} records in ${elapsed}s`);

    // Summary by breakdown type
    const summary: Record<string, number> = {};
    for (const breakdown of BREAKDOWNS) {
      summary[breakdown] = allRecords.filter(r => r.breakdown_type === breakdown).length;
    }
    console.log('[SYNC_DEMOGRAPHICS] Summary:', JSON.stringify(summary));

    return new Response(
      JSON.stringify({ 
        success: true, 
        records_count: upsertedCount,
        summary,
        elapsed_seconds: parseFloat(elapsed)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SYNC_DEMOGRAPHICS] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
