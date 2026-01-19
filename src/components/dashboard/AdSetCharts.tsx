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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { BarChart2, LineChart, TrendingUp, Settings2, Maximize2, X } from 'lucide-react';
import { useChartResponsive, sampleDataForMobile, formatCompactCurrency, formatCompactNumber } from '@/hooks/useChartResponsive';

type ChartType = 'area' | 'bar' | 'composed';

interface MetricOption {
  key: string;
  label: string;
  format: (v: number) => string;
  color: string;
}

interface AdSetChartsProps {
  data: AdSetDailyMetric[];
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | 'custom' | 'infoproduto' | null;
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
    { key: 'cpa', label: 'CPL/CPA', format: formatCurrency, color: 'hsl(30, 70%, 50%)' },
    { key: 'roas', label: 'ROAS', format: formatMultiplier, color: 'hsl(142, 76%, 36%)' },
    { key: 'profile_visits', label: 'Visitas ao Perfil', format: formatNumber, color: 'hsl(330, 80%, 60%)' },
    { key: 'cost_per_visit', label: 'Custo por Visita', format: formatCurrency, color: 'hsl(330, 60%, 45%)' },
  ];
};

// Aggregate data by month when there are too many days
interface MonthlyAggregate {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversion_value: number;
  profile_visits: number;
  ctr: number;
  cpm: number;
  cpc: number;
  roas: number;
  cpa: number;
  cost_per_visit: number;
}

