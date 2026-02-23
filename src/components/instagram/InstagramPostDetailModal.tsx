import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, Bookmark, Eye, Play, Clock, ExternalLink, BarChart3, Image as ImageIcon } from 'lucide-react';
import type { InstagramMedia } from '@/hooks/useInstagramData';

interface Props {
  item: InstagramMedia | null;
  open: boolean;
  onClose: () => void;
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
};

export default function InstagramPostDetailModal({ item, open, onClose }: Props) {
  if (!item) return null;
  const isReel = item.media_type === 'REELS' || item.media_type === 'VIDEO';
  // For videos/reels, always prefer thumbnail_url (media_url is a video file that won't render as img)
  const img = isReel ? (item.thumbnail_url || item.media_url) : (item.media_url || item.thumbnail_url);
  const engRate = item.reach > 0
    ? (((item.like_count || 0) + (item.comments_count || 0) + (item.shares || 0) + (item.saved || 0)) / item.reach * 100).toFixed(2)
    : '0.00';

  const metricItems = [
    { label: 'Alcance', value: fmt(item.reach), icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Visualizações', value: fmt(item.views), icon: BarChart3, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { label: 'Curtidas', value: fmt(item.like_count), icon: Heart, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Comentários', value: fmt(item.comments_count), icon: MessageCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Compartilhamentos', value: fmt(item.shares), icon: Share2, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Salvos', value: fmt(item.saved), icon: Bookmark, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    ...(isReel ? [
      { label: 'Reproduções', value: fmt(item.plays), icon: Play, color: 'text-green-500', bg: 'bg-green-500/10' },
      { label: 'Tempo Médio', value: `${(item.avg_watch_time || 0).toFixed(1)}s`, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    ] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Detalhes do Post
            <Badge variant="outline" className="text-xs">{item.media_type}</Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              {engRate}% eng.
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row min-h-0">
            {/* Left: Media + Caption */}
            <div className="lg:w-[55%] flex flex-col border-r border-border">
              {/* Image / Video thumbnail */}
              <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 280 }}>
                {img ? (
                  <img
                    src={img}
                    alt="Post"
                    className="w-full max-h-[60vh] object-contain"
                    onError={(e) => {
                      // If thumbnail also fails, show placeholder
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'flex flex-col items-center justify-center gap-2 text-muted-foreground py-16';
                        placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-sm">Imagem indisponível</span>';
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground py-16">
                    <ImageIcon className="h-12 w-12" />
                    <span className="text-sm">Sem imagem</span>
                  </div>
                )}
                {isReel && (
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                      <Play className="h-3 w-3" /> REEL
                    </Badge>
                  </div>
                )}
              </div>

              {/* Full Caption - no scroll, show everything */}
              {item.caption && (
                <div className="p-5 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legenda</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{item.caption}</p>
                </div>
              )}
            </div>

            {/* Right: Metrics */}
            <div className="lg:w-[45%] flex flex-col">
              <div className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Métricas</p>
                <div className="grid grid-cols-2 gap-3">
                  {metricItems.map((m) => (
                    <div key={m.label} className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/50 hover:bg-secondary/60 transition-colors">
                      <div className={`p-2 rounded-lg ${m.bg}`}>
                        <m.icon className={`h-5 w-5 ${m.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-bold leading-none">{m.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date and link */}
              <div className="mt-auto p-5 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                </span>
                {item.permalink && (
                  <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir no Instagram
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
