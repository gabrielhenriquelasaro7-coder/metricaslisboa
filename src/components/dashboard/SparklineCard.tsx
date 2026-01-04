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
  // V4 THEME: Always use V4 red for sparklines - ignore accentColor for chart color
  const finalSparklineColor = sparklineColor || V4_RED_SPARKLINE;

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
        'glass-card-hover p-4 group',
        className
      )}
    >
      {/* Animated top border on hover */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-v4-crimson to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Subtle background gradient */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-40',
        colors.gradient
      )} />
      
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-2xl font-bold mt-1 text-foreground group-hover:text-primary transition-colors duration-500">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3',
            'transition-all duration-500 group-hover:scale-105',
            colors.bg,
            'group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.25)]'
          )}>
            <Icon className={cn('w-5 h-5 transition-all duration-500', colors.icon, 'group-hover:drop-shadow-[0_0_6px_currentColor]')} />
          </div>
        )}
      </div>
      
      {/* Sparkline with glow */}
      {sparklineData.length > 1 && (
        <div className="h-14 -mx-2 mt-1 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={finalSparklineColor} stopOpacity={0.4} />
                  <stop offset="50%" stopColor={finalSparklineColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={finalSparklineColor} stopOpacity={0.02} />
                </linearGradient>
                <filter id={`glow-${uniqueId}`}>
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={finalSparklineColor}
                strokeWidth={2.5}
                strokeDasharray="6 3"
                fill={`url(#${uniqueId})`}
                animationDuration={800}
                animationEasing="ease-out"
                style={{ filter: `url(#glow-${uniqueId})` }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Change indicator */}
      {change !== undefined && (
        <div className="flex items-center gap-2 mt-3 relative z-10">
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full',
            'transition-all duration-300 backdrop-blur-sm',
            trendColor
          )}>
            <TrendIcon className="w-3.5 h-3.5" />
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
