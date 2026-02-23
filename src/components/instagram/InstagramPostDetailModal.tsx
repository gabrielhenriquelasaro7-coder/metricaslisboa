import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, Bookmark, Eye, Play, Clock, ExternalLink, BarChart3 } from 'lucide-react';
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
  const img = item.media_url || item.thumbnail_url;
  const engRate = item.reach > 0
    ? (((item.like_count || 0) + (item.comments_count || 0) + (item.shares || 0) + (item.saved || 0)) / item.reach * 100).toFixed(2)
    : '0.00';

  const metricItems = [
    { label: 'Alcance', value: fmt(item.reach), icon: Eye, color: 'text-purple-500' },
    { label: 'Visualizações', value: fmt(item.views), icon: BarChart3, color: 'text-cyan-500' },
    { label: 'Curtidas', value: fmt(item.like_count), icon: Heart, color: 'text-red-500' },
    { label: 'Comentários', value: fmt(item.comments_count), icon: MessageCircle, color: 'text-orange-500' },
    { label: 'Compartilhamentos', value: fmt(item.shares), icon: Share2, color: 'text-pink-500' },
    { label: 'Salvos', value: fmt(item.saved), icon: Bookmark, color: 'text-yellow-500' },
    ...(isReel ? [
      { label: 'Reproduções', value: fmt(item.plays), icon: Play, color: 'text-green-500' },
      { label: 'Tempo Médio', value: `${(item.avg_watch_time || 0).toFixed(1)}s`, icon: Clock, color: 'text-blue-500' },
    ] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Detalhes do Post {isReel ? '- Reels' : ''}
            <Badge variant="outline" className="text-xs">{item.media_type}</Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              {engRate}% eng.
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row gap-0 min-h-full">
            {/* Left side: Image + Caption */}
            <div className="lg:w-1/2 flex flex-col border-r border-border">
              {img && (
                <div className="bg-black flex items-center justify-center p-2" style={{ minHeight: '300px', maxHeight: '500px' }}>
                  <img src={img} alt="Post" className="max-w-full max-h-[480px] object-contain rounded" />
                </div>
              )}
              {item.caption && (
                <div className="p-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Legenda</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">{item.caption}</p>
                </div>
              )}
            </div>

            {/* Right side: Metrics */}
            <div className="lg:w-1/2 flex flex-col">
              {/* Metrics grid */}
              <div className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Métricas</p>
                <div className="grid grid-cols-2 gap-2">
                  {metricItems.map((m) => (
                    <div key={m.label} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
                      <m.icon className={`h-5 w-5 ${m.color} shrink-0`} />
                      <div className="min-w-0">
                        <p className="text-base font-bold">{m.value}</p>
                        <p className="text-[11px] text-muted-foreground">{m.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date and link */}
              <div className="mt-auto p-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                </span>
                {item.permalink && (
                  <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Abrir no Instagram
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
