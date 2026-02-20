import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, Bookmark, Eye, Play, Clock, ExternalLink } from 'lucide-react';
import type { InstagramMedia } from '@/hooks/useInstagramData';

interface Props {
  item: InstagramMedia | null;
  open: boolean;
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');

export default function InstagramPostDetailModal({ item, open, onClose }: Props) {
  if (!item) return null;
  const isReel = item.media_type === 'REELS' || item.media_type === 'VIDEO';
  const img = item.media_url || item.thumbnail_url;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Publicação
            <Badge variant="outline" className="text-xs">{item.media_type}</Badge>
          </DialogTitle>
        </DialogHeader>

        {img && (
          <div className="rounded-lg overflow-hidden bg-secondary">
            <img src={img} alt="Post" className="w-full h-auto max-h-[400px] object-contain" />
          </div>
        )}

        {item.caption && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">{item.caption}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Alcance', value: fmt(item.reach), icon: Eye, color: 'text-purple-500' },
            { label: 'Visualizações', value: fmt(item.views), icon: Eye, color: 'text-cyan-500' },
            { label: 'Curtidas', value: fmt(item.like_count), icon: Heart, color: 'text-red-500' },
            { label: 'Comentários', value: fmt(item.comments_count), icon: MessageCircle, color: 'text-orange-500' },
            { label: 'Compartilhamentos', value: fmt(item.shares), icon: Share2, color: 'text-pink-500' },
            { label: 'Salvos', value: fmt(item.saved), icon: Bookmark, color: 'text-yellow-500' },
            ...(isReel ? [
              { label: 'Reproduções', value: fmt(item.plays), icon: Play, color: 'text-green-500' },
              { label: 'Tempo Médio', value: `${(item.avg_watch_time || 0).toFixed(1)}s`, icon: Clock, color: 'text-blue-500' },
            ] : []),
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
              <m.icon className={`h-4 w-4 ${m.color}`} />
              <div>
                <p className="text-sm font-semibold">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</span>
          {item.permalink && (
            <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Ver no Instagram
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
