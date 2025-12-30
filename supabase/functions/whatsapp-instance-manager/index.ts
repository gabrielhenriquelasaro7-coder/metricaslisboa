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

        // Save instance to database
        const { data: instance, error: insertError } = await supabase
          .from('whatsapp_instances')
          .insert({
            project_id: projectId,
            user_id: user.id,
            instance_name: instanceName,
            display_name: displayName || 'Nova Conexão',
            instance_status: 'disconnected',
          })
          .select()
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

        // Get QR code from Evolution API
        const connectResponse = await fetch(
          `${EVOLUTION_URL}/instance/connect/${instance.instance_name}`,
          {
            method: 'GET',
            headers: { 'apikey': EVOLUTION_KEY },
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

        // Get status from Evolution API
        const statusResponse = await fetch(
          `${EVOLUTION_URL}/instance/connectionState/${instance.instance_name}`,
          {
            method: 'GET',
            headers: { 'apikey': EVOLUTION_KEY },
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

        // Logout from Evolution API
        await fetch(`${EVOLUTION_URL}/instance/logout/${instance.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': EVOLUTION_KEY },
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

        // Delete from Evolution API
        await fetch(`${EVOLUTION_URL}/instance/delete/${instance.instance_name}`, {
          method: 'DELETE',
          headers: { 'apikey': EVOLUTION_KEY },
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

        // Get groups from Evolution API
        const groupsResponse = await fetch(
          `${EVOLUTION_URL}/group/fetchAllGroups/${instance.instance_name}?getParticipants=false`,
          {
            method: 'GET',
            headers: { 'apikey': EVOLUTION_KEY },
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
