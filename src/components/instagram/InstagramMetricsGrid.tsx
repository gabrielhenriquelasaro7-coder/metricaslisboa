import { Card, CardContent } from '@/components/ui/card';
import { Eye, Heart, MessageCircle, Share2, Bookmark, Users, UserPlus, TrendingUp, BarChart3, MousePointer } from 'lucide-react';

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
    { label: 'Seguidores', sublabel: 'Total atual', value: fmt(followersCount), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Novos Seguidores', sublabel: 'Total no período', value: fmt(metrics.newFollows), icon: UserPlus, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Alcance', sublabel: 'Contas alcançadas', value: fmt(metrics.totalReach), icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Posts', sublabel: 'No período', value: '-', icon: BarChart3, color: 'text-cyan-500', bg: 'bg-cyan-500/10', skip: true },
    { label: 'Curtidas', sublabel: 'Total no período', value: fmt(metrics.totalLikes), icon: Heart, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Comentários', sublabel: 'Total no período', value: fmt(metrics.totalComments), icon: MessageCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Salvos', sublabel: 'Total no período', value: fmt(metrics.totalSaves), icon: Bookmark, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Compartilhamentos', sublabel: 'Total no período', value: fmt(metrics.totalShares), icon: Share2, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Visualizações', sublabel: 'Total no período', value: fmt(metrics.totalViews), icon: MousePointer, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Taxa de Engajamento', sublabel: '(Interações / Alcance)', value: `${metrics.engagementRate.toFixed(2)}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  const displayItems = items.filter(i => !i.skip);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {displayItems.map((item) => {
        const isZero = item.value === '0' || item.value === '0.00%';
        return (
          <Card key={item.label} className={`transition-all hover:shadow-md ${isZero ? 'opacity-60' : ''}`}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                <div className={`p-1.5 rounded-lg ${item.bg} ${item.color}`}>
                  <item.icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.sublabel}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
