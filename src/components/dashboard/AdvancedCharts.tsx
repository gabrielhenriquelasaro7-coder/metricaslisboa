import { useMemo, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart
} from 'recharts';
import { cn } from '@/lib/utils';
import { DailyMetric } from '@/hooks/useDailyMetrics';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { BarChart2, LineChart, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';

type ChartType = 'area' | 'bar' | 'composed';

interface AdvancedChartsProps {
  data: DailyMetric[];
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  campaignData?: { name: string; spend: number; conversions: number }[];
  className?: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(142, 76%, 36%)',
];

export default function AdvancedCharts({ 
  data, 
  businessModel,
  campaignData = [],
  className 
}: AdvancedChartsProps) {
  const [chartType, setChartType] = useState<ChartType>('area');
  const isEcommerce = businessModel === 'ecommerce';
  
  const chartData = useMemo(() => {
    return data.map(d => ({
      date: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
      fullDate: d.date,
      spend: d.spend,
      conversions: d.conversions,
      revenue: d.conversion_value,
      roas: d.roas,
      cpl: d.cpa,
      ctr: d.ctr,
    }));
  }, [data]);

  // Pie chart data for campaign distribution
  const pieData = useMemo(() => {
    if (!campaignData.length) return [];
    return campaignData
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
      .map((c, i) => ({
        name: c.name.length > 20 ? c.name.slice(0, 20) + '...' : c.name,
        value: c.spend,
        conversions: c.conversions,
        color: COLORS[i % COLORS.length],
      }));
  }, [campaignData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {entry.name === 'Gasto' || entry.name === 'Receita' || entry.name === 'CPL'
                ? formatCurrency(entry.value)
                : entry.name === 'ROAS'
                  ? `${entry.value.toFixed(2)}x`
                  : entry.name === 'CTR'
                    ? `${entry.value.toFixed(2)}%`
                    : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-1">{data.name}</p>
        <p className="text-sm text-muted-foreground">Gasto: {formatCurrency(data.value)}</p>
        <p className="text-sm text-muted-foreground">{isEcommerce ? 'Compras' : 'Leads'}: {data.conversions}</p>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4">Análise de Performance</h3>
        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
          Sem dados para o período selecionado
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Main Evolution Chart */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold">
            Evolução Diária - {isEcommerce ? 'Gasto vs Receita' : 'Gasto vs Leads'}
          </h3>
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            <Button
              size="sm"
              variant={chartType === 'area' ? 'default' : 'ghost'}
              className="h-8 px-3"
              onClick={() => setChartType('area')}
            >
              <TrendingUp className="w-4 h-4 mr-1" />
              Área
            </Button>
            <Button
              size="sm"
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              className="h-8 px-3"
              onClick={() => setChartType('bar')}
            >
              <BarChart2 className="w-4 h-4 mr-1" />
              Barras
            </Button>
            <Button
              size="sm"
              variant={chartType === 'composed' ? 'default' : 'ghost'}
              className="h-8 px-3"
              onClick={() => setChartType('composed')}
            >
              <LineChart className="w-4 h-4 mr-1" />
              Combinado
            </Button>
          </div>
        </div>
        
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientSpendAdv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientRevenueAdv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="spend" name="Gasto" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradientSpendAdv)" />
                {isEcommerce && (
                  <Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(142, 76%, 36%)" strokeWidth={2} fill="url(#gradientRevenueAdv)" />
                )}
              </AreaChart>
            ) : chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar yAxisId="left" dataKey="spend" name="Gasto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="conversions" name={isEcommerce ? 'Compras' : 'Leads'} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientSpendComp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Area yAxisId="left" type="monotone" dataKey="spend" name="Gasto" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradientSpendComp)" />
                <Bar yAxisId="right" dataKey="conversions" name={isEcommerce ? 'Compras' : 'Leads'} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} opacity={0.8} />
                {isEcommerce && (
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart for Campaign Distribution */}
      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">Distribuição de Gasto por Campanha</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {pieData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground truncate max-w-[150px]">{item.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">{isEcommerce ? 'Compras' : 'Leads'} por Campanha</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pieData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={100} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    formatter={(value: number) => [value, isEcommerce ? 'Compras' : 'Leads']}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="conversions" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
