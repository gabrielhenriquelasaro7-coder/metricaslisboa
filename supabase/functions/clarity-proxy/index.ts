import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchClarityData(token: string, numOfDays: number, dimensions: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("numOfDays", String(numOfDays));
  for (const [key, value] of Object.entries(dimensions)) {
    params.set(key, value);
  }

  const url = `https://www.clarity.ms/export-data/api/v1/project-live-insights?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Clarity API error:", response.status, errorText);
    if (response.status === 429) {
      return { _error: "rate_limit", message: "Limite diário de chamadas excedido (10/dia por projeto). Tente novamente amanhã." };
    }
    if (response.status === 401 || response.status === 403) {
      return { _error: "auth", message: "Token de autenticação inválido ou expirado. Verifique o token nas configurações." };
    }
    return { _error: "unknown", message: `Erro ${response.status}: ${errorText}` };
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clarityProjectId, numOfDays } = await req.json();

    if (!clarityProjectId) {
      return new Response(JSON.stringify({ error: "clarityProjectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: clarityProject, error: dbError } = await supabase
      .from("clarity_projects")
      .select("api_token, clarity_project_id")
      .eq("id", clarityProjectId)
      .single();

    if (dbError || !clarityProject) {
      return new Response(JSON.stringify({ error: "Clarity project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const days = numOfDays || 3;
    const token = clarityProject.api_token;

    // 5 parallel calls (of 10 allowed daily) for maximum data extraction
    const [byDevice, bySource, byChannel, byUtm, byEngagement] = await Promise.all([
      // Call 1: Device + Browser + OS
      fetchClarityData(token, days, { dimension1: "Device", dimension2: "Browser", dimension3: "OS" }),
      // Call 2: URL + Source + Country
      fetchClarityData(token, days, { dimension1: "URL", dimension2: "Source", dimension3: "Country" }),
      // Call 3: Channel + Medium + Campaign
      fetchClarityData(token, days, { dimension1: "Channel", dimension2: "Medium", dimension3: "Campaign" }),
      // Call 4: Campaign + Source + Medium (UTM focus)
      fetchClarityData(token, days, { dimension1: "Campaign", dimension2: "Source", dimension3: "Medium" }),
      // Call 5: URL + Device (engagement per page per device)
      fetchClarityData(token, days, { dimension1: "URL", dimension2: "Device" }),
    ]);

    // Check for errors in any result
    const results = [byDevice, bySource, byChannel, byUtm, byEngagement];
    const firstError = results.find(r => r && r._error);
    if (firstError) {
      return new Response(JSON.stringify({ error: firstError.message, errorType: firstError._error }), {
        status: firstError._error === 'rate_limit' ? 429 : firstError._error === 'auth' ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ byDevice, bySource, byChannel, byUtm, byEngagement }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Clarity proxy error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
