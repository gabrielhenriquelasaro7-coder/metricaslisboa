import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Metrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  ctr: number;
  cpm: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface PeriodComparisonProps {
  currentMetrics: Metrics;
  previousMetrics: Metrics | null;
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | 'custom' | null;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
  currency?: string;
}

interface ComparisonItemProps {
  label: string;
  current: string;
  previous?: string;
  change: number;
  isInverse?: boolean;
}

function ComparisonItem({ label, current, previous, change, isInverse = false }: ComparisonItemProps) {
  const isPositive = isInverse ? change < 0 : change > 0;
  const isNegative = isInverse ? change > 0 : change < 0;
  const isNeutral = change === 0 || isNaN(change);
  
  // Calculate progress bar width (capped at 100%)
  const progressWidth = Math.min(Math.abs(change), 100);

  return (
    <div className="group p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
      {/* Animated background gradient on hover */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
        isPositive && "bg-gradient-to-br from-metric-positive/5 to-transparent",
        isNegative && "bg-gradient-to-br from-metric-negative/5 to-transparent",
        isNeutral && "bg-gradient-to-br from-muted/10 to-transparent"
      )} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</p>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-300',
              isPositive && 'bg-metric-positive/20 text-metric-positive group-hover:bg-metric-positive/30 group-hover:shadow-[0_0_10px_hsl(var(--metric-positive)/0.3)]',
              isNegative && 'bg-metric-negative/20 text-metric-negative group-hover:bg-metric-negative/30 group-hover:shadow-[0_0_10px_hsl(var(--metric-negative)/0.3)]',
              isNeutral && 'bg-muted text-muted-foreground'
            )}
          >
            {isNeutral ? (
              <Minus className="w-3 h-3" />
            ) : isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{isNeutral ? '0%' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}</span>
          </div>
        </div>
        
        <p className="text-xl font-bold group-hover:text-primary transition-colors duration-300">{current}</p>
        
        {previous && (
          <p className="text-xs text-muted-foreground mt-2">
            Anterior: {previous}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PeriodComparison({ 
  currentMetrics, 
  previousMetrics, 
  businessModel,
  currentPeriodLabel = 'Período Atual',
  previousPeriodLabel = 'Período Anterior',
  currency = 'BRL'
}: PeriodComparisonProps) {
  const formatCurrencyValue = (value: number) => {
    const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const comparisons = useMemo(() => {
    if (!previousMetrics) return null;

    const items = [
      {
        label: 'Gasto',
        current: formatCurrencyValue(currentMetrics.totalSpend),
        previous: formatCurrencyValue(previousMetrics.totalSpend),
        change: calculateChange(currentMetrics.totalSpend, previousMetrics.totalSpend),
        isInverse: false,
      },
      {
        label: 'Impressões',
        current: formatNumber(currentMetrics.totalImpressions),
        previous: formatNumber(previousMetrics.totalImpressions),
        change: calculateChange(currentMetrics.totalImpressions, previousMetrics.totalImpressions),
        isInverse: false,
      },
      {
        label: 'Cliques',
        current: formatNumber(currentMetrics.totalClicks),
        previous: formatNumber(previousMetrics.totalClicks),
        change: calculateChange(currentMetrics.totalClicks, previousMetrics.totalClicks),
        isInverse: false,
      },
      {
        label: 'CTR',
        current: `${currentMetrics.ctr.toFixed(2)}%`,
        previous: `${previousMetrics.ctr.toFixed(2)}%`,
        change: calculateChange(currentMetrics.ctr, previousMetrics.ctr),
        isInverse: false,
      },
      {
        label: 'CPM',
        current: formatCurrencyValue(currentMetrics.cpm),
        previous: formatCurrencyValue(previousMetrics.cpm),
        change: calculateChange(currentMetrics.cpm, previousMetrics.cpm),
        isInverse: true,
      },
      {
        label: 'CPC',
        current: formatCurrencyValue(currentMetrics.cpc),
        previous: formatCurrencyValue(previousMetrics.cpc),
        change: calculateChange(currentMetrics.cpc, previousMetrics.cpc),
        isInverse: true,
      },
    ];

    // Add business-model specific metrics
    if (businessModel === 'ecommerce') {
      items.push(
        {
          label: 'ROAS',
          current: `${currentMetrics.roas.toFixed(2)}x`,
          previous: `${previousMetrics.roas.toFixed(2)}x`,
          change: calculateChange(currentMetrics.roas, previousMetrics.roas),
          isInverse: false,
        },
        {
          label: 'Compras',
          current: formatNumber(currentMetrics.totalConversions),
          previous: formatNumber(previousMetrics.totalConversions),
          change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
          isInverse: false,
        },
        {
          label: 'Receita',
          current: formatCurrencyValue(currentMetrics.totalConversionValue),
          previous: formatCurrencyValue(previousMetrics.totalConversionValue),
          change: calculateChange(currentMetrics.totalConversionValue, previousMetrics.totalConversionValue),
          isInverse: false,
        },
        {
          label: 'CPA',
          current: formatCurrencyValue(currentMetrics.cpa),
          previous: formatCurrencyValue(previousMetrics.cpa),
          change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
          isInverse: true,
        }
      );
    } else if (businessModel === 'inside_sales') {
      items.push(
        {
          label: 'Leads',
          current: formatNumber(currentMetrics.totalConversions),
          previous: formatNumber(previousMetrics.totalConversions),
          change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
          isInverse: false,
        },
        {
          label: 'CPL',
          current: formatCurrencyValue(currentMetrics.cpa),
          previous: formatCurrencyValue(previousMetrics.cpa),
          change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
          isInverse: true,
        }
      );
    } else if (businessModel === 'pdv') {
      items.push(
        {
          label: 'Visitas',
          current: formatNumber(currentMetrics.totalConversions),
          previous: formatNumber(previousMetrics.totalConversions),
          change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
          isInverse: false,
        },
        {
          label: 'Custo/Visita',
          current: formatCurrencyValue(currentMetrics.cpa),
          previous: formatCurrencyValue(previousMetrics.cpa),
          change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
          isInverse: true,
        }
      );
    } else if (businessModel === 'custom') {
      // For custom, show generic conversions and cost metrics
      items.push(
        {
          label: 'Conversões',
          current: formatNumber(currentMetrics.totalConversions),
          previous: formatNumber(previousMetrics.totalConversions),
          change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
          isInverse: false,
        },
        {
          label: 'CPA',
          current: formatCurrencyValue(currentMetrics.cpa),
          previous: formatCurrencyValue(previousMetrics.cpa),
          change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
          isInverse: true,
        }
      );
    }

    return items;
  }, [currentMetrics, previousMetrics, businessModel]);

  // Check if previous period has no data (all zeros)
  const hasPreviousData = previousMetrics && (
    previousMetrics.totalSpend > 0 || 
    previousMetrics.totalImpressions > 0 || 
    previousMetrics.totalClicks > 0
  );

  if (!previousMetrics || !comparisons) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Selecione um período para ver a comparação com o período anterior.</p>
      </div>
    );
  }

  if (!hasPreviousData) {
    // Show current period data without comparison when no previous data
    const currentOnlyItems = [
      { label: 'Gasto', value: formatCurrencyValue(currentMetrics.totalSpend) },
      { label: 'Impressões', value: formatNumber(currentMetrics.totalImpressions) },
      { label: 'Cliques', value: formatNumber(currentMetrics.totalClicks) },
      { label: 'CTR', value: `${currentMetrics.ctr.toFixed(2)}%` },
      { label: 'CPM', value: formatCurrencyValue(currentMetrics.cpm) },
      { label: 'CPC', value: formatCurrencyValue(currentMetrics.cpc) },
    ];

    // Add business-model specific
    if (businessModel === 'ecommerce') {
      currentOnlyItems.push(
        { label: 'ROAS', value: `${currentMetrics.roas.toFixed(2)}x` },
        { label: 'Compras', value: formatNumber(currentMetrics.totalConversions) },
        { label: 'Receita', value: formatCurrencyValue(currentMetrics.totalConversionValue) },
        { label: 'CPA', value: formatCurrencyValue(currentMetrics.cpa) }
      );
    } else if (businessModel === 'inside_sales') {
      currentOnlyItems.push(
        { label: 'Leads', value: formatNumber(currentMetrics.totalConversions) },
        { label: 'CPL', value: formatCurrencyValue(currentMetrics.cpa) }
      );
    } else if (businessModel === 'pdv') {
      currentOnlyItems.push(
        { label: 'Visitas', value: formatNumber(currentMetrics.totalConversions) },
        { label: 'Custo/Visita', value: formatCurrencyValue(currentMetrics.cpa) }
      );
    } else if (businessModel === 'custom') {
      currentOnlyItems.push(
        { label: 'Conversões', value: formatNumber(currentMetrics.totalConversions) },
        { label: 'CPA', value: formatCurrencyValue(currentMetrics.cpa) }
      );
    }

    return (
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold">Métricas do Período</h3>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-medium text-primary">{currentPeriodLabel}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentOnlyItems.map((item) => (
            <div key={item.label} className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all hover:scale-[1.02]">
              <p className="text-sm text-muted-foreground mb-2">{item.label}</p>
              <p className="text-xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Sem dados de período anterior para comparação
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h3 className="text-lg font-semibold">Comparação de Períodos</h3>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-medium text-primary">{currentPeriodLabel}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{previousPeriodLabel}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {comparisons.map((item) => (
          <ComparisonItem
            key={item.label}
            label={item.label}
            current={item.current}
            previous={item.previous}
            change={item.change}
            isInverse={item.isInverse}
          />
        ))}
      </div>
    </div>
  );
}