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
import { DailyMetric } from '@/hooks/useDailyMetrics';
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

interface AdvancedChartsProps {
  data: DailyMetric[];
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  className?: string;
  currency?: string;
}

const formatNumber = (value: number) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toLocaleString('pt-BR');
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;
const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;

const createMetricOptions = (currency: string = 'BRL'): MetricOption[] => {
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  const formatCurrency = (value: number) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return [
    { key: 'spend', label: 'Gasto', format: formatCurrency, color: 'hsl(var(--primary))' },
    { key: 'conversions', label: 'Conversões', format: formatNumber, color: 'hsl(var(--chart-1))' },
    { key: 'revenue', label: 'Receita', format: formatCurrency, color: 'hsl(142, 76%, 36%)' },
    { key: 'impressions', label: 'Impressões', format: formatNumber, color: 'hsl(var(--chart-2))' },
    { key: 'clicks', label: 'Cliques', format: formatNumber, color: 'hsl(var(--chart-3))' },
    { key: 'reach', label: 'Alcance', format: formatNumber, color: 'hsl(var(--chart-4))' },
    { key: 'ctr', label: 'CTR', format: formatPercent, color: 'hsl(var(--chart-5))' },
    { key: 'cpc', label: 'CPC', format: formatCurrency, color: 'hsl(280, 70%, 50%)' },
    { key: 'cpm', label: 'CPM', format: formatCurrency, color: 'hsl(200, 70%, 50%)' },
    { key: 'cpl', label: 'CPL/CPA', format: formatCurrency, color: 'hsl(30, 70%, 50%)' },
    { key: 'roas', label: 'ROAS', format: formatMultiplier, color: 'hsl(142, 76%, 36%)' },
    { key: 'frequency', label: 'Frequência', format: (v) => v.toFixed(2), color: 'hsl(var(--muted-foreground))' },
  ];
};

export default function AdvancedCharts({ 
  data, 
  businessModel,
  className,
  currency = 'BRL'
}: AdvancedChartsProps) {
  const isEcommerce = businessModel === 'ecommerce';
  
  // Create metric options with dynamic currency
  const METRIC_OPTIONS = useMemo(() => createMetricOptions(currency), [currency]);
  
  // State for customizable charts
  const [chart1Type, setChart1Type] = useState<ChartType>('composed');
  const [chart1Primary, setChart1Primary] = useState('spend');
  const [chart1Secondary, setChart1Secondary] = useState(isEcommerce ? 'conversions' : 'conversions');
  
  const [chart2Type, setChart2Type] = useState<ChartType>('area');
  const [chart2Primary, setChart2Primary] = useState('impressions');
  const [chart2Secondary, setChart2Secondary] = useState('ctr');
  
  const [chart3Type, setChart3Type] = useState<ChartType>('bar');
  const [chart3Primary, setChart3Primary] = useState('cpc');
  const [chart3Secondary, setChart3Secondary] = useState('clicks');
  
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
      frequency: d.reach > 0 ? d.impressions / d.reach : 0,
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
        <TrendingUp className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={value === 'bar' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => onChange('bar')}
      >
        <BarChart2 className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={value === 'composed' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => onChange('composed')}
      >
        <LineChart className="w-3 h-3" />
      </Button>
    </div>
  );

  const MetricSelector = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs w-[110px] bg-secondary/50 border-0">
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

  const renderChart = (
    chartType: ChartType,
    primaryKey: string,
    secondaryKey: string
  ) => {
    const primary = getMetric(primaryKey);
    const secondary = getMetric(secondaryKey);
    const gradientId1 = `gradient-${primaryKey}-${Math.random().toString(36).substr(2, 9)}`;
    const gradientId2 = `gradient-${secondaryKey}-${Math.random().toString(36).substr(2, 9)}`;

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
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryKey} name={primary.label} stroke={primary.color} strokeWidth={2} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Area yAxisId="right" type="monotone" dataKey={secondaryKey} name={secondary.label} stroke={secondary.color} strokeWidth={2} fill={`url(#${gradientId2})`} animationDuration={800} />
        </AreaChart>
      );
    } else if (chartType === 'bar') {
      return (
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar yAxisId="left" dataKey={primaryKey} name={primary.label} fill={primary.color} radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryKey} name={secondary.label} fill={secondary.color} radius={[4, 4, 0, 0]} animationDuration={800} />
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
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryKey} name={primary.label} stroke={primary.color} strokeWidth={2} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryKey} name={secondary.label} fill={secondary.color} radius={[4, 4, 0, 0]} opacity={0.8} animationDuration={800} />
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

  const ChartCard = ({ 
    title, 
    chartType, 
    setChartType, 
    primaryMetric, 
    setPrimaryMetric, 
    secondaryMetric, 
    setSecondaryMetric 
  }: {
    title: string;
    chartType: ChartType;
    setChartType: (v: ChartType) => void;
    primaryMetric: string;
    setPrimaryMetric: (v: string) => void;
    secondaryMetric: string;
    setSecondaryMetric: (v: string) => void;
  }) => (
    <div className="glass-card p-6 transition-all duration-300 hover:shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetricSelector value={primaryMetric} onChange={setPrimaryMetric} exclude={secondaryMetric} />
          <span className="text-muted-foreground text-xs">vs</span>
          <MetricSelector value={secondaryMetric} onChange={setSecondaryMetric} exclude={primaryMetric} />
          <ChartTypeSelector value={chartType} onChange={setChartType} />
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartType, primaryMetric, secondaryMetric)}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-6', className)}>
      <ChartCard
        title="Gráfico 1"
        chartType={chart1Type}
        setChartType={setChart1Type}
        primaryMetric={chart1Primary}
        setPrimaryMetric={setChart1Primary}
        secondaryMetric={chart1Secondary}
        setSecondaryMetric={setChart1Secondary}
      />
      
      <ChartCard
        title="Gráfico 2"
        chartType={chart2Type}
        setChartType={setChart2Type}
        primaryMetric={chart2Primary}
        setPrimaryMetric={setChart2Primary}
        secondaryMetric={chart2Secondary}
        setSecondaryMetric={setChart2Secondary}
      />
      
      <ChartCard
        title="Gráfico 3"
        chartType={chart3Type}
        setChartType={setChart3Type}
        primaryMetric={chart3Primary}
        setPrimaryMetric={setChart3Primary}
        secondaryMetric={chart3Secondary}
        setSecondaryMetric={setChart3Secondary}
      />
    </div>
  );
}