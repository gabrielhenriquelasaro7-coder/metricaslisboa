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
    const metaToken = Deno.env.get('META_ACCESS_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { project_id, force_refresh } = await req.json();

    // Get project ad_account_id
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('ad_account_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${project_id}`);
    }

    const adAccountId = project.ad_account_id;
    console.log(`[CACHE-HD] Starting for project ${project_id}, ad account ${adAccountId}`);

    // Fetch all ads from Meta API with creative info
    const adsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/ads?fields=id,name,creative{id,image_hash,thumbnail_url,object_story_spec{video_data{video_id,image_hash}}}&limit=500&access_token=${metaToken}`;
    
    const adsResponse = await fetch(adsUrl);
    const adsData = await adsResponse.json();
    
    if (adsData.error) {
      console.error('[CACHE-HD] Meta API error:', adsData.error);
      throw new Error(adsData.error.message);
    }

    const ads = adsData.data || [];
    console.log(`[CACHE-HD] Found ${ads.length} ads from Meta API`);

    // Collect all unique image hashes
    const imageHashes = new Set<string>();
    for (const ad of ads) {
      if (ad.creative?.image_hash) {
        imageHashes.add(ad.creative.image_hash);
      }
      if (ad.creative?.object_story_spec?.video_data?.image_hash) {
        imageHashes.add(ad.creative.object_story_spec.video_data.image_hash);
      }
    }

    console.log(`[CACHE-HD] Found ${imageHashes.size} unique image hashes`);

    // Fetch HD URLs for all image hashes in batches
    const adImageMap = new Map<string, string>();
    const hashArray = Array.from(imageHashes);
    
    for (let i = 0; i < hashArray.length; i += 50) {
      const batch = hashArray.slice(i, i + 50);
      const imageUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adimages?hashes=${encodeURIComponent(JSON.stringify(batch))}&fields=hash,url,url_128,permalink_url&access_token=${metaToken}`;
      
      const imageResponse = await fetch(imageUrl);
      const imageData = await imageResponse.json();
      
      if (imageData.data) {
        for (const img of imageData.data) {
          if (img.hash && img.url) {
            adImageMap.set(img.hash, img.url);
            console.log(`[CACHE-HD] Got HD URL for hash ${img.hash}`);
          }
        }
      }
    }

    console.log(`[CACHE-HD] Got ${adImageMap.size} HD image URLs from Meta`);

    // Fetch HD thumbnails for videos
    const videoThumbnailMap = new Map<string, string>();
    const videoIds = ads
      .filter((a: any) => a.creative?.object_story_spec?.video_data?.video_id)
      .map((a: any) => a.creative.object_story_spec.video_data.video_id);

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const batchRequests = batch.map((videoId: string) => ({ 
        method: 'GET', 
        relative_url: `${videoId}?fields=id,picture,thumbnails{uri,height,width}` 
      }));
      
      try {
        const response = await fetch(`https://graph.facebook.com/v21.0/?access_token=${metaToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: batchRequests })
        });
        
        if (response.ok) {
          const results = await response.json();
          for (let j = 0; j < results.length; j++) {
            if (results[j].code === 200 && results[j].body) {
              try {
                const d = JSON.parse(results[j].body);
                let thumb = d.picture;
                if (d.thumbnails?.data?.length) {
                  // Get highest resolution thumbnail
                  const sorted = d.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                  if (sorted[0]?.uri) thumb = sorted[0].uri;
                }
                if (thumb) {
                  videoThumbnailMap.set(batch[j], thumb);
                  console.log(`[CACHE-HD] Got video thumbnail for ${batch[j]}: ${thumb.substring(0, 50)}...`);
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        console.error('[CACHE-HD] Error fetching video thumbnails:', e);
      }
    }

    console.log(`[CACHE-HD] Got ${videoThumbnailMap.size} video thumbnails`);

    // Now cache each ad's HD image
    let cached = 0;
    let failed = 0;
    let skipped = 0;

    for (const ad of ads) {
      const adId = String(ad.id);
      
      // Check if already cached (unless force_refresh)
      if (!force_refresh) {
        const { data: existing } = await supabase
          .from('ads_daily_metrics')
          .select('cached_creative_thumbnail')
          .eq('project_id', project_id)
          .eq('ad_id', adId)
          .not('cached_creative_thumbnail', 'is', null)
          .limit(1);
          
        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }
      }

      // Determine best HD image URL
      let hdImageUrl: string | null = null;
      
      // Priority 1: HD image from image_hash
      if (ad.creative?.image_hash && adImageMap.has(ad.creative.image_hash)) {
        hdImageUrl = adImageMap.get(ad.creative.image_hash)!;
      }
      
      // Priority 2: Video image_hash
      if (!hdImageUrl && ad.creative?.object_story_spec?.video_data?.image_hash) {
        const videoImageHash = ad.creative.object_story_spec.video_data.image_hash;
        if (adImageMap.has(videoImageHash)) {
          hdImageUrl = adImageMap.get(videoImageHash)!;
        }
      }
      
      // Priority 3: Video thumbnail (highest res)
      if (!hdImageUrl && ad.creative?.object_story_spec?.video_data?.video_id) {
        const videoId = ad.creative.object_story_spec.video_data.video_id;
        if (videoThumbnailMap.has(videoId)) {
          hdImageUrl = videoThumbnailMap.get(videoId)!;
        }
      }
      
      // Priority 4: Creative thumbnail (fallback, may be low res)
      if (!hdImageUrl && ad.creative?.thumbnail_url) {
        hdImageUrl = ad.creative.thumbnail_url;
      }

      if (!hdImageUrl) {
        console.log(`[CACHE-HD] No image URL found for ad ${adId}`);
        failed++;
        continue;
      }

      try {
        // Download the HD image
        const imgResponse = await fetch(hdImageUrl);
        if (!imgResponse.ok) {
          console.warn(`[CACHE-HD] Failed to download image for ad ${adId}: ${imgResponse.status}`);
          failed++;
          continue;
        }

        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const imgBuffer = await imgResponse.arrayBuffer();
        
        // Skip if image is too small (likely a placeholder)
        if (imgBuffer.byteLength < 5000) {
          console.warn(`[CACHE-HD] Image too small for ad ${adId}: ${imgBuffer.byteLength} bytes`);
          failed++;
          continue;
        }

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
          console.warn(`[CACHE-HD] Upload error for ad ${adId}:`, uploadError);
          failed++;
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('creative-images')
          .getPublicUrl(filePath);

        // Update all records for this ad in ads_daily_metrics
        const { error: updateError } = await supabase
          .from('ads_daily_metrics')
          .update({ cached_creative_thumbnail: publicUrl })
          .eq('project_id', project_id)
          .eq('ad_id', adId);

        if (updateError) {
          console.warn(`[CACHE-HD] Update error for ad ${adId}:`, updateError);
          failed++;
          continue;
        }

        // Also update the ads table if it exists
        await supabase
          .from('ads')
          .update({ cached_image_url: publicUrl })
          .eq('project_id', project_id)
          .eq('id', adId);

        cached++;
        console.log(`[CACHE-HD] Cached HD image for ad ${adId} (${Math.round(imgBuffer.byteLength / 1024)}KB) -> ${publicUrl}`);

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 50));
      } catch (err: any) {
        console.error(`[CACHE-HD] Error caching ad ${adId}:`, err);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      project_id,
      total_ads: ads.length,
      hd_images_found: adImageMap.size,
      video_thumbnails_found: videoThumbnailMap.size,
      cached,
      failed,
      skipped
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[CACHE-HD] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
