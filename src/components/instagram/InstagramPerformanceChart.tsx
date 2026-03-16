import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { Calendar, TrendingUp } from 'lucide-react';
import type { InstagramInsightsDaily } from '@/hooks/useInstagramData';

interface Props {
  insights: InstagramInsightsDaily[];
}

export default function InstagramPerformanceChart({ insights }: Props) {
  const sortedInsights = [...insights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const chartData = sortedInsights
    .filter((i) => (i.reach || 0) > 0)
    .map((i) => ({
      date: new Date(i.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      alcance: i.reach || 0,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Performance</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <TrendingUp className="h-8 w-8 opacity-40" />
          <p className="text-sm">Sem dados de insights diários.</p>
          <p className="text-xs">Clique em "Sincronizar" para puxar os dados.</p>
        </CardContent>
      </Card>
    );
  }

  const fmtNumber = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return String(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-card p-3 shadow-md text-sm">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}:</span>
            <span className="font-semibold text-foreground">{fmtNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Alcance Diário</CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Últimos 30 dias</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              interval={Math.max(0, Math.floor(chartData.length / 8))}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={fmtNumber}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            />
            <Area
              type="monotone"
              dataKey="alcance"
              name="Alcance"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#reachGradient)"
              dot={{ r: 2, fill: '#8b5cf6' }}
              activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2, fill: 'white' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
