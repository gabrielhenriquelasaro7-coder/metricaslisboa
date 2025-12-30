import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data?: {
    state?: string;
    statusReason?: number;
    pushName?: string;
    wuid?: string;
    profilePictureUrl?: string;
  };
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: EvolutionWebhookPayload = await req.json();
    
    console.log(`[WHATSAPP-WEBHOOK] Received event: ${payload.event} for instance: ${payload.instance}`);
    console.log(`[WHATSAPP-WEBHOOK] Payload:`, JSON.stringify(payload));

    const instanceName = payload.instance;
    if (!instanceName) {
      console.log('[WHATSAPP-WEBHOOK] No instance name in payload');
      return new Response(
        JSON.stringify({ success: true, message: 'No instance to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the instance in our database
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_status')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (instanceError) {
      console.error('[WHATSAPP-WEBHOOK] Error finding instance:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instance) {
      console.log(`[WHATSAPP-WEBHOOK] Instance ${instanceName} not found in database`);
      return new Response(
        JSON.stringify({ success: true, message: 'Instance not managed by us' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process different event types
    let updateData: Record<string, unknown> = {};

    switch (payload.event) {
      case 'connection.update':
        const state = payload.data?.state;
        console.log(`[WHATSAPP-WEBHOOK] Connection state: ${state}`);
        
        if (state === 'open') {
          updateData = {
            instance_status: 'connected',
            phone_connected: payload.data?.wuid || null,
            qr_code: null,
            qr_code_expires_at: null,
          };
        } else if (state === 'close' || state === 'refused') {
          updateData = {
            instance_status: 'disconnected',
            phone_connected: null,
          };
        } else if (state === 'connecting') {
          updateData = {
            instance_status: 'connecting',
          };
        }
        break;

      case 'qrcode.updated':
        console.log(`[WHATSAPP-WEBHOOK] QR Code updated`);
        // QR code updates are handled by the instance manager
        break;

      case 'status.instance':
        const status = payload.data?.state;
        console.log(`[WHATSAPP-WEBHOOK] Instance status: ${status}`);
        
        if (status === 'open') {
          updateData = { instance_status: 'connected' };
        } else if (status === 'close') {
          updateData = { instance_status: 'disconnected', phone_connected: null };
        }
        break;

      case 'logout.instance':
        console.log(`[WHATSAPP-WEBHOOK] Instance logged out`);
        updateData = {
          instance_status: 'disconnected',
          phone_connected: null,
          qr_code: null,
          qr_code_expires_at: null,
        };
        break;

      default:
        console.log(`[WHATSAPP-WEBHOOK] Unhandled event type: ${payload.event}`);
    }

    // Update instance if we have data to update
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('whatsapp_instances')
        .update(updateData)
        .eq('id', instance.id);

      if (updateError) {
        console.error('[WHATSAPP-WEBHOOK] Error updating instance:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update instance' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[WHATSAPP-WEBHOOK] Instance ${instanceName} updated:`, updateData);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WHATSAPP-WEBHOOK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
