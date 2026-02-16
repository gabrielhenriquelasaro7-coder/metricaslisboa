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
    return null;
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

    // 3 parallel calls with different dimension combos
    const [byDevice, bySource, byChannel] = await Promise.all([
      fetchClarityData(token, days, { dimension1: "Device", dimension2: "Browser", dimension3: "OS" }),
      fetchClarityData(token, days, { dimension1: "URL", dimension2: "Source", dimension3: "Country" }),
      fetchClarityData(token, days, { dimension1: "Channel", dimension2: "Medium", dimension3: "Campaign" }),
    ]);

    return new Response(JSON.stringify({ byDevice, bySource, byChannel }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Clarity proxy error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
