import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, MessageCircle, Eye } from 'lucide-react';
import type { InstagramMedia } from '@/hooks/useInstagramData';

interface Props {
  media: InstagramMedia[];
  onSelect: (item: InstagramMedia) => void;
}

type SortKey = 'recent' | 'reach' | 'likes' | 'comments' | 'saved' | 'shares';

export default function InstagramPostsGrid({ media, onSelect }: Props) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
        <CardTitle className="text-base">Publicações ({filtered.length})</CardTitle>
        <div className="flex items-center gap-3">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sorted.map((item) => {
            const img = item.thumbnail_url || item.media_url;
            return (
              <div
                key={item.id}
                className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-secondary border border-border hover:border-primary/50 transition-all"
                onClick={() => onSelect(item)}
              >
                {img ? (
                  <img src={img} alt={item.caption?.substring(0, 50) || 'Post'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm">
                  <span className="flex items-center gap-1"><Heart className="h-4 w-4" />{item.like_count}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" />{item.comments_count}</span>
                  <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{item.reach}</span>
                </div>
                {(item.media_type === 'REELS' || item.media_type === 'VIDEO') && (
                  <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">Reel</div>
                )}
              </div>
            );
          })}
        </div>
        {sorted.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma publicação encontrada. Sincronize os dados primeiro.</p>}
      </CardContent>
    </Card>
  );
}
