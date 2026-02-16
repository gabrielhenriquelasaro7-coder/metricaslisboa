import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Eye, Users, MousePointerClick, Percent, TrendingDown, Target, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useChartResponsive } from '@/hooks/useChartResponsive';

type FunnelMetricSet = 'default' | 'cost' | 'engagement';

interface FunnelChartProps {
  impressions: number;
  reach?: number;
  clicks: number;
  conversions: number;
  spend?: number;
  ctr?: number;
  cpc?: number;
  cpl?: number;
  cpm?: number;
  frequency?: number;
  conversionRate?: number;
  currency?: string;
  className?: string;
  campaignFilter?: 'all' | 'active' | 'paused';
  onCampaignFilterChange?: (filter: 'all' | 'active' | 'paused') => void;
}

interface FunnelStep {
  label: string;
  value: string;
  icon: React.ReactNode;
  widthPercent: number;
}

export function FunnelChart({
  impressions,
  reach = 0,
  clicks,
  conversions,
  spend = 0,
  ctr = 0,
  cpc = 0,
  cpl = 0,
  cpm = 0,
  frequency = 0,
  conversionRate = 0,
  currency = 'BRL',
  className,
  campaignFilter = 'all',
  onCampaignFilterChange,
}: FunnelChartProps) {
  const { t } = useTranslation();
  const responsive = useChartResponsive();
  const [metricSet, setMetricSet] = useState<FunnelMetricSet>('default');
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    if (responsive.isMobile && value >= 1000) {
      const symbol = currency === 'USD' ? '$' : 'R$';
      if (value >= 1000000) return symbol + (value / 1000000).toFixed(1) + 'M';
      if (value >= 1000) return symbol + (value / 1000).toFixed(0) + 'K';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const steps: FunnelStep[] = useMemo(() => {
    const allSteps = [
      { label: t('funnel.spend'), value: formatCurrency(spend), icon: <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, widthPercent: 100 },
      { label: t('funnel.impressions'), value: formatNumber(impressions), icon: <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, widthPercent: 85 },
      { label: t('funnel.reach'), value: formatNumber(reach), icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, widthPercent: 70 },
      { label: t('funnel.clicks'), value: formatNumber(clicks), icon: <MousePointerClick className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, widthPercent: 55 },
      { label: t('funnel.leads'), value: formatNumber(conversions), icon: <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, widthPercent: 40 },
    ];
    
    if (responsive.isMobile) {
      return allSteps.filter(step => 
        [t('funnel.spend'), t('funnel.impressions'), t('funnel.clicks'), t('funnel.leads')].includes(step.label)
      );
    }
    
    return allSteps;
  }, [spend, impressions, reach, clicks, conversions, currency, responsive.isMobile, t]);

  const bottomMetrics = useMemo(() => {
    const convRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(responsive.isMobile ? 1 : 2) : '0.00';
    
    if (metricSet === 'cost') {
      return [
        { label: t('metrics.cpc'), value: formatCurrency(cpc) },
        { label: t('metrics.cpl'), value: formatCurrency(cpl) },
        { label: t('metrics.cpm'), value: formatCurrency(cpm) },
        { label: 'CPR (Alcance)', value: reach > 0 ? formatCurrency(spend / reach) : formatCurrency(0) },
        { label: 'Custo/Imp.', value: impressions > 0 ? formatCurrency(spend / impressions) : formatCurrency(0) },
        { label: t('funnel.totalCost'), value: formatCurrency(spend), highlight: true },
      ];
    }
    
    if (metricSet === 'engagement') {
      return [
        { label: t('metrics.ctr'), value: `${ctr.toFixed(responsive.isMobile ? 1 : 2)}%` },
        { label: t('funnel.conversionRate'), value: `${convRate}%` },
        { label: t('funnel.frequency'), value: frequency.toFixed(2) },
        { label: 'Imp./Alcance', value: reach > 0 ? (impressions / reach).toFixed(2) : '0' },
        { label: 'Cliques/Conv.', value: conversions > 0 ? (clicks / conversions).toFixed(1) : '0' },
        { label: 'Eficiência', value: spend > 0 ? `${((conversions / (spend / 1000)) * 100).toFixed(1)}` : '0' },
      ];
    }
    
    // default
    return [
      { label: t('metrics.ctr'), value: `${ctr.toFixed(responsive.isMobile ? 1 : 2)}%` },
      { label: t('metrics.cpc'), value: formatCurrency(cpc) },
      { label: t('metrics.cpl'), value: formatCurrency(cpl) },
      { label: t('metrics.cpm'), value: formatCurrency(cpm) },
      { label: t('funnel.frequency'), value: frequency.toFixed(2) },
      { label: t('funnel.conversionRate'), value: `${convRate}%` },
      { label: t('funnel.totalCost'), value: formatCurrency(spend), highlight: true },
    ];
  }, [metricSet, ctr, cpc, cpl, cpm, frequency, spend, clicks, conversions, impressions, reach, responsive.isMobile, currency, t]);

  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
            {t('funnel.title')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={metricSet} onValueChange={(v) => setMetricSet(v as FunnelMetricSet)}>
              <SelectTrigger className="h-7 text-[10px] w-[100px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default" className="text-xs">Geral</SelectItem>
                <SelectItem value="cost" className="text-xs">Custos</SelectItem>
                <SelectItem value="engagement" className="text-xs">Engajamento</SelectItem>
              </SelectContent>
            </Select>
            {onCampaignFilterChange && (
              <Select value={campaignFilter} onValueChange={(v) => onCampaignFilterChange(v as any)}>
                <SelectTrigger className="h-7 text-[10px] w-[90px] bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todas</SelectItem>
                  <SelectItem value="active" className="text-xs">Ativas</SelectItem>
                  <SelectItem value="paused" className="text-xs">Pausadas</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 px-3 sm:px-6">
        <div className="space-y-1.5 sm:space-y-2 flex flex-col items-center">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
              className="w-full flex justify-center"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${step.widthPercent}%` }}
                transition={{ delay: index * 0.05 + 0.1, duration: 0.4, ease: "easeOut" }}
                className={cn(
                  "relative h-9 sm:h-11 rounded-md",
                  "bg-primary/90",
                  "flex items-center justify-between px-2.5 sm:px-4",
                  "border border-primary/30"
                )}
                style={{ minWidth: responsive.isMobile ? '160px' : '200px' }}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 text-primary-foreground">
                  {step.icon}
                  <span className="text-[10px] sm:text-xs font-medium">{step.label}</span>
                </div>
                <span className="text-xs sm:text-sm font-bold text-primary-foreground">
                  {step.value}
                </span>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border/50"
        >
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-3">
            {bottomMetrics.map((m) => (
              <div key={m.label} className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">{m.label}</p>
                <p className={cn("text-xs sm:text-sm font-bold", (m as any).highlight ? 'text-primary' : 'text-foreground')}>{m.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
