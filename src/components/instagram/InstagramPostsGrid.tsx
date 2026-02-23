import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Bookmark, Share2, Calendar, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import type { InstagramMedia } from '@/hooks/useInstagramData';

interface Props {
  media: InstagramMedia[];
  onSelect: (item: InstagramMedia) => void;
}

type SortKey = 'recent' | 'reach' | 'likes' | 'comments' | 'saved' | 'shares';
const PAGE_SIZE = 9;

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export default function InstagramPostsGrid({ media, onSelect }: Props) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [page, setPage] = useState(0);

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

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filter changes
  const handleFilterChange = (v: string) => { setFilter(v); setPage(0); };
  const handleSortChange = (v: string) => { setSort(v as SortKey); setPage(0); };

  const formatDate = (ts: string | null) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
        <CardTitle className="text-base">Publicações ({filtered.length})</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={filter} onValueChange={handleFilterChange}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3 h-7">Todos</TabsTrigger>
              <TabsTrigger value="feed" className="text-xs px-3 h-7">Feed</TabsTrigger>
              <TabsTrigger value="reels" className="text-xs px-3 h-7">Reels</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={sort} onValueChange={handleSortChange}>
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
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {paged.map((item) => {
            const isReel = item.media_type === 'REELS' || item.media_type === 'VIDEO';
            const img = isReel ? (item.thumbnail_url || item.media_url) : (item.media_url || item.thumbnail_url);
            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden border border-border bg-card hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => onSelect(item)}
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-secondary">
                  {img ? (
                    <img
                      src={img}
                      alt={item.caption?.substring(0, 50) || 'Post'}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
                  )}
                  {isReel && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Play className="h-3 w-3" /> REEL
                    </div>
                  )}
                  {/* Date badge */}
                  {item.timestamp && (
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {formatDate(item.timestamp)}
                    </div>
                  )}
                  {/* Hover overlay with metrics */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                    <span className="flex items-center gap-1 text-sm font-bold"><Heart className="h-4 w-4" />{fmt(item.like_count)}</span>
                    <span className="flex items-center gap-1 text-sm font-bold"><MessageCircle className="h-4 w-4" />{fmt(item.comments_count)}</span>
                    <span className="flex items-center gap-1 text-sm font-bold"><Eye className="h-4 w-4" />{fmt(item.reach)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {sorted.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma publicação encontrada.</p>}
      </CardContent>
    </Card>
  );
}
