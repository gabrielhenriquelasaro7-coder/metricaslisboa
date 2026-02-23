import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MessageCircle, ArrowRight, ArrowLeft, LogOut, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Story {
  id: string;
  ig_story_id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  timestamp: string | null;
  reach: number;
  impressions: number;
  replies: number;
  taps_forward: number;
  taps_back: number;
  exits: number;
}

const fmt = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export default function InstagramStoriesGrid() {
  const projectId = localStorage.getItem('selectedProjectId');
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    supabase.from('instagram_stories')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setStories((data as any[]) || []);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) return null;
  if (stories.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">Nenhum Story ativo no momento.</p>
          <p className="text-xs mt-1">Stories ficam disponíveis por apenas 24 horas na API do Instagram.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Stories ({stories.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stories.map((story) => {
            const isVideo = story.media_type === 'VIDEO';
            const img = story.thumbnail_url || story.media_url;
            return (
              <div key={story.id} className="shrink-0 w-[140px] rounded-xl overflow-hidden border border-border bg-card group">
                <div className="relative aspect-[9/16] bg-secondary overflow-hidden">
                  {img ? (
                    isVideo ? (
                      <video src={story.media_url || ''} poster={story.thumbnail_url || ''} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Play className="h-6 w-6" />
                    </div>
                  )}
                  {isVideo && (
                    <Play className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow" />
                  )}
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1 text-[9px]">
                    <div className="flex items-center gap-1 text-muted-foreground" title="Alcance">
                      <Eye className="h-3 w-3" /> {fmt(story.reach)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground" title="Impressões">
                      <Eye className="h-3 w-3" /> {fmt(story.impressions)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground" title="Avançar">
                      <ArrowRight className="h-3 w-3" /> {fmt(story.taps_forward)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground" title="Voltar">
                      <ArrowLeft className="h-3 w-3" /> {fmt(story.taps_back)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground" title="Respostas">
                      <MessageCircle className="h-3 w-3" /> {fmt(story.replies)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground" title="Saídas">
                      <LogOut className="h-3 w-3" /> {fmt(story.exits)}
                    </div>
                  </div>
                  {story.timestamp && (
                    <p className="text-[9px] text-muted-foreground/70">
                      {new Date(story.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
