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

      // Process deals
      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const deal of deals) {
        try {
          const dealData = {
            connection_id,
            project_id,
            external_id: deal.external_id,
            external_pipeline_id: deal.external_pipeline_id,
            external_stage_id: deal.external_stage_id,
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

          // Upsert deal
          const { error: upsertError } = await supabase
            .from('crm_deals')
            .upsert(dealData, { 
              onConflict: 'connection_id,external_id',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error(`[CRM Sync] Failed to upsert deal ${deal.external_id}:`, upsertError);
            failed++;
          } else {
            // Check if it was created or updated (simplified - count as created if no prior record)
            const { data: existing } = await supabase
              .from('crm_deals')
              .select('id')
              .eq('connection_id', connection_id)
              .eq('external_id', deal.external_id)
              .single();
            
            if (existing) {
              updated++;
            } else {
              created++;
            }
          }
        } catch (dealError) {
          console.error(`[CRM Sync] Error processing deal:`, dealError);
          failed++;
        }
      }

      // Update sync log with success
      await supabase
        .from('crm_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: deals.length,
          records_created: created,
          records_updated: updated,
          records_failed: failed,
        })
        .eq('id', syncLog.id);

      console.log(`[CRM Sync] Completed: ${created} created, ${updated} updated, ${failed} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          sync_id: syncLog.id,
          records_processed: deals.length,
          records_created: created,
          records_updated: updated,
          records_failed: failed,
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

  const deals: CRMDeal[] = [];
  let page = 1;
  const limit = 250;

  // Cache for contact details
  const contactCache: Record<string, { email?: string; phone?: string; name?: string }> = {};

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
            
            contactCache[String(contact.id)] = {
              name: contact.name,
              email,
              phone,
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
      
      deals.push({
        external_id: String(lead.id),
        external_pipeline_id: String(lead.pipeline_id),
        external_stage_id: String(lead.status_id),
        title: lead.name || 'Sem título',
        value: (lead.price || 0) / 100, // Kommo stores in cents
        currency: 'BRL',
        status: mapKommoStatus(lead.status_id),
        stage_name: lead.status?.name,
        created_date: new Date(lead.created_at * 1000).toISOString(),
        closed_date: lead.closed_at ? new Date(lead.closed_at * 1000).toISOString() : undefined,
        owner_name: lead.responsible_user?.name,
        contact_name: contactDetails?.name || contact?.name,
        contact_email: contactDetails?.email,
        contact_phone: contactDetails?.phone,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
    }

    if (leads.length < limit) break;
    page++;
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return deals;
}

function mapKommoStatus(statusId: number): 'open' | 'won' | 'lost' {
  // Kommo status 142 = won, 143 = lost (these are standard IDs)
  if (statusId === 142) return 'won';
  if (statusId === 143) return 'lost';
  return 'open';
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
