import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadSyncRequest {
  project_id: string;
  page_id: string;
  since?: string; // YYYY-MM-DD
  until?: string; // YYYY-MM-DD
}

interface MetaLead {
  id: string;
  created_time: string;
  field_data: Array<{ name: string; values: string[] }>;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  campaign_id?: string;
}

interface LeadgenForm {
  id: string;
  name: string;
  status: string;
  leads_count: number;
  created_time: string;
}

// Helper: delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Extract field value from lead field_data
function extractFieldValue(fieldData: Array<{ name: string; values: string[] }> | null, fieldNames: string[]): string | null {
  if (!fieldData || !Array.isArray(fieldData)) return null;
  
  for (const name of fieldNames) {
    const field = fieldData.find(f => 
      f.name?.toLowerCase().includes(name.toLowerCase())
    );
    if (field && field.values && field.values.length > 0) {
      return field.values[0];
    }
  }
  return null;
}

// Fetch leadgen forms from a Facebook page
async function fetchLeadgenForms(pageId: string, accessToken: string): Promise<LeadgenForm[]> {
  console.log(`📋 Fetching leadgen forms for page: ${pageId}`);
  
  const allForms: LeadgenForm[] = [];
  let url: string | null = `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name,status,leads_count,created_time&access_token=${accessToken}`;
  
  while (url) {
    const res: Response = await fetch(url);
    const json: { data?: LeadgenForm[]; error?: { message: string }; paging?: { next?: string } } = await res.json();
    
    if (json.error) {
      console.error('❌ Error fetching forms:', json.error);
      throw new Error(`Meta API Error: ${json.error.message}`);
    }
    
    if (json.data && Array.isArray(json.data)) {
      allForms.push(...json.data);
      console.log(`  Found ${json.data.length} forms in this page`);
    }
    
    url = json.paging?.next || null;
    if (url) await delay(250);
  }
  
  console.log(`📋 Total forms found: ${allForms.length}`);
  return allForms;
}

