import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessagePayload {
  phone: string;
  message: string;
  subscriptionId?: string;
  messageType?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!EVOLUTION_URL || !EVOLUTION_KEY || !INSTANCE) {
      console.error('[WHATSAPP-SEND] Missing Evolution API configuration');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: SendMessagePayload = await req.json();
    const { phone, message, subscriptionId, messageType = 'test' } = payload;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove non-digits, ensure country code)
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[WHATSAPP-SEND] Sending message to ${formattedPhone}`);
    console.log(`[WHATSAPP-SEND] Message length: ${message.length} chars`);

    // Send via Evolution API
    const evolutionResponse = await fetch(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_KEY,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      }
    );

    const evolutionData = await evolutionResponse.json();
    console.log(`[WHATSAPP-SEND] Evolution response:`, JSON.stringify(evolutionData));

    // Log the message in the database
    if (subscriptionId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { error: logError } = await supabase
        .from('whatsapp_messages_log')
        .insert({
          subscription_id: subscriptionId,
          message_type: messageType,
          content: message.substring(0, 1000), // Limit content stored
          status: evolutionResponse.ok ? 'sent' : 'failed',
          error_message: evolutionResponse.ok ? null : JSON.stringify(evolutionData),
        });

      if (logError) {
        console.error('[WHATSAPP-SEND] Error logging message:', logError);
      }
    }

    if (!evolutionResponse.ok) {
      console.error('[WHATSAPP-SEND] Evolution API error:', evolutionData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send message',
          details: evolutionData 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WHATSAPP-SEND] Message sent successfully`);
    return new Response(
      JSON.stringify({ success: true, data: evolutionData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WHATSAPP-SEND] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
