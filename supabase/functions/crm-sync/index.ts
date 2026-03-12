import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  connection_id: string;
  project_id: string;
  sync_type: 'full' | 'incremental';
}

interface CRMDeal {
  external_id: string;
  external_pipeline_id?: string;
  external_stage_id?: string;
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won' | 'lost';
  stage_name?: string;
  created_date?: string;
  closed_date?: string;
  owner_name?: string;
  owner_email?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  lead_source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  custom_fields?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: SyncRequest = await req.json();
    const { connection_id, project_id, sync_type } = body;

    if (!connection_id || !project_id) {
      return new Response(
        JSON.stringify({ error: 'connection_id e project_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('id', connection_id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Conexão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (connection.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'CRM não está conectado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('crm_sync_logs')
      .insert({
        connection_id,
        project_id,
        sync_type,
        status: 'syncing',
      })
      .select('id')
      .single();

    if (logError) throw logError;

    console.log(`[CRM Sync] Starting ${sync_type} sync for connection ${connection_id}`);

    try {
      // Fetch deals based on provider
      const deals = await fetchDealsFromCRM(connection, sync_type);

      console.log(`[CRM Sync] Fetched ${deals.length} deals from ${connection.provider}`);

      // Process deals in batches for performance
      const BATCH_SIZE = 100;
      let totalProcessed = 0;
      let totalFailed = 0;

      for (let i = 0; i < deals.length; i += BATCH_SIZE) {
        const batch = deals.slice(i, i + BATCH_SIZE);

        const batchData = batch.map(deal => {
          const dealAny = deal as CRMDeal & { _pipeline_uuid?: string };
          return {
            connection_id,
            project_id,
            external_id: deal.external_id,
            external_pipeline_id: deal.external_pipeline_id,
            external_stage_id: deal.external_stage_id,
            pipeline_id: dealAny._pipeline_uuid || null,
            title: deal.title,
            value: deal.value || 0,
            currency: deal.currency || 'BRL',
            status: deal.status || 'open',
            stage_name: deal.stage_name,
            created_date: deal.created_date,
            closed_date: deal.closed_date,
            owner_name: deal.owner_name,
            owner_email: deal.owner_email,
            contact_name: deal.contact_name,
            contact_email: deal.contact_email,
            contact_phone: deal.contact_phone,
            lead_source: deal.lead_source,
            utm_source: deal.utm_source,
            utm_medium: deal.utm_medium,
            utm_campaign: deal.utm_campaign,
            custom_fields: deal.custom_fields || {},
            synced_at: new Date().toISOString(),
          };
        });

        // Batch upsert
        const { error: upsertError } = await supabase
          .from('crm_deals')
          .upsert(batchData, {
            onConflict: 'connection_id,external_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`[CRM Sync] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, upsertError);
          totalFailed += batch.length;
        } else {
          totalProcessed += batch.length;
        }

        // Update progress every 5 batches
        if ((i / BATCH_SIZE) % 5 === 0) {
          await supabase
            .from('crm_sync_logs')
            .update({
              records_processed: totalProcessed + totalFailed,
            })
            .eq('id', syncLog.id);
          console.log(`[CRM Sync] Progress: ${totalProcessed + totalFailed}/${deals.length}`);
        }
      }

      // Update sync log with success
      await supabase
        .from('crm_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: deals.length,
          records_created: 0, // We can't distinguish with batch upsert
          records_updated: totalProcessed,
          records_failed: totalFailed,
        })
        .eq('id', syncLog.id);

      console.log(`[CRM Sync] Completed: ${totalProcessed} processed, ${totalFailed} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          sync_id: syncLog.id,
          records_processed: deals.length,
          records_created: 0,
          records_updated: totalProcessed,
          records_failed: totalFailed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (syncError: unknown) {
      const errorMessage = syncError instanceof Error ? syncError.message : 'Erro desconhecido';
      const errorStack = syncError instanceof Error ? syncError.stack : undefined;

      // Update sync log with error
      await supabase
        .from('crm_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
          error_details: { stack: errorStack },
        })
        .eq('id', syncLog.id);

      // Update connection status
      await supabase
        .from('crm_connections')
        .update({
          last_error: errorMessage,
        })
        .eq('id', connection_id);

      throw syncError;
    }

  } catch (error: unknown) {
    console.error('[CRM Sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro durante sincronização';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchDealsFromCRM(
  connection: Record<string, unknown>,
  syncType: 'full' | 'incremental'
): Promise<CRMDeal[]> {
  const provider = connection.provider as string;

  switch (provider) {
    case 'kommo':
      return fetchKommoDeals(connection, syncType);
    case 'hubspot':
      return fetchHubSpotDeals(connection, syncType);
    case 'bitrix24':
      return fetchBitrixDeals(connection, syncType);
    case 'rdstation':
      return fetchRDStationDeals(connection, syncType);
    case 'gohighlevel':
      return fetchGoHighLevelDeals(connection, syncType);
    case 'helpsys':
      return fetchHelpSysDeals(connection, syncType);
    default:
      console.log(`[CRM Sync] Provider ${provider} not implemented, returning empty`);
      return [];
  }
}

// Kommo (AmoCRM) integration
async function fetchKommoDeals(
  connection: Record<string, unknown>,
  syncType: 'full' | 'incremental'
): Promise<CRMDeal[]> {
  const apiKey = connection.access_token || connection.api_key;
  const apiUrl = connection.api_url as string;

  if (!apiKey || !apiUrl) {
    throw new Error('Credenciais do Kommo não configuradas');
  }

  // Fetch all pipelines and their stages to correctly identify won/lost statuses
  const wonStatusIds = new Set<number>();
  const lostStatusIds = new Set<number>();
  const stageNames: Record<number, string> = {};

  try {
    const pipelinesUrl = `${apiUrl}/api/v4/leads/pipelines`;
    const pipelinesResponse = await fetch(pipelinesUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (pipelinesResponse.ok) {
      const pipelinesData = await pipelinesResponse.json();
      const pipelines = pipelinesData._embedded?.pipelines || [];

      for (const pipeline of pipelines) {
        const statuses = pipeline._embedded?.statuses || [];
        for (const status of statuses) {
          stageNames[status.id] = status.name;

          // Kommo uses type to indicate special statuses
          // type 0 = regular, type 1 = unsorted, type 2 = won, type 3 = lost
          if (status.type === 2 || status.is_editable === false && status.name?.toLowerCase().includes('gan')) {
            wonStatusIds.add(status.id);
            console.log(`[CRM Sync] Detected WON status: ${status.id} - ${status.name}`);
          } else if (status.type === 3 || status.is_editable === false && (status.name?.toLowerCase().includes('perd') || status.name?.toLowerCase().includes('lost'))) {
            lostStatusIds.add(status.id);
            console.log(`[CRM Sync] Detected LOST status: ${status.id} - ${status.name}`);
          }
        }
      }
    }
  } catch (pipelineError) {
    console.error('[CRM Sync] Error fetching pipelines:', pipelineError);
    // Continue with default mapping if pipeline fetch fails
  }

  // Fallback to standard Kommo IDs if no pipelines found
  if (wonStatusIds.size === 0) {
    wonStatusIds.add(142); // Default Kommo won status
  }
  if (lostStatusIds.size === 0) {
    lostStatusIds.add(143); // Default Kommo lost status
  }

  const deals: CRMDeal[] = [];
  let page = 1;
  const limit = 250;

  // Cache for contact details
  const contactCache: Record<string, {
    email?: string;
    phone?: string;
    name?: string;
    custom_fields?: Record<string, string>;
  }> = {};

  while (true) {
    const url = new URL(`${apiUrl}/api/v4/leads`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('with', 'contacts');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 204) break; // No more data
      throw new Error(`Kommo API error: ${response.status}`);
    }

    const data = await response.json();
    const leads = data._embedded?.leads || [];

    if (leads.length === 0) break;

    // Collect contact IDs to fetch details
    const contactIds: number[] = [];
    for (const lead of leads) {
      const contactId = lead._embedded?.contacts?.[0]?.id;
      if (contactId && !contactCache[String(contactId)]) {
        contactIds.push(contactId);
      }
    }

    // Fetch contact details in batch (if we have contact IDs)
    if (contactIds.length > 0) {
      try {
        const contactUrl = new URL(`${apiUrl}/api/v4/contacts`);
        contactUrl.searchParams.set('filter[id]', contactIds.join(','));
        contactUrl.searchParams.set('with', 'contacts');

        const contactResponse = await fetch(contactUrl.toString(), {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          const contacts = contactData._embedded?.contacts || [];

          for (const contact of contacts) {
            const email = contact.custom_fields_values?.find((cf: { field_code?: string }) => cf.field_code === 'EMAIL')?.values?.[0]?.value;
            const phone = contact.custom_fields_values?.find((cf: { field_code?: string }) => cf.field_code === 'PHONE')?.values?.[0]?.value;

            // Extract ALL custom fields from contact (including form questions)
            const contactCustomFields: Record<string, string> = {};
            if (contact.custom_fields_values) {
              for (const cf of contact.custom_fields_values) {
                const fieldName = cf.field_name || cf.field_code;
                const value = cf.values?.[0]?.value;
                if (fieldName && value !== undefined && value !== null && fieldName !== 'EMAIL' && fieldName !== 'PHONE') {
                  contactCustomFields[fieldName] = String(value);
                }
              }
            }

            contactCache[String(contact.id)] = {
              name: contact.name,
              email,
              phone,
              custom_fields: Object.keys(contactCustomFields).length > 0 ? contactCustomFields : undefined,
            };
          }
        }
      } catch (contactError) {
        console.error('[CRM Sync] Error fetching contacts:', contactError);
      }
    }

    for (const lead of leads) {
      const contact = lead._embedded?.contacts?.[0];
      const contactId = contact?.id ? String(contact.id) : null;
      const contactDetails = contactId ? contactCache[contactId] : null;

      // Extract ALL custom fields including UTMs and form questions
      const customFields: Record<string, string> = {};
      let utmSource: string | undefined;
      let utmMedium: string | undefined;
      let utmCampaign: string | undefined;

      if (lead.custom_fields_values) {
        for (const cf of lead.custom_fields_values) {
          const fieldName = cf.field_name || cf.field_code;
          const value = cf.values?.[0]?.value;

          if (fieldName && value !== undefined && value !== null) {
            // Store in custom_fields
            customFields[fieldName] = String(value);

            // Also extract UTMs to dedicated columns
            const lowerName = fieldName.toLowerCase();
            if (lowerName === 'utm_source' || lowerName.includes('utm_source')) {
              utmSource = String(value);
            } else if (lowerName === 'utm_medium' || lowerName.includes('utm_medium')) {
              utmMedium = String(value);
            } else if (lowerName === 'utm_campaign' || lowerName.includes('utm_campaign')) {
              utmCampaign = String(value);
            }
          }
        }
      }

      // Calculate value - Kommo API returns price in REAIS (not centavos)
      // The lead.price field is already the actual value in the main currency unit
      const dealValue = Number(lead.price || 0);

      // Determine status based on pipeline stages AND value
      // IMPORTANT: Only consider as "won" if value >= 0.01
      let status: 'open' | 'won' | 'lost' = 'open';
      const statusId = lead.status_id;

      if (lostStatusIds.has(statusId)) {
        status = 'lost';
      } else if (wonStatusIds.has(statusId)) {
        // Only mark as won if has a meaningful value
        if (dealValue >= 0.01) {
          status = 'won';
        } else {
          // Has won status but no value - keep as open (incomplete sale)
          status = 'open';
          console.log(`[CRM Sync] Lead ${lead.id} in won status but value ${dealValue} < 0.01, marking as open`);
        }
      }

      deals.push({
        external_id: String(lead.id),
        external_pipeline_id: String(lead.pipeline_id),
        external_stage_id: String(lead.status_id),
        title: lead.name || 'Sem título',
        value: dealValue,
        currency: 'BRL',
        status,
        stage_name: stageNames[statusId] || lead.status?.name,
        created_date: new Date(lead.created_at * 1000).toISOString(),
        closed_date: lead.closed_at ? new Date(lead.closed_at * 1000).toISOString() : undefined,
        owner_name: lead.responsible_user?.name,
        contact_name: contactDetails?.name || contact?.name,
        contact_email: contactDetails?.email,
        contact_phone: contactDetails?.phone,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        // Merge lead custom fields with contact custom fields
        custom_fields: (() => {
          const merged = { ...customFields, ...(contactDetails?.custom_fields || {}) };
          return Object.keys(merged).length > 0 ? merged : undefined;
        })(),
      });
    }

    if (leads.length < limit) break;
    page++;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[CRM Sync] Processed ${deals.length} deals. Won: ${deals.filter(d => d.status === 'won').length}, Lost: ${deals.filter(d => d.status === 'lost').length}, Open: ${deals.filter(d => d.status === 'open').length}`);

  return deals;
}

// HubSpot integration
async function fetchHubSpotDeals(
  connection: Record<string, unknown>,
  syncType: 'full' | 'incremental'
): Promise<CRMDeal[]> {
  const accessToken = connection.access_token as string;

  if (!accessToken) {
    throw new Error('Token de acesso do HubSpot não encontrado');
  }

  const deals: CRMDeal[] = [];
  let after: string | undefined;

  while (true) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/deals');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', 'dealname,amount,dealstage,closedate,createdate,pipeline,hubspot_owner_id');
    url.searchParams.set('associations', 'contacts');

    if (after) {
      url.searchParams.set('after', after);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expirado - reautenticação necessária');
      }
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    for (const deal of results) {
      const props = deal.properties;

      deals.push({
        external_id: deal.id,
        external_pipeline_id: props.pipeline,
        external_stage_id: props.dealstage,
        title: props.dealname || 'Sem título',
        value: parseFloat(props.amount) || 0,
        currency: 'BRL',
        status: mapHubSpotStage(props.dealstage),
        stage_name: props.dealstage,
        created_date: props.createdate,
        closed_date: props.closedate,
      });
    }

    after = data.paging?.next?.after;
    if (!after) break;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return deals;
}

function mapHubSpotStage(stage: string): 'open' | 'won' | 'lost' {
  const lowerStage = (stage || '').toLowerCase();
  if (lowerStage.includes('closedwon') || lowerStage.includes('won')) return 'won';
  if (lowerStage.includes('closedlost') || lowerStage.includes('lost')) return 'lost';
  return 'open';
}

// Bitrix24 integration
async function fetchBitrixDeals(
  connection: Record<string, unknown>,
  syncType: 'full' | 'incremental'
): Promise<CRMDeal[]> {
  const apiKey = connection.api_key as string;
  const apiUrl = connection.api_url as string;

  if (!apiKey || !apiUrl) {
    throw new Error('Credenciais do Bitrix24 não configuradas');
  }

  const deals: CRMDeal[] = [];
  let start = 0;

  while (true) {
    const webhookUrl = `${apiUrl}/rest/${apiKey}/crm.deal.list?start=${start}`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Bitrix24 API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.result || [];

    if (results.length === 0) break;

    for (const deal of results) {
      deals.push({
        external_id: String(deal.ID),
        external_pipeline_id: deal.CATEGORY_ID,
        external_stage_id: deal.STAGE_ID,
        title: deal.TITLE || 'Sem título',
        value: parseFloat(deal.OPPORTUNITY) || 0,
        currency: deal.CURRENCY_ID || 'BRL',
        status: mapBitrixStage(deal.STAGE_ID),
        stage_name: deal.STAGE_ID,
        created_date: deal.DATE_CREATE,
        closed_date: deal.CLOSEDATE,
      });
    }

    if (!data.next) break;
    start = data.next;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return deals;
}

function mapBitrixStage(stage: string): 'open' | 'won' | 'lost' {
  const upperStage = (stage || '').toUpperCase();
  if (upperStage.includes('WON')) return 'won';
  if (upperStage.includes('LOSE') || upperStage.includes('LOST')) return 'lost';
  return 'open';
}

// RD Station CRM integration
async function fetchRDStationDeals(
  connection: Record<string, unknown>,
  syncType: 'full' | 'incremental'
): Promise<CRMDeal[]> {
  const accessToken = connection.access_token as string;

  if (!accessToken) {
    throw new Error('Token de acesso do RD Station não encontrado');
  }

  // RD Station CRM has a different API structure
  // This is a simplified implementation
  const deals: CRMDeal[] = [];

  const response = await fetch('https://crm.rdstation.com/api/v1/deals', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`RD Station API error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.deals || [];

  for (const deal of results) {
    deals.push({
      external_id: deal.id,
      external_pipeline_id: deal.deal_stage?.pipeline_id,
      external_stage_id: deal.deal_stage?.id,
      title: deal.name || 'Sem título',
      value: deal.amount || 0,
      currency: 'BRL',
      status: mapRDStationStatus(deal.win),
      stage_name: deal.deal_stage?.name,
      created_date: deal.created_at,
      closed_date: deal.closed_at,
      contact_name: deal.contact?.name,
      contact_email: deal.contact?.emails?.[0],
      contact_phone: deal.contact?.phones?.[0],
    });
  }

  return deals;
}

function mapRDStationStatus(win: boolean | null): 'open' | 'won' | 'lost' {
  if (win === true) return 'won';
  if (win === false) return 'lost';
  return 'open';
}

// GoHighLevel integration
async function fetchGoHighLevelDeals(
  connection: Record<string, unknown>,
  syncType: 'full' | 'incremental'
): Promise<CRMDeal[]> {
  const accessToken = connection.access_token as string;
  const locationId = (connection.config as Record<string, unknown>)?.location_id as string;

  if (!accessToken || !locationId) {
    throw new Error('Credenciais do GoHighLevel não configuradas');
  }

  const deals: CRMDeal[] = [];

  const response = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Version': '2021-07-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GoHighLevel API error: ${response.status}`);
  }

  const data = await response.json();
  const opportunities = data.opportunities || [];

  for (const opp of opportunities) {
    deals.push({
      external_id: opp.id,
      external_pipeline_id: opp.pipelineId,
      external_stage_id: opp.pipelineStageId,
      title: opp.name || 'Sem título',
      value: opp.monetaryValue || 0,
      currency: 'BRL',
      status: mapGHLStatus(opp.status),
      stage_name: opp.pipelineStageName,
      created_date: opp.createdAt,
      contact_name: opp.contact?.name,
      contact_email: opp.contact?.email,
      contact_phone: opp.contact?.phone,
    });
  }

  return deals;
}

function mapGHLStatus(status: string): 'open' | 'won' | 'lost' {
  const lowerStatus = (status || '').toLowerCase();
  if (lowerStatus === 'won') return 'won';
  if (lowerStatus === 'lost' || lowerStatus === 'abandoned') return 'lost';
  return 'open';
}

// HelpSys integration
async function fetchHelpSysDeals(
  connection: Record<string, unknown>,
  syncType: 'full' | 'incremental'
): Promise<CRMDeal[]> {
  const apiKey = connection.api_key as string;
  const apiUrl = connection.api_url as string;
  const connectionId = connection.id as string;
  const projectId = connection.project_id as string;

  if (!apiKey || !apiUrl) {
    throw new Error('Credenciais do HelpSys não configuradas');
  }

  // Create supabase client to save pipelines
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const deals: CRMDeal[] = [];
  const headers: Record<string, string> = { 'X-API-KEY': apiKey };

  // Fetch pipelines to get stage info and identify won/lost stages
  const stageNames: Record<number, string> = {};
  const wonStageNames = new Set<string>();
  const lostStageNames = new Set<string>();
  const allPipelineIds: number[] = [];
  // Map external pipeline id -> internal pipeline id (uuid)
  const pipelineIdMap: Record<string, string> = {};

  try {
    const pipelinesRes = await fetch(`${apiUrl}/pipelines.php`, { headers });
    if (pipelinesRes.ok) {
      const pipelinesData = await pipelinesRes.json();
      const pipelines = pipelinesData.dados || pipelinesData.data || [];

      for (const pipeline of pipelines) {
        allPipelineIds.push(pipeline.id);

        // Save pipeline to crm_pipelines table
        const pipelineName = pipeline.nome || pipeline.name || `Pipeline ${pipeline.id}`;
        const fases = pipeline.fases || [];
        const stagesJson = fases.map((f: Record<string, unknown>) => ({
          id: String(f.id),
          name: f.nome || f.name || '',
          color: f.cor || '',
          sort: f.ordem || 0,
          probabilidade: f.probabilidade,
        }));

        const { data: savedPipeline } = await supabase
          .from('crm_pipelines')
          .upsert({
            connection_id: connectionId,
            project_id: projectId,
            external_id: String(pipeline.id),
            external_name: pipelineName,
            is_default: pipeline.padrao === true || pipeline.is_default === true,
            stages: stagesJson,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'connection_id,external_id' })
          .select('id')
          .single();

        if (savedPipeline) {
          pipelineIdMap[String(pipeline.id)] = savedPipeline.id;
          console.log(`[CRM Sync] Saved pipeline: ${pipelineName} (ext: ${pipeline.id} -> int: ${savedPipeline.id})`);
        }

        for (const fase of fases) {
          stageNames[fase.id] = fase.nome || fase.name || '';
          const nomeUpper = (fase.nome || fase.name || '').toUpperCase().trim();
          if (nomeUpper.includes('FECHADO') || nomeUpper.includes('GANHO') || nomeUpper.includes('VENDA') || fase.probabilidade === 100) {
            wonStageNames.add(nomeUpper);
          }
          if (nomeUpper.includes('PERDIDO') || nomeUpper.includes('PERDA') || nomeUpper.includes('DESCARTADO') || fase.probabilidade === 0) {
            lostStageNames.add(nomeUpper);
          }
        }
      }
      console.log(`[CRM Sync] HelpSys pipelines: ${allPipelineIds.length}, stages: ${Object.keys(stageNames).length}`);
      console.log(`[CRM Sync] HelpSys won stages: ${JSON.stringify([...wonStageNames])}`);
      console.log(`[CRM Sync] HelpSys lost stages: ${JSON.stringify([...lostStageNames])}`);
    }
  } catch (e) {
    console.error('[CRM Sync] Error fetching HelpSys pipelines:', e);
  }

  // If no pipelines found, try without
  const pipelinesToQuery = allPipelineIds.length > 0 ? allPipelineIds : [null as number | null];

  const seenIds = new Set<string>();

  for (const pipelineId of pipelinesToQuery) {
    try {
      while (true) {
        const url = new URL(`${apiUrl}/leads.php`);
        if (pipelineId !== null) {
          url.searchParams.set('pipeline', String(pipelineId));
        }

        // Since pagination isn't officially documented for GET /leads.php, 
        // but the user reports 690k (partial), we'll try to fetch without limit first.
        // If the API returns a 'total' field, we can use it to determine if we got everything.

        console.log(`[CRM Sync] Fetching HelpSys leads from: ${url.toString()}`);
        const response = await fetch(url.toString(), { method: 'GET', headers });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[CRM Sync] HelpSys API error ${response.status} for pipeline ${pipelineId}:`, errorBody);
          break;
        }

        const data = await response.json();
        const leads = Array.isArray(data) ? data : (data.dados || data.data || []);

        if (leads.length === 0) break;

        // Log API response structure if it has metadata
        if (data.total !== undefined) {
          console.log(`[CRM Sync] HelpSys API reported total: ${data.total}, received in this call: ${leads.length}`);
        }

        // Log first lead structure for debugging
        if (leads.length > 0 && deals.length === 0) {
          console.log(`[CRM Sync] HelpSys sample lead keys:`, JSON.stringify(Object.keys(leads[0])));
          const sample = leads[0];
          // Log all date-related fields specifically
          const dateFields: Record<string, unknown> = {};
          for (const key of Object.keys(sample)) {
            const val = sample[key];
            if (key.includes('data') || key.includes('date') || key.includes('atualiz') || key.includes('fecha') || key.includes('ganho') || key.includes('criacao') || key.includes('created') || key.includes('updated')) {
              dateFields[key] = val;
            }
          }
          console.log(`[CRM Sync] HelpSys sample lead DATE fields:`, JSON.stringify(dateFields));
        }

        for (const lead of leads) {
          const leadId = String(lead.id || lead.id_lead);
          if (seenIds.has(leadId)) continue;
          seenIds.add(leadId);

          const contato = lead.contato || {};
          const contactName = contato.nome || '';
          const contactEmail = contato.email || '';
          const contactPhone = contato.telefone || '';
          const leadTitle = lead.nome_negocio || contactName || 'Lead sem nome';

          // Extract value - checking multiple possible fields including properties_internas
          let valor = Number(lead.valor || lead.valor_venda || lead.valor_negocio || 0);
          const propriedades = Array.isArray(lead.propriedades) ? lead.propriedades : [];
          const propriedadesInternas = lead.propriedades_internas || {};

          // Check propriedades array
          for (const prop of propriedades) {
            const idInterno = String(prop.id_interno || '').toLowerCase();
            if (idInterno === 'valor' || idInterno === 'valor_venda' || idInterno === 'faturamento' || idInterno === 'valor_negocio') {
              const propValor = Number(prop.valor) || 0;
              if (propValor > valor) valor = propValor;
            }
          }

          // Check propriedades_internas object (documented in swagger/openapi)
          if (propriedadesInternas.valor) valor = Math.max(valor, Number(propriedadesInternas.valor) || 0);
          if (propriedadesInternas.valor_venda) valor = Math.max(valor, Number(propriedadesInternas.valor_venda) || 0);

          const stageId = lead.status;
          const stageName = lead.status_nome || stageNames[stageId] || '';
          const stageNameUpper = stageName.toUpperCase().trim();

          let status: 'open' | 'won' | 'lost' = 'open';
          const stageNameTrimmed = stageName.trim();
          if (wonStageNames.has(stageNameUpper) ||
            stageNameUpper.includes('FECHADO') ||
            stageNameUpper.includes('GANHO') ||
            stageNameUpper.includes('VENDA') ||
            stageNameUpper.includes('VENDIDO') ||
            stageNameUpper.includes('PAGO') ||
            stageNameUpper.includes('ASSINADO') ||
            stageNameUpper.includes('FINALIZADO') ||
            stageNameUpper.includes('CONFIRMADO') ||
            stageNameUpper.includes('CONCLUÍDO')) {
            status = 'won';
          } else if (lostStageNames.has(stageNameUpper) ||
            stageNameUpper.includes('PERDIDO') ||
            stageNameUpper.includes('PERDA') ||
            stageNameUpper.includes('DESCARTADO') ||
            stageNameUpper.includes('CANCELADO')) {
            status = 'lost';
          }

          // DEBUG LOG for potential won deals with value
          if (status === 'won' || stageNameUpper.includes('VENDA') || stageNameUpper.includes('PAGO')) {
            console.log(`[CRM Sync DEBUG] Lead ${leadId}: Status=${status}, Stage=${stageName}, Value=${valor}`);
          }

          const utm = lead.utm || {};
          const extPipelineId = String(lead.pipeline || pipelineId || '');

          // Use Creation Date as Closed Date for 2M faturamento (per user request)
          let closedDate = lead.data_criacao || lead.created_at;
          if (!closedDate && status === 'won') {
            closedDate = lead.data_fechamento || lead.data_ganho || lead.data_modificacao || lead.data_atualizacao;
          }

          deals.push({
            external_id: leadId,
            external_pipeline_id: extPipelineId,
            external_stage_id: String(stageId || ''),
            title: leadTitle,
            value: valor,
            currency: 'BRL',
            status,
            stage_name: stageName.trim(),
            created_date: lead.data_criacao || lead.created_at,
            closed_date: closedDate || undefined,
            owner_name: lead.nome_proprietario || '',
            contact_name: contactName || undefined,
            contact_email: contactEmail || undefined,
            contact_phone: contactPhone || undefined,
            utm_source: utm.source || undefined,
            utm_medium: utm.medium || undefined,
            utm_campaign: utm.campaign || undefined,
            custom_fields: {
              ...propriedadesInternas,
              ...(Array.isArray(propriedades) ? propriedades.reduce((acc: any, p: any) => {
                acc[String(p.id_interno || '')] = String(p.valor || '');
                return acc;
              }, {}) : {})
            },
            _pipeline_uuid: pipelineIdMap[extPipelineId],
          } as CRMDeal & { _pipeline_uuid?: string });
        }

        // If we don't have pagination params, we assume we got all data or the API doesn't support it.
        // We break the loop to avoid infinite calls if page++ is ignored.
        break;
      }

      const stageStats = deals.reduce((acc: Record<string, number>, d) => {
        const name = d.stage_name || 'Sem Nome';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      console.log(`[CRM Sync] HelpSys Stage Distribution:`, JSON.stringify(stageStats));

      console.log(`[CRM Sync] HelpSys pipeline ${pipelineId} complete. Unique leads so far: ${seenIds.size}`);
    } catch (e) {
      console.error(`[CRM Sync] Error fetching HelpSys leads for pipeline ${pipelineId}:`, e);
    }
  }

  console.log(`[CRM Sync] HelpSys total: ${deals.length} leads. Won: ${deals.filter(d => d.status === 'won').length}, Lost: ${deals.filter(d => d.status === 'lost').length}`);
  return deals;
}