// Fetch leads from a specific form
async function fetchLeadsFromForm(
  formId: string, 
  formName: string,
  accessToken: string, 
  sinceTimestamp?: number
): Promise<MetaLead[]> {
  console.log(`📥 Fetching leads from form: ${formName} (${formId})`);
  
  const allLeads: MetaLead[] = [];
  const seenIds = new Set<string>();
  
  let baseUrl = `https://graph.facebook.com/v19.0/${formId}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,campaign_id&limit=100&access_token=${accessToken}`;
  
  // Add date filter if provided
  if (sinceTimestamp) {
    const filtering = JSON.stringify([{
      field: 'time_created',
      operator: 'GREATER_THAN',
      value: sinceTimestamp
    }]);
    baseUrl += `&filtering=${encodeURIComponent(filtering)}`;
  }
  
  let url: string | null = baseUrl;
  let pageCount = 0;
  
  interface LeadsResponse {
    data?: MetaLead[];
    error?: { message: string };
    paging?: { next?: string };
  }
  
  while (url) {
    pageCount++;
    const res: Response = await fetch(url);
    const json: LeadsResponse = await res.json();
    
    if (json.error) {
      console.error('❌ Error fetching leads:', json.error);
      // Don't throw, just log and continue with other forms
      break;
    }
    
    if (json.data && Array.isArray(json.data)) {
      for (const lead of json.data) {
        // Deduplicate in memory
        if (!seenIds.has(lead.id)) {
          seenIds.add(lead.id);
          allLeads.push(lead);
        }
      }
    }
    
    url = json.paging?.next || null;
    
    // Rate limiting
    if (url) {
      await delay(250);
    }
    
    // Safety limit
    if (pageCount >= 100) {
      console.log('⚠️ Reached pagination limit (100 pages)');
      break;
    }
  }
  
  console.log(`  📥 Fetched ${allLeads.length} unique leads from ${formName}`);
  return allLeads;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');

    if (!metaAccessToken) {
      throw new Error('META_ACCESS_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: LeadSyncRequest = await req.json();
    const { project_id, page_id, since, until } = body;

    console.log('🚀 Starting leads sync:', { project_id, page_id, since, until });

    if (!project_id || !page_id) {
      throw new Error('project_id and page_id are required');
    }

    // Calculate timestamp for filtering
    let sinceTimestamp: number | undefined;
    if (since) {
      sinceTimestamp = Math.floor(new Date(since).getTime() / 1000);
    }

    // Step 1: Fetch all leadgen forms from the page
    const forms = await fetchLeadgenForms(page_id, metaAccessToken);

    // Step 2: Save/update forms in database
    const formsToSave = forms.map(form => ({
      id: form.id,
      project_id,
      page_id,
      name: form.name,
      status: form.status,
      leads_count: form.leads_count || 0,
      last_synced_at: new Date().toISOString(),
    }));

    if (formsToSave.length > 0) {
      const { error: formsError } = await supabase
        .from('leadgen_forms')
        .upsert(formsToSave, { onConflict: 'id,project_id' });

      if (formsError) {
        console.error('❌ Error saving forms:', formsError);
      } else {
        console.log(`✅ Saved ${formsToSave.length} forms`);
      }
    }

    // Step 3: Fetch leads from each form
    let totalLeadsSaved = 0;
    let totalLeadsFound = 0;

    for (const form of forms) {
      try {
        const leads = await fetchLeadsFromForm(
          form.id, 
          form.name, 
          metaAccessToken, 
          sinceTimestamp
        );

        totalLeadsFound += leads.length;

        if (leads.length === 0) continue;

        // Filter by until date if provided
        let filteredLeads = leads;
        if (until) {
          const untilDate = new Date(until);
          untilDate.setHours(23, 59, 59, 999);
          filteredLeads = leads.filter(lead => 
            new Date(lead.created_time) <= untilDate
          );
        }

        // Map leads for database
        const leadsToSave = filteredLeads.map(lead => ({
          id: lead.id,
          project_id,
          form_id: form.id,
          form_name: form.name,
          ad_id: lead.ad_id || null,
          ad_name: lead.ad_name || null,
          adset_id: lead.adset_id || null,
          campaign_id: lead.campaign_id || null,
          created_time: lead.created_time,
          field_data: lead.field_data,
          lead_name: extractFieldValue(lead.field_data, ['full_name', 'nome', 'name', 'primeiro_nome', 'first_name']),
          lead_email: extractFieldValue(lead.field_data, ['email', 'e-mail', 'e_mail']),
          lead_phone: extractFieldValue(lead.field_data, ['phone_number', 'phone', 'telefone', 'celular', 'whatsapp']),
          synced_at: new Date().toISOString(),
        }));

        // Batch insert with ON CONFLICT DO NOTHING
        if (leadsToSave.length > 0) {
          // Insert in batches of 100
          for (let i = 0; i < leadsToSave.length; i += 100) {
            const batch = leadsToSave.slice(i, i + 100);
            
            const { error: leadsError } = await supabase
              .from('leads')
              .upsert(batch, { 
                onConflict: 'id,project_id',
                ignoreDuplicates: true 
              });

            if (leadsError) {
              console.error(`❌ Error saving leads batch:`, leadsError);
            } else {
              totalLeadsSaved += batch.length;
            }
          }
        }

        // Small delay between forms
        await delay(500);

      } catch (formError) {
        console.error(`❌ Error processing form ${form.name}:`, formError);
        // Continue with other forms
      }
    }

    // Step 4: Update project sync status
    await supabase
      .from('projects')
      .update({ 
        facebook_page_id: page_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id);

    const result = {
      success: true,
      forms_found: forms.length,
      leads_found: totalLeadsFound,
      leads_saved: totalLeadsSaved,
      period: { since, until },
    };

    console.log('✅ Leads sync completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Leads sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
