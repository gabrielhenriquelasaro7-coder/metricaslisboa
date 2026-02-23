import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, MessageCircle, Eye, Bookmark, Share2, Calendar, ExternalLink } from 'lucide-react';
import type { InstagramMedia } from '@/hooks/useInstagramData';

interface Props {
  media: InstagramMedia[];
  onSelect: (item: InstagramMedia) => void;
}

type SortKey = 'recent' | 'reach' | 'likes' | 'comments' | 'saved' | 'shares';

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export default function InstagramPostsGrid({ media, onSelect }: Props) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = media.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'feed') return m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM';
    if (filter === 'reels') return m.media_type === 'REELS' || m.media_type === 'VIDEO';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'recent') return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
    if (sort === 'reach') return (b.reach || 0) - (a.reach || 0);
    if (sort === 'likes') return (b.like_count || 0) - (a.like_count || 0);
    if (sort === 'comments') return (b.comments_count || 0) - (a.comments_count || 0);
    if (sort === 'saved') return (b.saved || 0) - (a.saved || 0);
    if (sort === 'shares') return (b.shares || 0) - (a.shares || 0);
    return 0;
  });

  const formatDate = (ts: string | null) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
        <CardTitle className="text-base">Posts ({filtered.length})</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3 h-7">Todos</TabsTrigger>
              <TabsTrigger value="feed" className="text-xs px-3 h-7">Feed</TabsTrigger>
              <TabsTrigger value="reels" className="text-xs px-3 h-7">Reels</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="reach">Mais alcance</SelectItem>
              <SelectItem value="likes">Mais curtidas</SelectItem>
              <SelectItem value="comments">Mais comentários</SelectItem>
              <SelectItem value="saved">Mais salvos</SelectItem>
              <SelectItem value="shares">Mais compartilhados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Grid View */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
          {sorted.map((item) => {
            const img = item.thumbnail_url || item.media_url;
            return (
              <div key={item.id} className="rounded-xl overflow-hidden border border-border bg-card hover:border-primary/40 transition-all cursor-pointer group" onClick={() => onSelect(item)}>
                {/* Image */}
                <div className="relative aspect-square overflow-hidden">
                  {img ? (
                    <img src={img} alt={item.caption?.substring(0, 50) || 'Post'} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary text-muted-foreground text-xs">Sem imagem</div>
                  )}
                  {(item.media_type === 'REELS' || item.media_type === 'VIDEO') && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">REEL</div>
                  )}
                </div>

                {/* Date */}
                {item.timestamp && (
                  <div className="px-3 pt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(item.timestamp)}
                  </div>
                )}

                {/* Caption preview */}
                {item.caption && (
                  <p className="px-3 pt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.caption}</p>
                )}

                {/* Metrics row */}
                <div className="px-3 py-2.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-purple-500" />{fmt(item.reach)}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-red-500" />{fmt(item.like_count)}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-orange-500" />{fmt(item.comments_count)}</span>
                  <span className="flex items-center gap-1"><Bookmark className="h-3 w-3 text-yellow-500" />{fmt(item.saved)}</span>
                  <span className="flex items-center gap-1"><Share2 className="h-3 w-3 text-pink-500" />{fmt(item.shares)}</span>
                </div>

                {/* Action buttons */}
                <div className="px-3 pb-3 flex gap-2">
                  <button className="flex-1 text-xs py-1.5 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors" onClick={(e) => { e.stopPropagation(); onSelect(item); }}>
                    Ver Detalhes
                  </button>
                  {item.permalink && (
                    <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs py-1.5 px-3 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {sorted.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma publicação encontrada. Sincronize os dados primeiro.</p>}
      </CardContent>
    </Card>
  );
}
