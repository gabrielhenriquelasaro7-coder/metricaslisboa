import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import type { InstagramInsightsDaily } from '@/hooks/useInstagramData';

interface Props {
  insights: InstagramInsightsDaily[];
}

type ChartTab = 'reach' | 'engagement' | 'followers' | 'content';

export default function InstagramPerformanceChart({ insights }: Props) {
  const [tab, setTab] = useState<ChartTab>('reach');

  const chartData = [...insights].reverse().map((i) => ({
    date: new Date(i.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    reach: i.reach || 0,
    views: i.views || 0,
    profile_views: i.profile_views || 0,
    website_clicks: i.website_clicks || 0,
    likes: i.likes || 0,
    comments: i.comments || 0,
    shares: i.shares || 0,
    saves: i.saves || 0,
    total_interactions: i.total_interactions || 0,
    follows: i.follows || 0,
    unfollows: i.unfollows || 0,
    net_followers: (i.follows || 0) - (i.unfollows || 0),
    accounts_engaged: i.accounts_engaged || 0,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <p className="text-sm">Sem dados de insights diários.</p>
          <p className="text-xs">Clique em "Sincronizar" para puxar os dados.</p>
        </CardContent>
      </Card>
    );
  }

  const dateRange = insights.length > 0
    ? `${new Date(insights[insights.length - 1].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${new Date(insights[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
    : '';

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: 12,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Performance Instagram</CardTitle>
            {dateRange && <p className="text-xs text-muted-foreground mt-0.5">{dateRange}</p>}
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as ChartTab)}>
            <TabsList className="h-8">
              <TabsTrigger value="reach" className="text-xs px-3 h-7">Alcance</TabsTrigger>
              <TabsTrigger value="engagement" className="text-xs px-3 h-7">Engajamento</TabsTrigger>
              <TabsTrigger value="followers" className="text-xs px-3 h-7">Seguidores</TabsTrigger>
              <TabsTrigger value="content" className="text-xs px-3 h-7">Perfil</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {tab === 'reach' ? (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="reach" stroke="#8b5cf6" fill="url(#gradReach)" name="Alcance" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="views" stroke="#06b6d4" fill="url(#gradViews)" name="Visualizações" strokeWidth={2} dot={false} />
              </AreaChart>
            ) : tab === 'engagement' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="likes" fill="#ef4444" name="Curtidas" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="comments" fill="#f97316" name="Comentários" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="shares" fill="#ec4899" name="Compartilh." radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="saves" fill="#eab308" name="Salvos" radius={[2, 2, 0, 0]} stackId="a" />
              </BarChart>
            ) : tab === 'followers' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="follows" stroke="#10b981" name="Novos Seguidores" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="unfollows" stroke="#ef4444" name="Unfollows" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="net_followers" stroke="#3b82f6" name="Saldo Líquido" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradProfile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="profile_views" stroke="#a855f7" fill="url(#gradProfile)" name="Visitas ao Perfil" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="website_clicks" stroke="#f97316" fill="transparent" name="Cliques no Site" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="accounts_engaged" stroke="#10b981" fill="transparent" name="Contas Engajadas" strokeWidth={2} dot={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
