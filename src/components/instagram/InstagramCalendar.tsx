import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Image as ImageIcon, Play } from 'lucide-react';
import type { InstagramMedia } from '@/hooks/useInstagramData';

interface Props {
  media: InstagramMedia[];
  onSelectPost: (item: InstagramMedia) => void;
  onScheduleDate: (date: Date) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function InstagramCalendar({ media, onSelectPost, onScheduleDate }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group media by date
  const mediaByDate = useMemo(() => {
    const map: Record<string, InstagramMedia[]> = {};
    media.forEach((m) => {
      if (!m.timestamp) return;
      const key = m.timestamp.split('T')[0]; // YYYY-MM-DD
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [media]);

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: { day: number | null; dateStr: string }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: '' });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Calendário de Conteúdo</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {MONTHS[month]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[10px] font-medium text-muted-foreground py-1">{w}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (cell.day === null) return <div key={`empty-${i}`} className="aspect-square" />;

            const posts = mediaByDate[cell.dateStr] || [];
            const isToday = cell.dateStr === todayStr;
            const isFuture = new Date(cell.dateStr) > today;

            return (
              <div
                key={cell.dateStr}
                className={`
                  relative aspect-square rounded-lg border transition-all cursor-pointer overflow-hidden group
                  ${isToday ? 'border-primary ring-1 ring-primary/30' : 'border-border/50 hover:border-primary/40'}
                  ${posts.length > 0 ? 'bg-card' : isFuture ? 'bg-secondary/30 hover:bg-secondary/50' : 'bg-card/50'}
                `}
                onClick={() => {
                  if (posts.length === 1) {
                    onSelectPost(posts[0]);
                  } else if (posts.length > 1) {
                    onSelectPost(posts[0]);
                  } else if (isFuture || isToday) {
                    onScheduleDate(new Date(cell.dateStr));
                  }
                }}
              >
                {/* Day number */}
                <span className={`absolute top-1 left-1.5 text-[10px] font-medium z-10 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {cell.day}
                </span>

                {/* Post thumbnail */}
                {posts.length > 0 && (
                  <div className="absolute inset-0">
                    {posts[0].thumbnail_url || posts[0].media_url ? (
                      <img
                        src={posts[0].thumbnail_url || posts[0].media_url || ''}
                        alt=""
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    {/* Overlay with count */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {posts.length > 1 && (
                      <span className="absolute bottom-1 right-1.5 text-[9px] font-bold text-white bg-primary rounded-full px-1.5 py-0.5">
                        +{posts.length}
                      </span>
                    )}
                    {(posts[0].media_type === 'VIDEO' || posts[0].media_type === 'REELS') && (
                      <Play className="absolute bottom-1 left-1.5 h-3 w-3 text-white" />
                    )}
                  </div>
                )}

                {/* Schedule indicator for future empty dates */}
                {posts.length === 0 && (isFuture || isToday) && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="w-3 h-3 rounded bg-primary/20 border border-primary" /> Hoje
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="w-3 h-3 rounded overflow-hidden"><div className="w-full h-full bg-gradient-to-br from-purple-500/50 to-pink-500/50" /></div> Post publicado
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Plus className="h-3 w-3" /> Agendar (futuro)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
