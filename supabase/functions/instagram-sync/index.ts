import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const graphUrl = 'https://graph.facebook.com/v21.0';

async function fetchInsightsBatch(
  igUserId: string,
  metrics: string[],
  period: string,
  token: string,
  extraParams = ''
) {
  const url = `${graphUrl}/${igUserId}/insights?metric=${metrics.join(',')}&period=${period}${extraParams}&access_token=${token}`;
  console.log(`Fetching insights: ${metrics.join(',')}, period=${period}`);
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.warn(`Insights batch failed [${metrics.join(',')}]: ${data.error.message}`);
    return null;
  }
  return data.data || [];
}

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

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('facebook_page_id')
      .eq('id', project_id)
      .single();

    if (projErr || !project?.facebook_page_id) {
      throw new Error('Projeto sem facebook_page_id configurado');
    }

    const pageId = project.facebook_page_id;

    // Step 1: Get IG Business Account ID
    const pageRes = await fetch(`${graphUrl}/${pageId}?fields=instagram_business_account&access_token=${metaToken}`);
    const pageData = await pageRes.json();

    if (pageData.error) {
      throw new Error(`Erro ao consultar página Facebook (ID: ${pageId}): ${pageData.error.message}`);
    }
    if (!pageData.instagram_business_account?.id) {
      throw new Error(`Nenhuma conta Instagram Business vinculada à página ${pageId}.`);
    }

    const igUserId = pageData.instagram_business_account.id;

    // Step 2: Get account info
    const accountRes = await fetch(
      `${graphUrl}/${igUserId}?fields=biography,followers_count,follows_count,media_count,name,profile_picture_url,username,website&access_token=${metaToken}`
    );
    const accountData = await accountRes.json();
    if (accountData.error) throw new Error(`Meta API error: ${accountData.error.message}`);

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

    // Step 3: Daily insights (last 30 days)
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinceUnix = Math.floor(since.getTime() / 1000);
    const untilUnix = Math.floor(now.getTime() / 1000);
    const timeParams = `&since=${sinceUnix}&until=${untilUnix}`;

    const dailyInsights: Record<string, any> = {};

    // Batch 1: period=day metrics (NO impressions - it's not a valid daily metric)
    const batch1 = await fetchInsightsBatch(
      igUserId,
      ['reach', 'profile_views', 'website_clicks', 'follower_count'],
      'day',
      metaToken,
      timeParams
    );

    // Batch 2: total_value metrics need metric_type=total_value
    const batch2 = await fetchInsightsBatch(
      igUserId,
      ['likes', 'comments', 'shares', 'saves', 'total_interactions', 'follows_and_unfollows'],
      'day',
      metaToken,
      `${timeParams}&metric_type=total_value`
    );

    // Batch 3: views (previously impressions)
    const batch3 = await fetchInsightsBatch(
      igUserId,
      ['views'],
      'day',
      metaToken,
      timeParams
    );

    // If batch2 failed, try individual metrics with metric_type=total_value
    let interactionMetrics = batch2;
    if (!interactionMetrics) {
      console.log('Batch2 failed, trying individual total_value metrics...');
      interactionMetrics = [];
      for (const metric of ['likes', 'comments', 'shares', 'saves', 'total_interactions', 'follows_and_unfollows']) {
        const result = await fetchInsightsBatch(igUserId, [metric], 'day', metaToken, `${timeParams}&metric_type=total_value`);
        if (result) interactionMetrics.push(...result);
      }
    }

    const allDailyMetrics = [...(batch1 || []), ...(interactionMetrics || []), ...(batch3 || [])];

    for (const metric of allDailyMetrics) {
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
        } else if (metricName === 'follower_count') {
          dailyInsights[date].follower_count = val.value || 0;
        } else {
          dailyInsights[date][metricName] = val.value || 0;
        }
      }
    }

    console.log(`Daily insights parsed: ${Object.keys(dailyInsights).length} days`);

    // Step 4: Demographics (lifetime)
    let demographics: any = {};
    for (const metric of ['follower_demographics', 'engaged_audience_demographics', 'reached_audience_demographics']) {
      try {
        const demoRes = await fetch(
          `${graphUrl}/${igUserId}/insights?metric=${metric}&period=lifetime&metric_type=total_value&access_token=${metaToken}`
        );
        const demoData = await demoRes.json();
        if (demoData.data) {
          for (const m of demoData.data) {
            demographics[m.name] = m.total_value?.value || {};
          }
        }
      } catch (e) {
        console.warn(`Demographics [${metric}] failed:`, e);
      }
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
      const { error: insErr } = await supabase.from('instagram_insights_daily').upsert(insightRows, { onConflict: 'project_id,date' });
      if (insErr) console.error('Error upserting daily insights:', insErr);
      else console.log(`Upserted ${insightRows.length} daily insight rows`);
    }

    // Step 5: Get media (last 50)
    const mediaRes = await fetch(
      `${graphUrl}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count&limit=50&access_token=${metaToken}`
    );
    const mediaData = await mediaRes.json();
    const mediaItems = mediaData.data || [];

    // Step 6: Per-media insights with v22+ compatible metrics
    let insightsOk = 0;
    let insightsFail = 0;
    const mediaRows = [];

    for (const item of mediaItems) {
      let mediaInsightsData: any = {};

      // Try fetching insights - use metrics that work in current API version
      // Avoid deprecated: impressions (for IMAGE/CAROUSEL), plays (for REELS)
      const isReel = item.media_type === 'REELS' || item.media_type === 'VIDEO';
      const baseMetrics = ['reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'];
      const reelMetrics = isReel ? ['ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'] : [];
      const allMetrics = [...baseMetrics, ...reelMetrics];

      try {
        const miRes = await fetch(`${graphUrl}/${item.id}/insights?metric=${allMetrics.join(',')}&access_token=${metaToken}`);
        const miData = await miRes.json();

        if (miData.error) {
          // Fallback: try just basic metrics without reel-specific ones
          console.warn(`Media ${item.id} insights failed, trying basic metrics: ${miData.error.message}`);
          const fallbackRes = await fetch(`${graphUrl}/${item.id}/insights?metric=reach,likes,comments,shares,saved&access_token=${metaToken}`);
          const fallbackData = await fallbackRes.json();

          if (fallbackData.data) {
            insightsOk++;
            for (const m of fallbackData.data) {
              mediaInsightsData[m.name] = m.values?.[0]?.value || 0;
            }
          } else {
            insightsFail++;
            // Use basic fields from media object
            mediaInsightsData = {
              likes: item.like_count || 0,
              comments: item.comments_count || 0,
              reach: (item.like_count || 0) + (item.comments_count || 0),
            };
          }
        } else if (miData.data) {
          insightsOk++;
          for (const m of miData.data) {
            mediaInsightsData[m.name] = m.values?.[0]?.value || 0;
          }
        }
      } catch (e) {
        insightsFail++;
        mediaInsightsData = {
          likes: item.like_count || 0,
          comments: item.comments_count || 0,
          reach: (item.like_count || 0) + (item.comments_count || 0),
        };
      }

      const likes = mediaInsightsData.likes || item.like_count || 0;
      const comments = mediaInsightsData.comments || item.comments_count || 0;
      const shares = mediaInsightsData.shares || 0;
      const saved = mediaInsightsData.saved || 0;

      mediaRows.push({
        project_id,
        ig_media_id: item.id,
        media_type: item.media_type || 'IMAGE',
        caption: item.caption || null,
        media_url: item.media_url || null,
        thumbnail_url: item.thumbnail_url || null,
        permalink: item.permalink || null,
        timestamp: item.timestamp || null,
        like_count: likes,
        comments_count: comments,
        reach: mediaInsightsData.reach || 0,
        views: mediaInsightsData.views || 0,
        shares,
        saved,
        total_interactions: mediaInsightsData.total_interactions || (likes + comments + shares + saved),
        plays: mediaInsightsData.plays || 0,
        avg_watch_time: mediaInsightsData.ig_reels_avg_watch_time || 0,
        synced_at: new Date().toISOString(),
      });
    }

    if (mediaRows.length > 0) {
      const { error: mediaErr } = await supabase.from('instagram_media').upsert(mediaRows, { onConflict: 'project_id,ig_media_id' });
      if (mediaErr) console.error('Error upserting media:', mediaErr);
    }

    console.log(`Sync complete: ${mediaRows.length} media (${insightsOk} ok, ${insightsFail} failed), ${insightRows.length} daily insights`);

    return new Response(JSON.stringify({
      success: true,
      account: accountData.username,
      media_count: mediaRows.length,
      insights_days: insightRows.length,
      media_insights_ok: insightsOk,
      media_insights_failed: insightsFail,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Instagram sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
