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
  color: string;
}

// Color palette for funnel stages (from top to bottom)
const FUNNEL_COLORS = [
  'hsl(var(--primary))',
  'hsl(220, 70%, 55%)',
  'hsl(200, 65%, 50%)',
  'hsl(180, 60%, 45%)',
  'hsl(160, 55%, 40%)',
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
        icon: <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        color: FUNNEL_COLORS[0],
      },
      {
        label: 'Impressões',
        value: formatNumber(impressions),
        icon: <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        color: FUNNEL_COLORS[1],
      },
      {
        label: 'Alcance',
        value: formatNumber(reach),
        icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        color: FUNNEL_COLORS[2],
      },
      {
        label: 'Cliques',
        value: formatNumber(clicks),
        icon: <MousePointerClick className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        color: FUNNEL_COLORS[3],
      },
      {
        label: 'Leads',
        value: formatNumber(conversions),
        icon: <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
        color: FUNNEL_COLORS[4],
      },
    ];
    
    if (responsive.isMobile) {
      return allSteps.filter(step => 
        ['Gasto', 'Impressões', 'Cliques', 'Leads'].includes(step.label)
      );
    }
    
    return allSteps;
  }, [spend, impressions, reach, clicks, conversions, currency, responsive.isMobile]);

  // Calculate SVG dimensions and paths for true funnel shape
  const funnelHeight = responsive.isMobile ? 200 : 280;
  const funnelWidth = responsive.isMobile ? 280 : 400;
  const stepHeight = funnelHeight / steps.length;
  
  // Calculate the taper - from full width to a point
  const topWidth = funnelWidth;
  const bottomWidth = responsive.isMobile ? 40 : 60; // Width at the bottom tip
  const widthDecrement = (topWidth - bottomWidth) / steps.length;

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
            width={funnelWidth} 
            height={funnelHeight} 
            viewBox={`0 0 ${funnelWidth} ${funnelHeight}`}
            className="overflow-visible"
          >
            <defs>
              {steps.map((step, index) => (
                <linearGradient 
                  key={`gradient-${index}`} 
                  id={`funnel-gradient-${index}`} 
                  x1="0%" 
                  y1="0%" 
                  x2="0%" 
                  y2="100%"
                >
                  <stop offset="0%" stopColor={step.color} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={step.color} stopOpacity="0.75" />
                </linearGradient>
              ))}
            </defs>
            
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const y = index * stepHeight;
              
              // Calculate widths at top and bottom of this segment
              const currentTopWidth = topWidth - (widthDecrement * index);
              const currentBottomWidth = isLast ? bottomWidth * 0.4 : topWidth - (widthDecrement * (index + 1));
              
              // Calculate x positions (centered)
              const topLeftX = (funnelWidth - currentTopWidth) / 2;
              const topRightX = (funnelWidth + currentTopWidth) / 2;
              const bottomLeftX = (funnelWidth - currentBottomWidth) / 2;
              const bottomRightX = (funnelWidth + currentBottomWidth) / 2;
              
              // Create trapezoid path - if last, make it pointed
              const path = isLast
                ? `M ${topLeftX} ${y} 
                   L ${topRightX} ${y} 
                   L ${funnelWidth / 2} ${y + stepHeight} 
                   Z`
                : `M ${topLeftX} ${y} 
                   L ${topRightX} ${y} 
                   L ${bottomRightX} ${y + stepHeight} 
                   L ${bottomLeftX} ${y + stepHeight} 
                   Z`;
              
              // Center position for text
              const centerY = y + stepHeight / 2;
              
              return (
                <motion.g 
                  key={step.label}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                >
                  {/* Trapezoid shape */}
                  <motion.path
                    d={path}
                    fill={`url(#funnel-gradient-${index})`}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                  />
                  
                  {/* Label and value - only if not too narrow */}
                  {(!isLast || !responsive.isMobile) && (
                    <>
                      <text
                        x={funnelWidth / 2}
                        y={isLast ? centerY - 5 : centerY - 6}
                        textAnchor="middle"
                        className="fill-white text-[10px] sm:text-xs font-medium"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        {step.label}
                      </text>
                      <text
                        x={funnelWidth / 2}
                        y={isLast ? centerY + 8 : centerY + 10}
                        textAnchor="middle"
                        className="fill-white text-xs sm:text-sm font-bold"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        {step.value}
                      </text>
                    </>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Mobile: Show last step value below if hidden */}
        {responsive.isMobile && (
          <div className="flex justify-center mt-1">
            <span className="text-xs font-bold text-primary">
              {steps[steps.length - 1]?.label}: {steps[steps.length - 1]?.value}
            </span>
          </div>
        )}

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
