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
  BarChart
} from 'recharts';
import { cn } from '@/lib/utils';
import { AdSetDailyMetric } from '@/hooks/useAdSetDailyMetrics';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart2, LineChart, TrendingUp, Settings2 } from 'lucide-react';

type ChartType = 'area' | 'bar' | 'composed';

interface MetricOption {
  key: string;
  label: string;
  format: (v: number) => string;
  color: string;
}

interface AdSetChartsProps {
  data: AdSetDailyMetric[];
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  className?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toLocaleString('pt-BR');
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;
const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'spend', label: 'Gasto', format: formatCurrency, color: 'hsl(var(--primary))' },
  { key: 'conversions', label: 'Conversões', format: formatNumber, color: 'hsl(var(--chart-1))' },
  { key: 'revenue', label: 'Receita', format: formatCurrency, color: 'hsl(142, 76%, 36%)' },
  { key: 'impressions', label: 'Impressões', format: formatNumber, color: 'hsl(var(--chart-2))' },
  { key: 'clicks', label: 'Cliques', format: formatNumber, color: 'hsl(var(--chart-3))' },
  { key: 'reach', label: 'Alcance', format: formatNumber, color: 'hsl(var(--chart-4))' },
  { key: 'ctr', label: 'CTR', format: formatPercent, color: 'hsl(var(--chart-5))' },
  { key: 'cpc', label: 'CPC', format: formatCurrency, color: 'hsl(280, 70%, 50%)' },
  { key: 'cpm', label: 'CPM', format: formatCurrency, color: 'hsl(200, 70%, 50%)' },
  { key: 'cpa', label: 'CPL/CPA', format: formatCurrency, color: 'hsl(30, 70%, 50%)' },
  { key: 'roas', label: 'ROAS', format: formatMultiplier, color: 'hsl(142, 76%, 36%)' },
];

export default function AdSetCharts({ 
  data, 
  businessModel,
  className 
}: AdSetChartsProps) {
  const isEcommerce = businessModel === 'ecommerce';
  
  const [chartType, setChartType] = useState<ChartType>('composed');
  const [primaryMetric, setPrimaryMetric] = useState('spend');
  const [secondaryMetric, setSecondaryMetric] = useState(isEcommerce ? 'conversions' : 'conversions');
  
  const chartData = useMemo(() => {
    return data.map(d => ({
      date: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
      fullDate: d.date,
      spend: d.spend,
      conversions: d.conversions,
      revenue: d.conversion_value,
      roas: d.roas,
      cpa: d.cpa,
      ctr: d.ctr,
      cpm: d.cpm,
      cpc: d.cpc,
      impressions: d.impressions,
      clicks: d.clicks,
      reach: d.reach,
    }));
  }, [data]);

  const getMetric = (key: string) => METRIC_OPTIONS.find(m => m.key === key) || METRIC_OPTIONS[0];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const metric = METRIC_OPTIONS.find(m => m.label === entry.name);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">
                {metric ? metric.format(entry.value) : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const ChartTypeSelector = ({ value, onChange }: { value: ChartType; onChange: (v: ChartType) => void }) => (
    <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
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

  const MetricSelector = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs w-[120px] bg-secondary/50 border-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {METRIC_OPTIONS.filter(m => m.key !== exclude).map(metric => (
          <SelectItem key={metric.key} value={metric.key} className="text-xs">
            {metric.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const primary = getMetric(primaryMetric);
  const secondary = getMetric(secondaryMetric);
  const gradientId1 = `adset-gradient-${primaryMetric}`;
  const gradientId2 = `adset-gradient-${secondaryMetric}`;

  const renderChart = () => {
    if (chartType === 'area') {
      return (
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId1} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primary.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={primary.color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={gradientId2} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={secondary.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={secondary.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} name={primary.label} stroke={primary.color} strokeWidth={2} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Area yAxisId="right" type="monotone" dataKey={secondaryMetric} name={secondary.label} stroke={secondary.color} strokeWidth={2} fill={`url(#${gradientId2})`} animationDuration={800} />
        </AreaChart>
      );
    } else if (chartType === 'bar') {
      return (
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar yAxisId="left" dataKey={primaryMetric} name={primary.label} fill={primary.color} radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={secondary.color} radius={[4, 4, 0, 0]} animationDuration={800} />
        </BarChart>
      );
    } else {
      return (
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId1} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primary.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={primary.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} name={primary.label} stroke={primary.color} strokeWidth={2} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={secondary.color} radius={[4, 4, 0, 0]} opacity={0.8} animationDuration={800} />
        </ComposedChart>
      );
    }
  };

  if (data.length === 0) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4">Evolução de Performance</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Sem dados diários para este conjunto de anúncios
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-card p-6 transition-all duration-300', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Evolução de Performance</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetricSelector value={primaryMetric} onChange={setPrimaryMetric} exclude={secondaryMetric} />
          <span className="text-muted-foreground text-xs">vs</span>
          <MetricSelector value={secondaryMetric} onChange={setSecondaryMetric} exclude={primaryMetric} />
          <ChartTypeSelector value={chartType} onChange={setChartType} />
        </div>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}