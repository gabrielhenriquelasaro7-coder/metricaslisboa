import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token endpoints for OAuth providers
const TOKEN_CONFIGS: Record<string, { tokenUrl: string }> = {
  hubspot: {
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
  },
  rdstation: {
    tokenUrl: 'https://api.rd.services/auth/token',
  },
  gohighlevel: {
    tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return createRedirect(supabaseUrl, 'error', `Erro de autenticação: ${error}`);
    }

    if (!code || !state) {
      return createRedirect(supabaseUrl, 'error', 'Parâmetros inválidos');
    }

    // Decode state
    let stateData: { connection_id: string; project_id: string; user_id: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return createRedirect(supabaseUrl, 'error', 'Estado inválido');
    }

    // Get connection to determine provider
    const { data: connection, error: connError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('id', stateData.connection_id)
      .single();

    if (connError || !connection) {
      return createRedirect(supabaseUrl, 'error', 'Conexão não encontrada');
    }

    const provider = connection.provider;
    const tokenConfig = TOKEN_CONFIGS[provider];

    if (!tokenConfig) {
      return createRedirect(supabaseUrl, 'error', 'Provider não suportado');
    }

    // Exchange code for tokens
    const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);
    const redirectUri = `${supabaseUrl}/functions/v1/crm-callback`;

    if (!clientId || !clientSecret) {
      console.error(`Missing OAuth credentials for ${provider}`);
      return createRedirect(supabaseUrl, 'error', 'Configuração OAuth incompleta');
    }

    const tokenResponse = await fetch(tokenConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return createRedirect(supabaseUrl, 'error', 'Falha ao obter tokens');
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiration
    const expiresIn = tokens.expires_in || 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update connection with tokens
    const { error: updateError } = await supabase
      .from('crm_connections')
      .update({
        status: 'connected',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        connected_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', stateData.connection_id);

    if (updateError) {
      console.error('Failed to update connection:', updateError);
      return createRedirect(supabaseUrl, 'error', 'Erro ao salvar conexão');
    }

    // Trigger initial sync
    await triggerInitialSync(supabaseUrl, supabaseServiceKey, stateData.connection_id, stateData.project_id);

    // Redirect to success page
    return createRedirect(supabaseUrl, 'success', 'CRM conectado com sucesso');

  } catch (error) {
    console.error('Callback error:', error);
    return createRedirect(supabaseUrl, 'error', 'Erro interno do servidor');
  }
});

function createRedirect(baseUrl: string, status: 'success' | 'error', message: string): Response {
  // Extract the app URL from Supabase URL (remove /rest/v1 etc)
  const appUrl = baseUrl.replace('.supabase.co', '.lovable.app').replace('https://', 'https://');
  
  // Redirect to the financial page with status
  const redirectUrl = new URL('/financeiro', 'https://preview--v4-metrics-dashboard.lovable.app');
  redirectUrl.searchParams.set('crm_status', status);
  redirectUrl.searchParams.set('message', message);

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl.toString(),
    },
  });
}

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
