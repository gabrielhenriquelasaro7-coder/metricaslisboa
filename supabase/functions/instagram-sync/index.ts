import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const graphUrl = 'https://graph.facebook.com/v21.0';

async function fetchJSON(url: string) {
  const res = await fetch(url);
  return res.json();
}

async function fetchSingleMetric(igUserId: string, metric: string, period: string, token: string, extraParams = '') {
  const url = `${graphUrl}/${igUserId}/insights?metric=${metric}&period=${period}${extraParams}&access_token=${token}`;
  const data = await fetchJSON(url);
  if (data.error) {
    console.warn(`Metric ${metric} failed: ${data.error.message}`);
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
    const pageData = await fetchJSON(`${graphUrl}/${pageId}?fields=instagram_business_account&access_token=${metaToken}`);
    if (pageData.error) throw new Error(`Erro ao consultar página Facebook (ID: ${pageId}): ${pageData.error.message}`);
    if (!pageData.instagram_business_account?.id) throw new Error(`Nenhuma conta Instagram Business vinculada à página ${pageId}.`);

    const igUserId = pageData.instagram_business_account.id;

    // Step 2: Get account info
    const accountData = await fetchJSON(
      `${graphUrl}/${igUserId}?fields=biography,followers_count,follows_count,media_count,name,profile_picture_url,username,website&access_token=${metaToken}`
    );
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
    // Meta API v21+ requires metric_type=total_value for most metrics
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinceUnix = Math.floor(since.getTime() / 1000);
    const untilUnix = Math.floor(now.getTime() / 1000);
    const timeParams = `&since=${sinceUnix}&until=${untilUnix}`;

    const dailyInsights: Record<string, any> = {};

    // Helper to parse daily values from API response
    const parseDailyValues = (result: any[], target: Record<string, any>) => {
      for (const m of result) {
        if (m.values && m.values.length > 0) {
          for (const val of m.values) {
            const date = val.end_time?.split('T')[0];
            if (!date) continue;
            if (!target[date]) target[date] = {};
            if (m.name === 'follows_and_unfollows') {
              if (typeof val.value === 'object' && val.value !== null) {
                target[date].follows = val.value.follows || 0;
                target[date].unfollows = val.value.unfollows || 0;
              } else {
                // Sometimes returns number directly
                target[date].follows = val.value || 0;
              }
            } else {
              target[date][m.name] = val.value || 0;
            }
          }
        } else if (m.total_value !== undefined) {
          // If only total_value returned, put it on today's date so it's not lost
          const today = new Date().toISOString().split('T')[0];
          if (!target[today]) target[today] = {};
          if (m.name === 'follows_and_unfollows') {
            if (typeof m.total_value === 'object' && m.total_value !== null) {
              target[today].follows = (target[today].follows || 0) + (m.total_value.follows || 0);
              target[today].unfollows = (target[today].unfollows || 0) + (m.total_value.unfollows || 0);
            }
          } else {
            target[today][m.name] = (target[today][m.name] || 0) + (typeof m.total_value === 'number' ? m.total_value : (m.total_value?.value || 0));
          }
          console.log(`Metric ${m.name} returned total_value only: ${JSON.stringify(m.total_value)}, assigned to ${today}`);
        }
      }
    };

    // Metrics that ONLY support time_series
    const timeSeriesOnly = ['reach'];
    // Metrics that ONLY support total_value
    const totalValueOnly = [
      'views', 'follows_and_unfollows',
      'profile_views', 'website_clicks', 'accounts_engaged',
      'likes', 'comments', 'shares', 'saves', 'total_interactions',
    ];

    // Fetch time_series metrics
    for (const metric of timeSeriesOnly) {
      try {
        const result = await fetchSingleMetric(igUserId, metric, 'day', metaToken, `${timeParams}&metric_type=time_series`);
        if (result) parseDailyValues(result, dailyInsights);
      } catch (e) {
        console.warn(`time_series metric ${metric} error:`, e);
      }
    }

    // Fetch total_value metrics
    for (const metric of totalValueOnly) {
      try {
        const result = await fetchSingleMetric(igUserId, metric, 'day', metaToken, `${timeParams}&metric_type=total_value`);
        if (result) {
          parseDailyValues(result, dailyInsights);
          console.log(`Metric ${metric} fetched OK, data entries: ${result.length}`);
        } else {
          console.warn(`Metric ${metric} returned null from total_value`);
        }
      } catch (e) {
        console.warn(`total_value metric ${metric} error:`, e);
      }
    }

    // Also try follower_count with period=day (legacy metric, no metric_type needed)
    try {
      const fcResult = await fetchSingleMetric(igUserId, 'follower_count', 'day', metaToken, timeParams);
      if (fcResult) parseDailyValues(fcResult, dailyInsights);
    } catch (_) {}

    console.log(`Daily insights parsed: ${Object.keys(dailyInsights).length} days`);

    // Step 4: Demographics (lifetime)
    const demographics: any = {
      follower_demographics: {},
      engaged_audience_demographics: {},
      reached_audience_demographics: {},
    };

    const demoMetrics = [
      { metric: 'follower_demographics', key: 'follower_demographics' },
      { metric: 'engaged_audience_demographics', key: 'engaged_audience_demographics' },
      { metric: 'reached_audience_demographics', key: 'reached_audience_demographics' },
    ];

    for (const dm of demoMetrics) {
      for (const breakdown of ['age', 'gender', 'city', 'country']) {
        try {
          const url = `${graphUrl}/${igUserId}/insights?metric=${dm.metric}&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${metaToken}`;
          const demoData = await fetchJSON(url);
          if (demoData.data && demoData.data[0]?.total_value?.breakdowns?.[0]?.results) {
            const results = demoData.data[0].total_value.breakdowns[0].results;
            const parsed: Record<string, number> = {};
            for (const r of results) {
              const key = r.dimension_values?.join(', ') || 'unknown';
              parsed[key] = r.value || 0;
            }
            demographics[dm.key][breakdown] = parsed;
          }
        } catch (e) {
          console.warn(`${dm.metric}/${breakdown} failed:`, e);
        }
      }
    }

    console.log('Demographics loaded:', JSON.stringify({
      follower: Object.keys(demographics.follower_demographics),
      engaged: Object.keys(demographics.engaged_audience_demographics),
      reached: Object.keys(demographics.reached_audience_demographics),
    }));

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
      engaged_demographics: Object.keys(demographics.engaged_audience_demographics).length > 0 ? demographics.engaged_audience_demographics : null,
      reached_demographics: Object.keys(demographics.reached_audience_demographics).length > 0 ? demographics.reached_audience_demographics : null,
      follower_demographics: Object.keys(demographics.follower_demographics).length > 0 ? demographics.follower_demographics : null,
      synced_at: new Date().toISOString(),
    }));

    if (insightRows.length > 0) {
      const { error: insErr } = await supabase.from('instagram_insights_daily').upsert(insightRows, { onConflict: 'project_id,date' });
      if (insErr) console.error('Error upserting daily insights:', insErr);
      else console.log(`Upserted ${insightRows.length} daily insight rows`);
    }

    // Step 5: Get media (last 50)
    const mediaRes = await fetchJSON(
      `${graphUrl}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count,children{id,media_type,media_url,thumbnail_url}&limit=50&access_token=${metaToken}`
    );
    const mediaItems = mediaRes.data || [];

    // Step 6: Per-media insights
    let insightsOk = 0;
    let insightsFail = 0;
    const mediaRows = [];

    for (const item of mediaItems) {
      let mediaInsightsData: any = {};
      const isReel = item.media_type === 'REELS' || item.media_type === 'VIDEO';
      const baseMetrics = ['reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'];
      const reelMetrics = isReel ? ['ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'plays'] : [];
      const allMetrics = [...baseMetrics, ...reelMetrics];

      try {
        const miData = await fetchJSON(`${graphUrl}/${item.id}/insights?metric=${allMetrics.join(',')}&access_token=${metaToken}`);

        if (miData.error) {
          const fallbackData = await fetchJSON(`${graphUrl}/${item.id}/insights?metric=reach,likes,comments,shares,saved&access_token=${metaToken}`);
          if (fallbackData.data) {
            insightsOk++;
            for (const m of fallbackData.data) {
              mediaInsightsData[m.name] = m.values?.[0]?.value || 0;
            }
          } else {
            insightsFail++;
            mediaInsightsData = { likes: item.like_count || 0, comments: item.comments_count || 0 };
          }
        } else if (miData.data) {
          insightsOk++;
          for (const m of miData.data) {
            mediaInsightsData[m.name] = m.values?.[0]?.value || 0;
          }
        }
      } catch (e) {
        insightsFail++;
        mediaInsightsData = { likes: item.like_count || 0, comments: item.comments_count || 0 };
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

    // Step 7: Fetch Stories
    let storiesCount = 0;
    try {
      const storiesRes = await fetchJSON(
        `${graphUrl}/${igUserId}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp&access_token=${metaToken}`
      );
      const storyItems = storiesRes.data || [];
      const storyRows = [];

      for (const story of storyItems) {
        let storyInsights: any = {};
        try {
          const siData = await fetchJSON(`${graphUrl}/${story.id}/insights?metric=reach,impressions,replies,taps_forward,taps_back,exits&access_token=${metaToken}`);
          if (siData.data) {
            for (const m of siData.data) {
              storyInsights[m.name] = m.values?.[0]?.value || 0;
            }
          }
        } catch (_) {}

        storyRows.push({
          project_id,
          ig_story_id: story.id,
          media_type: story.media_type || 'IMAGE',
          media_url: story.media_url || null,
          thumbnail_url: story.thumbnail_url || null,
          timestamp: story.timestamp || null,
          reach: storyInsights.reach || 0,
          impressions: storyInsights.impressions || 0,
          replies: storyInsights.replies || 0,
          taps_forward: storyInsights.taps_forward || 0,
          taps_back: storyInsights.taps_back || 0,
          exits: storyInsights.exits || 0,
          synced_at: new Date().toISOString(),
        });
      }

      if (storyRows.length > 0) {
        await supabase.from('instagram_stories').upsert(storyRows, { onConflict: 'project_id,ig_story_id' });
        storiesCount = storyRows.length;
      }
    } catch (e) {
      console.warn('Stories sync failed:', e);
    }

    console.log(`Sync complete: ${mediaRows.length} media, ${insightRows.length} daily insights, ${storiesCount} stories`);

    return new Response(JSON.stringify({
      success: true,
      account: accountData.username,
      media_count: mediaRows.length,
      insights_days: insightRows.length,
      media_insights_ok: insightsOk,
      media_insights_failed: insightsFail,
      stories_count: storiesCount,
      demographics_loaded: Object.keys(demographics.follower_demographics).length > 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Instagram sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
