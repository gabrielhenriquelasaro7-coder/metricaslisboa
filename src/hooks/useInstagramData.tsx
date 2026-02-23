import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InstagramAccount {
  id: string;
  project_id: string;
  ig_user_id: string;
  username: string | null;
  name: string | null;
  biography: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  follows_count: number;
  media_count: number;
  website: string | null;
  last_sync_at: string | null;
}

export interface InstagramMedia {
  id: string;
  project_id: string;
  ig_media_id: string;
  media_type: string;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  like_count: number;
  comments_count: number;
  reach: number;
  views: number;
  shares: number;
  saved: number;
  total_interactions: number;
  plays: number;
  avg_watch_time: number;
}

export interface InstagramInsightsDaily {
  id: string;
  project_id: string;
  date: string;
  reach: number;
  views: number;
  accounts_engaged: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follows: number;
  unfollows: number;
  profile_views: number;
  website_clicks: number;
  total_interactions: number;
  engaged_demographics: any;
  reached_demographics: any;
  follower_demographics: any;
}

export function useInstagramData() {
  const projectId = localStorage.getItem('selectedProjectId');
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [insights, setInsights] = useState<InstagramInsightsDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [accRes, mediaRes, insRes] = await Promise.all([
        supabase.from('instagram_accounts').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('instagram_media').select('*').eq('project_id', projectId).order('timestamp', { ascending: false }).limit(100),
        supabase.from('instagram_insights_daily').select('*').eq('project_id', projectId).order('date', { ascending: false }).limit(30),
      ]);
      setAccount((accRes.data as any) || null);
      setMedia((mediaRes.data as any[]) || []);
      setInsights((insRes.data as any[]) || []);
    } catch (e) {
      console.error('Error fetching Instagram data:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const syncInstagram = useCallback(async () => {
    if (!projectId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-sync', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Instagram sincronizado com sucesso!', {
        description: `${data.media_count} mídias e ${data.insights_days} dias de insights atualizados.`,
      });
      await fetchData();
    } catch (e: any) {
      const msg = e.message || 'Erro desconhecido';
      if (msg.includes('facebook_page_id')) {
        toast.error('Facebook Page ID não configurado', {
          description: 'Vá em Editar Projeto e preencha o ID da Página Facebook (asset_id da URL do Business Manager).',
        });
      } else if (msg.includes('instagram_business_account') || msg.includes('nonexisting field')) {
        toast.error('Conta Instagram não vinculada', {
          description: 'Verifique se a página Facebook tem uma conta Instagram Business/Profissional conectada.',
        });
      } else if (msg.includes('Edge Function')) {
        toast.error('Erro na sincronização do Instagram', {
          description: 'Verifique se o Facebook Page ID está correto. Use o asset_id da URL, não o business_id.',
        });
      } else {
        toast.error('Erro ao sincronizar Instagram', { description: msg });
      }
    } finally {
      setSyncing(false);
    }
  }, [projectId, fetchData]);

  // Computed metrics
  const totalReach = insights.reduce((s, i) => s + (i.reach || 0), 0);
  const totalLikes = insights.reduce((s, i) => s + (i.likes || 0), 0);
  const totalComments = insights.reduce((s, i) => s + (i.comments || 0), 0);
  const totalShares = insights.reduce((s, i) => s + (i.shares || 0), 0);
  const totalSaves = insights.reduce((s, i) => s + (i.saves || 0), 0);
  const totalViews = insights.reduce((s, i) => s + (i.views || 0), 0);
  const totalInteractions = insights.reduce((s, i) => s + (i.total_interactions || 0), 0);
  const newFollows = insights.reduce((s, i) => s + (i.follows || 0), 0);
  const engagementRate = totalReach > 0 ? ((totalInteractions / totalReach) * 100) : 0;

  return {
    account, media, insights, loading, syncing,
    syncInstagram, fetchData,
    metrics: {
      totalReach, totalLikes, totalComments, totalShares, totalSaves,
      totalViews, totalInteractions, newFollows, engagementRate,
    },
  };
}
