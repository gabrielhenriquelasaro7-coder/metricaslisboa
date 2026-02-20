import { Card, CardContent } from '@/components/ui/card';
import { Eye, Heart, MessageCircle, Share2, Bookmark, Users, UserPlus, TrendingUp } from 'lucide-react';

interface Props {
  metrics: {
    totalReach: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    totalViews: number;
    totalInteractions: number;
    newFollows: number;
    engagementRate: number;
  };
  followersCount: number;
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('pt-BR');

export default function InstagramMetricsGrid({ metrics, followersCount }: Props) {
  const items = [
    { label: 'Seguidores', value: fmt(followersCount), icon: Users, color: 'text-blue-500' },
    { label: 'Novos Seguidores', value: fmt(metrics.newFollows), icon: UserPlus, color: 'text-green-500' },
    { label: 'Alcance', value: fmt(metrics.totalReach), icon: Eye, color: 'text-purple-500' },
    { label: 'Visualizações', value: fmt(metrics.totalViews), icon: Eye, color: 'text-cyan-500' },
    { label: 'Curtidas', value: fmt(metrics.totalLikes), icon: Heart, color: 'text-red-500' },
    { label: 'Comentários', value: fmt(metrics.totalComments), icon: MessageCircle, color: 'text-orange-500' },
    { label: 'Salvos', value: fmt(metrics.totalSaves), icon: Bookmark, color: 'text-yellow-500' },
    { label: 'Compartilhamentos', value: fmt(metrics.totalShares), icon: Share2, color: 'text-pink-500' },
    { label: 'Taxa Engajamento', value: `${metrics.engagementRate.toFixed(2)}%`, icon: TrendingUp, color: 'text-emerald-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-secondary ${item.color}`}>
              <item.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
