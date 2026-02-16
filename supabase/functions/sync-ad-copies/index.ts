import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Clean image URLs - removes ALL resize parameters to get original HD
function cleanMetaImageUrl(url: string | null): string | null {
  if (!url) return null;
  let clean = url;
  clean = clean.replace(/[&?]stp=[^&]*/gi, '');
  clean = clean.replace(/\/p\d+x\d+\//g, '/');
  clean = clean.replace(/\/s\d+x\d+\//g, '/');
  if (clean.includes('&') && !clean.includes('?')) {
    clean = clean.replace('&', '?');
  }
  clean = clean.replace(/[&?]$/g, '');
  return clean;
}

// Fetch HD thumbnail directly from creative endpoint (the ONLY way that works)
// Returns both the cleaned URL for display and raw URL for downloading
async function fetchHDThumbnail(creativeId: string, accessToken: string): Promise<{ cleanUrl: string; rawUrl: string } | null> {
  try {
    const url = `https://graph.facebook.com/v22.0/${creativeId}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080&access_token=${accessToken}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json();
    if (data.error) {
      console.log(`[SYNC-COPIES] Creative ${creativeId} thumbnail error: ${data.error.message}`);
      return null;
    }
    if (!data.thumbnail_url) return null;
    return {
      cleanUrl: cleanMetaImageUrl(data.thumbnail_url) || data.thumbnail_url,
      rawUrl: data.thumbnail_url  // Keep original URL for downloading (has auth tokens)
    };
  } catch (e) {
    console.log(`[SYNC-COPIES] Failed to fetch HD thumbnail for creative ${creativeId}`);
    return null;
  }
}

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

    // Buscar ads
    let adsQuery = supabase.from('ads').select('id, name, creative_id').eq('project_id', projectId);
    if (adId) {
      adsQuery = adsQuery.eq('id', adId);
    } else {
      // Fetch ads that need caching in Storage (no cached_image_url)
      adsQuery = adsQuery.is('cached_image_url', null);
    }
    
    const { data: ads, error: adsError } = await adsQuery;

    if (adsError) {
      throw new Error(`Error fetching ads: ${adsError.message}`);
    }

    console.log(`[SYNC-COPIES] Found ${ads?.length || 0} ads to sync for project ${projectId}`);

    const results: any[] = [];
    const batchSize = adId ? 1 : 5;

    for (let i = 0; i < (ads?.length || 0); i += batchSize) {
      const batch = ads!.slice(i, i + batchSize);
      const adIds = batch.map(a => a.id).join(',');

      console.log(`[SYNC-COPIES] Batch ${Math.floor(i / batchSize) + 1}, ads: ${batch.length}`);

      try {
        // Step 1: Get ad data with creative info (text, headline, CTA)
        const url = `https://graph.facebook.com/v22.0/?ids=${adIds}&fields=id,name,creative{id,name,body,title,call_to_action_type,object_story_spec,effective_object_story_id}&access_token=${accessToken}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        
        const data = await response.json();

        if (data.error) {
          console.error(`[SYNC-COPIES] Meta API error:`, data.error);
          continue;
        }

        // Process each ad
        for (const currentAdId of Object.keys(data)) {
          const adData = data[currentAdId];
          if (!adData || adData.error) continue;

          const creative = adData.creative;
          if (!creative) continue;

          let primaryText: string | null = null;
          let headline: string | null = null;
          let cta: string | null = null;

          if (creative.body) primaryText = creative.body;
          if (creative.title) headline = creative.title;
          if (creative.call_to_action_type) cta = creative.call_to_action_type;

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
            } catch (_e) {
              console.log(`[SYNC-COPIES] Could not fetch post for ${currentAdId}`);
            }
          }

          // Step 2: Fetch HD thumbnail DIRECTLY from creative endpoint with 1080x1080
          let hdThumbnailResult: { cleanUrl: string; rawUrl: string } | null = null;
          if (creative.id) {
            hdThumbnailResult = await fetchHDThumbnail(creative.id, accessToken);
            if (hdThumbnailResult) {
              console.log(`[SYNC-COPIES] ✅ Got TRUE HD 1080px thumbnail for ad ${currentAdId} from creative ${creative.id}`);
            }
          }

          if (primaryText || headline || cta || hdThumbnailResult) {
            const updateData: any = {};
            if (primaryText) updateData.primary_text = primaryText;
            if (headline) updateData.headline = headline;
            if (cta) updateData.cta = cta;
            if (hdThumbnailResult) {
              updateData.creative_thumbnail = hdThumbnailResult.cleanUrl;
              updateData.creative_image_url = hdThumbnailResult.cleanUrl;
              
              // CACHE HD image in Storage using RAW URL (has fbcdn auth tokens)
              try {
                const imgController = new AbortController();
                const imgTimeout = setTimeout(() => imgController.abort(), 15000);
                const imgResponse = await fetch(hdThumbnailResult.rawUrl, { 
                  signal: imgController.signal,
                  redirect: 'follow'
                });
                clearTimeout(imgTimeout);
                
                if (imgResponse.ok) {
                  const imageBuffer = await imgResponse.arrayBuffer();
                  // Only cache if >= 5KB (more lenient threshold)
                  if (imageBuffer.byteLength >= 5000) {
                    const fileName = `${projectId}/${currentAdId}.jpg`;
                    const { error: uploadError } = await supabase.storage.from('creative-images').upload(fileName, imageBuffer, { 
                      contentType: imgResponse.headers.get('content-type') || 'image/jpeg', 
                      upsert: true 
                    });
                    if (uploadError) {
                      console.log(`[SYNC-COPIES] ⚠️ Storage upload failed for ${currentAdId}: ${uploadError.message}`);
                    } else {
                      const { data: publicUrlData } = supabase.storage.from('creative-images').getPublicUrl(fileName);
                      if (publicUrlData?.publicUrl) {
                        updateData.cached_image_url = publicUrlData.publicUrl;
                        console.log(`[SYNC-COPIES] ✅ Cached HD image (${Math.round(imageBuffer.byteLength/1024)}KB) for ${currentAdId}`);
                      }
                    }
                  } else {
                    console.log(`[SYNC-COPIES] ⚠️ Image too small (${imageBuffer.byteLength}B), not caching for ${currentAdId}`);
                  }
                } else {
                  console.log(`[SYNC-COPIES] ⚠️ Image download failed for ${currentAdId}: HTTP ${imgResponse.status} ${imgResponse.statusText}`);
                }
              } catch (cacheErr) {
                console.log(`[SYNC-COPIES] Cache image failed for ${currentAdId}: ${cacheErr}`);
              }
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
                hdThumbnail: hdThumbnailResult ? 'YES_1080' : 'NO',
                cachedImageUrl: updateData.cached_image_url || null
              });
              console.log(`[SYNC-COPIES] ✅ Updated ad ${currentAdId}: HD=${hdThumbnailResult ? '1080px' : 'none'}, cached=${!!updateData.cached_image_url}`);
            }
          }
        }
      } catch (batchError) {
        console.error(`[SYNC-COPIES] Batch error:`, batchError);
        continue;
      }

      if (i + batchSize < (ads?.length || 0)) {
        await new Promise(r => setTimeout(r, 3000));
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
