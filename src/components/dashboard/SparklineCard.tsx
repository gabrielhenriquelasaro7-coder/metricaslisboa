import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
  sparklineColor?: string;
  invertTrend?: boolean;
  className?: string;
  tooltip?: string;
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

// V4 RED THEME: All sparklines use V4 red color for consistency
const V4_RED_SPARKLINE = 'hsl(var(--primary))';

const accentColors = {
  primary: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
  },
  success: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
  },
  warning: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
  },
  danger: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
  },
  info: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
  },
};

export default function SparklineCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
  sparklineData = [],
  sparklineColor,
  invertTrend = false,
  className,
  tooltip,
  accentColor = 'primary',
}: SparklineCardProps) {
  const actualTrend = trend ?? (change !== undefined 
    ? change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    : 'neutral');
  
  const displayTrend = invertTrend 
    ? (actualTrend === 'up' ? 'down' : actualTrend === 'down' ? 'up' : 'neutral')
    : actualTrend;
  
  const TrendIcon = actualTrend === 'up' ? TrendingUp : actualTrend === 'down' ? TrendingDown : Minus;
  
  const trendColor = displayTrend === 'up' 
    ? 'text-metric-positive bg-metric-positive/15' 
    : displayTrend === 'down' 
      ? 'text-metric-negative bg-metric-negative/15' 
      : 'text-muted-foreground bg-muted/50';

  const chartData = sparklineData.map((value, index) => ({ value, index }));
  const colors = accentColors[accentColor];
  const uniqueId = `sparkline-${title.replace(/\s/g, '')}-${Math.random().toString(36).substr(2, 9)}`;
  // V4 THEME: Always use V4 red for sparklines
  const finalSparklineColor = V4_RED_SPARKLINE;

  const titleElement = tooltip ? (
    <Tooltip>
      <TooltipTrigger className="text-sm text-muted-foreground border-b border-dashed border-muted-foreground/50 cursor-help inline-block text-left">
        {title}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-background/95 backdrop-blur-xl border-border/50">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-sm text-muted-foreground block">{title}</span>
  );

  return (
    <div 
      className={cn(
        'metric-card group relative cursor-default',
        className
      )}
    >
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      </div>
      
      {/* Sparkle effects */}
      <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
      <div className="absolute top-6 right-8 w-1 h-1 rounded-full bg-primary/70 opacity-0 group-hover:opacity-100 group-hover:animate-ping" style={{ animationDelay: '0.3s' }} />
      <div className="absolute bottom-8 left-4 w-0.5 h-0.5 rounded-full bg-primary/50 opacity-0 group-hover:opacity-100 group-hover:animate-ping" style={{ animationDelay: '0.5s' }} />
      
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-2xl font-bold mt-1 text-foreground group-hover:text-primary transition-colors duration-500">
            {value}
          </p>
        </div>
        {Icon && (
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 ml-3 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-500 overflow-hidden">
            {/* Icon glow ring */}
            <div className="absolute inset-0 rounded-xl border border-primary/20 group-hover:border-primary/40 transition-colors duration-500" />
            <div className="absolute inset-[2px] rounded-lg bg-gradient-to-br from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Rotating gradient on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 bg-gradient-conic from-primary/30 via-transparent to-primary/30 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            
            <Icon className="w-5 h-5 text-primary relative z-10 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_currentColor] transition-all duration-500" />
          </div>
        )}
      </div>
      
      {/* Sparkline - Area chart with gradient fill */}
      {sparklineData.length > 1 && (
        <div className="h-16 -mx-2 mt-2 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`area-gradient-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`stroke-gradient-${uniqueId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary) / 0.6)" />
                  <stop offset="50%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={`url(#stroke-gradient-${uniqueId})`}
                strokeWidth={2}
                fill={`url(#area-gradient-${uniqueId})`}
                dot={false}
                activeDot={false}
                animationDuration={1000}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Change indicator with enhanced styling */}
      {change !== undefined && (
        <div className="flex items-center gap-2 mt-3 relative z-10">
          <div className={cn(
            'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full',
            'transition-all duration-300 backdrop-blur-sm border',
            displayTrend === 'up' 
              ? 'bg-metric-positive/15 text-metric-positive border-metric-positive/20 group-hover:bg-metric-positive/25 group-hover:shadow-[0_0_12px_hsl(var(--metric-positive)/0.3)]' 
              : displayTrend === 'down' 
                ? 'bg-metric-negative/15 text-metric-negative border-metric-negative/20 group-hover:bg-metric-negative/25 group-hover:shadow-[0_0_12px_hsl(var(--metric-negative)/0.3)]' 
                : 'bg-muted/50 text-muted-foreground border-muted/30 group-hover:bg-muted/70'
          )}>
            <TrendIcon className="w-4 h-4" />
            <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          </div>
          {changeLabel && (
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
