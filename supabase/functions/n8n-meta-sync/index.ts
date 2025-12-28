import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MetaDataPayload {
  project_id: string;
  type: "campaigns" | "ad_sets" | "ads";
  data: any[];
  webhook_secret?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret for security
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
    
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: MetaDataPayload = await req.json();
    console.log(`Receiving ${payload.type} data for project ${payload.project_id}:`, payload.data?.length || 0, "records");

    if (!payload.project_id || !payload.type || !payload.data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: project_id, type, data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", payload.project_id)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    let insertedCount = 0;

    // Process based on data type
    switch (payload.type) {
      case "campaigns": {
        const campaigns = payload.data.map((c: any) => ({
          id: c.id,
          project_id: payload.project_id,
          name: c.name,
          status: c.status || c.effective_status || "UNKNOWN",
          objective: c.objective,
          daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
          lifetime_budget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
          spend: parseFloat(c.insights?.spend || c.spend || 0),
          impressions: parseInt(c.insights?.impressions || c.impressions || 0),
          clicks: parseInt(c.insights?.clicks || c.clicks || 0),
          reach: parseInt(c.insights?.reach || c.reach || 0),
          ctr: parseFloat(c.insights?.ctr || c.ctr || 0),
          cpm: parseFloat(c.insights?.cpm || c.cpm || 0),
          cpc: parseFloat(c.insights?.cpc || c.cpc || 0),
          frequency: parseFloat(c.insights?.frequency || c.frequency || 0),
          conversions: parseInt(c.insights?.conversions || c.conversions || 0),
          conversion_value: parseFloat(c.insights?.conversion_value || c.conversion_value || 0),
          roas: parseFloat(c.insights?.roas || c.roas || 0),
          cpa: parseFloat(c.insights?.cpa || c.cpa || 0),
          created_time: c.created_time,
          updated_time: c.updated_time,
          synced_at: now,
        }));

        // Delete existing campaigns for this project
        await supabase.from("campaigns").delete().eq("project_id", payload.project_id);

        // Insert in batches of 50
        for (let i = 0; i < campaigns.length; i += 50) {
          const batch = campaigns.slice(i, i + 50);
          const { error } = await supabase.from("campaigns").insert(batch);
          if (error) {
            console.error("Error inserting campaigns batch:", error);
          } else {
            insertedCount += batch.length;
          }
        }
        break;
      }

      case "ad_sets": {
        const adSets = payload.data.map((as: any) => ({
          id: as.id,
          project_id: payload.project_id,
          campaign_id: as.campaign_id || as.campaign?.id,
          name: as.name,
          status: as.status || as.effective_status || "UNKNOWN",
          daily_budget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
          lifetime_budget: as.lifetime_budget ? parseFloat(as.lifetime_budget) / 100 : null,
          targeting: as.targeting,
          spend: parseFloat(as.insights?.spend || as.spend || 0),
          impressions: parseInt(as.insights?.impressions || as.impressions || 0),
          clicks: parseInt(as.insights?.clicks || as.clicks || 0),
          reach: parseInt(as.insights?.reach || as.reach || 0),
          ctr: parseFloat(as.insights?.ctr || as.ctr || 0),
          cpm: parseFloat(as.insights?.cpm || as.cpm || 0),
          cpc: parseFloat(as.insights?.cpc || as.cpc || 0),
          frequency: parseFloat(as.insights?.frequency || as.frequency || 0),
          conversions: parseInt(as.insights?.conversions || as.conversions || 0),
          conversion_value: parseFloat(as.insights?.conversion_value || as.conversion_value || 0),
          roas: parseFloat(as.insights?.roas || as.roas || 0),
          cpa: parseFloat(as.insights?.cpa || as.cpa || 0),
          synced_at: now,
        }));

        // Delete existing ad_sets for this project
        await supabase.from("ad_sets").delete().eq("project_id", payload.project_id);

        // Insert in batches
        for (let i = 0; i < adSets.length; i += 50) {
          const batch = adSets.slice(i, i + 50);
          const { error } = await supabase.from("ad_sets").insert(batch);
          if (error) {
            console.error("Error inserting ad_sets batch:", error);
          } else {
            insertedCount += batch.length;
          }
        }
        break;
      }

      case "ads": {
        const ads = payload.data.map((ad: any) => ({
          id: ad.id,
          project_id: payload.project_id,
          campaign_id: ad.campaign_id || ad.campaign?.id,
          ad_set_id: ad.adset_id || ad.adset?.id,
          name: ad.name,
          status: ad.status || ad.effective_status || "UNKNOWN",
          creative_id: ad.creative?.id || ad.creative_id,
          creative_thumbnail: ad.creative?.thumbnail_url || ad.thumbnail_url,
          creative_image_url: ad.creative?.image_url || ad.image_url,
          creative_video_url: ad.creative?.video_url || ad.video_url,
          headline: ad.headline || ad.name,
          primary_text: ad.primary_text || ad.body,
          cta: ad.call_to_action_type || ad.cta,
          spend: parseFloat(ad.insights?.spend || ad.spend || 0),
          impressions: parseInt(ad.insights?.impressions || ad.impressions || 0),
          clicks: parseInt(ad.insights?.clicks || ad.clicks || 0),
          reach: parseInt(ad.insights?.reach || ad.reach || 0),
          ctr: parseFloat(ad.insights?.ctr || ad.ctr || 0),
          cpm: parseFloat(ad.insights?.cpm || ad.cpm || 0),
          cpc: parseFloat(ad.insights?.cpc || ad.cpc || 0),
          frequency: parseFloat(ad.insights?.frequency || ad.frequency || 0),
          conversions: parseInt(ad.insights?.conversions || ad.conversions || 0),
          conversion_value: parseFloat(ad.insights?.conversion_value || ad.conversion_value || 0),
          roas: parseFloat(ad.insights?.roas || ad.roas || 0),
          cpa: parseFloat(ad.insights?.cpa || ad.cpa || 0),
          synced_at: now,
        }));

        // Delete existing ads for this project
        await supabase.from("ads").delete().eq("project_id", payload.project_id);

        // Insert in batches
        for (let i = 0; i < ads.length; i += 50) {
          const batch = ads.slice(i, i + 50);
          const { error } = await supabase.from("ads").insert(batch);
          if (error) {
            console.error("Error inserting ads batch:", error);
          } else {
            insertedCount += batch.length;
          }
        }
        break;
      }
    }

    // Update project last_sync_at
    await supabase
      .from("projects")
      .update({ last_sync_at: now })
      .eq("id", payload.project_id);

    // Log sync
    await supabase.from("sync_logs").insert({
      project_id: payload.project_id,
      status: "success",
      message: `n8n sync: ${insertedCount} ${payload.type} synced`,
    });

    console.log(`Successfully synced ${insertedCount} ${payload.type}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        type: payload.type,
        inserted: insertedCount 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing n8n webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
