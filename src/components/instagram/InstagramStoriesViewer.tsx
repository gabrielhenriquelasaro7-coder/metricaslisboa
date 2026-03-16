import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Eye, MessageCircle, ArrowRight, ArrowLeft, LogOut, Play, Pause, ImageOff } from 'lucide-react';
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

interface Props {
  open: boolean;
  onClose: () => void;
  profilePic?: string | null;
  username?: string | null;
}

export default function InstagramStoriesViewer({ open, onClose, profilePic, username }: Props) {
  const projectId = localStorage.getItem('selectedProjectId');
  const [stories, setStories] = useState<Story[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [mediaError, setMediaError] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    setMediaError({});
    supabase.from('instagram_stories')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: true })
      .then(({ data }) => {
        setStories((data as any[]) || []);
        setCurrent(0);
        setLoading(false);
      });
  }, [open, projectId]);

  const goNext = useCallback(() => {
    setCurrent(prev => {
      if (prev >= stories.length - 1) {
        onClose();
        return 0;
      }
      return prev + 1;
    });
  }, [stories.length, onClose]);

  const goPrev = useCallback(() => {
    setCurrent(prev => Math.max(0, prev - 1));
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (!open || stories.length === 0 || paused) return;
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [open, stories.length, paused, goNext]);

  // Reset media error when story changes
  useEffect(() => {
    setMediaError({});
  }, [current]);

  if (!open) return null;

  const story = stories[current];
  const isVideo = story?.media_type === 'VIDEO';
  const storyId = story?.id || '';
  const hasMediaError = mediaError[storyId];
  const mediaUrl = isVideo ? story?.media_url : (story?.media_url || story?.thumbnail_url);
  const hasMedia = !!mediaUrl && !hasMediaError;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[420px] w-full h-[85vh] max-h-[750px] p-0 gap-0 overflow-hidden border-none bg-black rounded-2xl">
        {loading || stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white gap-3">
            <p className="text-sm">{loading ? 'Carregando stories...' : 'Nenhum story ativo'}</p>
            <p className="text-xs text-white/50">Stories ficam disponíveis por 24h na API.</p>
          </div>
        ) : story && (
          <div className="relative h-full flex flex-col">
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
              {stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className={`h-full bg-white rounded-full transition-all ${
                      i < current ? 'w-full' : i === current ? 'w-0 animate-story-progress' : 'w-0'
                    }`}
                    style={i === current && !paused ? { animation: 'story-progress 5s linear forwards' } : i < current ? {} : {}}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-3 pt-2">
              <div className="flex items-center gap-2">
                {profilePic && (
                  <img src={profilePic} alt="" className="w-8 h-8 rounded-full border-2 border-white/50" />
                )}
                <div>
                  <p className="text-white text-xs font-semibold">{username || 'Instagram'}</p>
                  {story.timestamp && (
                    <p className="text-white/60 text-[10px]">
                      {new Date(story.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setPaused(!paused)}>
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Media */}
            <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
              {!hasMedia ? (
                <div className="flex flex-col items-center gap-3 text-white/60">
                  <ImageOff className="h-12 w-12" />
                  <p className="text-sm">Mídia indisponível</p>
                  <p className="text-xs text-white/40">A URL do story expirou (stories duram 24h)</p>
                </div>
              ) : isVideo ? (
                <video
                  key={story.id}
                  src={story.media_url!}
                  poster={story.thumbnail_url || undefined}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                  onError={() => setMediaError(prev => ({ ...prev, [storyId]: true }))}
                />
              ) : (
                <img
                  src={mediaUrl!}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={() => setMediaError(prev => ({ ...prev, [storyId]: true }))}
                />
              )}
            </div>

            {/* Navigation areas */}
            <div className="absolute inset-0 z-10 flex">
              <div className="w-1/3 cursor-pointer" onClick={goPrev} />
              <div className="w-1/3" />
              <div className="w-1/3 cursor-pointer" onClick={goNext} />
            </div>

            {/* Bottom metrics */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <Eye className="h-4 w-4 text-white/80" />
                  <span className="text-white text-sm font-bold">{fmt(story.reach)}</span>
                  <span className="text-white/50 text-[9px]">Alcance</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Eye className="h-4 w-4 text-white/80" />
                  <span className="text-white text-sm font-bold">{fmt(story.impressions)}</span>
                  <span className="text-white/50 text-[9px]">Impressões</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <MessageCircle className="h-4 w-4 text-white/80" />
                  <span className="text-white text-sm font-bold">{fmt(story.replies)}</span>
                  <span className="text-white/50 text-[9px]">Respostas</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mt-2">
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                  <span className="text-white/80 text-xs">{fmt(story.taps_forward)}</span>
                  <span className="text-white/40 text-[8px]">Avançar</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowLeft className="h-3.5 w-3.5 text-white/60" />
                  <span className="text-white/80 text-xs">{fmt(story.taps_back)}</span>
                  <span className="text-white/40 text-[8px]">Voltar</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <LogOut className="h-3.5 w-3.5 text-white/60" />
                  <span className="text-white/80 text-xs">{fmt(story.exits)}</span>
                  <span className="text-white/40 text-[8px]">Saídas</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
