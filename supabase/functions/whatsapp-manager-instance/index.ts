import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption utilities
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32) || '');
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptToken(token: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedToken: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, instanceId, displayName, isManager } = await req.json();

    // Only handle manager instances
    if (!isManager) {
      return new Response(JSON.stringify({ success: false, error: 'Use the project-specific endpoint' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const MAX_INSTANCES = 4;

    // CREATE
    if (action === 'create') {
      // Check limit
      const { count } = await supabase
        .from('whatsapp_manager_instances')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((count || 0) >= MAX_INSTANCES) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Limite de ${MAX_INSTANCES} conexões atingido` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate unique name
      const instanceName = `manager_${user.id.slice(0, 8)}_${Date.now()}`;

      // Create on Evolution API
      const createRes = await fetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey!
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });

      const createData = await createRes.json();
      
      if (!createRes.ok) {
        throw new Error(createData.message || 'Erro ao criar instância');
      }

      // Encrypt token
      const encryptedToken = createData.hash?.apikey 
        ? await encryptToken(createData.hash.apikey) 
        : null;

      // Save to DB
      const { data: instance, error: insertError } = await supabase
        .from('whatsapp_manager_instances')
        .insert({
          user_id: user.id,
          instance_name: instanceName,
          display_name: displayName || 'Meu WhatsApp',
          token: encryptedToken,
          instance_status: 'disconnected'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, instance }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For other actions, get instance first
    if (!instanceId) {
      return new Response(JSON.stringify({ success: false, error: 'instanceId obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: instance, error: fetchError } = await supabase
      .from('whatsapp_manager_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !instance) {
      return new Response(JSON.stringify({ success: false, error: 'Instância não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CONNECT
    if (action === 'connect') {
      // First check if instance exists on Evolution, if not recreate it
      const checkRes = await fetch(`${evolutionApiUrl}/instance/connectionState/${instance.instance_name}`, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey! }
      });
      
      // If instance doesn't exist, recreate it
      if (!checkRes.ok || checkRes.status === 404) {
        console.log('Instance not found on Evolution, recreating...');
        
        const recreateRes = await fetch(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey!
          },
          body: JSON.stringify({
            instanceName: instance.instance_name,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
          })
        });

        if (!recreateRes.ok) {
          const recreateError = await recreateRes.json();
          console.error('Failed to recreate instance:', recreateError);
        }
      }

      // Now try to connect
      const connectRes = await fetch(`${evolutionApiUrl}/instance/connect/${instance.instance_name}`, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey! }
      });

      const connectData = await connectRes.json();
      console.log('Connect response:', JSON.stringify(connectData));

      if (connectData.base64) {
        const expiresAt = new Date(Date.now() + 45000).toISOString();
        
        await supabase
          .from('whatsapp_manager_instances')
          .update({ 
            qr_code: connectData.base64, 
            qr_code_expires_at: expiresAt,
            instance_status: 'connecting'
          })
          .eq('id', instanceId);

        return new Response(JSON.stringify({ 
          success: true, 
          qrCode: connectData.base64,
          expiresAt 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if code is in qrcode field (some versions use this)
      if (connectData.qrcode?.base64) {
        const expiresAt = new Date(Date.now() + 45000).toISOString();
        
        await supabase
          .from('whatsapp_manager_instances')
          .update({ 
            qr_code: connectData.qrcode.base64, 
            qr_code_expires_at: expiresAt,
            instance_status: 'connecting'
          })
          .eq('id', instanceId);

        return new Response(JSON.stringify({ 
          success: true, 
          qrCode: connectData.qrcode.base64,
          expiresAt 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Already connected
      if (connectData.instance?.state === 'open') {
        await supabase
          .from('whatsapp_manager_instances')
          .update({ 
            instance_status: 'connected',
            qr_code: null,
            qr_code_expires_at: null
          })
          .eq('id', instanceId);

        return new Response(JSON.stringify({ 
          success: true, 
          status: 'connected',
          message: 'Já conectado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If we still don't have QR, return helpful error
      console.error('No QR code in response:', connectData);
      throw new Error('Aguarde alguns segundos e tente novamente. A instância está sendo preparada.');
    }

    // STATUS
    if (action === 'status') {
      const statusRes = await fetch(`${evolutionApiUrl}/instance/connectionState/${instance.instance_name}`, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey! }
      });

      const statusData = await statusRes.json();
      const isConnected = statusData.instance?.state === 'open';
      
      let phoneNumber = instance.phone_connected;
      
      if (isConnected && !phoneNumber) {
        // Try to get phone number
        try {
          const infoRes = await fetch(`${evolutionApiUrl}/instance/fetchInstances?instanceName=${instance.instance_name}`, {
            method: 'GET',
            headers: { 'apikey': evolutionApiKey! }
          });
          const infoData = await infoRes.json();
          if (infoData[0]?.instance?.owner) {
            phoneNumber = infoData[0].instance.owner.split('@')[0];
          }
        } catch (e) {
          console.error('Error fetching phone:', e);
        }
      }

      await supabase
        .from('whatsapp_manager_instances')
        .update({ 
          instance_status: isConnected ? 'connected' : 'disconnected',
          phone_connected: isConnected ? phoneNumber : null,
          qr_code: isConnected ? null : instance.qr_code,
          qr_code_expires_at: isConnected ? null : instance.qr_code_expires_at
        })
        .eq('id', instanceId);

      return new Response(JSON.stringify({ 
        success: true, 
        status: isConnected ? 'connected' : 'disconnected',
        phone: phoneNumber
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DISCONNECT
    if (action === 'disconnect') {
      await fetch(`${evolutionApiUrl}/instance/logout/${instance.instance_name}`, {
        method: 'DELETE',
        headers: { 'apikey': evolutionApiKey! }
      });

      await supabase
        .from('whatsapp_manager_instances')
        .update({ 
          instance_status: 'disconnected',
          phone_connected: null,
          qr_code: null,
          qr_code_expires_at: null
        })
        .eq('id', instanceId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE
    if (action === 'delete') {
      // Delete from Evolution API
      try {
        await fetch(`${evolutionApiUrl}/instance/delete/${instance.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': evolutionApiKey! }
        });
      } catch (e) {
        console.error('Error deleting from Evolution:', e);
      }

      // Delete from DB (configs will be set to null via foreign key)
      await supabase
        .from('whatsapp_manager_instances')
        .delete()
        .eq('id', instanceId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // LIST_GROUPS
    if (action === 'list_groups') {
      const groupsRes = await fetch(`${evolutionApiUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=false`, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey! }
      });

      const groupsData = await groupsRes.json();
      const groups = (groupsData || []).map((g: any) => ({
        id: g.id,
        name: g.subject || g.name || 'Grupo sem nome'
      }));

      return new Response(JSON.stringify({ success: true, groups }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
