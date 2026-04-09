import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  LineChart as RechartsLineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Bar,
  BarChart,
  ScatterChart,
  Scatter,
  ZAxis,
  LabelList
} from 'recharts';
import { cn } from '@/lib/utils';
import { DailyMetric } from '@/hooks/useDailyMetrics';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart2, LineChart, TrendingUp, Settings2, Pencil, Circle, Maximize2, X, Filter } from 'lucide-react';
import { ChartCustomizationDialog } from './ChartCustomizationDialog';
import { useChartPreferences, ChartPreference } from '@/hooks/useChartPreferences';
import { useChartResponsive } from '@/hooks/useChartResponsive';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type ChartType = 'line' | 'bar' | 'composed' | 'scatter';

interface MetricOption {
  key: string;
  label: string;
  format: (v: number) => string;
  color: string;
}

interface CampaignOption {
  id: string;
  name: string;
}

interface CustomizableChartProps {
  chartKey: string;
  data: DailyMetric[];
  defaultTitle: string;
  defaultPrimaryMetric: string;
  defaultSecondaryMetric: string;
  defaultChartType?: ChartType;
  className?: string;
  currency?: string;
  projectId?: string;
}

const formatNumber = (value: number) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toLocaleString('pt-BR');
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;
const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;

// Aggregate data by month for long periods
const aggregateByMonth = (data: DailyMetric[]): DailyMetric[] => {
  const monthlyMap = new Map<string, DailyMetric>();
  
  data.forEach(d => {
    const monthKey = d.date.substring(0, 7); // 'yyyy-MM'
    const existing = monthlyMap.get(monthKey);
    
    if (existing) {
      existing.spend += d.spend;
      existing.impressions += d.impressions;
      existing.clicks += d.clicks;
      existing.reach += d.reach;
      existing.conversions += d.conversions;
      existing.conversion_value += d.conversion_value;
    } else {
      monthlyMap.set(monthKey, {
        date: monthKey,
        spend: d.spend,
        impressions: d.impressions,
        clicks: d.clicks,
        reach: d.reach,
        conversions: d.conversions,
        conversion_value: d.conversion_value,
        messaging_replies: d.messaging_replies,
        profile_visits: d.profile_visits,
        leads_conversions: d.leads_conversions || 0,
        sales_conversions: d.sales_conversions || 0,
        initiate_checkout_conversions: d.initiate_checkout_conversions || 0,
        ctr: 0,
        cpm: 0,
        cpc: 0,
        roas: 0,
        cpa: 0,
        cvr_leads: 0,
        cvr_sales: 0,
      });
    }
  });
  
  // Recalculate derived metrics
  return Array.from(monthlyMap.values()).map(m => ({
    ...m,
    ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
    cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
    cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
    roas: m.spend > 0 ? m.conversion_value / m.spend : 0,
    cpa: m.conversions > 0 ? m.spend / m.conversions : 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
};

const createMetricOptions = (currency: string = 'BRL'): MetricOption[] => {
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  const formatCurrency = (value: number) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return [
    { key: 'spend', label: 'Gasto', format: formatCurrency, color: 'hsl(var(--chart-1))' },
    { key: 'conversions', label: 'Conversões', format: formatNumber, color: 'hsl(var(--metric-positive))' },
    { key: 'revenue', label: 'Receita', format: formatCurrency, color: 'hsl(var(--metric-positive))' },
    { key: 'impressions', label: 'Impressões', format: formatNumber, color: 'hsl(var(--chart-2))' },
    { key: 'clicks', label: 'Cliques', format: formatNumber, color: 'hsl(var(--chart-3))' },
    { key: 'reach', label: 'Alcance', format: formatNumber, color: 'hsl(var(--chart-4))' },
    { key: 'ctr', label: 'CTR', format: formatPercent, color: 'hsl(var(--chart-5))' },
    { key: 'cpc', label: 'CPC', format: formatCurrency, color: 'hsl(280, 70%, 50%)' },
    { key: 'cpm', label: 'CPM', format: formatCurrency, color: 'hsl(200, 70%, 50%)' },
    { key: 'cpl', label: 'CPL/CPA', format: formatCurrency, color: 'hsl(30, 70%, 50%)' },
    { key: 'roas', label: 'ROAS', format: formatMultiplier, color: 'hsl(var(--metric-positive))' },
    { key: 'frequency', label: 'Frequência', format: (v) => v.toFixed(2), color: 'hsl(var(--muted-foreground))' },
    // Comparative keys for Meta vs Google
    { key: 'meta_spend', label: 'Meta Gasto', format: formatCurrency, color: 'hsl(221, 83%, 53%)' },
    { key: 'google_spend', label: 'Google Gasto', format: formatCurrency, color: 'hsl(45, 93%, 47%)' },
    { key: 'meta_conversions', label: 'Meta Conv.', format: formatNumber, color: 'hsl(221, 83%, 53%)' },
    { key: 'google_conversions', label: 'Google Conv.', format: formatNumber, color: 'hsl(45, 93%, 47%)' },
  ];
};

export function CustomizableChart({
  chartKey,
  data,
  defaultTitle,
  defaultPrimaryMetric,
  defaultSecondaryMetric,
  defaultChartType = 'composed',
  className,
  currency = 'BRL',
  projectId,
}: CustomizableChartProps) {
  const DEFAULT_METRIC_OPTIONS = useMemo(() => createMetricOptions(currency), [currency]);
  const { getPreference, savePreference, isLoading: prefsLoading } = useChartPreferences();
  const savedPref = getPreference(chartKey);

  // Campaign filter state
  const [availableCampaigns, setAvailableCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<DailyMetric[] | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignFilterOpen, setCampaignFilterOpen] = useState(false);

  // Load available campaigns when projectId is provided
  useEffect(() => {
    if (!projectId) return;
    const loadCampaigns = async () => {
      // Query distinct campaigns from ads_daily_metrics
      const { data: metaCampaigns } = await supabase
        .from('ads_daily_metrics')
        .select('campaign_id, campaign_name')
        .eq('project_id', projectId)
        .order('campaign_name');

      const { data: googleCampaigns } = await supabase
        .from('google_ads_daily_metrics')
        .select('campaign_id, campaign_name')
        .eq('project_id', projectId)
        .order('campaign_name');

      const campaignMap = new Map<string, string>();
      metaCampaigns?.forEach(c => campaignMap.set(c.campaign_id, c.campaign_name));
      googleCampaigns?.forEach(c => campaignMap.set(c.campaign_id, c.campaign_name));
      
      const unique = Array.from(campaignMap.entries()).map(([id, name]) => ({ id, name }));
      unique.sort((a, b) => a.name.localeCompare(b.name));
      setAvailableCampaigns(unique);
    };
    loadCampaigns();
  }, [projectId]);

  // Fetch filtered data when campaigns are selected
  useEffect(() => {
    if (selectedCampaigns.length === 0) {
      setFilteredData(null);
      return;
    }
    if (!projectId) return;

    const fetchFiltered = async () => {
      setLoadingCampaigns(true);
      
      // Get date range from current data
      if (data.length === 0) { setLoadingCampaigns(false); return; }
      const minDate = data[0].date;
      const maxDate = data[data.length - 1].date;

      // Query Meta
      const { data: metaRows } = await supabase
        .from('ads_daily_metrics')
        .select('date, spend, impressions, clicks, reach, conversions, conversion_value, messaging_replies, profile_visits')
        .eq('project_id', projectId)
        .in('campaign_id', selectedCampaigns)
        .gte('date', minDate)
        .lte('date', maxDate);

      // Query Google
      const { data: googleRows } = await supabase
        .from('google_ads_daily_metrics')
        .select('date, spend, impressions, clicks, conversions, conversion_value')
        .eq('project_id', projectId)
        .in('campaign_id', selectedCampaigns)
        .gte('date', minDate)
        .lte('date', maxDate);

      // Aggregate by date
      const dateMap = new Map<string, DailyMetric>();
      
      const addRow = (row: any) => {
        const existing = dateMap.get(row.date);
        if (existing) {
          existing.spend += row.spend || 0;
          existing.impressions += row.impressions || 0;
          existing.clicks += row.clicks || 0;
          existing.reach += row.reach || 0;
          existing.conversions += row.conversions || 0;
          existing.conversion_value += row.conversion_value || 0;
        } else {
          dateMap.set(row.date, {
            date: row.date,
            spend: row.spend || 0,
            impressions: row.impressions || 0,
            clicks: row.clicks || 0,
            reach: row.reach || 0,
            conversions: row.conversions || 0,
            conversion_value: row.conversion_value || 0,
            messaging_replies: row.messaging_replies || 0,
            profile_visits: row.profile_visits || 0,
            leads_conversions: 0,
            sales_conversions: 0,
            initiate_checkout_conversions: 0,
            ctr: 0, cpm: 0, cpc: 0, roas: 0, cpa: 0, cvr_leads: 0, cvr_sales: 0,
          });
        }
      };

      metaRows?.forEach(addRow);
      googleRows?.forEach(addRow);

      // Recalculate derived metrics
      const result = Array.from(dateMap.values()).map(m => ({
        ...m,
        ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
        cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
        cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
        roas: m.spend > 0 ? m.conversion_value / m.spend : 0,
        cpa: m.conversions > 0 ? m.spend / m.conversions : 0,
      })).sort((a, b) => a.date.localeCompare(b.date));

      setFilteredData(result);
      setLoadingCampaigns(false);
    };

    fetchFiltered();
  }, [selectedCampaigns, projectId, data]);

  const toggleCampaign = useCallback((campaignId: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  }, []);

  const clearCampaignFilter = useCallback(() => {
    setSelectedCampaigns([]);
  }, []);

  // Use filtered data if campaigns are selected, otherwise use original data
  const activeData = filteredData || data;

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
    savedPref?.primary_color || 'hsl(150, 80%, 42%)'
  );
  const [secondaryColor, setSecondaryColor] = useState(
    savedPref?.secondary_color || 'hsl(200, 80%, 50%)'
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const responsiveConfig = useChartResponsive();

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

  // Determine if we should aggregate by month (more than 60 data points)
  const shouldAggregateByMonth = useMemo(() => {
    if (activeData.length === 0) return false;
    if (activeData.length > 60) return true;
    
    // Also check actual date span
    const firstDate = new Date(activeData[0].date);
    const lastDate = new Date(activeData[activeData.length - 1].date);
    const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff > 60;
  }, [activeData]);

  const chartData = useMemo(() => {
    const processedData = shouldAggregateByMonth ? aggregateByMonth(data) : data;
    
    return processedData.map(d => {
      // For monthly data, the date is in 'yyyy-MM' format
      const isMonthly = d.date.length === 7;
      const formattedDate = isMonthly 
        ? format(parseISO(`${d.date}-01`), 'MMM/yy', { locale: ptBR })
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
  }, [data, shouldAggregateByMonth]);

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
      <div className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl p-4 shadow-[0_8px_32px_hsl(0,0%,0%,0.4)]">
        <p className="font-semibold text-sm mb-3 text-primary">{label}</p>
        {payload.map((entry: any, index: number) => {
          const metric = DEFAULT_METRIC_OPTIONS.find(m => m.label === entry.name);
          return (
            <div key={index} className="flex items-center gap-2 text-sm py-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium text-foreground">
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
        variant={chartType === 'line' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => handleChartTypeChange('line')}
        title="Linha"
      >
        <TrendingUp className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={chartType === 'bar' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => handleChartTypeChange('bar')}
        title="Barras"
      >
        <BarChart2 className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={chartType === 'composed' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => handleChartTypeChange('composed')}
        title="Misto"
      >
        <LineChart className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant={chartType === 'scatter' ? 'default' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => handleChartTypeChange('scatter')}
        title="Pontilhado"
      >
        <Circle className="w-3 h-3" />
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
    if (chartType === 'line') {
      // LineChart with solid visible lines
      return (
        <RechartsLineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey={primaryMetric} 
            name={primary.label} 
            stroke={primaryColor} 
            strokeWidth={3}
            dot={{ r: 4, fill: primaryColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: primaryColor, stroke: 'hsl(var(--background))', strokeWidth: 3 }}
            animationDuration={800} 
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey={secondaryMetric} 
            name={secondary.label} 
            stroke={secondaryColor} 
            strokeWidth={3}
            dot={{ r: 4, fill: secondaryColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: secondaryColor, stroke: 'hsl(var(--background))', strokeWidth: 3 }}
            animationDuration={800} 
          />
        </RechartsLineChart>
      );
    } else if (chartType === 'bar') {
      const renderLabel = (props: any) => {
        const { x, y, width, value } = props;
        if (!shouldAggregateByMonth || !value) return null;
        return (
          <text x={x + width / 2} y={y - 5} fill="hsl(var(--foreground))" textAnchor="middle" fontSize={9}>
            {formatNumber(value)}
          </text>
        );
      };
      
      return (
        <BarChart data={chartData} margin={{ top: shouldAggregateByMonth ? 25 : 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            {/* Primary bar gradient - subtle depth */}
            <linearGradient id={gradientId1} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity={0.9} />
              <stop offset="100%" stopColor={primaryColor} stopOpacity={0.7} />
            </linearGradient>
            {/* Secondary bar gradient - subtle depth */}
            <linearGradient id={gradientId2} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={secondaryColor} stopOpacity={0.9} />
              <stop offset="100%" stopColor={secondaryColor} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar yAxisId="left" dataKey={primaryMetric} name={primary.label} fill={`url(#${gradientId1})`} radius={[4, 4, 0, 0]} animationDuration={800}>
            {shouldAggregateByMonth && <LabelList dataKey={primaryMetric} content={renderLabel} />}
          </Bar>
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={`url(#${gradientId2})`} radius={[4, 4, 0, 0]} animationDuration={800}>
            {shouldAggregateByMonth && <LabelList dataKey={secondaryMetric} content={renderLabel} />}
          </Bar>
        </BarChart>
      );
    } else if (chartType === 'scatter') {
      // SCATTER/DOT CHART - Dots with dashed connecting lines
      return (
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey={primaryMetric} 
            name={primary.label} 
            stroke={primaryColor}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 6, fill: primaryColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 9, fill: primaryColor, stroke: 'hsl(var(--background))', strokeWidth: 3 }}
            animationDuration={800} 
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey={secondaryMetric} 
            name={secondary.label} 
            stroke={secondaryColor}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 6, fill: secondaryColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 9, fill: secondaryColor, stroke: 'hsl(var(--background))', strokeWidth: 3 }}
            animationDuration={800} 
          />
        </ComposedChart>
      );
    } else {
      // Composed: Bar first, then Line on top
      const renderBarLabel = (props: any) => {
        const { x, y, width, value } = props;
        if (!shouldAggregateByMonth || !value) return null;
        return (
          <text x={x + width / 2} y={y - 5} fill="hsl(var(--foreground))" textAnchor="middle" fontSize={9}>
            {formatNumber(value)}
          </text>
        );
      };
      
      return (
        <ComposedChart data={chartData} margin={{ top: shouldAggregateByMonth ? 25 : 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            {/* Composed bar gradient - subtle depth */}
            <linearGradient id={`${gradientId2}-composed`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={secondaryColor} stopOpacity={0.9} />
              <stop offset="100%" stopColor={secondaryColor} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={primary.format} />
          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={secondary.format} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {/* Bar rendered FIRST so it's behind */}
          <Bar yAxisId="right" dataKey={secondaryMetric} name={secondary.label} fill={`url(#${gradientId2}-composed)`} radius={[4, 4, 0, 0]} animationDuration={800}>
            {shouldAggregateByMonth && <LabelList dataKey={secondaryMetric} content={renderBarLabel} />}
          </Bar>
          {/* Line rendered AFTER so it's on top */}
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey={primaryMetric} 
            name={primary.label} 
            stroke={primaryColor} 
            strokeWidth={2}
            dot={{ r: 4, fill: primaryColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: primaryColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            animationDuration={800} 
          />
        </ComposedChart>
      );
    }
  };

  const displayTitle = customName || defaultTitle;

  return (
    <>
      <div className={cn(
        'premium-card p-3 sm:p-6 transition-all duration-300 group',
        className
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-300">{displayTitle}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setDialogOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
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
            {responsiveConfig.isMobile && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setIsFullscreen(true)}
                title="Expandir gráfico"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            )}
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

      {/* Fullscreen Chart - Horizontal on mobile */}
      {isFullscreen && (
        <div 
          className="fixed z-50 bg-background flex flex-col"
          style={responsiveConfig.isMobile ? {
            top: '12px',
            left: 'calc(100% - 12px)',
            width: 'calc(100dvh - 24px)',
            height: 'calc(100vw - 24px)',
            transform: 'rotate(90deg)',
            transformOrigin: 'top left',
            borderRadius: '8px',
          } : {
            inset: 0,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{displayTitle}</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setDialogOpen(true)}
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
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
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 ml-1"
                onClick={() => setIsFullscreen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          {/* Chart - fills remaining space */}
          <div className="flex-1 p-2 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
