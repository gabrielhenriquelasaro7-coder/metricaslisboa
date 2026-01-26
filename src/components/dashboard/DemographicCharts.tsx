import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DemographicInsights, DemographicData } from '@/hooks/useDemographicInsights';
import { Users, Smartphone, Globe, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemographicChartsProps {
  data: DemographicInsights | null;
  isLoading: boolean;
  className?: string;
  currency?: string;
}

const COLORS = [
  'hsl(220, 70%, 50%)',
  'hsl(142, 76%, 36%)',
  'hsl(280, 70%, 50%)',
  'hsl(30, 70%, 50%)',
  'hsl(340, 70%, 50%)',
  'hsl(180, 70%, 45%)',
  'hsl(0, 70%, 50%)',
  'hsl(50, 80%, 45%)',
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

function DemographicPieChart({ 
  data, 
  type, 
  title, 
  icon: Icon,
  currency = 'BRL',
  translations
}: { 
  data: DemographicData[]; 
  type: string;
  title: string; 
  icon: React.ElementType;
  currency?: string;
  translations: {
    male: string;
    female: string;
    unknown: string;
    noData: string;
    spend: string;
    percentage: string;
    impressions: string;
    clicks: string;
  };
}) {
  const formatCurrencyValue = createFormatCurrency(currency);
  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);

  const GENDER_LABELS: Record<string, string> = {
    male: translations.male,
    female: translations.female,
    unknown: translations.unknown,
  };

  const DEVICE_LABELS: Record<string, string> = {
    mobile: 'Mobile',
    desktop: 'Desktop',
    tablet: 'Tablet',
    unknown: translations.unknown,
  };

  const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    messenger: 'Messenger',
    audience_network: 'Audience Network',
    whatsapp: 'WhatsApp',
    unknown: translations.unknown,
  };

  function translateLabel(breakdownType: string, value: string): string {
    switch (breakdownType) {
      case 'gender':
        return GENDER_LABELS[value.toLowerCase()] || value;
      case 'device_platform':
        return DEVICE_LABELS[value.toLowerCase()] || value;
      case 'publisher_platform':
        return PLATFORM_LABELS[value.toLowerCase()] || value;
      default:
        return value;
    }
  }
  
  const chartData = data.map((d, i) => ({
    name: translateLabel(type, d.breakdown_value),
    value: d.spend,
    percent: totalSpend > 0 ? (d.spend / totalSpend * 100).toFixed(1) : 0,
    impressions: d.impressions,
    clicks: d.clicks,
    color: COLORS[i % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-2">{item.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{translations.spend}:</span>
            <span className="font-medium">{formatCurrencyValue(item.value)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{translations.percentage}:</span>
            <span className="font-medium">{item.percent}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{translations.impressions}:</span>
            <span className="font-medium">{formatNumber(item.impressions)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{translations.clicks}:</span>
            <span className="font-medium">{formatNumber(item.clicks)}</span>
          </div>
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="premium-card relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="p-4">
          <h4 className="text-base font-medium flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md premium-bar flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            {title}
          </h4>
          <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
            {translations.noData}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="p-3 sm:p-4">
        <h4 className="text-sm sm:text-base font-medium flex items-center gap-2 mb-3 sm:mb-4">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md premium-bar flex items-center justify-center flex-shrink-0">
            <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-foreground" />
          </div>
          <span className="truncate">{title}</span>
        </h4>
        <div className="flex flex-col xs:flex-row items-center gap-2 sm:gap-4">
          <div className="h-[100px] w-[100px] sm:h-[140px] sm:w-[140px] md:h-[160px] md:w-[160px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  dataKey="value"
                  strokeWidth={1}
                  stroke="hsl(var(--background))"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 w-full space-y-0.5 sm:space-y-1.5 min-w-0 overflow-hidden">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-[9px] xs:text-[10px] sm:text-xs md:text-sm gap-1">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-hidden">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-3 md:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate max-w-[60px] xs:max-w-[80px] sm:max-w-none">{item.name}</span>
                </div>
                <span className="text-muted-foreground flex-shrink-0 font-medium">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgeBarChart({ data, currency = 'BRL', translations }: { 
  data: DemographicData[]; 
  currency?: string;
  translations: {
    ageRange: string;
    noData: string;
    spend: string;
    conversions: string;
  };
}) {
  const formatCurrencyValue = createFormatCurrency(currency);
  const chartData = data.map((d) => ({
    name: d.breakdown_value,
    spend: d.spend,
    conversions: d.conversions,
  })).sort((a, b) => {
    const ageA = parseInt(a.name.split('-')[0]) || 0;
    const ageB = parseInt(b.name.split('-')[0]) || 0;
    return ageA - ageB;
  });

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {translations.ageRange}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          {translations.noData}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2 p-3 sm:p-4">
        <CardTitle className="text-sm sm:text-base font-medium flex items-center gap-2">
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{translations.ageRange}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
        <div className="h-[160px] sm:h-[180px] md:h-[200px] w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="name" 
                fontSize={9}
                tickLine={false} 
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                interval={0}
                angle={-45}
                textAnchor="end"
                height={40}
              />
              <YAxis 
                fontSize={9}
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}K` : value.toString()}
                stroke="hsl(var(--muted-foreground))"
                width={35}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'spend' ? formatCurrencyValue(value) : formatNumber(value),
                  name === 'spend' ? translations.spend : translations.conversions
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar 
                dataKey="spend" 
                name={translations.spend}
                fill="hsl(220, 70%, 50%)" 
                radius={[3, 3, 0, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function DemographicCharts({ data, isLoading, className, currency = 'BRL' }: DemographicChartsProps) {
  const { t } = useTranslation();

  const translations = {
    male: t('demographic.male'),
    female: t('demographic.female'),
    unknown: t('demographic.unknown'),
    noData: t('demographic.noData'),
    spend: t('demographic.spend'),
    percentage: t('demographic.percentage'),
    impressions: t('dashboard.impressions'),
    clicks: t('dashboard.clicks'),
    ageRange: t('demographic.ageRange'),
    conversions: t('dashboard.conversions'),
    title: t('demographic.title'),
    gender: t('demographic.gender'),
    device: t('demographic.device'),
    platform: t('demographic.platform'),
    noDataForPeriod: t('demographic.noDataForPeriod'),
    syncToView: t('demographic.syncToView'),
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
      <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
        <UserCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
        <span className="truncate">{translations.title}</span>
      </h3>
      
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DemographicPieChart
          data={data.gender}
          type="gender"
          title={translations.gender}
          icon={UserCircle2}
          currency={currency}
          translations={translations}
        />
        <div className="xs:col-span-2 md:col-span-1">
          <AgeBarChart data={data.age} currency={currency} translations={translations} />
        </div>
        <DemographicPieChart
          data={data.device_platform}
          type="device_platform"
          title={translations.device}
          icon={Smartphone}
          currency={currency}
          translations={translations}
        />
        <DemographicPieChart
          data={data.publisher_platform}
          type="publisher_platform"
          title={translations.platform}
          icon={Globe}
          currency={currency}
          translations={translations}
        />
      </div>
    </div>
  );
}