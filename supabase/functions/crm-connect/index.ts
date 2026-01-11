import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectRequest {
  project_id: string;
  provider: 'kommo' | 'hubspot' | 'gohighlevel' | 'bitrix24' | 'rdstation' | 'outros';
  api_key?: string;
  api_url?: string;
  config?: Record<string, unknown>;
}

// OAuth URLs for providers that support it
const OAUTH_CONFIGS: Record<string, { authUrl: string; tokenUrl: string; scopes: string[] }> = {
  hubspot: {
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['crm.objects.deals.read', 'crm.objects.contacts.read', 'crm.schemas.deals.read'],
  },
  rdstation: {
    authUrl: 'https://api.rd.services/auth/dialog',
    tokenUrl: 'https://api.rd.services/auth/token',
    scopes: ['conversions.write', 'contacts.read'],
  },
  gohighlevel: {
    authUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation',
    tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
    scopes: ['opportunities.readonly', 'contacts.readonly'],
  },
};

// Providers that use API Key instead of OAuth
const API_KEY_PROVIDERS = ['kommo', 'bitrix24', 'outros'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ConnectRequest = await req.json();
    const { project_id, provider, api_key, api_url, config } = body;

    if (!project_id || !provider) {
      return new Response(
        JSON.stringify({ error: 'project_id e provider são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Projeto não encontrado ou sem permissão' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if connection already exists
    const { data: existing } = await supabase
      .from('crm_connections')
      .select('id, status')
      .eq('project_id', project_id)
      .eq('provider', provider)
      .single();

    if (existing && existing.status === 'connected') {
      return new Response(
        JSON.stringify({ 
          error: 'CRM já conectado',
          connection_id: existing.id 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle API Key providers
    if (API_KEY_PROVIDERS.includes(provider)) {
      if (!api_key) {
        return new Response(
          JSON.stringify({ error: 'API Key é obrigatória para este CRM' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate API key by making a test request
      const isValid = await validateApiKey(provider, api_key, api_url);
      
      if (!isValid.success) {
        return new Response(
          JSON.stringify({ error: isValid.error || 'API Key inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create or update connection
      const connectionData = {
        project_id,
        user_id: user.id,
        provider,
        status: 'connected' as const,
        display_name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${project.name}`,
        api_key,
        api_url: api_url || isValid.api_url,
        config: config || {},
        connected_at: new Date().toISOString(),
      };

      let connectionId: string;
      
      if (existing) {
        const { error: updateError } = await supabase
          .from('crm_connections')
          .update(connectionData)
          .eq('id', existing.id);

        if (updateError) throw updateError;
        connectionId = existing.id;
      } else {
        const { data: newConn, error: insertError } = await supabase
          .from('crm_connections')
          .insert(connectionData)
          .select('id')
          .single();

        if (insertError) throw insertError;
        connectionId = newConn.id;
      }

      // Trigger initial sync
      await triggerInitialSync(supabaseUrl, supabaseServiceKey, connectionId, project_id);

      return new Response(
        JSON.stringify({
          success: true,
          connection_id: connectionId,
          message: 'CRM conectado com sucesso. Sincronização inicial iniciada.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle OAuth providers
    const oauthConfig = OAUTH_CONFIGS[provider];
    if (!oauthConfig) {
      return new Response(
        JSON.stringify({ error: 'Provider não suportado para OAuth' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending connection
    const pendingConnection = {
      project_id,
      user_id: user.id,
      provider,
      status: 'pending' as const,
      display_name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${project.name}`,
      config: config || {},
    };

    let connectionId: string;
    
    if (existing) {
      const { error: updateError } = await supabase
        .from('crm_connections')
        .update(pendingConnection)
        .eq('id', existing.id);

      if (updateError) throw updateError;
      connectionId = existing.id;
    } else {
      const { data: newConn, error: insertError } = await supabase
        .from('crm_connections')
        .insert(pendingConnection)
        .select('id')
        .single();

      if (insertError) throw insertError;
      connectionId = newConn.id;
    }

    // Generate OAuth URL
    const redirectUri = `${supabaseUrl}/functions/v1/crm-callback`;
    const state = btoa(JSON.stringify({ 
      connection_id: connectionId,
      project_id,
      user_id: user.id 
    }));

    const authUrl = new URL(oauthConfig.authUrl);
    authUrl.searchParams.set('client_id', Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`) || '');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', oauthConfig.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return new Response(
      JSON.stringify({
        success: true,
        connection_id: connectionId,
        oauth_url: authUrl.toString(),
        message: 'Redirecionando para autenticação OAuth',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('CRM Connect Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Validate API key for different providers
async function validateApiKey(
  provider: string, 
  apiKey: string, 
  apiUrl?: string
): Promise<{ success: boolean; error?: string; api_url?: string }> {
  try {
    switch (provider) {
      case 'kommo': {
        // Kommo uses subdomain.kommo.com
        const subdomain = apiUrl || '';
        if (!subdomain) {
          return { success: false, error: 'URL do Kommo é obrigatória (ex: suaempresa.kommo.com)' };
        }
        
        const baseUrl = subdomain.includes('kommo.com') ? subdomain : `https://${subdomain}.kommo.com`;
        const response = await fetch(`${baseUrl}/api/v4/account`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (response.ok) {
          return { success: true, api_url: baseUrl };
        }
        return { success: false, error: 'Token de acesso inválido ou expirado' };
      }

      case 'bitrix24': {
        if (!apiUrl) {
          return { success: false, error: 'URL do Bitrix24 é obrigatória (ex: suaempresa.bitrix24.com.br)' };
        }
        
        const baseUrl = apiUrl.includes('bitrix24') ? apiUrl : `https://${apiUrl}.bitrix24.com.br`;
        const webhookUrl = `${baseUrl}/rest/${apiKey}/crm.deal.list`;
        
        const response = await fetch(webhookUrl, { method: 'POST' });
        
        if (response.ok) {
          return { success: true, api_url: baseUrl };
        }
        return { success: false, error: 'Webhook URL inválida' };
      }

      case 'outros': {
        // For custom CRMs, just validate that we can reach the URL
        if (!apiUrl) {
          return { success: true }; // Allow without URL for manual setup
        }
        
        try {
          const response = await fetch(apiUrl, {
            method: 'HEAD',
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          return { success: true, api_url: apiUrl };
        } catch {
          return { success: true, api_url: apiUrl }; // Allow even if HEAD fails
        }
      }

      default:
        return { success: false, error: 'Provider não suportado' };
    }
  } catch (error) {
    console.error(`API Key validation error for ${provider}:`, error);
    return { success: false, error: 'Erro ao validar credenciais' };
  }
}

// Trigger initial sync
async function triggerInitialSync(
  supabaseUrl: string,
  serviceKey: string,
  connectionId: string,
  projectId: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/crm-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        connection_id: connectionId,
        project_id: projectId,
        sync_type: 'full',
      }),
    });
  } catch (error) {
    console.error('Failed to trigger initial sync:', error);
  }
}
