import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Eye, Users, MousePointerClick, Target, TrendingDown } from 'lucide-react';
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
        widthPercent: 82,
      },
      {
        label: 'Alcance',
        value: formatNumber(reach),
        icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 64,
      },
      {
        label: 'Cliques',
        value: formatNumber(clicks),
        icon: <MousePointerClick className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 46,
      },
      {
        label: 'Leads',
        value: formatNumber(conversions),
        icon: <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        widthPercent: 28,
      },
    ];
    
    if (responsive.isMobile) {
      return allSteps.filter(step => 
        ['Gasto', 'Impressões', 'Cliques', 'Leads'].includes(step.label)
      );
    }
    
    return allSteps;
  }, [spend, impressions, reach, clicks, conversions, currency, responsive.isMobile]);

  // Generate clip-path for trapezoid shape
  const getClipPath = (index: number, total: number) => {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    
    // Taper amount (how much the sides angle in)
    const taperTop = isFirst ? 0 : 8;
    const taperBottom = isLast ? 50 : 8; // Last one comes to a point
    
    if (isLast) {
      // Triangle/pointed bottom
      return `polygon(${taperTop}% 0%, ${100 - taperTop}% 0%, 50% 100%)`;
    }
    
    return `polygon(${taperTop}% 0%, ${100 - taperTop}% 0%, ${100 - taperBottom}% 100%, ${taperBottom}% 100%)`;
  };

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
        {/* Funnel Container */}
        <div className="flex flex-col items-center gap-0.5">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.08, duration: 0.3 }}
                className="flex justify-center w-full"
              >
                <div
                  className={cn(
                    "relative flex items-center justify-between px-4 sm:px-6",
                    "bg-primary/80 text-primary-foreground",
                    isLast ? "h-10 sm:h-12" : "h-11 sm:h-14"
                  )}
                  style={{
                    width: `${step.widthPercent}%`,
                    minWidth: responsive.isMobile ? '140px' : '180px',
                    clipPath: getClipPath(index, steps.length),
                  }}
                >
                  {!isLast && (
                    <>
                      {/* Left side content */}
                      <div className="flex items-center gap-1.5 sm:gap-2 z-10">
                        {step.icon}
                        <span className="text-[10px] sm:text-xs font-medium opacity-90">
                          {step.label}
                        </span>
                      </div>
                      
                      {/* Right side value */}
                      <span className="text-xs sm:text-sm font-bold z-10">
                        {step.value}
                      </span>
                    </>
                  )}
                  
                  {/* Last step - centered content */}
                  {isLast && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                      <span className="text-[10px] sm:text-xs font-medium opacity-90">
                        {step.label}
                      </span>
                      <span className="text-xs sm:text-sm font-bold">
                        {step.value}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Métricas adicionais */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-border/50"
        >
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-3">
            <div className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">CTR</p>
              <p className="text-xs sm:text-sm font-bold text-foreground">{ctr.toFixed(responsive.isMobile ? 1 : 2)}%</p>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">CPC</p>
              <p className="text-xs sm:text-sm font-bold text-foreground">{formatCurrency(cpc)}</p>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">CPL</p>
              <p className="text-xs sm:text-sm font-bold text-foreground">{formatCurrency(cpl)}</p>
            </div>
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
