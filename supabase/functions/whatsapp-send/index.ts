import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessagePayload {
  phone?: string;
  message: string;
  subscriptionId?: string;
  messageType?: string;
  instanceId?: string;
  targetType?: 'phone' | 'group';
  groupId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Default Evolution API config (fallback for legacy calls)
    const DEFAULT_EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL');
    const DEFAULT_EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const DEFAULT_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: SendMessagePayload = await req.json();
    const { 
      phone, 
      message, 
      subscriptionId, 
      messageType = 'test',
      instanceId,
      targetType = 'phone',
      groupId
    } = payload;

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let evolutionUrl = DEFAULT_EVOLUTION_URL;
    let evolutionKey = DEFAULT_EVOLUTION_KEY;
    let instanceName = DEFAULT_INSTANCE;

    // If instanceId is provided, get instance details from database
    if (instanceId) {
      console.log(`[WHATSAPP-SEND] Using instance ${instanceId}`);
      
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, instance_status, token')
        .eq('id', instanceId)
        .single();

      if (instanceError || !instance) {
        console.error('[WHATSAPP-SEND] Instance not found:', instanceError);
        return new Response(
          JSON.stringify({ error: 'Instance not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (instance.instance_status !== 'connected') {
        console.error('[WHATSAPP-SEND] Instance not connected:', instance.instance_status);
        return new Response(
          JSON.stringify({ error: 'Instance is not connected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      instanceName = instance.instance_name;
      // Use instance-specific token if available
      if (instance.token) {
        evolutionKey = instance.token;
        console.log(`[WHATSAPP-SEND] Using instance token for authentication`);
      }
    }

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      console.error('[WHATSAPP-SEND] Missing Evolution API configuration');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let evolutionResponse;
    let evolutionData;

    // Send to group or phone based on targetType
    if (targetType === 'group' && groupId) {
      console.log(`[WHATSAPP-SEND] Sending to group ${groupId} via instance ${instanceName}`);
      console.log(`[WHATSAPP-SEND] Message length: ${message.length} chars`);

      // Send to group via Evolution API
      evolutionResponse = await fetch(
        `${evolutionUrl}/message/sendText/${instanceName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionKey,
          },
          body: JSON.stringify({
            number: groupId,
            text: message,
          }),
        }
      );

      evolutionData = await evolutionResponse.json();
      console.log(`[WHATSAPP-SEND] Evolution group response:`, JSON.stringify(evolutionData));

    } else {
      // Send to phone number
      if (!phone) {
        return new Response(
          JSON.stringify({ error: 'Phone number is required for phone target' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Format phone number (remove non-digits, ensure country code)
      let formattedPhone = phone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      console.log(`[WHATSAPP-SEND] Sending to phone ${formattedPhone} via instance ${instanceName}`);
      console.log(`[WHATSAPP-SEND] Message length: ${message.length} chars`);

      // Send via Evolution API
      evolutionResponse = await fetch(
        `${evolutionUrl}/message/sendText/${instanceName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        }
      );

      evolutionData = await evolutionResponse.json();
      console.log(`[WHATSAPP-SEND] Evolution phone response:`, JSON.stringify(evolutionData));
    }

    // Log the message in the database
    if (subscriptionId) {
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
