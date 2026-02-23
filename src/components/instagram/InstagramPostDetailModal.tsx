import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, Bookmark, Eye, Play, Clock, ExternalLink, BarChart3, Image as ImageIcon, Send, Volume2, VolumeX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  const [muted, setMuted] = useState(true);

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1100px] h-[90vh] max-h-[800px] p-0 gap-0 overflow-hidden border-none bg-card">
        <div className="flex h-full">
          {/* Left: Media */}
          <div className="w-[55%] bg-black flex items-center justify-center relative shrink-0">
            {isReel && item.media_url ? (
              <>
                <video
                  src={item.media_url}
                  poster={item.thumbnail_url || undefined}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => setMuted(!muted)}
                  className="absolute bottom-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <Badge className="absolute top-4 left-4 bg-black/60 text-white border-none gap-1">
                  <Play className="h-3 w-3" /> Reels
                </Badge>
              </>
            ) : item.thumbnail_url || item.media_url ? (
              <img
                src={item.media_url || item.thumbnail_url || ''}
                alt="Post"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  // Try thumbnail as fallback
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
          <div className="w-[45%] flex flex-col h-full overflow-hidden">
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
                <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Caption */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
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

              {item.comments_count > 0 && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    {item.comments_count} comentário{item.comments_count !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Os comentários são visíveis diretamente no Instagram.
                  </p>
                </div>
              )}
            </div>

            {/* Interaction buttons */}
            <div className="border-t border-border shrink-0">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-red-500">
                    <Heart className="h-6 w-6" />
                    <span className="text-sm font-semibold">{fmt(item.like_count)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-6 w-6" />
                    <span className="text-sm font-semibold">{fmt(item.comments_count)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Send className="h-6 w-6" />
                    <span className="text-sm font-semibold">{fmt(item.shares)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Bookmark className="h-6 w-6" />
                  <span className="text-sm font-semibold">{fmt(item.saved)}</span>
                </div>
              </div>

              {/* Detailed metrics */}
              <div className="px-4 pb-3 grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-secondary/40">
                  <Eye className="h-3.5 w-3.5 text-purple-500 mx-auto mb-1" />
                  <p className="text-sm font-bold">{fmt(item.reach)}</p>
                  <p className="text-[9px] text-muted-foreground">Alcance</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-secondary/40">
                  <Eye className="h-3.5 w-3.5 text-cyan-500 mx-auto mb-1" />
                  <p className="text-sm font-bold">{fmt(item.views)}</p>
                  <p className="text-[9px] text-muted-foreground">Visualizações</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-secondary/40">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-500 mx-auto mb-1" />
                  <p className="text-sm font-bold">{engRate}%</p>
                  <p className="text-[9px] text-muted-foreground">Engajamento</p>
                </div>
                {isReel && (
                  <>
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <Play className="h-3.5 w-3.5 text-green-500 mx-auto mb-1" />
                      <p className="text-sm font-bold">{fmt(item.plays)}</p>
                      <p className="text-[9px] text-muted-foreground">Plays</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <Clock className="h-3.5 w-3.5 text-blue-500 mx-auto mb-1" />
                      <p className="text-sm font-bold">{(item.avg_watch_time || 0).toFixed(1)}s</p>
                      <p className="text-[9px] text-muted-foreground">Tempo Médio</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <Share2 className="h-3.5 w-3.5 text-pink-500 mx-auto mb-1" />
                      <p className="text-sm font-bold">{fmt(item.total_interactions)}</p>
                      <p className="text-[9px] text-muted-foreground">Interações</p>
                    </div>
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
