import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Heart, MessageCircle, Share2, Bookmark, Eye, Play, Pause, Clock, ExternalLink, BarChart3, Image as ImageIcon, Send, Volume2, VolumeX, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { InstagramMedia } from '@/hooks/useInstagramData';

interface Props {
  item: InstagramMedia | null;
  open: boolean;
  onClose: () => void;
  profilePic?: string | null;
  username?: string | null;
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
};

export default function InstagramPostDetailModal({ item, open, onClose, profilePic, username }: Props) {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!item) return null;
  const isReel = item.media_type === 'REELS' || item.media_type === 'VIDEO';
  const totalEngagement = (item.like_count || 0) + (item.comments_count || 0) + (item.shares || 0) + (item.saved || 0);
  const engRate = item.reach > 0 ? (totalEngagement / item.reach * 100).toFixed(2) : '0.00';

  const formattedDate = item.timestamp
    ? new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const timeAgo = item.timestamp
    ? (() => {
        const diff = Date.now() - new Date(item.timestamp).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 30) return `${Math.floor(days / 30)} meses atrás`;
        if (days > 0) return `${days} dias atrás`;
        return 'Hoje';
      })()
    : '';

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1100px] h-[90vh] max-h-[800px] p-0 gap-0 overflow-hidden border-none bg-card [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:top-3 [&>button]:right-3 [&>button]:z-30 !grid-rows-[1fr]">
        <div className="flex h-full min-h-0 overflow-hidden">
          {/* Left: Media */}
          <div className="w-[55%] bg-black flex items-center justify-center relative shrink-0">
            {isReel && item.media_url ? (
              <>
                <video
                  ref={videoRef}
                  src={item.media_url}
                  poster={item.thumbnail_url || undefined}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  className="max-w-full max-h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                />
                {!playing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={togglePlay}>
                    <Play className="h-16 w-16 text-white/80" />
                  </div>
                )}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button onClick={togglePlay} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setMuted(!muted)} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>
                <div className="absolute top-4 left-4 bg-black/60 text-white text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Play className="h-3 w-3" /> Reels
                </div>
              </>
            ) : item.thumbnail_url || item.media_url ? (
              <img
                src={item.media_url || item.thumbnail_url || ''}
                alt="Post"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  if (item.thumbnail_url && e.currentTarget.src !== item.thumbnail_url) {
                    e.currentTarget.src = item.thumbnail_url;
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <ImageIcon className="h-16 w-16" />
                <span className="text-sm">Sem mídia</span>
              </div>
            )}
          </div>

          {/* Right: Info panel */}
          <div className="w-[45%] flex flex-col h-full overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profilePic || ''} />
                <AvatarFallback className="text-xs">IG</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{username || 'Instagram'}</p>
                <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
              </div>
              {item.permalink && (
                <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors p-1">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Caption + Comments - scrollable area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {item.caption && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarImage src={profilePic || ''} />
                    <AvatarFallback className="text-xs">IG</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      <span className="font-semibold mr-1.5">{username || 'usuario'}</span>
                      <span className="text-foreground/90">{item.caption}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{formattedDate}</p>
                  </div>
                </div>
              )}

              {/* Comments section */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {item.comments_count} comentário{item.comments_count !== 1 ? 's' : ''}
                  </p>
                </div>
                {item.comments_count > 0 ? (
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      Os comentários são visíveis diretamente no Instagram.
                    </p>
                    {item.permalink && (
                      <a
                        href={item.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver comentários no Instagram
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum comentário nesta publicação.</p>
                )}
              </div>
            </div>

            {/* Interaction buttons */}
            <div className="border-t border-border shrink-0">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-destructive">
                    <Heart className="h-5 w-5" />
                    <span className="text-sm font-semibold">{fmt(item.like_count)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm font-semibold">{fmt(item.comments_count)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Send className="h-5 w-5" />
                    <span className="text-sm font-semibold">{fmt(item.shares)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Bookmark className="h-5 w-5" />
                  <span className="text-sm font-semibold">{fmt(item.saved)}</span>
                </div>
              </div>

              {/* Detailed metrics grid */}
              <div className="px-4 pb-3 grid grid-cols-3 gap-2">
                <MetricBox icon={<Eye className="h-3.5 w-3.5 text-primary" />} value={fmt(item.reach)} label="Alcance" />
                <MetricBox icon={<Users className="h-3.5 w-3.5 text-primary" />} value={fmt(item.views)} label="Visualizações" />
                <MetricBox icon={<BarChart3 className="h-3.5 w-3.5 text-primary" />} value={`${engRate}%`} label="Engajamento" />
                {isReel && (
                  <>
                    <MetricBox icon={<Play className="h-3.5 w-3.5 text-primary" />} value={fmt(item.plays)} label="Plays" />
                    <MetricBox icon={<Clock className="h-3.5 w-3.5 text-primary" />} value={`${(item.avg_watch_time || 0).toFixed(1)}s`} label="Tempo Médio" />
                    <MetricBox icon={<Share2 className="h-3.5 w-3.5 text-primary" />} value={fmt(item.total_interactions)} label="Interações" />
                  </>
                )}
              </div>

              <div className="px-4 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase">{formattedDate}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricBox({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-secondary/40">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
