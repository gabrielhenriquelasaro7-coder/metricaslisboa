import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { project_id } = await req.json();

    // Get all unique ads with thumbnails but no cache
    const { data: adsToCache, error: fetchError } = await supabase
      .from('ads_daily_metrics')
      .select('ad_id, creative_thumbnail')
      .eq('project_id', project_id)
      .not('creative_thumbnail', 'is', null)
      .is('cached_creative_thumbnail', null);

    if (fetchError) {
      console.error('[CACHE] Error fetching ads:', fetchError);
      throw fetchError;
    }

    // Deduplicate by ad_id
    const uniqueAds = new Map<string, string>();
    for (const ad of adsToCache || []) {
      if (ad.creative_thumbnail && !uniqueAds.has(ad.ad_id)) {
        uniqueAds.set(ad.ad_id, ad.creative_thumbnail);
      }
    }

    console.log(`[CACHE] Found ${uniqueAds.size} ads to cache for project ${project_id}`);

    let cached = 0;
    let failed = 0;

    for (const [adId, thumbnailUrl] of uniqueAds) {
      try {
        // Download the image
        const imgResponse = await fetch(thumbnailUrl);
        if (!imgResponse.ok) {
          console.warn(`[CACHE] Failed to download image for ad ${adId}: ${imgResponse.status}`);
          failed++;
          continue;
        }

        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const imgBuffer = await imgResponse.arrayBuffer();
        
        // Determine file extension
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';

        const filePath = `${project_id}/${adId}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('creative-images')
          .upload(filePath, imgBuffer, {
            contentType,
            upsert: true
          });

        if (uploadError) {
          console.warn(`[CACHE] Upload error for ad ${adId}:`, uploadError);
          failed++;
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('creative-images')
          .getPublicUrl(filePath);

        // Update all records for this ad
        const { error: updateError } = await supabase
          .from('ads_daily_metrics')
          .update({ cached_creative_thumbnail: publicUrl })
          .eq('project_id', project_id)
          .eq('ad_id', adId);

        if (updateError) {
          console.warn(`[CACHE] Update error for ad ${adId}:`, updateError);
          failed++;
          continue;
        }

        cached++;
        console.log(`[CACHE] Cached ad ${adId} -> ${publicUrl}`);

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error(`[CACHE] Error caching ad ${adId}:`, err);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      project_id,
      total: uniqueAds.size,
      cached,
      failed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[CACHE] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
