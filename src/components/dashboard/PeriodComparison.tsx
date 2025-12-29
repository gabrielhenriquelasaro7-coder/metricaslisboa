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
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
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

  return (
    <div className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            isPositive && 'bg-metric-positive/20 text-metric-positive',
            isNegative && 'bg-metric-negative/20 text-metric-negative',
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
      <p className="text-xl font-bold">{current}</p>
      {previous && (
        <p className="text-xs text-muted-foreground mt-1">
          Anterior: {previous}
        </p>
      )}
    </div>
  );
}

export default function PeriodComparison({ 
  currentMetrics, 
  previousMetrics, 
  businessModel,
  currentPeriodLabel = 'Período Atual',
  previousPeriodLabel = 'Período Anterior'
}: PeriodComparisonProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
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
        current: formatCurrency(currentMetrics.totalSpend),
        previous: formatCurrency(previousMetrics.totalSpend),
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
          current: formatCurrency(currentMetrics.totalConversionValue),
          previous: formatCurrency(previousMetrics.totalConversionValue),
          change: calculateChange(currentMetrics.totalConversionValue, previousMetrics.totalConversionValue),
          isInverse: false,
        },
        {
          label: 'CPA',
          current: formatCurrency(currentMetrics.cpa),
          previous: formatCurrency(previousMetrics.cpa),
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
          current: formatCurrency(currentMetrics.cpa),
          previous: formatCurrency(previousMetrics.cpa),
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
          current: formatCurrency(currentMetrics.cpa),
          previous: formatCurrency(previousMetrics.cpa),
          change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
          isInverse: true,
        }
      );
    }

    return items;
  }, [currentMetrics, previousMetrics, businessModel]);

  if (!previousMetrics || !comparisons) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Selecione um período para ver a comparação com o período anterior.</p>
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