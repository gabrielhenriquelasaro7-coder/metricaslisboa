import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { clarityProjectId, numOfDays, dimension1, dimension2, dimension3 } = await req.json();

    if (!clarityProjectId) {
      return new Response(JSON.stringify({ error: "clarityProjectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the API token from the database
    const { data: clarityProject, error: dbError } = await supabase
      .from("clarity_projects")
      .select("api_token")
      .eq("id", clarityProjectId)
      .single();

    if (dbError || !clarityProject) {
      return new Response(JSON.stringify({ error: "Clarity project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query params
    const params = new URLSearchParams();
    params.set("numOfDays", String(numOfDays || 3));
    if (dimension1) params.set("dimension1", dimension1);
    if (dimension2) params.set("dimension2", dimension2);
    if (dimension3) params.set("dimension3", dimension3);

    const clarityUrl = `https://www.clarity.ms/export-data/api/v1/project-live-insights?${params.toString()}`;

    const clarityResponse = await fetch(clarityUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${clarityProject.api_token}`,
      },
    });

    if (!clarityResponse.ok) {
      const errorText = await clarityResponse.text();
      console.error("Clarity API error:", clarityResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Clarity API error: ${clarityResponse.status}`,
        details: errorText 
      }), {
        status: clarityResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await clarityResponse.json();

    return new Response(JSON.stringify(data), {
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
