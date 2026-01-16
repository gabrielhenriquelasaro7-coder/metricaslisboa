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
}

// Red gradient colors from dark to light (top to bottom)
const FUNNEL_COLORS = [
  '#8B1538', // Dark red
  '#A52145',
  '#BF3055',
  '#D64568',
  '#E8607D',
];

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
        icon: <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" />,
      },
      {
        label: 'Impressões',
        value: formatNumber(impressions),
        icon: <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />,
      },
      {
        label: 'Alcance',
        value: formatNumber(reach),
        icon: <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />,
      },
      {
        label: 'Cliques',
        value: formatNumber(clicks),
        icon: <MousePointerClick className="w-3 h-3 sm:w-3.5 sm:h-3.5" />,
      },
      {
        label: 'Leads',
        value: formatNumber(conversions),
        icon: <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5" />,
      },
    ];
    
    if (responsive.isMobile) {
      return allSteps.filter(step => 
        ['Gasto', 'Impressões', 'Cliques', 'Leads'].includes(step.label)
      );
    }
    
    return allSteps;
  }, [spend, impressions, reach, clicks, conversions, currency, responsive.isMobile]);

  // SVG dimensions
  const width = responsive.isMobile ? 300 : 420;
  const height = responsive.isMobile ? 180 : 240;
  const stepHeight = height / steps.length;
  const gap = 2; // Gap between sections

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
        {/* SVG Funnel */}
        <div className="flex justify-center">
          <svg 
            width={width} 
            height={height + 10} 
            viewBox={`0 0 ${width} ${height + 10}`}
            className="overflow-visible"
          >
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const y = index * stepHeight + (index * gap);
              
              // Calculate the taper - each step gets narrower
              const topWidthPercent = 100 - (index * 15);
              const bottomWidthPercent = isLast ? 0 : 100 - ((index + 1) * 15);
              
              const topWidth = (width * topWidthPercent) / 100;
              const bottomWidth = (width * bottomWidthPercent) / 100;
              
              // Center positions
              const topLeftX = (width - topWidth) / 2;
              const topRightX = (width + topWidth) / 2;
              const bottomLeftX = (width - bottomWidth) / 2;
              const bottomRightX = (width + bottomWidth) / 2;
              
              // Path for trapezoid (or triangle for last)
              const actualHeight = stepHeight - gap;
              const path = isLast
                ? `M ${topLeftX} ${y} L ${topRightX} ${y} L ${width / 2} ${y + actualHeight + 8} Z`
                : `M ${topLeftX} ${y} L ${topRightX} ${y} L ${bottomRightX} ${y + actualHeight} L ${bottomLeftX} ${y + actualHeight} Z`;
              
              const centerY = isLast ? y + actualHeight * 0.35 : y + actualHeight / 2;
              
              return (
                <motion.g 
                  key={step.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                >
                  <path
                    d={path}
                    fill={FUNNEL_COLORS[index] || FUNNEL_COLORS[FUNNEL_COLORS.length - 1]}
                  />
                  
                  {/* Content - icon, label and value */}
                  <foreignObject
                    x={topLeftX}
                    y={y}
                    width={topWidth}
                    height={isLast ? actualHeight * 0.7 : actualHeight}
                    className="pointer-events-none"
                  >
                    <div className="w-full h-full flex items-center justify-between px-3 sm:px-5">
                      <div className="flex items-center gap-1.5 text-white">
                        {step.icon}
                        <span className="text-[10px] sm:text-xs font-medium">
                          {step.label}
                        </span>
                      </div>
                      <span className="text-[11px] sm:text-sm font-bold text-white">
                        {step.value}
                      </span>
                    </div>
                  </foreignObject>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Métricas adicionais */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border/50"
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
