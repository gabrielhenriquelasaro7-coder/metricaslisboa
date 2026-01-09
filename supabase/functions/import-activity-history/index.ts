import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Event type mapping to human-readable change types
const EVENT_TYPE_MAP: Record<string, { field: string; changeType: string }> = {
  'update_campaign_status': { field: 'status', changeType: 'status_change' },
  'update_campaign_budget': { field: 'daily_budget', changeType: 'budget_change' },
  'update_campaign_name': { field: 'name', changeType: 'name_change' },
  'update_ad_set_status': { field: 'status', changeType: 'status_change' },
  'update_ad_set_budget': { field: 'daily_budget', changeType: 'budget_change' },
  'update_ad_set_name': { field: 'name', changeType: 'name_change' },
  'update_ad_set_targeting': { field: 'targeting', changeType: 'targeting_change' },
  'update_ad_set_bid_amount': { field: 'bid_amount', changeType: 'bid_change' },
  'update_ad_status': { field: 'status', changeType: 'status_change' },
  'update_ad_name': { field: 'name', changeType: 'name_change' },
  'update_ad_creative': { field: 'creative', changeType: 'creative_change' },
  'create_campaign': { field: 'created', changeType: 'created' },
  'create_ad_set': { field: 'created', changeType: 'created' },
  'create_ad': { field: 'created', changeType: 'created' },
  'delete_campaign': { field: 'deleted', changeType: 'deleted' },
  'delete_ad_set': { field: 'deleted', changeType: 'deleted' },
  'delete_ad': { field: 'deleted', changeType: 'deleted' },
  'pause_campaign': { field: 'status', changeType: 'paused' },
  'pause_ad_set': { field: 'status', changeType: 'paused' },
  'pause_ad': { field: 'status', changeType: 'paused' },
  'unpause_campaign': { field: 'status', changeType: 'activated' },
  'unpause_ad_set': { field: 'status', changeType: 'activated' },
  'unpause_ad': { field: 'status', changeType: 'activated' },
};

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
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

    const body = await req.json();
    const { project_id, access_token } = body;

    if (!project_id) {
      throw new Error('project_id is required');
    }

    // Get project info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, ad_account_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${project_id}`);
    }

    const token = access_token || metaAccessToken;
    if (!token) {
      throw new Error('No Meta access token available');
    }

    // Fetch activities from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sinceTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);

    console.log(`[IMPORT] Fetching activities for project ${project.name} since ${sevenDaysAgo.toISOString()}`);

    let allActivities: any[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/v22.0/${project.ad_account_id}/activities?fields=actor_id,actor_name,object_id,object_name,object_type,event_type,event_time,extra_data&limit=500&since=${sinceTimestamp}&access_token=${token}`;

    // Paginate through all activities
    while (nextUrl) {
      const data = await fetchWithRetry(nextUrl);
      if (data.data && Array.isArray(data.data)) {
        allActivities.push(...data.data);
      }
      nextUrl = data.paging?.next || null;
      
      // Safety limit
      if (allActivities.length > 2000) break;
    }

    console.log(`[IMPORT] Fetched ${allActivities.length} activities`);

    // Get existing entity names from database
    const { data: campaigns } = await supabase.from('campaigns').select('id, name').eq('project_id', project_id);
    const { data: adsets } = await supabase.from('ad_sets').select('id, name').eq('project_id', project_id);
    const { data: ads } = await supabase.from('ads').select('id, name').eq('project_id', project_id);

    const entityNameMap = new Map<string, string>();
    (campaigns || []).forEach(c => entityNameMap.set(c.id, c.name));
    (adsets || []).forEach(a => entityNameMap.set(a.id, a.name));
    (ads || []).forEach(a => entityNameMap.set(a.id, a.name));

    // Process activities into optimization_history records
    const historyRecords: any[] = [];
    const seenKeys = new Set<string>();

    for (const activity of allActivities) {
      // Skip Meta automated changes
      if (activity.actor_name === 'Meta') continue;
      
      const eventType = activity.event_type?.toLowerCase() || '';
      const objectType = activity.object_type?.toLowerCase() || '';
      
      // Determine entity_type based on both object_type and event_type
      // Event type is more accurate for ad_set specific operations
      let entityType: 'campaign' | 'ad_set' | 'ad' | null = null;
      
      // First, check event_type for specific entity indicators
      if (eventType.includes('ad_set') || eventType.includes('adset')) {
        entityType = 'ad_set';
      } else if (eventType.includes('_ad_') && !eventType.includes('ad_set')) {
        entityType = 'ad';
      } else if (eventType.includes('_campaign_')) {
        entityType = 'campaign';
      }
      // Fallback to object_type if event_type didn't determine it
      else if (objectType.includes('adset') || objectType.includes('ad_set')) {
        entityType = 'ad_set';
      } else if (objectType.includes('campaign')) {
        entityType = 'campaign';
      } else if (objectType.includes('ad') && !objectType.includes('adset')) {
        entityType = 'ad';
      }
      
      if (!entityType || !activity.object_id) continue;

      // Find matching event type mapping
      let eventInfo = EVENT_TYPE_MAP[eventType];
      
      // If no exact match, try to infer from event type string
      if (!eventInfo) {
        if (eventType.includes('status')) {
          eventInfo = { field: 'status', changeType: 'status_change' };
        } else if (eventType.includes('budget')) {
          eventInfo = { field: 'daily_budget', changeType: 'budget_change' };
        } else if (eventType.includes('name')) {
          eventInfo = { field: 'name', changeType: 'name_change' };
        } else if (eventType.includes('target') || eventType.includes('targeting')) {
          // Targeting changes are always ad_set level
          entityType = 'ad_set';
          eventInfo = { field: 'targeting', changeType: 'targeting_change' };
        } else if (eventType.includes('creative')) {
          // Creative changes are always ad level
          entityType = 'ad';
          eventInfo = { field: 'creative', changeType: 'creative_change' };
        } else if (eventType.includes('create')) {
          eventInfo = { field: 'created', changeType: 'created' };
        } else if (eventType.includes('pause')) {
          eventInfo = { field: 'status', changeType: 'paused' };
        } else if (eventType.includes('unpause') || eventType.includes('resume')) {
          eventInfo = { field: 'status', changeType: 'activated' };
        } else if (eventType.includes('optimization_goal') || eventType.includes('bid')) {
          // Optimization and bid changes are ad_set level
          entityType = 'ad_set';
          eventInfo = { field: eventType, changeType: 'modified' };
        } else {
          eventInfo = { field: eventType, changeType: 'modified' };
        }
      }

      // Parse extra_data for old/new values
      let oldValue: string | null = null;
      let newValue: string | null = null;
      
      if (activity.extra_data) {
        try {
          const extraData = typeof activity.extra_data === 'string' 
            ? JSON.parse(activity.extra_data) 
            : activity.extra_data;
          
          oldValue = extraData.old_value ?? extraData.old_status ?? extraData.old_name ?? null;
          newValue = extraData.new_value ?? extraData.new_status ?? extraData.new_name ?? null;
          
          if (oldValue && typeof oldValue === 'object') oldValue = JSON.stringify(oldValue);
          if (newValue && typeof newValue === 'object') newValue = JSON.stringify(newValue);
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Deduplicate by entity + field + timestamp (within same minute)
      const eventDate = new Date(activity.event_time);
      const minuteKey = `${activity.object_id}:${eventInfo.field}:${Math.floor(eventDate.getTime() / 60000)}`;
      if (seenKeys.has(minuteKey)) continue;
      seenKeys.add(minuteKey);

      const entityName = activity.object_name || entityNameMap.get(activity.object_id) || 'Unknown';

      historyRecords.push({
        project_id: project_id,
        entity_type: entityType,
        entity_id: activity.object_id,
        entity_name: entityName,
        field_changed: eventInfo.field,
        old_value: oldValue ? String(oldValue) : null,
        new_value: newValue ? String(newValue) : null,
        change_type: eventInfo.changeType,
        change_percentage: null,
        changed_by: activity.actor_name || null,
        detected_at: activity.event_time,
      });
    }

    console.log(`[IMPORT] Processed ${historyRecords.length} unique changes`);

    // Insert records in batches
    if (historyRecords.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < historyRecords.length; i += batchSize) {
        const batch = historyRecords.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('optimization_history')
          .insert(batch);
        
        if (insertError) {
          console.error(`[IMPORT] Insert error:`, insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        project: project.name,
        activities_fetched: allActivities.length,
        records_created: historyRecords.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[IMPORT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
