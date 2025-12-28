import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  project_id: string;
  ad_account_id: string;
  access_token?: string;
  date_preset?: string;
  time_range?: {
    since: string;
    until: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_id, ad_account_id, access_token, date_preset, time_range }: SyncRequest = await req.json();
    
    // Build time parameter for API - use time_range if provided, otherwise use date_preset
    // Meta API requires JSON format for time_range
    const timeParam = time_range 
      ? `time_range=${encodeURIComponent(JSON.stringify({ since: time_range.since, until: time_range.until }))}`
      : `date_preset=${date_preset || 'last_30d'}`;
    
    console.log('Using time parameter:', timeParam);

    const token = access_token || metaAccessToken;

    if (!token) {
      console.error('No Meta access token provided');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Meta access token is required. Please configure META_ACCESS_TOKEN in secrets or provide access_token in request.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project_id || !ad_account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'project_id and ad_account_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting Meta Ads sync for project: ${project_id}, account: ${ad_account_id}`);

    // Log sync start
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'in_progress',
      message: `Iniciando sincronização da conta ${ad_account_id}`,
    });

    // Update project status
    await supabase.from('projects').update({
      webhook_status: 'syncing',
    }).eq('id', project_id);

    // Fetch campaigns from Meta Ads API
    const campaignFields = 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time';
    const campaignsUrl = `https://graph.facebook.com/v19.0/${ad_account_id}/campaigns?fields=${campaignFields}&access_token=${token}`;
    
    console.log('Fetching campaigns from Meta Ads API...');
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (!campaignsResponse.ok || campaignsData.error) {
      console.error('Meta API error:', campaignsData);
      
      await supabase.from('sync_logs').insert({
        project_id,
        status: 'error',
        message: `Erro na API do Meta: ${campaignsData.error?.message || JSON.stringify(campaignsData)}`,
      });

      await supabase.from('projects').update({
        webhook_status: 'error',
      }).eq('id', project_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: campaignsData.error?.message || 'Meta API error',
          details: campaignsData 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaigns = campaignsData.data || [];
    console.log(`Found ${campaigns.length} campaigns`);

    // Helper function to fetch high-res creative image and video
    async function fetchCreativeMedia(creativeId: string): Promise<{ imageUrl: string | null; videoUrl: string | null }> {
      if (!creativeId) return { imageUrl: null, videoUrl: null };
      
      try {
        // Request more fields for higher resolution images
        const creativeUrl = `https://graph.facebook.com/v19.0/${creativeId}?fields=image_url,image_hash,video_id,object_story_spec,effective_object_story_id,asset_feed_spec,thumbnail_url&access_token=${token}`;
        const creativeResponse = await fetch(creativeUrl);
        const creativeData = await creativeResponse.json();
        
        if (creativeData.error) {
          console.log(`Could not fetch creative ${creativeId}:`, creativeData.error.message);
          return { imageUrl: null, videoUrl: null };
        }
        
        let imageUrl: string | null = null;
        let videoUrl: string | null = null;
        
        // Try to get video URL if video_id exists - request HD source
        if (creativeData.video_id) {
          try {
            const videoApiUrl = `https://graph.facebook.com/v19.0/${creativeData.video_id}?fields=source,picture&access_token=${token}`;
            const videoResponse = await fetch(videoApiUrl);
            const videoData = await videoResponse.json();
            if (videoData.source) {
              videoUrl = videoData.source;
              console.log(`Got HD video source for creative ${creativeId}`);
            }
            // Use video picture as fallback image
            if (!imageUrl && videoData.picture) {
              imageUrl = videoData.picture;
            }
          } catch (e) {
            console.log(`Could not fetch video for creative ${creativeId}`);
          }
        }
        
        // Try to get image_url first (direct image - usually high quality)
        if (creativeData.image_url) {
          console.log(`Got image_url for creative ${creativeId}`);
          imageUrl = creativeData.image_url;
        }
        
        // Try to get from image_hash using adimages endpoint for highest resolution
        if (!imageUrl && creativeData.image_hash) {
          try {
            // Extract account ID from ad_account_id
            const cleanAccountId = ad_account_id.replace('act_', '');
            const adImagesUrl = `https://graph.facebook.com/v19.0/act_${cleanAccountId}/adimages?hashes=['${creativeData.image_hash}']&fields=url_128,url,permalink_url&access_token=${token}`;
            const adImagesResponse = await fetch(adImagesUrl);
            const adImagesData = await adImagesResponse.json();
            
            if (adImagesData.data?.[0]) {
              const imgData = adImagesData.data[0];
              // permalink_url is highest quality, then url, then url_128
              imageUrl = imgData.permalink_url || imgData.url || imgData.url_128;
              if (imageUrl) {
                console.log(`Got image from image_hash for creative ${creativeId}`);
              }
            }
          } catch (e) {
            console.log(`Could not fetch image from hash for creative ${creativeId}`);
          }
        }
        
        // Try to get from object_story_spec (for video/carousel ads)
        if (!imageUrl && creativeData.object_story_spec) {
          const spec = creativeData.object_story_spec;
          
          // Check for link_data (single image ads)
          if (spec.link_data?.image_url) {
            console.log(`Got link_data.image_url for creative ${creativeId}`);
            imageUrl = spec.link_data.image_url;
          } else if (spec.link_data?.picture) {
            console.log(`Got link_data.picture for creative ${creativeId}`);
            imageUrl = spec.link_data.picture;
          }
          
          // Check for photo_data (photo posts)
          if (!imageUrl && spec.photo_data?.image_url) {
            console.log(`Got photo_data.image_url for creative ${creativeId}`);
            imageUrl = spec.photo_data.image_url;
          }
          
          // Check for video_data (video posts with thumbnail and video source)
          if (spec.video_data) {
            if (!imageUrl && spec.video_data.image_url) {
              console.log(`Got video_data.image_url for creative ${creativeId}`);
              imageUrl = spec.video_data.image_url;
            }
            // Try to get HD video source from video_data
            if (!videoUrl && spec.video_data.video_id) {
              try {
                const videoApiUrl = `https://graph.facebook.com/v19.0/${spec.video_data.video_id}?fields=source,picture&access_token=${token}`;
                const videoResponse = await fetch(videoApiUrl);
                const videoData = await videoResponse.json();
                if (videoData.source) {
                  videoUrl = videoData.source;
                  console.log(`Got HD video source from video_data for creative ${creativeId}`);
                }
                if (!imageUrl && videoData.picture) {
                  imageUrl = videoData.picture;
                }
              } catch (e) {
                console.log(`Could not fetch video from video_data for creative ${creativeId}`);
              }
            }
          }
        }
        
        // Check asset_feed_spec for carousel/dynamic ads
        if (!imageUrl && creativeData.asset_feed_spec?.images) {
          const images = creativeData.asset_feed_spec.images;
          if (images.length > 0 && images[0].url) {
            imageUrl = images[0].url;
            console.log(`Got image from asset_feed_spec for creative ${creativeId}`);
          }
        }
        
        // Try to get from effective_object_story_id (actual post)
        if (!imageUrl && creativeData.effective_object_story_id) {
          try {
            const postUrl = `https://graph.facebook.com/v19.0/${creativeData.effective_object_story_id}?fields=full_picture,attachments{media}&access_token=${token}`;
            const postResponse = await fetch(postUrl);
            const postData = await postResponse.json();
            
            if (postData.full_picture) {
              console.log(`Got full_picture from post for creative ${creativeId}`);
              imageUrl = postData.full_picture;
            }
            
            // Try attachments for even higher resolution
            if (postData.attachments?.data?.[0]?.media?.image?.src) {
              const attachmentSrc = postData.attachments.data[0].media.image.src;
              if (attachmentSrc) {
                console.log(`Got attachment image for creative ${creativeId}`);
                imageUrl = attachmentSrc;
              }
            }
          } catch (e) {
            console.log(`Could not fetch post for creative ${creativeId}`);
          }
        }
        
        return { imageUrl, videoUrl };
      } catch (e) {
        console.error(`Error fetching creative media for ${creativeId}:`, e);
        return { imageUrl: null, videoUrl: null };
      }
    }

    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';

    // Process each campaign
    for (const campaign of campaigns) {
      // Fetch campaign insights
      const insightsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`;
      
      let insights = null;
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();
        insights = insightsData.data?.[0] || null;
      } catch (e) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, e);
      }

      // Extract conversions from actions
      let conversions = 0;
      let conversionValue = 0;
      if (insights?.actions) {
        const purchaseAction = insights.actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
        const leadAction = insights.actions.find((a: any) => a.action_type === 'lead');
        conversions = parseInt(purchaseAction?.value || leadAction?.value || '0');
      }
      if (insights?.action_values) {
        const purchaseValue = insights.action_values.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
        conversionValue = parseFloat(purchaseValue?.value || '0');
      }

      const spend = parseFloat(insights?.spend || '0');
      const roas = spend > 0 ? conversionValue / spend : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      // Upsert campaign
      const campaignData = {
        id: campaign.id,
        project_id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
        lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
        spend,
        impressions: parseInt(insights?.impressions || '0'),
        clicks: parseInt(insights?.clicks || '0'),
        ctr: parseFloat(insights?.ctr || '0'),
        cpm: parseFloat(insights?.cpm || '0'),
        cpc: parseFloat(insights?.cpc || '0'),
        reach: parseInt(insights?.reach || '0'),
        frequency: parseFloat(insights?.frequency || '0'),
        conversions,
        conversion_value: conversionValue,
        roas,
        cpa,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time,
        synced_at: new Date().toISOString(),
      };

      await supabase.from('campaigns').upsert(campaignData, { onConflict: 'id' });
      console.log(`Synced campaign: ${campaign.name}`);

      // Fetch ad sets for this campaign with pagination
      let adSets: any[] = [];
      let adSetsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/adsets?fields=id,name,status,daily_budget,lifetime_budget,targeting&limit=100&access_token=${token}`;
      
      try {
        while (adSetsUrl) {
          const adSetsResponse = await fetch(adSetsUrl);
          const adSetsData = await adSetsResponse.json();
          
          if (adSetsData.error) {
            console.error(`Error fetching ad sets for campaign ${campaign.id}:`, adSetsData.error);
            break;
          }
          
          adSets = adSets.concat(adSetsData.data || []);
          adSetsUrl = adSetsData.paging?.next || null;
        }
        
        console.log(`Found ${adSets.length} ad sets for campaign ${campaign.name}`);

        for (const adSet of adSets) {
          // Fetch ad set insights
          const adSetInsightsUrl = `https://graph.facebook.com/v19.0/${adSet.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`;
          let adSetInsights = null;
          try {
            const adSetInsightsResponse = await fetch(adSetInsightsUrl);
            const adSetInsightsData = await adSetInsightsResponse.json();
            adSetInsights = adSetInsightsData.data?.[0] || null;
          } catch (e) {
            console.error(`Error fetching insights for ad set ${adSet.id}:`, e);
          }

          let adSetConversions = 0;
          let adSetConversionValue = 0;
          if (adSetInsights?.actions) {
            const purchaseAction = adSetInsights.actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
            const leadAction = adSetInsights.actions.find((a: any) => a.action_type === 'lead');
            adSetConversions = parseInt(purchaseAction?.value || leadAction?.value || '0');
          }
          if (adSetInsights?.action_values) {
            const purchaseValue = adSetInsights.action_values.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
            adSetConversionValue = parseFloat(purchaseValue?.value || '0');
          }

          const adSetSpend = parseFloat(adSetInsights?.spend || '0');
          const adSetRoas = adSetSpend > 0 ? adSetConversionValue / adSetSpend : 0;
          const adSetCpa = adSetConversions > 0 ? adSetSpend / adSetConversions : 0;

          const adSetData = {
            id: adSet.id,
            campaign_id: campaign.id,
            project_id,
            name: adSet.name,
            status: adSet.status,
            daily_budget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : null,
            lifetime_budget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : null,
            targeting: adSet.targeting,
            spend: adSetSpend,
            impressions: parseInt(adSetInsights?.impressions || '0'),
            clicks: parseInt(adSetInsights?.clicks || '0'),
            ctr: parseFloat(adSetInsights?.ctr || '0'),
            cpm: parseFloat(adSetInsights?.cpm || '0'),
            cpc: parseFloat(adSetInsights?.cpc || '0'),
            reach: parseInt(adSetInsights?.reach || '0'),
            frequency: parseFloat(adSetInsights?.frequency || '0'),
            conversions: adSetConversions,
            conversion_value: adSetConversionValue,
            roas: adSetRoas,
            cpa: adSetCpa,
            synced_at: new Date().toISOString(),
          };

          await supabase.from('ad_sets').upsert(adSetData, { onConflict: 'id' });

          // Fetch ads for this ad set with pagination
          const allAds: any[] = [];
          let currentAdsUrl = `https://graph.facebook.com/v19.0/${adSet.id}/ads?fields=id,name,status,creative{id,thumbnail_url,title,body,call_to_action_type}&limit=100&access_token=${token}`;
          
          try {
            let hasMoreAds = true;
            while (hasMoreAds && currentAdsUrl) {
              const adsResponse: Response = await fetch(currentAdsUrl);
              const adsResult: any = await adsResponse.json();
              
              if (adsResult.error) {
                console.error(`Error fetching ads for ad set ${adSet.id}:`, adsResult.error);
                hasMoreAds = false;
                break;
              }
              
              allAds.push(...(adsResult.data || []));
              currentAdsUrl = adsResult.paging?.next || '';
              hasMoreAds = !!adsResult.paging?.next;
            }
            
            console.log(`Found ${allAds.length} ads for ad set ${adSet.name}`);

            for (const ad of allAds) {
              // Fetch ad insights
              const adInsightsUrl = `https://graph.facebook.com/v19.0/${ad.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`;
              let adInsights = null;
              try {
                const adInsightsResponse = await fetch(adInsightsUrl);
                const adInsightsData = await adInsightsResponse.json();
                adInsights = adInsightsData.data?.[0] || null;
              } catch (e) {
                console.error(`Error fetching insights for ad ${ad.id}:`, e);
              }

              let adConversions = 0;
              let adConversionValue = 0;
              if (adInsights?.actions) {
                const purchaseAction = adInsights.actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
                const leadAction = adInsights.actions.find((a: any) => a.action_type === 'lead');
                adConversions = parseInt(purchaseAction?.value || leadAction?.value || '0');
              }
              if (adInsights?.action_values) {
                const purchaseValue = adInsights.action_values.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
                adConversionValue = parseFloat(purchaseValue?.value || '0');
              }

              const adSpend = parseFloat(adInsights?.spend || '0');
              const adRoas = adSpend > 0 ? adConversionValue / adSpend : 0;
              const adCpa = adConversions > 0 ? adSpend / adConversions : 0;

              // Fetch high-res creative image and video
              let creativeImageUrl: string | null = null;
              let creativeVideoUrl: string | null = null;
              if (ad.creative?.id) {
                const media = await fetchCreativeMedia(ad.creative.id);
                creativeImageUrl = media.imageUrl;
                creativeVideoUrl = media.videoUrl;
              }

              const adData = {
                id: ad.id,
                ad_set_id: adSet.id,
                campaign_id: campaign.id,
                project_id,
                name: ad.name,
                status: ad.status,
                creative_id: ad.creative?.id,
                creative_thumbnail: ad.creative?.thumbnail_url,
                creative_image_url: creativeImageUrl,
                creative_video_url: creativeVideoUrl,
                headline: ad.creative?.title,
                primary_text: ad.creative?.body,
                cta: ad.creative?.call_to_action_type,
                spend: adSpend,
                impressions: parseInt(adInsights?.impressions || '0'),
                clicks: parseInt(adInsights?.clicks || '0'),
                ctr: parseFloat(adInsights?.ctr || '0'),
                cpm: parseFloat(adInsights?.cpm || '0'),
                cpc: parseFloat(adInsights?.cpc || '0'),
                reach: parseInt(adInsights?.reach || '0'),
                frequency: parseFloat(adInsights?.frequency || '0'),
                conversions: adConversions,
                conversion_value: adConversionValue,
                roas: adRoas,
                cpa: adCpa,
                synced_at: new Date().toISOString(),
              };

              await supabase.from('ads').upsert(adData, { onConflict: 'id' });
            }
          } catch (e) {
            console.error(`Error fetching ads for ad set ${adSet.id}:`, e);
          }
        }
      } catch (e) {
        console.error(`Error fetching ad sets for campaign ${campaign.id}:`, e);
      }
    }

    // Update project with successful sync
    await supabase.from('projects').update({
      webhook_status: 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    // Log successful sync
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: `Sincronização concluída: ${campaigns.length} campanhas sincronizadas`,
    });

    console.log('Sync completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          campaigns_count: campaigns.length,
          synced_at: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});