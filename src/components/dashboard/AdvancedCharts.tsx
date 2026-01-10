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
import { useChartResponsive, sampleDataForMobile, formatCompactCurrency, formatCompactNumber } from '@/hooks/useChartResponsive';

type ChartType = 'area' | 'bar' | 'composed';

interface MetricOption {
  key: string;
  label: string;
  format: (v: number) => string;
  formatCompact: (v: number) => string;
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
const formatPercentCompact = (value: number) => `${value.toFixed(1)}%`;
const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;
const formatMultiplierCompact = (value: number) => `${value.toFixed(1)}x`;

const createMetricOptions = (currency: string = 'BRL'): MetricOption[] => {
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  const formatCurrency = (value: number) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  
  const formatCurrencyCompact = (value: number) => formatCompactCurrency(value, currency);

  return [
    { key: 'spend', label: 'Gasto', format: formatCurrency, formatCompact: formatCurrencyCompact, color: 'hsl(var(--primary))' },
    { key: 'conversions', label: 'Conversões', format: formatNumber, formatCompact: formatCompactNumber, color: 'hsl(var(--chart-1))' },
    { key: 'revenue', label: 'Receita', format: formatCurrency, formatCompact: formatCurrencyCompact, color: 'hsl(142, 76%, 36%)' },
    { key: 'impressions', label: 'Impressões', format: formatNumber, formatCompact: formatCompactNumber, color: 'hsl(var(--chart-2))' },
    { key: 'clicks', label: 'Cliques', format: formatNumber, formatCompact: formatCompactNumber, color: 'hsl(var(--chart-3))' },
    { key: 'reach', label: 'Alcance', format: formatNumber, formatCompact: formatCompactNumber, color: 'hsl(var(--chart-4))' },
    { key: 'ctr', label: 'CTR', format: formatPercent, formatCompact: formatPercentCompact, color: 'hsl(var(--chart-5))' },
    { key: 'cpc', label: 'CPC', format: formatCurrency, formatCompact: formatCurrencyCompact, color: 'hsl(280, 70%, 50%)' },
    { key: 'cpm', label: 'CPM', format: formatCurrency, formatCompact: formatCurrencyCompact, color: 'hsl(200, 70%, 50%)' },
    { key: 'cpl', label: 'CPL/CPA', format: formatCurrency, formatCompact: formatCurrencyCompact, color: 'hsl(30, 70%, 50%)' },
    { key: 'roas', label: 'ROAS', format: formatMultiplier, formatCompact: formatMultiplierCompact, color: 'hsl(142, 76%, 36%)' },
    { key: 'frequency', label: 'Frequência', format: (v) => v.toFixed(2), formatCompact: (v) => v.toFixed(1), color: 'hsl(var(--muted-foreground))' },
  ];
};

// Aggregate data by month when there are too many days
function aggregateByMonth(data: DailyMetric[]): DailyMetric[] {
  const monthlyMap = new Map<string, DailyMetric>();
  
  for (const d of data) {
    const date = parseISO(d.date);
    const monthKey = format(date, 'yyyy-MM');
    
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        date: monthKey,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        conversions: 0,
        conversion_value: 0,
        messaging_replies: 0,
        profile_visits: 0,
        leads_conversions: 0,
        sales_conversions: 0,
        ctr: 0,
        cpm: 0,
        cpc: 0,
        roas: 0,
        cpa: 0,
      });
    }
    
    const agg = monthlyMap.get(monthKey)!;
    agg.spend += d.spend;
    agg.impressions += d.impressions;
    agg.clicks += d.clicks;
    agg.reach += d.reach;
    agg.conversions += d.conversions;
    agg.conversion_value += d.conversion_value;
  }
  
  // Calculate derived metrics
  return Array.from(monthlyMap.values())
    .map(d => ({
      ...d,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
      cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
      cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
      roas: d.spend > 0 ? d.conversion_value / d.spend : 0,
      cpa: d.conversions > 0 ? d.spend / d.conversions : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function AdvancedCharts({ 
  data, 
  businessModel,
  className,
  currency = 'BRL'
}: AdvancedChartsProps) {
  const isEcommerce = businessModel === 'ecommerce';
  const responsive = useChartResponsive();
  
  // Create metric options with dynamic currency
  const METRIC_OPTIONS = useMemo(() => createMetricOptions(currency), [currency]);
  
  // Calculate the date range span to determine if we should aggregate by month
  const shouldAggregateByMonth = useMemo(() => {
    if (data.length === 0) return false;
    if (data.length > 60) return true;
    
    const firstDate = new Date(data[0].date);
    const lastDate = new Date(data[data.length - 1].date);
    const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDiff > 60;
  }, [data]);
  
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
    const processedData = shouldAggregateByMonth ? aggregateByMonth(data) : data;
    
    // Sample data for mobile to reduce density
    const sampledData = responsive.isMobile 
      ? sampleDataForMobile(processedData, responsive.maxDataPoints)
      : processedData;
    
    return sampledData.map(d => {
      const isMonthly = d.date.length === 7;
      const formattedDate = isMonthly 
        ? format(parseISO(`${d.date}-01`), responsive.isMobile ? 'MM/yy' : 'MMM/yy', { locale: ptBR })
        : format(parseISO(d.date), 'dd/MM', { locale: ptBR });
      
      return {
        date: formattedDate,
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
      };
    });
  }, [data, shouldAggregateByMonth, responsive.isMobile, responsive.maxDataPoints]);

  const getMetric = (key: string) => METRIC_OPTIONS.find(m => m.key === key) || METRIC_OPTIONS[0];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-2 sm:p-3 shadow-lg max-w-[180px] sm:max-w-none">
        <p className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const metric = METRIC_OPTIONS.find(m => m.label === entry.name);
          return (
            <div key={index} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <div 
                className="w-2 h-2 sm:w-3 sm:h-3 rounded-full shrink-0" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground truncate">{entry.name}:</span>
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
        className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs"
        onClick={() => onChange('area')}
      >
        <TrendingUp className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={value === 'bar' ? 'default' : 'ghost'}
        className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs"
        onClick={() => onChange('bar')}
      >
        <BarChart2 className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={value === 'composed' ? 'default' : 'ghost'}
        className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs"
        onClick={() => onChange('composed')}
      >
        <LineChart className="w-3 h-3" />
      </Button>
    </div>
  );

  const MetricSelector = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-6 sm:h-7 text-xs w-[80px] sm:w-[110px] bg-secondary/50 border-0">
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

    // Common axis props for responsiveness
    const xAxisProps = {
      dataKey: "date",
      stroke: "hsl(var(--muted-foreground))",
      fontSize: responsive.xAxisFontSize,
      tickLine: false,
      axisLine: false,
      angle: responsive.xAxisAngle,
      textAnchor: responsive.xAxisTextAnchor,
      height: responsive.isMobile ? 40 : 30,
      interval: responsive.isMobile ? ('preserveStartEnd' as const) : ('equidistantPreserveStart' as const),
      tick: { dy: responsive.isMobile ? 8 : 0 }
    };

    const yAxisLeftProps = {
      yAxisId: "left",
      stroke: "hsl(var(--muted-foreground))",
      fontSize: responsive.yAxisFontSize,
      tickLine: false,
      axisLine: false,
      tickFormatter: responsive.isMobile ? primary.formatCompact : primary.format,
      width: responsive.isMobile ? 40 : 60
    };

    const yAxisRightProps = {
      yAxisId: "right",
      orientation: "right" as const,
      stroke: "hsl(var(--muted-foreground))",
      fontSize: responsive.yAxisFontSize,
      tickLine: false,
      axisLine: false,
      tickFormatter: responsive.isMobile ? secondary.formatCompact : secondary.format,
      width: responsive.isMobile ? 35 : 50
    };

    if (chartType === 'area') {
      return (
        <AreaChart data={chartData} margin={responsive.chartMargins}>
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
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisLeftProps} />
          {!responsive.isMobile && <YAxis {...yAxisRightProps} />}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={responsive.legendWrapperStyle} iconSize={responsive.isMobile ? 8 : 14} />
          <Area yAxisId="left" type="monotone" dataKey={primaryKey} name={primary.label} stroke={primary.color} strokeWidth={responsive.strokeWidth} fill={`url(#${gradientId1})`} animationDuration={600} dot={false} />
          <Area yAxisId={responsive.isMobile ? "left" : "right"} type="monotone" dataKey={secondaryKey} name={secondary.label} stroke={secondary.color} strokeWidth={responsive.strokeWidth} fill={`url(#${gradientId2})`} animationDuration={600} dot={false} />
        </AreaChart>
      );
    } else if (chartType === 'bar') {
      return (
        <BarChart data={chartData} margin={responsive.chartMargins}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisLeftProps} />
          {!responsive.isMobile && <YAxis {...yAxisRightProps} />}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={responsive.legendWrapperStyle} iconSize={responsive.isMobile ? 8 : 14} />
          <Bar yAxisId="left" dataKey={primaryKey} name={primary.label} fill={primary.color} radius={responsive.barRadius} animationDuration={600} />
          <Bar yAxisId={responsive.isMobile ? "left" : "right"} dataKey={secondaryKey} name={secondary.label} fill={secondary.color} radius={responsive.barRadius} animationDuration={600} />
        </BarChart>
      );
    } else {
      return (
        <ComposedChart data={chartData} margin={responsive.chartMargins}>
          <defs>
            <linearGradient id={gradientId1} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primary.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={primary.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisLeftProps} />
          {!responsive.isMobile && <YAxis {...yAxisRightProps} />}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={responsive.legendWrapperStyle} iconSize={responsive.isMobile ? 8 : 14} />
          <Area yAxisId="left" type="monotone" dataKey={primaryKey} name={primary.label} stroke={primary.color} strokeWidth={responsive.strokeWidth} fill={`url(#${gradientId1})`} animationDuration={600} dot={false} />
          <Bar yAxisId={responsive.isMobile ? "left" : "right"} dataKey={secondaryKey} name={secondary.label} fill={secondary.color} radius={responsive.barRadius} opacity={0.8} animationDuration={600} />
        </ComposedChart>
      );
    }
  };

  if (data.length === 0) {
    return (
      <div className={cn('glass-card p-4 sm:p-6', className)}>
        <h3 className="text-base sm:text-lg font-semibold mb-4">Análise de Performance</h3>
        <div className="h-[180px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
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
    <div className="glass-card p-4 sm:p-6 transition-all duration-300">
      <div className="flex flex-col gap-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
          </div>
          <ChartTypeSelector value={chartType} onChange={setChartType} />
        </div>
        <div className="flex items-center gap-2">
          <MetricSelector value={primaryMetric} onChange={setPrimaryMetric} exclude={secondaryMetric} />
          <span className="text-muted-foreground text-xs">vs</span>
          <MetricSelector value={secondaryMetric} onChange={setSecondaryMetric} exclude={primaryMetric} />
        </div>
      </div>
      <div style={{ height: responsive.chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartType, primaryMetric, secondaryMetric)}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-4 sm:space-y-6', className)}>
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