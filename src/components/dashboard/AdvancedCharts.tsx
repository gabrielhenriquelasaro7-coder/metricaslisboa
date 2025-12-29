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
  BarChart
} from 'recharts';
import { cn } from '@/lib/utils';
import { DailyMetric } from '@/hooks/useDailyMetrics';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { BarChart2, LineChart, TrendingUp } from 'lucide-react';

type ChartType = 'area' | 'bar' | 'composed';

interface AdvancedChartsProps {
  data: DailyMetric[];
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  className?: string;
}

export default function AdvancedCharts({ 
  data, 
  businessModel,
  className 
}: AdvancedChartsProps) {
  const [chartType1, setChartType1] = useState<ChartType>('composed');
  const [chartType2, setChartType2] = useState<ChartType>('area');
  const [chartType3, setChartType3] = useState<ChartType>('bar');
  
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
      cpm: d.cpm,
      cpc: d.cpc,
      impressions: d.impressions,
      clicks: d.clicks,
      reach: d.reach,
    }));
  }, [data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(0);
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
              {entry.name === 'Gasto' || entry.name === 'Receita' || entry.name === 'CPL' || entry.name === 'CPC' || entry.name === 'CPM'
                ? formatCurrency(entry.value)
                : entry.name === 'ROAS'
                  ? `${entry.value.toFixed(2)}x`
                  : entry.name === 'CTR'
                    ? `${entry.value.toFixed(2)}%`
                    : formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const ChartTypeSelector = ({ value, onChange }: { value: ChartType; onChange: (v: ChartType) => void }) => (
    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
      <Button
        size="sm"
        variant={value === 'area' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => onChange('area')}
      >
        <TrendingUp className="w-3 h-3 mr-1" />
        Área
      </Button>
      <Button
        size="sm"
        variant={value === 'bar' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => onChange('bar')}
      >
        <BarChart2 className="w-3 h-3 mr-1" />
        Barras
      </Button>
      <Button
        size="sm"
        variant={value === 'composed' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => onChange('composed')}
      >
        <LineChart className="w-3 h-3 mr-1" />
        Combinado
      </Button>
    </div>
  );

  const renderChart = (
    chartType: ChartType,
    primaryKey: string,
    primaryName: string,
    primaryColor: string,
    secondaryKey: string,
    secondaryName: string,
    secondaryColor: string,
    formatPrimary: (v: number) => string = formatCurrency,
    formatSecondary: (v: number) => string = formatNumber
  ) => {
    const gradientId1 = `gradient-${primaryKey}-${Math.random().toString(36).substr(2, 9)}`;
    const gradientId2 = `gradient-${secondaryKey}-${Math.random().toString(36).substr(2, 9)}`;

    if (chartType === 'area') {
      return (
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId1} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={gradientId2} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatPrimary} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatSecondary} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryKey} name={primaryName} stroke={primaryColor} strokeWidth={2} fill={`url(#${gradientId1})`} />
          <Area yAxisId="right" type="monotone" dataKey={secondaryKey} name={secondaryName} stroke={secondaryColor} strokeWidth={2} fill={`url(#${gradientId2})`} />
        </AreaChart>
      );
    } else if (chartType === 'bar') {
      return (
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatPrimary} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatSecondary} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar yAxisId="left" dataKey={primaryKey} name={primaryName} fill={primaryColor} radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey={secondaryKey} name={secondaryName} fill={secondaryColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    } else {
      return (
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId1} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatPrimary} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatSecondary} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryKey} name={primaryName} stroke={primaryColor} strokeWidth={2} fill={`url(#${gradientId1})`} />
          <Bar yAxisId="right" dataKey={secondaryKey} name={secondaryName} fill={secondaryColor} radius={[4, 4, 0, 0]} opacity={0.8} />
        </ComposedChart>
      );
    }
  };

  if (data.length === 0) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4">Análise de Performance</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Sem dados para o período selecionado
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Chart 1: Gasto vs Leads/Compras */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold">
            Gasto vs {isEcommerce ? 'Compras' : 'Leads'}
          </h3>
          <ChartTypeSelector value={chartType1} onChange={setChartType1} />
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(
              chartType1,
              'spend', 'Gasto', 'hsl(var(--primary))',
              'conversions', isEcommerce ? 'Compras' : 'Leads', 'hsl(var(--chart-1))'
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Impressões vs CTR */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold">
            Impressões vs CTR
          </h3>
          <ChartTypeSelector value={chartType2} onChange={setChartType2} />
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(
              chartType2,
              'impressions', 'Impressões', 'hsl(var(--chart-2))',
              'ctr', 'CTR', 'hsl(var(--chart-3))',
              formatNumber,
              (v) => `${v.toFixed(2)}%`
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: CPC vs Cliques */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold">
            CPC vs Cliques
          </h3>
          <ChartTypeSelector value={chartType3} onChange={setChartType3} />
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(
              chartType3,
              'cpc', 'CPC', 'hsl(var(--chart-4))',
              'clicks', 'Cliques', 'hsl(142, 76%, 36%)',
              formatCurrency,
              formatNumber
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 4: ROAS/CPL Evolution (business model specific) */}
      {isEcommerce ? (
        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-semibold">
              Receita vs ROAS
            </h3>
            <ChartTypeSelector value={chartType1} onChange={setChartType1} />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(
                chartType1,
                'revenue', 'Receita', 'hsl(142, 76%, 36%)',
                'roas', 'ROAS', 'hsl(var(--chart-5))',
                formatCurrency,
                (v) => `${v.toFixed(2)}x`
              )}
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-semibold">
              CPL vs Alcance
            </h3>
            <ChartTypeSelector value={chartType1} onChange={setChartType1} />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(
                chartType1,
                'cpl', 'CPL', 'hsl(var(--chart-5))',
                'reach', 'Alcance', 'hsl(var(--chart-2))',
                formatCurrency,
                formatNumber
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
