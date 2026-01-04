import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstancePayload {
  action: 'create' | 'connect' | 'status' | 'disconnect' | 'delete' | 'list_groups';
  instanceId?: string;
  projectId?: string;
  displayName?: string;
}

// Simple encryption using AES-GCM with a derived key
const ENCRYPTION_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32) || 'default-encryption-key-32bytes!';

async function getEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('whatsapp-token-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptToken(token: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token)
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Convert to base64 manually for Deno compatibility
  return `encrypted:${btoa(String.fromCharCode(...combined))}`;
}

async function decryptToken(encryptedToken: string): Promise<string | null> {
  if (!encryptedToken || !encryptedToken.startsWith('encrypted:')) {
    // Return as-is if not encrypted (legacy tokens)
    return encryptedToken;
  }
  
  try {
    const key = await getEncryptionKey();
    const decoder = new TextDecoder();
    
    // Decode base64 manually for Deno compatibility
    const base64String = encryptedToken.replace('encrypted:', '');
    const binaryString = atob(base64String);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[INSTANCE-MANAGER] Error decrypting token:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      console.error('[INSTANCE-MANAGER] Missing Evolution API configuration');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: InstancePayload = await req.json();
    const { action, instanceId, projectId, displayName } = payload;

    console.log(`[INSTANCE-MANAGER] Action: ${action}, InstanceId: ${instanceId}, ProjectId: ${projectId}`);

    switch (action) {
      case 'create': {
        if (!projectId) {
          return new Response(
            JSON.stringify({ error: 'projectId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user owns the project
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (projectError || !project) {
          return new Response(
            JSON.stringify({ error: 'Project not found or access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check instance limit (max 3 per project)
        const { count } = await supabase
          .from('whatsapp_instances')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        if (count && count >= 3) {
          return new Response(
            JSON.stringify({ error: 'Maximum 3 instances per project' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate unique instance name
        const instanceName = `v4-${projectId.substring(0, 8)}-${Date.now()}`;
        
        console.log(`[INSTANCE-MANAGER] Creating instance: ${instanceName}`);

        // Create instance in Evolution API
        const createResponse = await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_KEY,
          },
          body: JSON.stringify({
            instanceName: instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });

        const createData = await createResponse.json();
        console.log(`[INSTANCE-MANAGER] Evolution create response:`, JSON.stringify(createData));

        if (!createResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to create instance', details: createData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Extract the token/hash from the response
        // Evolution API returns token in different locations depending on version
        const instanceToken = createData.hash || createData.token || createData.instance?.token || createData.instance?.hash || null;
        console.log(`[INSTANCE-MANAGER] Instance token captured: ${instanceToken ? 'yes' : 'no'}`);

        // Encrypt the token before storing
        const encryptedToken = instanceToken ? await encryptToken(instanceToken) : null;
        console.log(`[INSTANCE-MANAGER] Token encrypted: ${encryptedToken ? 'yes' : 'no'}`);

        // Save instance to database with encrypted token
        const { data: instance, error: insertError } = await supabase
          .from('whatsapp_instances')
          .insert({
            project_id: projectId,
            user_id: user.id,
            instance_name: instanceName,
            display_name: displayName || 'Nova Conexão',
            instance_status: 'disconnected',
            token: encryptedToken,
          })
          .select('id, project_id, user_id, instance_name, display_name, instance_status, phone_connected, created_at, updated_at')
          .single();

        if (insertError) {
          console.error('[INSTANCE-MANAGER] Error saving instance:', insertError);
          // Try to delete from Evolution API
          await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: { 'apikey': EVOLUTION_KEY },
          });
          return new Response(
            JSON.stringify({ error: 'Failed to save instance' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, instance }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'connect': {
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'instanceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', instanceId)
          .eq('user_id', user.id)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[INSTANCE-MANAGER] Connecting instance: ${instance.instance_name}`);

        // Decrypt and use instance token if available, otherwise fall back to global key
        const decryptedToken = instance.token ? await decryptToken(instance.token) : null;
        const authKey = decryptedToken || EVOLUTION_KEY;
        console.log(`[INSTANCE-MANAGER] Using ${decryptedToken ? 'instance token' : 'global key'} for auth`);

        // Get QR code from Evolution API
        const connectResponse = await fetch(
          `${EVOLUTION_URL}/instance/connect/${instance.instance_name}`,
          {
            method: 'GET',
            headers: { 'apikey': authKey },
          }
        );

        const connectData = await connectResponse.json();
        console.log(`[INSTANCE-MANAGER] Evolution connect response:`, JSON.stringify(connectData));

        if (!connectResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to get QR code', details: connectData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update instance with QR code
        const qrCode = connectData.base64 || connectData.qrcode?.base64;
        const expiresAt = new Date(Date.now() + 60 * 1000); // QR expires in 60s

        await supabase
          .from('whatsapp_instances')
          .update({
            qr_code: qrCode,
            qr_code_expires_at: expiresAt.toISOString(),
            instance_status: 'connecting',
          })
          .eq('id', instanceId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            qrCode,
            expiresAt: expiresAt.toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'instanceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', instanceId)
          .eq('user_id', user.id)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Decrypt and use instance token if available
        const decryptedToken = instance.token ? await decryptToken(instance.token) : null;
        const authKey = decryptedToken || EVOLUTION_KEY;

        // Get status from Evolution API
        const statusResponse = await fetch(
          `${EVOLUTION_URL}/instance/connectionState/${instance.instance_name}`,
          {
            method: 'GET',
            headers: { 'apikey': authKey },
          }
        );

        const statusData = await statusResponse.json();
        console.log(`[INSTANCE-MANAGER] Evolution status response:`, JSON.stringify(statusData));

        const isConnected = statusData.state === 'open' || statusData.instance?.state === 'open';
        const phoneNumber = statusData.instance?.owner || null;

        // Update database if status changed
        if (isConnected && instance.instance_status !== 'connected') {
          await supabase
            .from('whatsapp_instances')
            .update({
              instance_status: 'connected',
              phone_connected: phoneNumber?.split('@')[0] || null,
              qr_code: null,
              qr_code_expires_at: null,
            })
            .eq('id', instanceId);
        } else if (!isConnected && instance.instance_status === 'connected') {
          await supabase
            .from('whatsapp_instances')
            .update({
              instance_status: 'disconnected',
              phone_connected: null,
            })
            .eq('id', instanceId);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: isConnected ? 'connected' : 'disconnected',
            phoneNumber: phoneNumber?.split('@')[0] || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'instanceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', instanceId)
          .eq('user_id', user.id)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[INSTANCE-MANAGER] Disconnecting instance: ${instance.instance_name}`);

        // Decrypt and use instance token if available
        const decryptedToken = instance.token ? await decryptToken(instance.token) : null;
        const authKey = decryptedToken || EVOLUTION_KEY;

        // Logout from Evolution API
        await fetch(`${EVOLUTION_URL}/instance/logout/${instance.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': authKey },
        });

        // Update database
        await supabase
          .from('whatsapp_instances')
          .update({
            instance_status: 'disconnected',
            phone_connected: null,
            qr_code: null,
            qr_code_expires_at: null,
          })
          .eq('id', instanceId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'instanceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', instanceId)
          .eq('user_id', user.id)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[INSTANCE-MANAGER] Deleting instance: ${instance.instance_name}`);

        // Decrypt and use instance token if available
        const decryptedToken = instance.token ? await decryptToken(instance.token) : null;
        const authKey = decryptedToken || EVOLUTION_KEY;

        // Delete from Evolution API
        await fetch(`${EVOLUTION_URL}/instance/delete/${instance.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': authKey },
        });

        // Delete from database
        await supabase
          .from('whatsapp_instances')
          .delete()
          .eq('id', instanceId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_groups': {
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'instanceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get instance
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', instanceId)
          .eq('user_id', user.id)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ error: 'Instance not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (instance.instance_status !== 'connected') {
          return new Response(
            JSON.stringify({ error: 'Instance not connected' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[INSTANCE-MANAGER] Listing groups for instance: ${instance.instance_name}`);

        // Decrypt and use instance token if available
        const decryptedToken = instance.token ? await decryptToken(instance.token) : null;
        const authKey = decryptedToken || EVOLUTION_KEY;

        // Get groups from Evolution API
        const groupsResponse = await fetch(
          `${EVOLUTION_URL}/group/fetchAllGroups/${instance.instance_name}?getParticipants=false`,
          {
            method: 'GET',
            headers: { 'apikey': authKey },
          }
        );

        const groupsData = await groupsResponse.json();
        console.log(`[INSTANCE-MANAGER] Evolution groups response:`, JSON.stringify(groupsData));

        if (!groupsResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to list groups', details: groupsData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Format groups list
        const groups = (groupsData || []).map((g: any) => ({
          id: g.id,
          name: g.subject || g.name || 'Grupo sem nome',
        }));

        return new Response(
          JSON.stringify({ success: true, groups }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[INSTANCE-MANAGER] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
