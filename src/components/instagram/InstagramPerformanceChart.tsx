import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { InstagramInsightsDaily } from '@/hooks/useInstagramData';

interface Props {
  insights: InstagramInsightsDaily[];
}

type ViewMode = 'reach' | 'followers';

export default function InstagramPerformanceChart({ insights }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('reach');

  const sortedInsights = [...insights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const chartData = sortedInsights.map((i) => ({
    date: new Date(i.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    reach: i.reach || 0,
    views: i.views || 0,
    net_followers: (i.follows || 0) - (i.unfollows || 0),
    follows: i.follows || 0,
    unfollows: i.unfollows || 0,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Performance</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <p className="text-sm">Sem dados de insights diários.</p>
          <p className="text-xs">Clique em "Sincronizar" para puxar os dados.</p>
        </CardContent>
      </Card>
    );
  }

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: 12,
  };

  const fmtNumber = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return String(value);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Performance</CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="reach" className="text-xs px-3 h-7">Alcance & Visualizações</TabsTrigger>
              <TabsTrigger value="followers" className="text-xs px-3 h-7">Novos Seguidores</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'reach' ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                className="fill-muted-foreground"
                interval={Math.max(0, Math.floor(chartData.length / 8))}
              />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={fmtNumber} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmtNumber(value), '']} />
              <Line type="monotone" dataKey="reach" stroke="#8b5cf6" name="Alcance" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="views" stroke="#06b6d4" name="Visualizações" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                className="fill-muted-foreground"
                interval={Math.max(0, Math.floor(chartData.length / 8))}
              />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="follows" fill="#10b981" name="Novos seguidores" radius={[4, 4, 0, 0]} />
              <Bar dataKey="unfollows" fill="#ef4444" name="Unfollows" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          Últimos 30 dias · Use as abas acima para alternar entre métricas
        </p>
      </CardContent>
    </Card>
  );
}
