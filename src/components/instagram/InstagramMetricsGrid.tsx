import { Card, CardContent } from '@/components/ui/card';
import { Eye, Heart, MessageCircle, Share2, Bookmark, Users, UserPlus, TrendingUp, BarChart3 } from 'lucide-react';

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

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
};

export default function InstagramMetricsGrid({ metrics, followersCount }: Props) {
  const items = [
    { label: 'Seguidores', value: fmt(followersCount), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Novos Seguidores', value: fmt(metrics.newFollows), icon: UserPlus, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Alcance', value: fmt(metrics.totalReach), icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Visualizações', value: fmt(metrics.totalViews), icon: BarChart3, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { label: 'Curtidas', value: fmt(metrics.totalLikes), icon: Heart, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Comentários', value: fmt(metrics.totalComments), icon: MessageCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Salvos', value: fmt(metrics.totalSaves), icon: Bookmark, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Compartilhamentos', value: fmt(metrics.totalShares), icon: Share2, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Taxa Engajamento', value: `${metrics.engagementRate.toFixed(2)}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground px-1">Últimos 30 dias</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item) => {
          const isZero = item.value === '0' || item.value === '0.00%';
          return (
            <Card key={item.label} className={`transition-all hover:shadow-md ${isZero ? 'opacity-50' : ''}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold truncate">{item.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
