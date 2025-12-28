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
        const creativeUrl = `https://graph.facebook.com/v19.0/${creativeId}?fields=image_url,image_hash,video_id,object_story_spec,effective_object_story_id,asset_feed_spec,thumbnail_url&access_token=${token}`;
        const creativeResponse = await fetch(creativeUrl);
        const creativeData = await creativeResponse.json();
        
        if (creativeData.error) {
          console.log(`[CREATIVE ERROR] Could not fetch creative ${creativeId}: ${creativeData.error.message}`);
          return { imageUrl: null, videoUrl: null };
        }
        
        let imageUrl: string | null = null;
        let videoUrl: string | null = null;
        
        // Try to get video URL if video_id exists
        if (creativeData.video_id) {
          try {
            const videoApiUrl = `https://graph.facebook.com/v19.0/${creativeData.video_id}?fields=source,picture&access_token=${token}`;
            const videoResponse = await fetch(videoApiUrl);
            const videoData = await videoResponse.json();
            if (videoData.source) {
              videoUrl = videoData.source;
              console.log(`[CREATIVE SUCCESS] Got HD video source for creative ${creativeId}`);
            }
            if (!imageUrl && videoData.picture) {
              imageUrl = videoData.picture;
            }
          } catch (e) {
            console.log(`[CREATIVE WARN] Could not fetch video for creative ${creativeId}`);
          }
        }
        
        // Try to get image_url first
        if (creativeData.image_url) {
          console.log(`[CREATIVE SUCCESS] Got image_url for creative ${creativeId}`);
          imageUrl = creativeData.image_url;
        }
        
        // Try to get from image_hash using adimages endpoint
        if (!imageUrl && creativeData.image_hash) {
          try {
            const cleanAccountId = ad_account_id.replace('act_', '');
            const adImagesUrl = `https://graph.facebook.com/v19.0/act_${cleanAccountId}/adimages?hashes=['${creativeData.image_hash}']&fields=url_128,url,permalink_url&access_token=${token}`;
            const adImagesResponse = await fetch(adImagesUrl);
            const adImagesData = await adImagesResponse.json();
            
            if (adImagesData.data?.[0]) {
              const imgData = adImagesData.data[0];
              imageUrl = imgData.permalink_url || imgData.url || imgData.url_128;
              if (imageUrl) {
                console.log(`[CREATIVE SUCCESS] Got image from image_hash for creative ${creativeId}`);
              }
            }
          } catch (e) {
            console.log(`[CREATIVE WARN] Could not fetch image from hash for creative ${creativeId}`);
          }
        }
        
        // Try to get from object_story_spec
        if (!imageUrl && creativeData.object_story_spec) {
          const spec = creativeData.object_story_spec;
          
          if (spec.link_data?.image_url) {
            imageUrl = spec.link_data.image_url;
            console.log(`[CREATIVE SUCCESS] Got link_data.image_url for creative ${creativeId}`);
          } else if (spec.link_data?.picture) {
            imageUrl = spec.link_data.picture;
            console.log(`[CREATIVE SUCCESS] Got link_data.picture for creative ${creativeId}`);
          }
          
          if (!imageUrl && spec.photo_data?.image_url) {
            imageUrl = spec.photo_data.image_url;
            console.log(`[CREATIVE SUCCESS] Got photo_data.image_url for creative ${creativeId}`);
          }
          
          if (spec.video_data) {
            if (!imageUrl && spec.video_data.image_url) {
              imageUrl = spec.video_data.image_url;
              console.log(`[CREATIVE SUCCESS] Got video_data.image_url for creative ${creativeId}`);
            }
            if (!videoUrl && spec.video_data.video_id) {
              try {
                const videoApiUrl = `https://graph.facebook.com/v19.0/${spec.video_data.video_id}?fields=source,picture&access_token=${token}`;
                const videoResponse = await fetch(videoApiUrl);
                const videoData = await videoResponse.json();
                if (videoData.source) {
                  videoUrl = videoData.source;
                  console.log(`[CREATIVE SUCCESS] Got HD video source from video_data for creative ${creativeId}`);
                }
                if (!imageUrl && videoData.picture) {
                  imageUrl = videoData.picture;
                }
              } catch (e) {
                console.log(`[CREATIVE WARN] Could not fetch video from video_data for creative ${creativeId}`);
              }
            }
          }
        }
        
        // Check asset_feed_spec for carousel/dynamic ads
        if (!imageUrl && creativeData.asset_feed_spec?.images) {
          const images = creativeData.asset_feed_spec.images;
          if (images.length > 0 && images[0].url) {
            imageUrl = images[0].url;
            console.log(`[CREATIVE SUCCESS] Got image from asset_feed_spec for creative ${creativeId}`);
          }
        }
        
        // Try to get from effective_object_story_id
        if (!imageUrl && creativeData.effective_object_story_id) {
          try {
            const postUrl = `https://graph.facebook.com/v19.0/${creativeData.effective_object_story_id}?fields=full_picture,attachments{media}&access_token=${token}`;
            const postResponse = await fetch(postUrl);
            const postData = await postResponse.json();
            
            if (postData.full_picture) {
              imageUrl = postData.full_picture;
              console.log(`[CREATIVE SUCCESS] Got full_picture from post for creative ${creativeId}`);
            }
            
            if (postData.attachments?.data?.[0]?.media?.image?.src) {
              const attachmentSrc = postData.attachments.data[0].media.image.src;
              if (attachmentSrc) {
                imageUrl = attachmentSrc;
                console.log(`[CREATIVE SUCCESS] Got attachment image for creative ${creativeId}`);
              }
            }
          } catch (e) {
            console.log(`[CREATIVE WARN] Could not fetch post for creative ${creativeId}`);
          }
        }

        // Final fallback: use thumbnail_url from original creative data
        if (!imageUrl && creativeData.thumbnail_url) {
          imageUrl = creativeData.thumbnail_url;
          console.log(`[CREATIVE FALLBACK] Using thumbnail_url for creative ${creativeId}`);
        }
        
        return { imageUrl, videoUrl };
      } catch (e) {
        console.error(`[CREATIVE ERROR] Error fetching creative media for ${creativeId}:`, e);
        return { imageUrl: null, videoUrl: null };
      }
    }

    const insightsFields = 'spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,action_values';

    // Track sync statistics
    let totalAdSets = 0;
    let totalAds = 0;
    let campaignsWithZeroAdSets = 0;

    // Process each campaign
    for (const campaign of campaigns) {
      console.log(`\n[CAMPAIGN] Processing: ${campaign.name} (${campaign.id}) - Status: ${campaign.status}`);
      
      // Fetch campaign insights
      const insightsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`;
      
      let insights = null;
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();
        insights = insightsData.data?.[0] || null;
      } catch (e) {
        console.error(`[CAMPAIGN ERROR] Error fetching insights for campaign ${campaign.id}:`, e);
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
      console.log(`[CAMPAIGN] Synced campaign: ${campaign.name}`);

      // IMPROVED: Fetch ad sets with ALL statuses (including archived/paused)
      let adSets: any[] = [];
      const effectiveStatus = encodeURIComponent(JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'CAMPAIGN_PAUSED', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES']));
      let adSetsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/adsets?fields=id,name,status,daily_budget,lifetime_budget,targeting&effective_status=${effectiveStatus}&limit=100&access_token=${token}`;
      
      try {
        while (adSetsUrl) {
          const adSetsResponse = await fetch(adSetsUrl);
          const adSetsData = await adSetsResponse.json();
          
          if (adSetsData.error) {
            console.error(`[ADSET ERROR] Error fetching ad sets for campaign ${campaign.id}:`, adSetsData.error);
            break;
          }
          
          adSets = adSets.concat(adSetsData.data || []);
          adSetsUrl = adSetsData.paging?.next || null;
        }
        
        console.log(`[ADSET] Found ${adSets.length} ad sets for campaign ${campaign.name}`);

        // FALLBACK: If no ad sets found through campaign, try fetching directly from account
        if (adSets.length === 0) {
          console.log(`[ADSET FALLBACK] Campaign ${campaign.name} returned 0 ad sets, trying direct account query...`);
          
          try {
            const directAdSetsUrl = `https://graph.facebook.com/v19.0/${ad_account_id}/adsets?fields=id,name,status,daily_budget,lifetime_budget,targeting,campaign_id&filtering=[{"field":"campaign_id","operator":"EQUAL","value":"${campaign.id}"}]&effective_status=${effectiveStatus}&limit=100&access_token=${token}`;
            const directResponse = await fetch(directAdSetsUrl);
            const directData = await directResponse.json();
            
            if (directData.error) {
              console.log(`[ADSET FALLBACK ERROR] Direct query failed:`, directData.error.message);
            } else if (directData.data?.length > 0) {
              adSets = directData.data;
              console.log(`[ADSET FALLBACK SUCCESS] Found ${adSets.length} ad sets via direct query`);
            } else {
              console.log(`[ADSET FALLBACK] Direct query also returned 0 ad sets - campaign may genuinely have none`);
              campaignsWithZeroAdSets++;
            }
          } catch (e) {
            console.log(`[ADSET FALLBACK ERROR] Exception in direct query:`, e);
          }
        }

        totalAdSets += adSets.length;

        for (const adSet of adSets) {
          // Fetch ad set insights
          const adSetInsightsUrl = `https://graph.facebook.com/v19.0/${adSet.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`;
          let adSetInsights = null;
          try {
            const adSetInsightsResponse = await fetch(adSetInsightsUrl);
            const adSetInsightsData = await adSetInsightsResponse.json();
            adSetInsights = adSetInsightsData.data?.[0] || null;
          } catch (e) {
            console.error(`[ADSET ERROR] Error fetching insights for ad set ${adSet.id}:`, e);
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

          // Fetch ads for this ad set with ALL statuses
          const allAds: any[] = [];
          let currentAdsUrl = `https://graph.facebook.com/v19.0/${adSet.id}/ads?fields=id,name,status,creative{id,thumbnail_url,title,body,call_to_action_type}&effective_status=${effectiveStatus}&limit=100&access_token=${token}`;
          
          try {
            let hasMoreAds = true;
            while (hasMoreAds && currentAdsUrl) {
              const adsResponse: Response = await fetch(currentAdsUrl);
              const adsResult: any = await adsResponse.json();
              
              if (adsResult.error) {
                console.error(`[AD ERROR] Error fetching ads for ad set ${adSet.id}:`, adsResult.error);
                hasMoreAds = false;
                break;
              }
              
              allAds.push(...(adsResult.data || []));
              currentAdsUrl = adsResult.paging?.next || '';
              hasMoreAds = !!adsResult.paging?.next;
            }
            
            console.log(`[AD] Found ${allAds.length} ads for ad set ${adSet.name}`);
            totalAds += allAds.length;

            let successfulCreatives = 0;
            let failedCreatives = 0;

            for (const ad of allAds) {
              // Fetch ad insights
              const adInsightsUrl = `https://graph.facebook.com/v19.0/${ad.id}/insights?fields=${insightsFields}&${timeParam}&access_token=${token}`;
              let adInsights = null;
              try {
                const adInsightsResponse = await fetch(adInsightsUrl);
                const adInsightsData = await adInsightsResponse.json();
                adInsights = adInsightsData.data?.[0] || null;
              } catch (e) {
                console.error(`[AD ERROR] Error fetching insights for ad ${ad.id}:`, e);
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
                if (creativeImageUrl || creativeVideoUrl) {
                  successfulCreatives++;
                } else {
                  failedCreatives++;
                }
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

            if (allAds.length > 0) {
              console.log(`[AD CREATIVES] ${successfulCreatives}/${allAds.length} creatives fetched successfully, ${failedCreatives} failed`);
            }
          } catch (e) {
            console.error(`[AD ERROR] Error fetching ads for ad set ${adSet.id}:`, e);
          }
        }
      } catch (e) {
        console.error(`[ADSET ERROR] Error fetching ad sets for campaign ${campaign.id}:`, e);
      }
    }

    // Update project with successful sync
    await supabase.from('projects').update({
      webhook_status: 'success',
      last_sync_at: new Date().toISOString(),
    }).eq('id', project_id);

    // Log successful sync with statistics
    const syncMessage = `Sincronização concluída: ${campaigns.length} campanhas, ${totalAdSets} conjuntos, ${totalAds} anúncios. ${campaignsWithZeroAdSets > 0 ? `${campaignsWithZeroAdSets} campanhas sem conjuntos.` : ''}`;
    await supabase.from('sync_logs').insert({
      project_id,
      status: 'success',
      message: syncMessage,
    });

    console.log('\n[SYNC COMPLETE]', syncMessage);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          campaigns_count: campaigns.length,
          ad_sets_count: totalAdSets,
          ads_count: totalAds,
          campaigns_without_adsets: campaignsWithZeroAdSets,
          synced_at: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC ERROR]', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
