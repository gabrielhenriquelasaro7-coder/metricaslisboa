import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DemographicInsights, DemographicData } from '@/hooks/useDemographicInsights';
import { Users, Smartphone, Globe, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemographicChartsProps {
  data: DemographicInsights | null;
  isLoading: boolean;
  className?: string;
  currency?: string;
}

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

const BAR_COLORS = [
  'bg-primary',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-accent',
  'bg-muted-foreground/50',
  'bg-secondary-foreground/30',
];

function DemographicBarList({ 
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
  translations: Record<string, string>;
}) {
  const formatCurrencyValue = createFormatCurrency(currency);
  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);

  const GENDER_LABELS: Record<string, string> = {
    male: translations.male || 'Masculino',
    female: translations.female || 'Feminino',
    unknown: translations.unknown || 'N/D',
  };

  const DEVICE_LABELS: Record<string, string> = {
    mobile: 'Mobile',
    desktop: 'Desktop',
    tablet: 'Tablet',
    unknown: translations.unknown || 'N/D',
  };

  const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    messenger: 'Messenger',
    audience_network: 'Audience Network',
    whatsapp: 'WhatsApp',
    unknown: translations.unknown || 'N/D',
  };

  function translateLabel(breakdownType: string, value: string): string {
    switch (breakdownType) {
      case 'gender': return GENDER_LABELS[value.toLowerCase()] || value;
      case 'device_platform': return DEVICE_LABELS[value.toLowerCase()] || value;
      case 'publisher_platform': return PLATFORM_LABELS[value.toLowerCase()] || value;
      default: return value;
    }
  }

  if (data.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 bg-secondary/30 border-b border-border">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Icon className="w-4 h-4" /> {title}
          </h3>
        </div>
        <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
          {translations.noData || 'Sem dados'}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 bg-secondary/30 border-b border-border">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Icon className="w-4 h-4" /> {title}
        </h3>
      </div>
      <div className="p-3 space-y-2.5">
        {data.map((d, i) => {
          const pct = totalSpend > 0 ? (d.spend / totalSpend) * 100 : 0;
          const label = translateLabel(type, d.breakdown_value);
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {formatCurrencyValue(d.spend)} · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all", BAR_COLORS[i % BAR_COLORS.length])} 
                  style={{ width: `${Math.max(pct, 1)}%` }} 
                />
              </div>
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                <span>{formatNumber(d.clicks)} cliques</span>
                <span>{formatNumber(d.conversions)} conv.</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <DemographicBarList
          data={data.age}
          type="age"
          title={translations.ageRange}
          icon={Users}
          currency={currency}
          translations={translations}
        />
        <DemographicBarList
          data={data.gender}
          type="gender"
          title={translations.gender}
          icon={UserCircle2}
          currency={currency}
          translations={translations}
        />
        <DemographicBarList
          data={data.device_platform}
          type="device_platform"
          title={translations.device}
          icon={Smartphone}
          currency={currency}
          translations={translations}
        />
      </div>
      {data.publisher_platform.length > 0 && (
        <DemographicBarList
          data={data.publisher_platform}
          type="publisher_platform"
          title={translations.platform}
          icon={Globe}
          currency={currency}
          translations={translations}
        />
      )}
    </div>
  );
}
