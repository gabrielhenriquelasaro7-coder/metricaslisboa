import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, ArrowRight, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
interface Metrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  totalSalesConversions?: number; // Purchases (for infoproduto)
  totalLeadsConversions?: number; // Leads
  totalInitiateCheckout?: number; // Initiate Checkout
  totalProfileVisits?: number; // Profile visits (for top of funnel)
  ctr: number;
  cpm: number;
  cpc: number;
  cpa: number;
  roas: number;
}
interface PeriodComparisonProps {
  currentMetrics: Metrics;
  previousMetrics: Metrics | null;
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | 'custom' | 'infoproduto' | null;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
  currency?: string;
  resultMetrics?: string[]; // For custom business model
  resultMetricsLabels?: Record<string, string>; // Labels for custom metrics
  hiddenMetrics?: string[]; // Array of hidden metric keys (triggers re-render on change)
}
interface ComparisonItemProps {
  label: string;
  current: string;
  previous?: string;
  change: number;
  isInverse?: boolean;
  tooltip?: string;
}
function ComparisonItem({
  label,
  current,
  previous,
  change,
  isInverse = false,
  tooltip
}: ComparisonItemProps) {
  const isPositive = isInverse ? change < 0 : change > 0;
  const isNegative = isInverse ? change > 0 : change < 0;
  const isNeutral = change === 0 || isNaN(change);

  // Calculate progress bar width (capped at 100%)
  const progressWidth = Math.min(Math.abs(change), 100);
  return <motion.div initial={{
    opacity: 0,
    y: 10
  }} animate={{
    opacity: 1,
    y: 0
  }} className="group relative p-2.5 sm:p-4 rounded-xl bg-card/80 border border-border/50 hover:border-border transition-all duration-300 overflow-hidden min-w-0">
      <div className="relative z-10 min-w-0">
        <div className="flex items-center justify-between mb-1 sm:mb-2 gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <p className="text-[10px] sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">{label}</p>
            {tooltip && <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>}
          </div>
          {/* Badge hidden on mobile, visible on sm+ */}
          <div className={cn('hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-300 border flex-shrink-0', isPositive && 'bg-metric-positive/15 text-metric-positive border-metric-positive/20', isNegative && 'bg-metric-negative/15 text-metric-negative border-metric-negative/20', isNeutral && 'bg-muted/50 text-muted-foreground border-muted/30')}>
            {isNeutral ? <Minus className="w-3 h-3" /> : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isNeutral ? '0%' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}</span>
          </div>
        </div>
        
        <p className="sm:text-xl font-bold transition-colors duration-300 truncate text-base">{current}</p>
        
        {previous && <p className="sm:text-xs text-muted-foreground mt-1 sm:mt-2 truncate text-xs">
            Anterior: {previous}
          </p>}
        
        {/* Mobile-only compact badge */}
        <div className={cn('sm:hidden flex items-center gap-0.5 mt-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium w-fit border', isPositive && 'bg-metric-positive/15 text-metric-positive border-metric-positive/20', isNegative && 'bg-metric-negative/15 text-metric-negative border-metric-negative/20', isNeutral && 'bg-muted/50 text-muted-foreground border-muted/30')}>
          {isNeutral ? <Minus className="w-2.5 h-2.5" /> : isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          <span>{isNeutral ? '0%' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}</span>
        </div>
      </div>
    </motion.div>;
}
export default function PeriodComparison({
  currentMetrics,
  previousMetrics,
  businessModel,
  currentPeriodLabel = 'Período Atual',
  previousPeriodLabel = 'Período Anterior',
  currency = 'BRL',
  resultMetrics,
  resultMetricsLabels,
  hiddenMetrics = []
}: PeriodComparisonProps) {
  // Helper to check if a metric should be shown (local function based on hiddenMetrics array)
  const shouldShowMetric = (metricKey: string) => !hiddenMetrics.includes(metricKey);
  const formatCurrencyValue = (value: number) => {
    const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  const formatNumber = (num: number) => {
    return num.toLocaleString('pt-BR');
  };
  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return (current - previous) / previous * 100;
  };
  const comparisons = useMemo(() => {
    if (!previousMetrics) return null;
    
    const items: Array<{
      label: string;
      current: string;
      previous: string;
      change: number;
      isInverse: boolean;
      tooltip?: string;
    }> = [];
    
    // Base metrics - only add if not hidden
    if (shouldShowMetric('spend')) {
      items.push({
        label: 'Gasto',
        current: formatCurrencyValue(currentMetrics.totalSpend),
        previous: formatCurrencyValue(previousMetrics.totalSpend),
        change: calculateChange(currentMetrics.totalSpend, previousMetrics.totalSpend),
        isInverse: false
      });
    }
    
    if (shouldShowMetric('impressions')) {
      items.push({
        label: 'Impressões',
        current: formatNumber(currentMetrics.totalImpressions),
        previous: formatNumber(previousMetrics.totalImpressions),
        change: calculateChange(currentMetrics.totalImpressions, previousMetrics.totalImpressions),
        isInverse: false
      });
    }
    
    if (shouldShowMetric('clicks')) {
      items.push({
        label: 'Cliques',
        current: formatNumber(currentMetrics.totalClicks),
        previous: formatNumber(previousMetrics.totalClicks),
        change: calculateChange(currentMetrics.totalClicks, previousMetrics.totalClicks),
        isInverse: false
      });
    }
    
    if (shouldShowMetric('ctr')) {
      items.push({
        label: 'CTR',
        current: `${currentMetrics.ctr.toFixed(2)}%`,
        previous: `${previousMetrics.ctr.toFixed(2)}%`,
        change: calculateChange(currentMetrics.ctr, previousMetrics.ctr),
        isInverse: false
      });
    }
    
    if (shouldShowMetric('cpm')) {
      items.push({
        label: 'CPM',
        current: formatCurrencyValue(currentMetrics.cpm),
        previous: formatCurrencyValue(previousMetrics.cpm),
        change: calculateChange(currentMetrics.cpm, previousMetrics.cpm),
        isInverse: true
      });
    }
    
    if (shouldShowMetric('cpc')) {
      items.push({
        label: 'CPC',
        current: formatCurrencyValue(currentMetrics.cpc),
        previous: formatCurrencyValue(previousMetrics.cpc),
        change: calculateChange(currentMetrics.cpc, previousMetrics.cpc),
        isInverse: true
      });
    }

    // Add business-model specific metrics
    if (businessModel === 'ecommerce') {
      // Para ecommerce, "Compras" = purchases (totalSalesConversions)
      const currentPurchases = currentMetrics.totalSalesConversions ?? currentMetrics.totalConversions;
      const previousPurchases = previousMetrics.totalSalesConversions ?? previousMetrics.totalConversions;

      // CPA de compras = spend / purchases
      const currentCpaPurchases = currentPurchases > 0 ? currentMetrics.totalSpend / currentPurchases : 0;
      const previousCpaPurchases = previousPurchases > 0 ? previousMetrics.totalSpend / previousPurchases : 0;
      items.push({
        label: 'ROAS',
        current: `${currentMetrics.roas.toFixed(2)}x`,
        previous: `${previousMetrics.roas.toFixed(2)}x`,
        change: calculateChange(currentMetrics.roas, previousMetrics.roas),
        isInverse: false
      }, {
        label: 'Compras',
        current: formatNumber(currentPurchases),
        previous: formatNumber(previousPurchases),
        change: calculateChange(currentPurchases, previousPurchases),
        isInverse: false
      }, {
        label: 'Receita',
        current: formatCurrencyValue(currentMetrics.totalConversionValue),
        previous: formatCurrencyValue(previousMetrics.totalConversionValue),
        change: calculateChange(currentMetrics.totalConversionValue, previousMetrics.totalConversionValue),
        isInverse: false
      }, {
        label: 'CPA',
        current: formatCurrencyValue(currentCpaPurchases),
        previous: formatCurrencyValue(previousCpaPurchases),
        change: calculateChange(currentCpaPurchases, previousCpaPurchases),
        isInverse: true
      });
    } else if (businessModel === 'inside_sales') {
      items.push({
        label: 'Leads',
        current: formatNumber(currentMetrics.totalConversions),
        previous: formatNumber(previousMetrics.totalConversions),
        change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
        isInverse: false,
        tooltip: 'Pequenas diferenças de ±1-2 resultados em relação ao Gerenciador são normais devido ao timing de atribuição do Meta.'
      }, {
        label: 'CPL',
        current: formatCurrencyValue(currentMetrics.cpa),
        previous: formatCurrencyValue(previousMetrics.cpa),
        change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
        isInverse: true
      });
    } else if (businessModel === 'pdv') {
      items.push({
        label: 'Visitas',
        current: formatNumber(currentMetrics.totalConversions),
        previous: formatNumber(previousMetrics.totalConversions),
        change: calculateChange(currentMetrics.totalConversions, previousMetrics.totalConversions),
        isInverse: false
      }, {
        label: 'Custo/Visita',
        current: formatCurrencyValue(currentMetrics.cpa),
        previous: formatCurrencyValue(previousMetrics.cpa),
        change: calculateChange(currentMetrics.cpa, previousMetrics.cpa),
        isInverse: true
      });
    } else if (businessModel === 'infoproduto') {
      // Para infoproduto, "Vendas" = purchases (totalSalesConversions)
      // Se não tiver totalSalesConversions, fallback para totalConversions
      const currentSales = currentMetrics.totalSalesConversions ?? currentMetrics.totalConversions;
      const previousSales = previousMetrics.totalSalesConversions ?? previousMetrics.totalConversions;

      // CPA de vendas = spend / sales
      const currentCpaSales = currentSales > 0 ? currentMetrics.totalSpend / currentSales : 0;
      const previousCpaSales = previousSales > 0 ? previousMetrics.totalSpend / previousSales : 0;
      items.push({
        label: 'Vendas',
        current: formatNumber(currentSales),
        previous: formatNumber(previousSales),
        change: calculateChange(currentSales, previousSales),
        isInverse: false
      }, {
        label: 'Receita',
        current: formatCurrencyValue(currentMetrics.totalConversionValue),
        previous: formatCurrencyValue(previousMetrics.totalConversionValue),
        change: calculateChange(currentMetrics.totalConversionValue, previousMetrics.totalConversionValue),
        isInverse: false
      }, {
        label: 'ROAS',
        current: `${currentMetrics.roas.toFixed(2)}x`,
        previous: `${previousMetrics.roas.toFixed(2)}x`,
        change: calculateChange(currentMetrics.roas, previousMetrics.roas),
        isInverse: false
      }, {
        label: 'CPA',
        current: formatCurrencyValue(currentCpaSales),
        previous: formatCurrencyValue(previousCpaSales),
        change: calculateChange(currentCpaSales, previousCpaSales),
        isInverse: true
      });
    } else if (businessModel === 'custom') {
      // For custom, show separate cards for each result metric based on configuration
      // Default to showing leads, initiate_checkout, purchases, profile_visits separately (if they exist)
      const metricsToShow = resultMetrics || ['leads', 'initiate_checkout', 'purchases', 'profile_visits'];
      const labels: Record<string, string> = resultMetricsLabels || {
        leads: 'Leads',
        initiate_checkout: 'Initiate Checkout',
        purchases: 'Vendas',
        profile_visits: 'Visitas ao Perfil'
      };
      
      // Get current and previous values for each metric
      const getMetricValue = (m: Metrics, key: string): number => {
        switch (key) {
          case 'leads': return m.totalLeadsConversions || 0;
          case 'initiate_checkout': return m.totalInitiateCheckout || 0;
          case 'purchases': return m.totalSalesConversions || 0;
          case 'profile_visits': return m.totalProfileVisits || 0;
          default: return 0;
        }
      };

      for (const metric of metricsToShow) {
        const currentValue = getMetricValue(currentMetrics, metric);
        const previousValue = getMetricValue(previousMetrics, metric);
        
        // Only show if there's actual data (value > 0) - hide metrics with 0 results
        if (currentValue > 0 || previousValue > 0) {
          items.push({
            label: labels[metric] || metric,
            current: formatNumber(currentValue),
            previous: formatNumber(previousValue),
            change: calculateChange(currentValue, previousValue),
            isInverse: false
          });
        }
      }

      // Calculate CPL based on leads only - only if leads > 0
      const currentLeads = getMetricValue(currentMetrics, 'leads');
      const previousLeads = getMetricValue(previousMetrics, 'leads');
      
      if (currentLeads > 0 || previousLeads > 0) {
        const currentCpl = currentLeads > 0 ? currentMetrics.totalSpend / currentLeads : 0;
        const previousCpl = previousLeads > 0 ? previousMetrics.totalSpend / previousLeads : 0;

        items.push({
          label: 'CPL',
          current: formatCurrencyValue(currentCpl),
          previous: formatCurrencyValue(previousCpl),
          change: calculateChange(currentCpl, previousCpl),
          isInverse: true
        });
      }

      // Calculate CPV (Cost per Profile Visit) - only if profile visits > 0
      const currentProfileVisits = getMetricValue(currentMetrics, 'profile_visits');
      const previousProfileVisits = getMetricValue(previousMetrics, 'profile_visits');
      
      if (currentProfileVisits > 0 || previousProfileVisits > 0) {
        const currentCpv = currentProfileVisits > 0 ? currentMetrics.totalSpend / currentProfileVisits : 0;
        const previousCpv = previousProfileVisits > 0 ? previousMetrics.totalSpend / previousProfileVisits : 0;

        items.push({
          label: 'CPV',
          current: formatCurrencyValue(currentCpv),
          previous: formatCurrencyValue(previousCpv),
          change: calculateChange(currentCpv, previousCpv),
          isInverse: true,
          tooltip: 'Custo por Visita ao Perfil'
        });
      }

      // Calculate Cost per Initiate Checkout - only if IC > 0
      const currentIC = getMetricValue(currentMetrics, 'initiate_checkout');
      const previousIC = getMetricValue(previousMetrics, 'initiate_checkout');
      
      if (currentIC > 0 || previousIC > 0) {
        const currentCpic = currentIC > 0 ? currentMetrics.totalSpend / currentIC : 0;
        const previousCpic = previousIC > 0 ? previousMetrics.totalSpend / previousIC : 0;

        items.push({
          label: 'Custo/Init. Checkout',
          current: formatCurrencyValue(currentCpic),
          previous: formatCurrencyValue(previousCpic),
          change: calculateChange(currentCpic, previousCpic),
          isInverse: true
        });
      }

      // Calculate CPP (Cost per Purchase) only if there are purchases
      const currentPurchases = getMetricValue(currentMetrics, 'purchases');
      const previousPurchases = getMetricValue(previousMetrics, 'purchases');
      
      if (currentPurchases > 0 || previousPurchases > 0) {
        const currentCpp = currentPurchases > 0 ? currentMetrics.totalSpend / currentPurchases : 0;
        const previousCpp = previousPurchases > 0 ? previousMetrics.totalSpend / previousPurchases : 0;

        items.push({
          label: 'CPP',
          current: formatCurrencyValue(currentCpp),
          previous: formatCurrencyValue(previousCpp),
          change: calculateChange(currentCpp, previousCpp),
          isInverse: true
        });
      }
    }
    return items;
  }, [currentMetrics, previousMetrics, businessModel, resultMetrics, resultMetricsLabels, hiddenMetrics]);

  // Check if previous period has no data (all zeros)
  const hasPreviousData = previousMetrics && (previousMetrics.totalSpend > 0 || previousMetrics.totalImpressions > 0 || previousMetrics.totalClicks > 0);
  if (!previousMetrics || !comparisons) {
    return <div className="glass-card p-6 text-center text-muted-foreground">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Selecione um período para ver a comparação com o período anterior.</p>
      </div>;
  }
  if (!hasPreviousData) {
    // Show current period data without comparison when no previous data
    const currentOnlyItems: Array<{ label: string; value: string }> = [];
    
    if (shouldShowMetric('spend')) {
      currentOnlyItems.push({ label: 'Gasto', value: formatCurrencyValue(currentMetrics.totalSpend) });
    }
    if (shouldShowMetric('impressions')) {
      currentOnlyItems.push({ label: 'Impressões', value: formatNumber(currentMetrics.totalImpressions) });
    }
    if (shouldShowMetric('clicks')) {
      currentOnlyItems.push({ label: 'Cliques', value: formatNumber(currentMetrics.totalClicks) });
    }
    if (shouldShowMetric('ctr')) {
      currentOnlyItems.push({ label: 'CTR', value: `${currentMetrics.ctr.toFixed(2)}%` });
    }
    if (shouldShowMetric('cpm')) {
      currentOnlyItems.push({ label: 'CPM', value: formatCurrencyValue(currentMetrics.cpm) });
    }
    if (shouldShowMetric('cpc')) {
      currentOnlyItems.push({ label: 'CPC', value: formatCurrencyValue(currentMetrics.cpc) });
    }

    // Add business-model specific
    if (businessModel === 'ecommerce') {
      const purchases = currentMetrics.totalSalesConversions ?? currentMetrics.totalConversions;
      const cpaPurchases = purchases > 0 ? currentMetrics.totalSpend / purchases : 0;
      if (shouldShowMetric('roas')) currentOnlyItems.push({ label: 'ROAS', value: `${currentMetrics.roas.toFixed(2)}x` });
      if (shouldShowMetric('purchases')) currentOnlyItems.push({ label: 'Compras', value: formatNumber(purchases) });
      if (shouldShowMetric('conversion_value')) currentOnlyItems.push({ label: 'Receita', value: formatCurrencyValue(currentMetrics.totalConversionValue) });
      if (shouldShowMetric('cpa')) currentOnlyItems.push({ label: 'CPA', value: formatCurrencyValue(cpaPurchases) });
    } else if (businessModel === 'inside_sales') {
      if (shouldShowMetric('conversions')) currentOnlyItems.push({ label: 'Leads', value: formatNumber(currentMetrics.totalConversions) });
      if (shouldShowMetric('cpa')) currentOnlyItems.push({ label: 'CPL', value: formatCurrencyValue(currentMetrics.cpa) });
    } else if (businessModel === 'pdv') {
      if (shouldShowMetric('conversions')) currentOnlyItems.push({ label: 'Visitas', value: formatNumber(currentMetrics.totalConversions) });
      if (shouldShowMetric('cpa')) currentOnlyItems.push({ label: 'Custo/Visita', value: formatCurrencyValue(currentMetrics.cpa) });
    } else if (businessModel === 'infoproduto') {
      const sales = currentMetrics.totalSalesConversions ?? currentMetrics.totalConversions;
      const cpaSales = sales > 0 ? currentMetrics.totalSpend / sales : 0;
      if (shouldShowMetric('purchases')) currentOnlyItems.push({ label: 'Vendas', value: formatNumber(sales) });
      if (shouldShowMetric('conversion_value')) currentOnlyItems.push({ label: 'Receita', value: formatCurrencyValue(currentMetrics.totalConversionValue) });
      if (shouldShowMetric('roas')) currentOnlyItems.push({ label: 'ROAS', value: `${currentMetrics.roas.toFixed(2)}x` });
      if (shouldShowMetric('cpa')) currentOnlyItems.push({ label: 'CPA', value: formatCurrencyValue(cpaSales) });
    } else if (businessModel === 'custom') {
      // For custom, show separate metrics based on configuration
      const metricsToShow = resultMetrics || ['leads', 'initiate_checkout', 'purchases', 'profile_visits'];
      const labels: Record<string, string> = resultMetricsLabels || {
        leads: 'Leads',
        initiate_checkout: 'Initiate Checkout',
        purchases: 'Vendas',
        profile_visits: 'Visitas ao Perfil'
      };
      
      const getMetricValue = (key: string): number => {
        switch (key) {
          case 'leads': return currentMetrics.totalLeadsConversions || 0;
          case 'initiate_checkout': return currentMetrics.totalInitiateCheckout || 0;
          case 'purchases': return currentMetrics.totalSalesConversions || 0;
          case 'profile_visits': return currentMetrics.totalProfileVisits || 0;
          default: return 0;
        }
      };

      for (const metric of metricsToShow) {
        const value = getMetricValue(metric);
        // Only show metrics with value > 0 - hide metrics with 0 results
        if (value > 0 && shouldShowMetric(metric)) {
          currentOnlyItems.push({ label: labels[metric] || metric, value: formatNumber(value) });
        }
      }

      // CPL based on leads - only if leads > 0
      const leads = getMetricValue('leads');
      if (leads > 0 && shouldShowMetric('cpa')) {
        const cpl = currentMetrics.totalSpend / leads;
        currentOnlyItems.push({ label: 'CPL', value: formatCurrencyValue(cpl) });
      }

      // CPV based on profile visits - only if profile_visits > 0
      const profileVisits = getMetricValue('profile_visits');
      if (profileVisits > 0 && shouldShowMetric('profile_visits')) {
        const cpv = currentMetrics.totalSpend / profileVisits;
        currentOnlyItems.push({ label: 'CPV', value: formatCurrencyValue(cpv) });
      }

      // Cost per Initiate Checkout - only if IC > 0
      const ic = getMetricValue('initiate_checkout');
      if (ic > 0 && shouldShowMetric('initiate_checkout')) {
        const cpic = currentMetrics.totalSpend / ic;
        currentOnlyItems.push({ label: 'Custo/Init. Checkout', value: formatCurrencyValue(cpic) });
      }

      // CPP only if there are purchases
      const purchases = getMetricValue('purchases');
      if (purchases > 0 && shouldShowMetric('purchases')) {
        const cpp = currentMetrics.totalSpend / purchases;
        currentOnlyItems.push({ label: 'CPP', value: formatCurrencyValue(cpp) });
      }
    }
    return <div className="glass-card p-6">
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
          {currentOnlyItems.map(item => <div key={item.label} className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all hover:scale-[1.02]">
              <p className="text-sm text-muted-foreground mb-2">{item.label}</p>
              <p className="text-xl font-bold">{item.value}</p>
            </div>)}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Sem dados de período anterior para comparação
        </p>
      </div>;
  }
  return <div className="glass-card p-6">
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
        {comparisons.map(item => <ComparisonItem key={item.label} label={item.label} current={item.current} previous={item.previous} change={item.change} isInverse={item.isInverse} tooltip={item.tooltip} />)}
      </div>
    </div>;
}