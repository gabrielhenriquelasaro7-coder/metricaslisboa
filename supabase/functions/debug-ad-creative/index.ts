import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ad_id } = await req.json();
    
    if (!ad_id) {
      return new Response(JSON.stringify({ error: 'ad_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = Deno.env.get('META_ACCESS_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar o anúncio com TODOS os campos possíveis de creative
    const adFields = 'id,name,status,creative{id,name,body,title,call_to_action_type,object_story_spec,asset_feed_spec,thumbnail_url,image_url,image_hash}';
    const adUrl = `https://graph.facebook.com/v22.0/${ad_id}?fields=${adFields}&access_token=${token}`;
    
    console.log(`[DEBUG] Fetching ad ${ad_id}...`);
    
    const adRes = await fetch(adUrl);
    const adData = await adRes.json();
    
    if (adData.error) {
      return new Response(JSON.stringify({ 
        error: 'Meta API Error',
        details: adData.error 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair textos de todas as fontes possíveis
    const creative = adData.creative || {};
    const oss = creative.object_story_spec || {};
    const afs = creative.asset_feed_spec || {};
    
    const extractedTexts = {
      // Campos diretos do creative
      body: creative.body || null,
      title: creative.title || null,
      call_to_action_type: creative.call_to_action_type || null,
      
      // asset_feed_spec (anúncios dinâmicos)
      afs_bodies: afs.bodies?.map((b: any) => b.text) || [],
      afs_titles: afs.titles?.map((t: any) => t.text) || [],
      afs_descriptions: afs.descriptions?.map((d: any) => d.text) || [],
      afs_ctas: afs.call_to_action_types || [],
      
      // link_data
      link_message: oss.link_data?.message || null,
      link_name: oss.link_data?.name || null,
      link_description: oss.link_data?.description || null,
      link_cta: oss.link_data?.call_to_action?.type || null,
      
      // video_data
      video_message: oss.video_data?.message || null,
      video_title: oss.video_data?.title || null,
      video_cta: oss.video_data?.call_to_action?.type || null,
      
      // photo_data
      photo_message: oss.photo_data?.message || null,
      photo_caption: oss.photo_data?.caption || null,
    };

    // Determinar qual texto final seria extraído
    let finalPrimaryText = null;
    let finalHeadline = null;
    let finalCta = null;

    // Prioridade asset_feed_spec
    if (afs.bodies?.length > 0) finalPrimaryText = afs.bodies[0].text;
    if (afs.titles?.length > 0) finalHeadline = afs.titles[0].text;
    if (afs.call_to_action_types?.length > 0) finalCta = afs.call_to_action_types[0];

    // Fallback link_data
    if (!finalPrimaryText && oss.link_data?.message) finalPrimaryText = oss.link_data.message;
    if (!finalHeadline && oss.link_data?.name) finalHeadline = oss.link_data.name;
    if (!finalCta && oss.link_data?.call_to_action?.type) finalCta = oss.link_data.call_to_action.type;

    // Fallback video_data
    if (!finalPrimaryText && oss.video_data?.message) finalPrimaryText = oss.video_data.message;
    if (!finalHeadline && oss.video_data?.title) finalHeadline = oss.video_data.title;
    if (!finalCta && oss.video_data?.call_to_action?.type) finalCta = oss.video_data.call_to_action.type;

    // Fallback photo_data
    if (!finalPrimaryText && oss.photo_data?.message) finalPrimaryText = oss.photo_data.message;
    if (!finalPrimaryText && oss.photo_data?.caption) finalPrimaryText = oss.photo_data.caption;

    // Campos diretos
    if (!finalPrimaryText && creative.body) finalPrimaryText = creative.body;
    if (!finalHeadline && creative.title) finalHeadline = creative.title;
    if (!finalCta && creative.call_to_action_type) finalCta = creative.call_to_action_type;

    return new Response(JSON.stringify({
      ad_id: adData.id,
      ad_name: adData.name,
      ad_status: adData.status,
      creative_id: creative.id,
      creative_name: creative.name,
      raw_creative: creative,
      extracted_texts: extractedTexts,
      final_result: {
        primary_text: finalPrimaryText,
        headline: finalHeadline,
        cta: finalCta
      }
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
