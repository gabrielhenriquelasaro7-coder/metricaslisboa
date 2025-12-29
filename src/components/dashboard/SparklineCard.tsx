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
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}

const accentColors = {
  primary: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    glow: 'shadow-primary/20',
    gradient: 'from-primary/5 to-transparent',
  },
  success: {
    bg: 'bg-metric-positive/10',
    icon: 'text-metric-positive',
    glow: 'shadow-metric-positive/20',
    gradient: 'from-metric-positive/5 to-transparent',
  },
  warning: {
    bg: 'bg-metric-warning/10',
    icon: 'text-metric-warning',
    glow: 'shadow-metric-warning/20',
    gradient: 'from-metric-warning/5 to-transparent',
  },
  danger: {
    bg: 'bg-metric-negative/10',
    icon: 'text-metric-negative',
    glow: 'shadow-metric-negative/20',
    gradient: 'from-metric-negative/5 to-transparent',
  },
  info: {
    bg: 'bg-chart-2/10',
    icon: 'text-chart-2',
    glow: 'shadow-chart-2/20',
    gradient: 'from-chart-2/5 to-transparent',
  },
  purple: {
    bg: 'bg-chart-4/10',
    icon: 'text-chart-4',
    glow: 'shadow-chart-4/20',
    gradient: 'from-chart-4/5 to-transparent',
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
  sparklineColor = 'hsl(var(--primary))',
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
    ? 'text-metric-positive bg-metric-positive/10' 
    : displayTrend === 'down' 
      ? 'text-metric-negative bg-metric-negative/10' 
      : 'text-muted-foreground bg-muted/50';

  const chartData = sparklineData.map((value, index) => ({ value, index }));
  const colors = accentColors[accentColor];
  const uniqueId = `sparkline-${title.replace(/\s/g, '')}-${Math.random().toString(36).substr(2, 9)}`;

  const titleElement = tooltip ? (
    <Tooltip>
      <TooltipTrigger className="text-sm text-muted-foreground border-b border-dashed border-muted-foreground/50 cursor-help inline-block text-left">
        {title}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-sm text-muted-foreground block">{title}</span>
  );

  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/50 bg-card p-4',
        'transition-all duration-300 ease-out',
        'hover:border-border hover:shadow-lg hover:-translate-y-0.5',
        `hover:${colors.glow}`,
        className
      )}
    >
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-50 pointer-events-none',
        colors.gradient
      )} />
      
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-2xl font-bold mt-1 animate-fade-in">{value}</p>
        </div>
        {Icon && (
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3',
            'transition-transform duration-300 hover:scale-110',
            colors.bg
          )}>
            <Icon className={cn('w-5 h-5', colors.icon)} />
          </div>
        )}
      </div>
      
      {/* Sparkline */}
      {sparklineData.length > 1 && (
        <div className="h-14 -mx-2 mt-1 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={sparklineColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparklineColor}
                strokeWidth={2}
                fill={`url(#${uniqueId})`}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Change indicator */}
      {change !== undefined && (
        <div className="flex items-center gap-2 mt-3 relative z-10">
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full',
            'transition-all duration-200',
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