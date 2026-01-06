import { useMemo } from 'react';
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
  Line
} from 'recharts';
import { cn } from '@/lib/utils';
import { DailyMetric } from '@/hooks/useDailyMetrics';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyEvolutionChartProps {
  data: DailyMetric[];
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  className?: string;
  currency?: string;
}

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

export default function DailyEvolutionChart({ 
  data, 
  businessModel,
  className,
  currency = 'BRL'
}: DailyEvolutionChartProps) {
  const isEcommerce = businessModel === 'ecommerce';
  
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
    
    console.log(`[DailyEvolutionChart] Data length: ${data.length}, Days span: ${daysDiff}, shouldAggregate: ${data.length > 60 || daysDiff > 60}`);
    
    return daysDiff > 60;
  }, [data]);
  
  const chartData = useMemo(() => {
    // If too many data points, aggregate by month
    const processedData = shouldAggregateByMonth ? aggregateByMonth(data) : data;
    
    return processedData.map(d => {
      // For monthly data, the date is already in 'yyyy-MM' format
      const isMonthly = d.date.length === 7; // 'yyyy-MM' = 7 chars
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
      };
    });
  }, [data, shouldAggregateByMonth]);

  const formatCurrency = (value: number) => {
    const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  if (data.length === 0) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4">Evolução Diária</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Sem dados para o período selecionado
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-card p-6', className)}>
      <h3 className="text-lg font-semibold mb-4">
        {shouldAggregateByMonth ? 'Evolução Mensal' : 'Evolução Diária'} - {isEcommerce ? 'Gasto vs Receita' : 'Gasto vs Leads'}
      </h3>
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="left"
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span className="text-sm">{value}</span>}
            />
            
            {/* Gasto */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="spend"
              name="Gasto"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#gradientSpend)"
            />
            
            {/* Receita (E-commerce) ou Conversões como linha */}
            {isEcommerce ? (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Receita"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fill="url(#gradientRevenue)"
              />
            ) : (
              <Bar
                yAxisId="right"
                dataKey="conversions"
                name="Leads"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
            )}
            
            {/* ROAS ou CPL como linha secundária */}
            {isEcommerce && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="roas"
                name="ROAS"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
