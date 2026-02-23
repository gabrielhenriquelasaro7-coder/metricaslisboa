import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import type { InstagramInsightsDaily } from '@/hooks/useInstagramData';

interface Props {
  insights: InstagramInsightsDaily[];
}

type MetricKey = 'reach' | 'followers';

const METRIC_CONFIG: Record<MetricKey, { label: string; lines: { key: string; color: string; name: string }[] }> = {
  reach: {
    label: 'Alcance',
    lines: [
      { key: 'reach', color: '#8b5cf6', name: 'Alcance' },
      { key: 'views', color: '#06b6d4', name: 'Visualizações' },
    ],
  },
  followers: {
    label: 'Novos Seguidores',
    lines: [
      { key: 'net_followers', color: '#10b981', name: 'Novos Seguidores' },
    ],
  },
};

export default function InstagramPerformanceChart({ insights }: Props) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(new Set(['reach', 'followers']));

  const chartData = [...insights].reverse().map((i) => ({
    date: new Date(i.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    reach: i.reach || 0,
    views: i.views || 0,
    net_followers: (i.follows || 0) - (i.unfollows || 0),
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

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Gather all active lines
  const activeLines: { key: string; color: string; name: string }[] = [];
  for (const mk of Object.keys(METRIC_CONFIG) as MetricKey[]) {
    if (activeMetrics.has(mk)) {
      activeLines.push(...METRIC_CONFIG[mk].lines);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {activeLines.map(line => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                name={line.name}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Metric toggles */}
        <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-border/30">
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map(mk => (
            <button
              key={mk}
              onClick={() => toggleMetric(mk)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeMetrics.has(mk)
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: METRIC_CONFIG[mk].lines[0].color }} />
              {METRIC_CONFIG[mk].label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">Clique nas métricas acima para alterar a visualização</p>
      </CardContent>
    </Card>
  );
}
