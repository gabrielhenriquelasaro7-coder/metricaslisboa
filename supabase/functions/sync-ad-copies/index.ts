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
    const { projectId, adId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessToken = Deno.env.get('META_ACCESS_TOKEN')!;
    
    if (!accessToken) {
      throw new Error('META_ACCESS_TOKEN not configured');
    }
    
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

    // Buscar ads - single or all
    let adsQuery = supabase.from('ads').select('id, name').eq('project_id', projectId);
    if (adId) adsQuery = adsQuery.eq('id', adId);
    
    const { data: ads, error: adsError } = await adsQuery;

    if (adsError) {
      throw new Error(`Error fetching ads: ${adsError.message}`);
    }

    console.log(`[SYNC-COPIES] Found ${ads?.length || 0} ads to sync for project ${projectId}`);

    const results: any[] = [];
    // Process in smaller batches to avoid timeouts
    const batchSize = adId ? 1 : 10;

    for (let i = 0; i < (ads?.length || 0); i += batchSize) {
      const batch = ads!.slice(i, i + batchSize);
      const adIds = batch.map(a => a.id).join(',');

      console.log(`[SYNC-COPIES] Batch ${Math.floor(i / batchSize) + 1}, ads: ${batch.length}`);

      try {
        // IMPORTANTE: thumbnail_width=1080 e thumbnail_height=1080 para HD
        const url = `https://graph.facebook.com/v22.0/?ids=${adIds}&fields=id,name,creative{id,name,body,title,call_to_action_type,thumbnail_url,object_story_spec,effective_object_story_id}&thumbnail_width=1080&thumbnail_height=1080&access_token=${accessToken}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        
        const data = await response.json();

        if (data.error) {
          console.error(`[SYNC-COPIES] Meta API error:`, data.error);
          continue;
        }

        // Processar cada ad
        for (const currentAdId of Object.keys(data)) {
          const adData = data[currentAdId];
          if (!adData || adData.error) {
            console.log(`[SYNC-COPIES] Skipping ad ${currentAdId}: ${adData?.error?.message || 'no data'}`);
            continue;
          }

          const creative = adData.creative;
          if (!creative) {
            console.log(`[SYNC-COPIES] No creative for ad ${currentAdId}`);
            continue;
          }

          let primaryText: string | null = null;
          let headline: string | null = null;
          let cta: string | null = null;

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
              const postUrl = `https://graph.facebook.com/v22.0/${creative.effective_object_story_id}?fields=message,name,description,full_picture&access_token=${accessToken}`;
              const postController = new AbortController();
              const postTimeout = setTimeout(() => postController.abort(), 10000);
              const postResponse = await fetch(postUrl, { signal: postController.signal });
              clearTimeout(postTimeout);
              const postData = await postResponse.json();

              if (!postData.error) {
                if (!primaryText && postData.message) primaryText = postData.message;
                if (!headline && postData.name) headline = postData.name;
              }
            } catch (e) {
              console.log(`[SYNC-COPIES] Could not fetch post for ${currentAdId}`);
            }
          }

          // Atualizar no banco se encontrou algo
          if (primaryText || headline || cta || creative.thumbnail_url) {
            const updateData: any = {};
            if (primaryText) updateData.primary_text = primaryText;
            if (headline) updateData.headline = headline;
            if (cta) updateData.cta = cta;
            // Store the HD thumbnail URL - clean resize parameters to get full resolution
            if (creative.thumbnail_url) {
              let hdUrl = creative.thumbnail_url;
              // Remove stp= parameter that forces small resize (e.g. p64x64)
              hdUrl = hdUrl.replace(/[&?]stp=[^&]*/gi, '');
              // Remove size parameters in path
              hdUrl = hdUrl.replace(/\/p\d+x\d+\//g, '/');
              hdUrl = hdUrl.replace(/\/s\d+x\d+\//g, '/');
              // Fix malformed URL after param removal
              if (hdUrl.includes('&') && !hdUrl.includes('?')) {
                hdUrl = hdUrl.replace('&', '?');
              }
              hdUrl = hdUrl.replace(/[&?]$/g, '');
              
              updateData.creative_thumbnail = hdUrl;
              updateData.creative_image_url = hdUrl;
              console.log(`[SYNC-COPIES] HD URL for ${currentAdId}: cleaned stp params`);
            }

            const { error: updateError } = await supabase
              .from('ads')
              .update(updateData)
              .eq('id', currentAdId);

            if (updateError) {
              console.error(`[SYNC-COPIES] Error updating ad ${currentAdId}:`, updateError);
            } else {
              results.push({
                adId: currentAdId,
                name: adData.name,
                primaryText: primaryText?.substring(0, 50),
                headline,
                cta,
                thumbnailUrl: creative.thumbnail_url ? 'YES' : 'NO'
              });
              console.log(`[SYNC-COPIES] ✅ Updated ad ${currentAdId}: thumbnail=${creative.thumbnail_url ? '1080px' : 'none'}, headline=${headline}`);
            }
          }
        }
      } catch (batchError) {
        console.error(`[SYNC-COPIES] Batch error:`, batchError);
        // Continue with next batch even if this one fails
        continue;
      }

      // Delay entre batches
      if (i + batchSize < (ads?.length || 0)) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[SYNC-COPIES] ✅ Completed! Updated ${results.length}/${ads?.length || 0} ads`);

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
