import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const graphUrl = 'https://graph.facebook.com/v21.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, action, post_id, caption, media_url, media_type, scheduled_at } = await req.json();
    if (!project_id) throw new Error('project_id required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaToken = Deno.env.get('META_ACCESS_TOKEN')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get IG user ID
    const { data: project } = await supabase
      .from('projects')
      .select('facebook_page_id')
      .eq('id', project_id)
      .single();

    if (!project?.facebook_page_id) {
      throw new Error('Projeto sem facebook_page_id configurado');
    }

    const pageRes = await fetch(`${graphUrl}/${project.facebook_page_id}?fields=instagram_business_account&access_token=${metaToken}`);
    const pageData = await pageRes.json();
    if (!pageData.instagram_business_account?.id) {
      throw new Error('Nenhuma conta Instagram Business vinculada');
    }
    const igUserId = pageData.instagram_business_account.id;

    if (action === 'publish_now') {
      // Step 1: Create container
      const isVideo = media_type === 'VIDEO' || media_type === 'REELS';
      const containerParams = new URLSearchParams({
        access_token: metaToken,
        caption: caption || '',
      });

      if (isVideo) {
        containerParams.set('media_type', 'REELS');
        containerParams.set('video_url', media_url);
      } else {
        containerParams.set('image_url', media_url);
      }

      console.log(`Creating container for ${isVideo ? 'video' : 'image'}...`);
      const containerRes = await fetch(`${graphUrl}/${igUserId}/media`, {
        method: 'POST',
        body: containerParams,
      });
      const containerData = await containerRes.json();

      if (containerData.error) {
        throw new Error(`Erro ao criar container: ${containerData.error.message}`);
      }

      const containerId = containerData.id;
      console.log(`Container created: ${containerId}`);

      // Step 2: Wait for container to be ready (for videos)
      if (isVideo) {
        let ready = false;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await fetch(`${graphUrl}/${containerId}?fields=status_code&access_token=${metaToken}`);
          const statusData = await statusRes.json();
          console.log(`Container status: ${statusData.status_code}`);
          if (statusData.status_code === 'FINISHED') { ready = true; break; }
          if (statusData.status_code === 'ERROR') throw new Error('Erro no processamento do vídeo');
        }
        if (!ready) throw new Error('Timeout aguardando processamento do vídeo');
      }

      // Step 3: Publish
      const publishRes = await fetch(`${graphUrl}/${igUserId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({
          access_token: metaToken,
          creation_id: containerId,
        }),
      });
      const publishData = await publishRes.json();

      if (publishData.error) {
        throw new Error(`Erro ao publicar: ${publishData.error.message}`);
      }

      console.log(`Published! Media ID: ${publishData.id}`);

      // Update post record if exists
      if (post_id) {
        await supabase.from('instagram_scheduled_posts').update({
          status: 'published',
          published_at: new Date().toISOString(),
          ig_media_id: publishData.id,
          updated_at: new Date().toISOString(),
        }).eq('id', post_id);
      }

      return new Response(JSON.stringify({
        success: true,
        ig_media_id: publishData.id,
        message: 'Post publicado com sucesso!',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'schedule') {
      // For scheduling, we save to DB and the scheduled-sync or a cron will publish it
      // Meta API doesn't support native scheduling for IG, so we handle it server-side
      return new Response(JSON.stringify({
        success: true,
        message: 'Post agendado com sucesso!',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      throw new Error('Invalid action. Use publish_now or schedule.');
    }
  } catch (error) {
    console.error('Instagram publish error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
