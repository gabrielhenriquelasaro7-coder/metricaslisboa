import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id } = await req.json();
    if (!project_id) throw new Error('project_id required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaToken = Deno.env.get('META_ACCESS_TOKEN')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get project's facebook_page_id
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('facebook_page_id')
      .eq('id', project_id)
      .single();

    if (projErr || !project?.facebook_page_id) {
      throw new Error('Projeto sem facebook_page_id configurado');
    }

    const pageId = project.facebook_page_id;
    const graphUrl = 'https://graph.facebook.com/v21.0';

    // Step 1: Get IG Business Account ID from page
    const pageRes = await fetch(`${graphUrl}/${pageId}?fields=instagram_business_account&access_token=${metaToken}`);
    const pageData = await pageRes.json();
    
    if (!pageData.instagram_business_account?.id) {
      throw new Error('Nenhuma conta Instagram Business vinculada a esta página');
    }

    const igUserId = pageData.instagram_business_account.id;

    // Step 2: Get account info
    const accountRes = await fetch(
      `${graphUrl}/${igUserId}?fields=biography,followers_count,follows_count,media_count,name,profile_picture_url,username,website&access_token=${metaToken}`
    );
    const accountData = await accountRes.json();

    if (accountData.error) {
      throw new Error(`Meta API error: ${accountData.error.message}`);
    }

    // Upsert instagram_accounts
    await supabase.from('instagram_accounts').upsert({
      project_id,
      ig_user_id: igUserId,
      username: accountData.username,
      name: accountData.name,
      biography: accountData.biography,
      profile_picture_url: accountData.profile_picture_url,
      followers_count: accountData.followers_count || 0,
      follows_count: accountData.follows_count || 0,
      media_count: accountData.media_count || 0,
      website: accountData.website,
      last_sync_at: new Date().toISOString(),
    }, { onConflict: 'project_id' });

    // Step 3: Get daily insights (last 30 days)
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinceUnix = Math.floor(since.getTime() / 1000);
    const untilUnix = Math.floor(now.getTime() / 1000);

    let dailyInsights: Record<string, any> = {};
    
    try {
      const insightsRes = await fetch(
        `${graphUrl}/${igUserId}/insights?metric=reach,impressions,accounts_engaged,likes,comments,shares,saves,follows_and_unfollows,profile_views,website_clicks,total_interactions&period=day&since=${sinceUnix}&until=${untilUnix}&access_token=${metaToken}`
      );
      const insightsData = await insightsRes.json();

      if (insightsData.data) {
        for (const metric of insightsData.data) {
          const metricName = metric.name;
          for (const val of metric.values || []) {
            const date = val.end_time?.split('T')[0];
            if (!date) continue;
            if (!dailyInsights[date]) dailyInsights[date] = {};
            
            if (metricName === 'follows_and_unfollows') {
              if (typeof val.value === 'object' && val.value !== null) {
                dailyInsights[date].follows = val.value.follows || 0;
                dailyInsights[date].unfollows = val.value.unfollows || 0;
              }
            } else if (metricName === 'impressions') {
              dailyInsights[date].views = val.value || 0;
            } else {
              dailyInsights[date][metricName] = val.value || 0;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching daily insights:', e);
    }

    // Step 4: Get demographics (lifetime)
    let demographics: any = {};
    try {
      const demoRes = await fetch(
        `${graphUrl}/${igUserId}/insights?metric=engaged_audience_demographics,reached_audience_demographics,follower_demographics&period=lifetime&metric_type=total_value&access_token=${metaToken}`
      );
      const demoData = await demoRes.json();
      
      if (demoData.data) {
        for (const metric of demoData.data) {
          demographics[metric.name] = metric.total_value?.value || {};
        }
      }
    } catch (e) {
      console.error('Error fetching demographics:', e);
    }

    // Upsert daily insights
    const insightRows = Object.entries(dailyInsights).map(([date, data]: [string, any]) => ({
      project_id,
      date,
      reach: data.reach || 0,
      views: data.views || 0,
      accounts_engaged: data.accounts_engaged || 0,
      likes: data.likes || 0,
      comments: data.comments || 0,
      shares: data.shares || 0,
      saves: data.saves || 0,
      follows: data.follows || 0,
      unfollows: data.unfollows || 0,
      profile_views: data.profile_views || 0,
      website_clicks: data.website_clicks || 0,
      total_interactions: data.total_interactions || 0,
      engaged_demographics: demographics.engaged_audience_demographics || null,
      reached_demographics: demographics.reached_audience_demographics || null,
      follower_demographics: demographics.follower_demographics || null,
      synced_at: new Date().toISOString(),
    }));

    if (insightRows.length > 0) {
      await supabase.from('instagram_insights_daily').upsert(insightRows, { onConflict: 'project_id,date' });
    }

    // Step 5: Get media (last 50)
    const mediaRes = await fetch(
      `${graphUrl}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count&limit=50&access_token=${metaToken}`
    );
    const mediaData = await mediaRes.json();
    const mediaItems = mediaData.data || [];

    // Step 6: Get insights per media
    const mediaRows = [];
    for (const item of mediaItems) {
      let mediaInsights: any = {};
      try {
        const isReel = item.media_type === 'REELS' || item.media_type === 'VIDEO';
        const metrics = isReel
          ? 'reach,impressions,likes,comments,shares,saved,total_interactions,plays,ig_reels_avg_watch_time'
          : 'reach,impressions,likes,comments,shares,saved,total_interactions';
        
        const miRes = await fetch(
          `${graphUrl}/${item.id}/insights?metric=${metrics}&access_token=${metaToken}`
        );
        const miData = await miRes.json();
        
        if (miData.data) {
          for (const m of miData.data) {
            if (m.name === 'impressions') {
              mediaInsights.views = m.values?.[0]?.value || 0;
            } else {
              mediaInsights[m.name] = m.values?.[0]?.value || 0;
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching insights for media ${item.id}:`, e);
      }

      mediaRows.push({
        project_id,
        ig_media_id: item.id,
        media_type: item.media_type || 'IMAGE',
        caption: item.caption || null,
        media_url: item.media_url || null,
        thumbnail_url: item.thumbnail_url || null,
        permalink: item.permalink || null,
        timestamp: item.timestamp || null,
        like_count: item.like_count || 0,
        comments_count: item.comments_count || 0,
        reach: mediaInsights.reach || 0,
        views: mediaInsights.views || 0,
        shares: mediaInsights.shares || 0,
        saved: mediaInsights.saved || 0,
        total_interactions: mediaInsights.total_interactions || 0,
        plays: mediaInsights.plays || 0,
        avg_watch_time: mediaInsights.ig_reels_avg_watch_time || 0,
        synced_at: new Date().toISOString(),
      });
    }

    if (mediaRows.length > 0) {
      await supabase.from('instagram_media').upsert(mediaRows, { onConflict: 'project_id,ig_media_id' });
    }

    return new Response(JSON.stringify({
      success: true,
      account: accountData.username,
      media_count: mediaRows.length,
      insights_days: insightRows.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Instagram sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
