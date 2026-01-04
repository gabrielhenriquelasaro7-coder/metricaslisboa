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
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan';
}

const accentColors = {
  primary: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    glow: 'shadow-[0_0_30px_hsl(var(--neon-yellow)/0.3)]',
    gradient: 'from-primary/10 to-transparent',
    sparkline: 'hsl(var(--neon-yellow))',
  },
  success: {
    bg: 'bg-metric-positive/10',
    icon: 'text-metric-positive',
    glow: 'shadow-[0_0_30px_hsl(var(--neon-green)/0.3)]',
    gradient: 'from-metric-positive/10 to-transparent',
    sparkline: 'hsl(var(--neon-green))',
  },
  warning: {
    bg: 'bg-metric-warning/10',
    icon: 'text-metric-warning',
    glow: 'shadow-[0_0_30px_hsl(var(--metric-warning)/0.3)]',
    gradient: 'from-metric-warning/10 to-transparent',
    sparkline: 'hsl(var(--metric-warning))',
  },
  danger: {
    bg: 'bg-metric-negative/10',
    icon: 'text-metric-negative',
    glow: 'shadow-[0_0_30px_hsl(var(--metric-negative)/0.3)]',
    gradient: 'from-metric-negative/10 to-transparent',
    sparkline: 'hsl(var(--metric-negative))',
  },
  info: {
    bg: 'bg-neon-cyan/10',
    icon: 'text-neon-cyan',
    glow: 'shadow-[0_0_30px_hsl(var(--neon-cyan)/0.3)]',
    gradient: 'from-neon-cyan/10 to-transparent',
    sparkline: 'hsl(var(--neon-cyan))',
  },
  purple: {
    bg: 'bg-neon-purple/10',
    icon: 'text-neon-purple',
    glow: 'shadow-[0_0_30px_hsl(var(--neon-purple)/0.3)]',
    gradient: 'from-neon-purple/10 to-transparent',
    sparkline: 'hsl(var(--neon-purple))',
  },
  cyan: {
    bg: 'bg-neon-cyan/10',
    icon: 'text-neon-cyan',
    glow: 'shadow-[0_0_30px_hsl(var(--neon-cyan)/0.3)]',
    gradient: 'from-neon-cyan/10 to-transparent',
    sparkline: 'hsl(var(--neon-cyan))',
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
  const finalSparklineColor = sparklineColor || colors.sparkline;

  const titleElement = tooltip ? (
    <Tooltip>
      <TooltipTrigger className="text-sm text-muted-foreground border-b border-dashed border-muted-foreground/50 cursor-help inline-block text-left">
        {title}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-background/95 backdrop-blur-sm border-border/50">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-sm text-muted-foreground block">{title}</span>
  );

  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm p-4',
        'transition-all duration-500 ease-out group',
        'border-border/30 hover:border-primary/40',
        'hover:shadow-[0_0_40px_hsl(var(--neon-yellow)/0.15),0_0_60px_hsl(var(--neon-purple)/0.1)]',
        'hover:-translate-y-1',
        className
      )}
    >
      {/* Animated top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-neon-purple to-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-glow-rotate bg-[length:200%_100%]" />
      
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-30 pointer-events-none transition-opacity duration-500 group-hover:opacity-60',
        colors.gradient
      )} />
      
      {/* Subtle scan lines effect */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 4px)',
      }} />
      
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-2xl font-bold mt-1 animate-fade-in bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80 group-hover:from-primary group-hover:to-foreground transition-all duration-500">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3',
            'transition-all duration-500 group-hover:scale-110',
            colors.bg,
            'group-hover:shadow-[0_0_20px_currentColor]'
          )}>
            <Icon className={cn('w-5 h-5 transition-all duration-500', colors.icon, 'group-hover:drop-shadow-[0_0_8px_currentColor]')} />
          </div>
        )}
      </div>
      
      {/* Sparkline with neon glow */}
      {sparklineData.length > 1 && (
        <div className="h-14 -mx-2 mt-1 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={finalSparklineColor} stopOpacity={0.5} />
                  <stop offset="50%" stopColor={finalSparklineColor} stopOpacity={0.2} />
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
                strokeWidth={2}
                fill={`url(#${uniqueId})`}
                animationDuration={800}
                animationEasing="ease-out"
                style={{ filter: `url(#glow-${uniqueId})` }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Change indicator with neon styling */}
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