import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Eye, Users, MousePointerClick, Percent, TrendingDown, Target, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useChartResponsive } from '@/hooks/useChartResponsive';

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
}: FunnelChartProps) {
  const responsive = useChartResponsive();
  
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
    // On mobile, show fewer steps to reduce clutter
    const allSteps = [
      {
        label: 'Gasto',
        value: formatCurrency(spend),
        icon: <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 100,
      },
      {
        label: 'Impressões',
        value: formatNumber(impressions),
        icon: <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 88,
      },
      {
        label: 'Alcance',
        value: formatNumber(reach),
        icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 76,
      },
      {
        label: 'Cliques',
        value: formatNumber(clicks),
        icon: <MousePointerClick className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 64,
      },
      {
        label: 'CTR',
        value: `${ctr.toFixed(responsive.isMobile ? 1 : 2)}%`,
        icon: <Percent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 52,
      },
      {
        label: 'CPC',
        value: formatCurrency(cpc),
        icon: <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 40,
      },
      {
        label: 'CPL',
        value: formatCurrency(cpl),
        icon: <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 28,
      },
      {
        label: 'Leads',
        value: formatNumber(conversions),
        icon: <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 18,
      },
    ];
    
    // On mobile, show only key steps
    if (responsive.isMobile) {
      return allSteps.filter(step => 
        ['Gasto', 'Impressões', 'Cliques', 'CTR', 'CPL', 'Leads'].includes(step.label)
      );
    }
    
    return allSteps;
  }, [spend, impressions, reach, clicks, ctr, cpc, cpl, conversions, currency, responsive.isMobile]);

  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          Funil Geral
        </CardTitle>
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
                  "bg-gradient-to-r from-primary via-primary to-primary/90",
                  "flex items-center justify-between px-2.5 sm:px-4",
                  "border border-white/10",
                  "shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)]"
                )}
                style={{ minWidth: responsive.isMobile ? '160px' : '200px' }}
              >
                {/* Ícone e Label */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-primary-foreground">
                  {step.icon}
                  <span className="text-[10px] sm:text-xs font-medium">{step.label}</span>
                </div>
                
                {/* Valor */}
                <span className="text-xs sm:text-sm font-bold text-primary-foreground">
                  {step.value}
                </span>

                {/* Efeito de brilho */}
                <div className="absolute inset-0 rounded-md bg-gradient-to-t from-transparent via-white/5 to-white/15 pointer-events-none" />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Métricas adicionais */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border/50"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">CPM</p>
              <p className="text-xs sm:text-sm font-bold text-foreground">{formatCurrency(cpm)}</p>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Frequência</p>
              <p className="text-xs sm:text-sm font-bold text-foreground">{frequency.toFixed(2)}</p>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Tx Conversão</p>
              <p className="text-xs sm:text-sm font-bold text-foreground">
                {clicks > 0 ? ((conversions / clicks) * 100).toFixed(responsive.isMobile ? 1 : 2) : '0.00'}%
              </p>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Custo Total</p>
              <p className="text-xs sm:text-sm font-bold text-primary">{formatCurrency(spend)}</p>
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
