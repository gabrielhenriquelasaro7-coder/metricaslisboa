import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
}

interface ComparisonItemProps {
  label: string;
  current: string;
  change: number;
  isInverse?: boolean; // For metrics where lower is better (CPA, CPC, CPM)
}

function ComparisonItem({ label, current, change, isInverse = false }: ComparisonItemProps) {
  const isPositive = isInverse ? change < 0 : change > 0;
  const isNegative = isInverse ? change > 0 : change < 0;
  const isNeutral = change === 0 || isNaN(change);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{current}</p>
      </div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-sm font-medium',
          isPositive && 'bg-metric-positive/20 text-metric-positive',
          isNegative && 'bg-metric-negative/20 text-metric-negative',
          isNeutral && 'bg-muted text-muted-foreground'
        )}
      >
        {isNeutral ? (
          <Minus className="w-4 h-4" />
        ) : isPositive ? (
          <TrendingUp className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
        <span>{isNeutral ? '0%' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}</span>
      </div>
    </div>
  );
}

export default function PeriodComparison({ currentMetrics, previousMetrics, businessModel }: PeriodComparisonProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
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
        change: calculateChange(currentMetrics.totalSpend, previousMetrics.totalSpend),
        isInverse: false,
      },
      {
        label: 'Impressões',
        current: formatNumber(currentMetrics.totalImpressions),
        change: calculateChange(currentMetrics.totalImpressions, previousMetrics.totalImpressions),
        isInverse: false,
      },
      {
        label: 'Cliques',
        current: formatNumber(currentMetrics.totalClicks),
        change: calculateChange(currentMetrics.totalClicks, previousMetrics.totalClicks),
        isInverse: false,
      },
      {
        label: 'CTR',
        current: `${currentMetrics.ctr.toFixed(2)}%`,
        change: calculateChange(currentMetrics.ctr, previousMetrics.ctr),
        isInverse: false,
      },
      {
        label: 'CPC',
        current: formatCurrency(currentMetrics.cpc),
        change: calculateChange(currentMetrics.cpc, previousMetrics.cpc),
        isInverse: true,
      },
      {
        label: 'CPM',
        current: formatCurrency(currentMetrics.cpm),
        change: calculateChange(currentMetrics.cpm, previousMetrics.cpm),
        isInverse: true,
      },
    ];

    // Add business-model specific metrics
    if (businessModel === 'ecommerce') {
      items.push(
        {
          label: 'ROAS',
          current: `${currentMetrics.roas.toFixed(2)}x`,
          change: calculateChange(currentMetrics.roas, previousMetrics.roas),
          isInverse: false,
        },
        {
          label: 'Compras',
          current: formatNumber(currentMetrics.totalConversions),
          change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
          isInverse: false,
        },
        {
          label: 'Receita',
          current: formatCurrency(currentMetrics.totalConversionValue),
          change: calculateChange(currentMetrics.totalConversionValue, previousMetrics.totalConversionValue),
          isInverse: false,
        },
        {
          label: 'CPA',
          current: formatCurrency(currentMetrics.cpa),
          change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
          isInverse: true,
        }
      );
    } else if (businessModel === 'inside_sales') {
      items.push(
        {
          label: 'Leads',
          current: formatNumber(currentMetrics.totalConversions),
          change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
          isInverse: false,
        },
        {
          label: 'CPL',
          current: formatCurrency(currentMetrics.cpa),
          change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
          isInverse: true,
        }
      );
    } else if (businessModel === 'pdv') {
      items.push(
        {
          label: 'Visitas',
          current: formatNumber(currentMetrics.totalConversions),
          change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
          isInverse: false,
        },
        {
          label: 'Custo por Visita',
          current: formatCurrency(currentMetrics.cpa),
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
        <p>Selecione um período para ver a comparação com o período anterior.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold mb-4">Comparação com Período Anterior</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {comparisons.map((item) => (
          <ComparisonItem
            key={item.label}
            label={item.label}
            current={item.current}
            change={item.change}
            isInverse={item.isInverse}
          />
        ))}
      </div>
    </div>
  );
}