function aggregateByMonth(data: AdSetDailyMetric[]): MonthlyAggregate[] {
  const monthlyMap = new Map<string, MonthlyAggregate>();
  
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
        profile_visits: 0,
        ctr: 0,
        cpm: 0,
        cpc: 0,
        roas: 0,
        cpa: 0,
        cost_per_visit: 0,
      });
    }
    
    const agg = monthlyMap.get(monthKey)!;
    agg.spend += d.spend ?? 0;
    agg.impressions += d.impressions ?? 0;
    agg.clicks += d.clicks ?? 0;
    agg.reach += d.reach ?? 0;
    agg.conversions += d.conversions ?? 0;
    agg.conversion_value += d.conversion_value ?? 0;
    agg.profile_visits += d.profile_visits ?? 0;
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
      cost_per_visit: d.profile_visits > 0 ? d.spend / d.profile_visits : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function AdSetCharts({ 
  data, 
  businessModel,
  className,
  currency = 'BRL'
}: AdSetChartsProps) {
  const isEcommerce = businessModel === 'ecommerce';
  const responsiveConfig = useChartResponsive();
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const METRIC_OPTIONS = useMemo(() => createMetricOptions(currency), [currency]);
  
  // Calculate the date range span to determine if we should aggregate by month
  // More than 60 data points OR more than 60 days span = aggregate by month
  const shouldAggregateByMonth = useMemo(() => {
    if (data.length === 0) return false;
    
    // If more than 60 data points, aggregate
    if (data.length > 60) return true;
    
    // Also check actual date span
    const firstDate = new Date(data[0].date);
    const lastDate = new Date(data[data.length - 1].date);
    const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`[AdSetCharts] Data length: ${data.length}, Days span: ${daysDiff}, shouldAggregate: ${data.length > 60 || daysDiff > 60}`);
    
    return daysDiff > 60;
  }, [data]);
  
  const [chartType, setChartType] = useState<ChartType>('composed');
  const [primaryMetric, setPrimaryMetric] = useState('spend');
  const [secondaryMetric, setSecondaryMetric] = useState(isEcommerce ? 'conversions' : 'conversions');
  
  const chartData = useMemo(() => {
    if (shouldAggregateByMonth) {
      const monthlyData = aggregateByMonth(data);
      return monthlyData.map(d => ({
        date: format(parseISO(`${d.date}-01`), 'MMM/yy', { locale: ptBR }),
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
        profile_visits: d.profile_visits,
        cost_per_visit: d.cost_per_visit,
      }));
    }
    
    return data.map(d => {
      const profileVisits = d.profile_visits ?? 0;
      const spend = d.spend ?? 0;
      const costPerVisit = profileVisits > 0 ? spend / profileVisits : 0;
      
      return {
        date: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
        fullDate: d.date,
        spend,
        conversions: d.conversions ?? 0,
        revenue: d.conversion_value ?? 0,
        roas: d.roas ?? 0,
        cpa: d.cpa ?? 0,
        ctr: d.ctr ?? 0,
        cpm: d.cpm ?? 0,
        cpc: d.cpc ?? 0,
        impressions: d.impressions ?? 0,
        clicks: d.clicks ?? 0,
        reach: d.reach ?? 0,
        profile_visits: profileVisits,
        cost_per_visit: costPerVisit,
      };
    });
  }, [data, shouldAggregateByMonth]);

  // Sample data for mobile to reduce clutter - MUST be before any conditional returns
  const displayData = useMemo(() => {
    if (responsiveConfig.isMobile && chartData.length > 0) {
      return sampleDataForMobile(chartData, responsiveConfig.maxDataPoints);
    }
    return chartData;
  }, [chartData, responsiveConfig.isMobile, responsiveConfig.maxDataPoints]);

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
        className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs"
        onClick={() => onChange('area')}
      >
        <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
        <span className="hidden xs:inline">Área</span>
      </Button>
      <Button
        size="sm"
        variant={value === 'bar' ? 'default' : 'ghost'}
        className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs"
        onClick={() => onChange('bar')}
      >
        <BarChart2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
        <span className="hidden xs:inline">Barras</span>
      </Button>
      <Button
        size="sm"
        variant={value === 'composed' ? 'default' : 'ghost'}
        className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs"
        onClick={() => onChange('composed')}
      >
        <LineChart className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
        <span className="hidden xs:inline">Combinado</span>
      </Button>
    </div>
  );

  const MetricSelector = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-6 sm:h-8 text-[10px] sm:text-xs w-[80px] sm:w-[120px] bg-secondary/50 border-0">
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
    const { isMobile, xAxisFontSize, yAxisFontSize, chartMargins, legendWrapperStyle, strokeWidth, barRadius } = responsiveConfig;
    const dataToRender = isMobile ? displayData : chartData;
    const margins = isMobile ? chartMargins : { top: 10, right: 30, left: 0, bottom: 0 };
    
    if (chartType === 'area') {
      return (
        <AreaChart data={dataToRender} margin={margins}>
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
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={xAxisFontSize} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={isMobile ? 15 : 20} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={yAxisFontSize} tickLine={false} axisLine={false} tickFormatter={primary.format} width={isMobile ? 40 : 60} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={yAxisFontSize} tickLine={false} axisLine={false} tickFormatter={secondary.format} width={isMobile ? 35 : 50} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendWrapperStyle} />
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} name={primary.label} stroke={primary.color} strokeWidth={strokeWidth} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Area yAxisId="right" type="monotone" dataKey={secondaryMetric} name={secondary.label} stroke={secondary.color} strokeWidth={strokeWidth} fill={`url(#${gradientId2})`} animationDuration={800} />
        </AreaChart>
      );
    } else if (chartType === 'bar') {
      return (
        <BarChart data={dataToRender} margin={margins}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={xAxisFontSize} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={isMobile ? 15 : 20} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={yAxisFontSize} tickLine={false} axisLine={false} tickFormatter={primary.format} width={isMobile ? 40 : 60} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={yAxisFontSize} tickLine={false} axisLine={false} tickFormatter={secondary.format} width={isMobile ? 35 : 50} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendWrapperStyle} />
          <Bar yAxisId="left" dataKey={primaryMetric} name={primary.label} fill={primary.color} radius={barRadius} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={secondary.color} radius={barRadius} animationDuration={800} />
        </BarChart>
      );
    } else {
      return (
        <ComposedChart data={dataToRender} margin={margins}>
          <defs>
            <linearGradient id={gradientId1} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primary.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={primary.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={xAxisFontSize} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={isMobile ? 15 : 20} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={yAxisFontSize} tickLine={false} axisLine={false} tickFormatter={primary.format} width={isMobile ? 40 : 60} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={yAxisFontSize} tickLine={false} axisLine={false} tickFormatter={secondary.format} width={isMobile ? 35 : 50} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendWrapperStyle} />
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} name={primary.label} stroke={primary.color} strokeWidth={strokeWidth} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={secondary.color} radius={barRadius} opacity={0.8} animationDuration={800} />
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

  // displayData is now defined above, before the early return

  const chartHeight = isFullscreen ? 400 : (responsiveConfig.isMobile ? 220 : 320);

  const ChartContent = ({ fullscreen = false }: { fullscreen?: boolean }) => (
    <div className={cn(fullscreen ? 'h-[400px]' : `h-[${chartHeight}px]`)} style={{ height: fullscreen ? 400 : chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      <div className={cn('glass-card p-3 sm:p-6 transition-all duration-300', className)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-6 gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
            <h3 className="text-sm sm:text-lg font-semibold">
              {shouldAggregateByMonth ? 'Evolução Mensal' : 'Evolução Diária'}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <MetricSelector value={primaryMetric} onChange={setPrimaryMetric} exclude={secondaryMetric} />
            <span className="text-muted-foreground text-[10px] sm:text-xs">vs</span>
            <MetricSelector value={secondaryMetric} onChange={setSecondaryMetric} exclude={primaryMetric} />
            <div className="hidden sm:block">
              <ChartTypeSelector value={chartType} onChange={setChartType} />
            </div>
            {/* Fullscreen button for mobile */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 sm:ml-2"
              onClick={() => setIsFullscreen(true)}
              title="Expandir gráfico"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <ChartContent />
      </div>

      {/* Fullscreen Chart - Simple Sheet from bottom */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                {shouldAggregateByMonth ? 'Evolução Mensal' : 'Evolução Diária'}
              </h3>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-center gap-2 p-3 border-b border-border flex-wrap">
            <MetricSelector value={primaryMetric} onChange={setPrimaryMetric} exclude={secondaryMetric} />
            <span className="text-muted-foreground text-xs">vs</span>
            <MetricSelector value={secondaryMetric} onChange={setSecondaryMetric} exclude={primaryMetric} />
            <ChartTypeSelector value={chartType} onChange={setChartType} />
          </div>
          
          {/* Chart - full remaining height */}
          <div className="p-3" style={{ height: 'calc(100dvh - 120px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}