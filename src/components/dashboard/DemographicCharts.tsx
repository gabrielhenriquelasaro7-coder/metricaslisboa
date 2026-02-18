import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DemographicInsights, DemographicData } from '@/hooks/useDemographicInsights';
import { Users, Smartphone, Globe, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DemographicChartsProps {
  data: DemographicInsights | null;
  isLoading: boolean;
  className?: string;
  currency?: string;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--accent))',
];

const createFormatCurrency = (currency: string = 'BRL') => (value: number) => {
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toLocaleString('pt-BR');
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino', female: 'Feminino', unknown: 'N/D',
};
const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', unknown: 'N/D',
};
const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger',
  audience_network: 'Audience Net', whatsapp: 'WhatsApp', unknown: 'N/D',
};

function translateLabel(breakdownType: string, value: string): string {
  switch (breakdownType) {
    case 'gender': return GENDER_LABELS[value.toLowerCase()] || value;
    case 'device_platform': return DEVICE_LABELS[value.toLowerCase()] || value;
    case 'publisher_platform': return PLATFORM_LABELS[value.toLowerCase()] || value;
    default: return value;
  }
}

// Bar chart for age ranges
function AgeBarChart({ data, currency }: { data: DemographicData[]; currency: string }) {
  const formatCurrencyValue = createFormatCurrency(currency);
  const chartData = [...data]
    .sort((a, b) => {
      const ageA = parseInt(a.breakdown_value.split('-')[0]) || 0;
      const ageB = parseInt(b.breakdown_value.split('-')[0]) || 0;
      return ageA - ageB;
    })
    .map(d => ({
      name: d.breakdown_value,
      gasto: d.spend,
      clicks: d.clicks,
      conversions: d.conversions,
    }));

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 bg-secondary/30 border-b border-border">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" /> Faixa Etária
        </h3>
      </div>
      <div className="p-3">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              formatter={(value: any, name: string) => {
                if (name === 'gasto') return [formatCurrencyValue(value), 'Gasto'];
                return [formatNumber(value), name === 'clicks' ? 'Cliques' : 'Conversões'];
              }}
            />
            <Bar dataKey="gasto" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Pie chart for gender, device, platform
function DemoPieChart({ data, type, title, icon: Icon, currency }: {
  data: DemographicData[];
  type: string;
  title: string;
  icon: React.ElementType;
  currency: string;
}) {
  const formatCurrencyValue = createFormatCurrency(currency);
  const totalSpend = data.reduce((s, d) => s + d.spend, 0);
  const chartData = data.slice(0, 6).map((d, i) => ({
    name: translateLabel(type, d.breakdown_value),
    value: d.spend,
    pct: totalSpend > 0 ? ((d.spend / totalSpend) * 100).toFixed(1) : '0',
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (data.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 bg-secondary/30 border-b border-border">
          <h3 className="text-sm font-medium flex items-center gap-2"><Icon className="w-4 h-4" /> {title}</h3>
        </div>
        <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 bg-secondary/30 border-b border-border">
        <h3 className="text-sm font-medium flex items-center gap-2"><Icon className="w-4 h-4" /> {title}</h3>
      </div>
      <div className="p-3 flex items-center gap-2">
        <div style={{ width: 130, height: 130, flexShrink: 0 }}>
          <PieChart width={130} height={130}>
            <Pie data={chartData} cx={65} cy={65} innerRadius={30} outerRadius={58} dataKey="value" strokeWidth={2} stroke="hsl(var(--background))">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              formatter={(value: any) => [formatCurrencyValue(value), 'Gasto']}
            />
          </PieChart>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-foreground truncate">{item.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium shrink-0">{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemographicCharts({ data, isLoading, className, currency = 'BRL' }: DemographicChartsProps) {
  const { t } = useTranslation();

  const translations = {
    noData: t('demographic.noData'),
    noDataForPeriod: t('demographic.noDataForPeriod'),
    syncToView: t('demographic.syncToView'),
    title: t('demographic.title'),
  };

  if (isLoading) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-secondary/50 rounded w-1/3" />
          <div className="h-[200px] bg-secondary/30 rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCircle2 className="w-5 h-5" />
          {translations.title}
        </h3>
        <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
          <p>{translations.noData}</p>
          <p className="text-sm mt-1">{translations.syncToView}</p>
        </div>
      </div>
    );
  }

  const hasData =
    data.gender.length > 0 ||
    data.age.length > 0 ||
    data.device_platform.length > 0 ||
    data.publisher_platform.length > 0;

  if (!hasData) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCircle2 className="w-5 h-5" />
          {translations.title}
        </h3>
        <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
          <p>{translations.noDataForPeriod}</p>
          <p className="text-sm mt-1">{translations.syncToView}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 sm:space-y-6 overflow-hidden', className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Age - bar chart */}
        {data.age.length > 0 && (
          <AgeBarChart data={data.age} currency={currency} />
        )}
        {/* Gender - pie chart */}
        <DemoPieChart
          data={data.gender}
          type="gender"
          title="Gênero"
          icon={UserCircle2}
          currency={currency}
        />
        {/* Device - pie chart */}
        <DemoPieChart
          data={data.device_platform}
          type="device_platform"
          title="Dispositivo"
          icon={Smartphone}
          currency={currency}
        />
      </div>
      {data.publisher_platform.length > 0 && (
        <DemoPieChart
          data={data.publisher_platform}
          type="publisher_platform"
          title="Plataforma"
          icon={Globe}
          currency={currency}
        />
      )}
    </div>
  );
}
