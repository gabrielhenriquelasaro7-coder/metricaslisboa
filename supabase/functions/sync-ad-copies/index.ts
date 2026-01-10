import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessToken = Deno.env.get('META_ACCESS_TOKEN')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar projeto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('ad_account_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }

    // Buscar todos os ads do projeto
    const { data: ads, error: adsError } = await supabase
      .from('ads')
      .select('id, name')
      .eq('project_id', projectId);

    if (adsError) {
      throw new Error(`Error fetching ads: ${adsError.message}`);
    }

    console.log(`[SYNC-COPIES] Found ${ads?.length || 0} ads to sync`);

    const results: any[] = [];
    const batchSize = 50;

    // Processar em batches
    for (let i = 0; i < (ads?.length || 0); i += batchSize) {
      const batch = ads!.slice(i, i + batchSize);
      const adIds = batch.map(a => a.id).join(',');

      console.log(`[SYNC-COPIES] Processing batch ${i / batchSize + 1}, ads: ${batch.length}`);

      // Buscar dados de todos os ads do batch
      const url = `https://graph.facebook.com/v21.0/?ids=${adIds}&fields=id,name,creative{id,name,body,title,call_to_action_type,object_story_spec,effective_object_story_id}&access_token=${accessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error(`[SYNC-COPIES] Meta API error:`, data.error);
        continue;
      }

      // Processar cada ad
      for (const adId of Object.keys(data)) {
        const adData = data[adId];
        if (!adData || adData.error) continue;

        const creative = adData.creative;
        if (!creative) continue;

        let primaryText = null;
        let headline = null;
        let cta = null;

        // 1. Direto do creative
        if (creative.body) primaryText = creative.body;
        if (creative.title) headline = creative.title;
        if (creative.call_to_action_type) cta = creative.call_to_action_type;

        // 2. Do object_story_spec
        const storySpec = creative.object_story_spec;
        if (storySpec) {
          const linkData = storySpec.link_data;
          const videoData = storySpec.video_data;

          if (linkData) {
            if (!primaryText && linkData.message) primaryText = linkData.message;
            if (!headline && linkData.name) headline = linkData.name;
            if (!cta && linkData.call_to_action?.type) cta = linkData.call_to_action.type;
          }

          if (videoData) {
            if (!primaryText && videoData.message) primaryText = videoData.message;
            if (!headline && videoData.title) headline = videoData.title;
            if (!cta && videoData.call_to_action?.type) cta = videoData.call_to_action.type;
          }
        }

        // 3. Se tem effective_object_story_id, buscar o post
        if ((!primaryText || !headline) && creative.effective_object_story_id) {
          try {
            const postUrl = `https://graph.facebook.com/v21.0/${creative.effective_object_story_id}?fields=message,name,description&access_token=${accessToken}`;
            const postResponse = await fetch(postUrl);
            const postData = await postResponse.json();

            if (!postData.error) {
              if (!primaryText && postData.message) primaryText = postData.message;
              if (!headline && postData.name) headline = postData.name;
            }
          } catch (e) {
            console.log(`[SYNC-COPIES] Could not fetch post for ${adId}`);
          }
        }

        // Atualizar no banco se encontrou algo
        if (primaryText || headline || cta) {
          const updateData: any = {};
          if (primaryText) updateData.primary_text = primaryText;
          if (headline) updateData.headline = headline;
          if (cta) updateData.cta = cta;

          const { error: updateError } = await supabase
            .from('ads')
            .update(updateData)
            .eq('id', adId);

          if (updateError) {
            console.error(`[SYNC-COPIES] Error updating ad ${adId}:`, updateError);
          } else {
            results.push({
              adId,
              name: adData.name,
              primaryText: primaryText?.substring(0, 50),
              headline,
              cta
            });
            console.log(`[SYNC-COPIES] Updated ad ${adId}: headline=${headline}, cta=${cta}`);
          }
        }
      }

      // Delay entre batches para não sobrecarregar a API
      if (i + batchSize < (ads?.length || 0)) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`[SYNC-COPIES] Completed! Updated ${results.length} ads`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalAds: ads?.length || 0,
        updatedAds: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SYNC-COPIES] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
