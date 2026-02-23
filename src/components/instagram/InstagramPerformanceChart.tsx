import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { InstagramInsightsDaily } from '@/hooks/useInstagramData';

interface Props {
  insights: InstagramInsightsDaily[];
}

const metricOptions = [
  { value: 'reach', label: 'Alcance', color: '#8b5cf6' },
  { value: 'views', label: 'Visualizações', color: '#06b6d4' },
  { value: 'likes', label: 'Curtidas', color: '#ef4444' },
  { value: 'comments', label: 'Comentários', color: '#f97316' },
  { value: 'shares', label: 'Compartilhamentos', color: '#ec4899' },
  { value: 'saves', label: 'Salvos', color: '#eab308' },
  { value: 'total_interactions', label: 'Interações', color: '#10b981' },
  { value: 'follows', label: 'Novos Seguidores', color: '#3b82f6' },
  { value: 'profile_views', label: 'Visitas ao Perfil', color: '#a855f7' },
];

export default function InstagramPerformanceChart({ insights }: Props) {
  const [metric1, setMetric1] = useState('reach');
  const [metric2, setMetric2] = useState('likes');

  const m1 = metricOptions.find(m => m.value === metric1)!;
  const m2 = metricOptions.find(m => m.value === metric2)!;

  const chartData = [...insights].reverse().map((i) => ({
    date: new Date(i.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    [metric1]: (i as any)[metric1] || 0,
    [metric2]: (i as any)[metric2] || 0,
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
        <div>
          <CardTitle className="text-base">Performance Instagram</CardTitle>
          {dateRange && <p className="text-xs text-muted-foreground mt-0.5">{dateRange}</p>}
        </div>
        <div className="flex gap-2">
          <Select value={metric1} onValueChange={setMetric1}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{metricOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={metric2} onValueChange={setMetric2}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{metricOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`grad-${metric1}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={m1.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={m1.color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`grad-${metric2}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={m2.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={m2.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
            <Legend />
            <Area type="monotone" dataKey={metric1} stroke={m1.color} fill={`url(#grad-${metric1})`} name={m1.label} strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey={metric2} stroke={m2.color} fill={`url(#grad-${metric2})`} name={m2.label} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
