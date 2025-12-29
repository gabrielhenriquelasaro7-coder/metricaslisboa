import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { BarChart2, LineChart, TrendingUp, Settings2, Pencil } from 'lucide-react';
import { ChartCustomizationDialog } from './ChartCustomizationDialog';
import { useChartPreferences, ChartPreference } from '@/hooks/useChartPreferences';

type ChartType = 'area' | 'bar' | 'composed';

interface MetricOption {
  key: string;
  label: string;
  format: (v: number) => string;
  color: string;
}

interface CustomizableChartProps {
  chartKey: string;
  data: DailyMetric[];
  defaultTitle: string;
  defaultPrimaryMetric: string;
  defaultSecondaryMetric: string;
  defaultChartType?: ChartType;
  className?: string;
}

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

const formatPercent = (value: number) => `${value.toFixed(2)}%`;
const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;

const DEFAULT_METRIC_OPTIONS: MetricOption[] = [
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

export function CustomizableChart({
  chartKey,
  data,
  defaultTitle,
  defaultPrimaryMetric,
  defaultSecondaryMetric,
  defaultChartType = 'composed',
  className,
}: CustomizableChartProps) {
  const { getPreference, savePreference, isLoading: prefsLoading } = useChartPreferences();
  const savedPref = getPreference(chartKey);

  const [chartType, setChartType] = useState<ChartType>(
    (savedPref?.chart_type as ChartType) || defaultChartType
  );
  const [primaryMetric, setPrimaryMetric] = useState(
    savedPref?.primary_metric || defaultPrimaryMetric
  );
  const [secondaryMetric, setSecondaryMetric] = useState(
    savedPref?.secondary_metric || defaultSecondaryMetric
  );
  const [customName, setCustomName] = useState(savedPref?.custom_name || '');
  const [primaryColor, setPrimaryColor] = useState(
    savedPref?.primary_color || 'hsl(220, 70%, 50%)'
  );
  const [secondaryColor, setSecondaryColor] = useState(
    savedPref?.secondary_color || 'hsl(142, 76%, 36%)'
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // Update state when preferences load
  useEffect(() => {
    if (savedPref) {
      if (savedPref.chart_type) setChartType(savedPref.chart_type as ChartType);
      if (savedPref.primary_metric) setPrimaryMetric(savedPref.primary_metric);
      if (savedPref.secondary_metric) setSecondaryMetric(savedPref.secondary_metric);
      if (savedPref.custom_name) setCustomName(savedPref.custom_name);
      if (savedPref.primary_color) setPrimaryColor(savedPref.primary_color);
      if (savedPref.secondary_color) setSecondaryColor(savedPref.secondary_color);
    }
  }, [savedPref]);

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

  const getMetric = useCallback((key: string) => {
    return DEFAULT_METRIC_OPTIONS.find(m => m.key === key) || DEFAULT_METRIC_OPTIONS[0];
  }, []);

  const handleSaveCustomization = useCallback((name: string, pColor: string, sColor: string) => {
    setCustomName(name);
    setPrimaryColor(pColor);
    setSecondaryColor(sColor);
    
    savePreference(chartKey, {
      custom_name: name || null,
      primary_color: pColor,
      secondary_color: sColor,
      chart_type: chartType,
      primary_metric: primaryMetric,
      secondary_metric: secondaryMetric,
    });
  }, [chartKey, chartType, primaryMetric, secondaryMetric, savePreference]);

  const handleChartTypeChange = useCallback((newType: ChartType) => {
    setChartType(newType);
    savePreference(chartKey, {
      custom_name: customName || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      chart_type: newType,
      primary_metric: primaryMetric,
      secondary_metric: secondaryMetric,
    });
  }, [chartKey, customName, primaryColor, secondaryColor, primaryMetric, secondaryMetric, savePreference]);

  const handleMetricChange = useCallback((isPrimary: boolean, value: string) => {
    if (isPrimary) {
      setPrimaryMetric(value);
      savePreference(chartKey, {
        custom_name: customName || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        chart_type: chartType,
        primary_metric: value,
        secondary_metric: secondaryMetric,
      });
    } else {
      setSecondaryMetric(value);
      savePreference(chartKey, {
        custom_name: customName || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        chart_type: chartType,
        primary_metric: primaryMetric,
        secondary_metric: value,
      });
    }
  }, [chartKey, customName, primaryColor, secondaryColor, chartType, primaryMetric, secondaryMetric, savePreference]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const metric = DEFAULT_METRIC_OPTIONS.find(m => m.label === entry.name);
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

  const ChartTypeSelector = () => (
    <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
      <Button
        size="sm"
        variant={chartType === 'area' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => handleChartTypeChange('area')}
      >
        <TrendingUp className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={chartType === 'bar' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => handleChartTypeChange('bar')}
      >
        <BarChart2 className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={chartType === 'composed' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => handleChartTypeChange('composed')}
      >
        <LineChart className="w-3 h-3" />
      </Button>
    </div>
  );

  const MetricSelector = ({ value, onChange, exclude }: { 
    value: string; 
    onChange: (v: string) => void; 
    exclude?: string;
  }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs w-[110px] bg-secondary/50 border-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DEFAULT_METRIC_OPTIONS.filter(m => m.key !== exclude).map(metric => (
          <SelectItem key={metric.key} value={metric.key} className="text-xs">
            {metric.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const primary = getMetric(primaryMetric);
  const secondary = getMetric(secondaryMetric);
  const gradientId1 = `gradient-${chartKey}-primary`;
  const gradientId2 = `gradient-${chartKey}-secondary`;

  const renderChart = () => {
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
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} name={primary.label} stroke={primaryColor} strokeWidth={2} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Area yAxisId="right" type="monotone" dataKey={secondaryMetric} name={secondary.label} stroke={secondaryColor} strokeWidth={2} fill={`url(#${gradientId2})`} animationDuration={800} />
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
          <Bar yAxisId="left" dataKey={primaryMetric} name={primary.label} fill={primaryColor} radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={secondaryColor} radius={[4, 4, 0, 0]} animationDuration={800} />
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
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} name={primary.label} stroke={primaryColor} strokeWidth={2} fill={`url(#${gradientId1})`} animationDuration={800} />
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={secondaryColor} radius={[4, 4, 0, 0]} opacity={0.8} animationDuration={800} />
        </ComposedChart>
      );
    }
  };

  const displayTitle = customName || defaultTitle;

  return (
    <>
      <div className={cn('glass-card p-6 transition-all duration-300 hover:shadow-lg', className)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{displayTitle}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setDialogOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MetricSelector 
              value={primaryMetric} 
              onChange={(v) => handleMetricChange(true, v)} 
              exclude={secondaryMetric} 
            />
            <span className="text-muted-foreground text-xs">vs</span>
            <MetricSelector 
              value={secondaryMetric} 
              onChange={(v) => handleMetricChange(false, v)} 
              exclude={primaryMetric} 
            />
            <ChartTypeSelector />
          </div>
        </div>
        <div className="h-[280px]">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Sem dados para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <ChartCustomizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        chartName={customName || defaultTitle}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        onSave={handleSaveCustomization}
      />
    </>
  );
}
