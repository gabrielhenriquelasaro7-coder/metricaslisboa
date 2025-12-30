import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'currency' | 'percent' | 'number';
  className?: string;
  tooltip?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
  className,
  tooltip,
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  
  const trendColor = trend === 'up' 
    ? 'text-metric-positive' 
    : trend === 'down' 
      ? 'text-metric-negative' 
      : 'text-muted-foreground';

  const titleElement = tooltip ? (
    <Tooltip>
      <TooltipTrigger className="text-sm text-muted-foreground mb-1 border-b border-dashed border-muted-foreground/50 cursor-help inline-block text-left">
        {title}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-sm text-muted-foreground mb-1 block">{title}</span>
  );

  return (
    <div className={cn('metric-card group hover-lift', className)}>
      {/* Top red border accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0 overflow-hidden">
          {titleElement}
          <p className="text-lg sm:text-xl md:text-2xl font-bold break-all leading-tight">{value}</p>
        </div>
        {Icon && (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
        )}
      </div>
      
      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center gap-1 text-sm font-medium', trendColor)}>
            <TrendIcon className="w-4 h-4" />
            {change !== undefined && (
              <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
            )}
          </div>
          {changeLabel && (
            <span className="text-sm text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
