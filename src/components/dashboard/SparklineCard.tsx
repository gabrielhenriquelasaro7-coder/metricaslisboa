import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface SparklineCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  previousValue?: string | number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
  sparklineColor?: string;
  invertTrend?: boolean;
  className?: string;
  tooltip?: string;
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  index?: number;
}

export default function SparklineCard({
  title,
  value,
  change,
  changeLabel,
  previousValue,
  icon: Icon,
  trend,
  sparklineData = [],
  invertTrend = false,
  className,
  tooltip,
  index = 0,
}: SparklineCardProps) {
  const actualTrend = trend ?? (change !== undefined 
    ? change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    : 'neutral');
  
  const displayTrend = invertTrend 
    ? (actualTrend === 'up' ? 'down' : actualTrend === 'down' ? 'up' : 'neutral')
    : actualTrend;
  
  const TrendIcon = actualTrend === 'up' ? TrendingUp : actualTrend === 'down' ? TrendingDown : Minus;

  const chartData = sparklineData.map((value, index) => ({ value, index }));
  const uniqueId = `sparkline-${title.replace(/\s/g, '')}-${Math.random().toString(36).substr(2, 9)}`;

  const titleElement = tooltip ? (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span className="text-xs text-muted-foreground border-b border-dashed border-muted-foreground/50 cursor-help inline-block text-left">
          {title}
        </span>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        sideOffset={8}
        className="max-w-[280px] p-3 text-sm leading-relaxed bg-popover text-popover-foreground border border-border shadow-xl z-[9999]"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-xs text-muted-foreground block">{title}</span>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        'premium-card group relative cursor-default p-3 sm:p-4',
        className
      )}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-base sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 text-foreground transition-colors duration-300 truncate">
            {value}
          </p>
          {previousValue !== undefined && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              Anterior: {previousValue}
            </p>
          )}
        </div>
        {Icon && (
          <div className="premium-icon w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0 ml-2 sm:ml-3">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary transition-all duration-300 group-hover:scale-110" />
          </div>
        )}
      </div>
      
      {/* Sparkline - Responsive height */}
      {sparklineData.length > 1 && (
        <div className="h-10 sm:h-14 -mx-1 sm:-mx-2 mt-1 sm:mt-2 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
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
                strokeWidth={1.5}
                fill={`url(#area-gradient-${uniqueId})`}
                dot={false}
                activeDot={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Change indicator - Responsive with proper tooltip on mobile */}
      {change !== undefined && (
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 relative z-10 flex-wrap">
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <div className={cn(
                'flex items-center gap-1 text-[10px] sm:text-xs font-medium px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-full cursor-default',
                'transition-all duration-300 border',
                displayTrend === 'up' 
                  ? 'bg-metric-positive/15 text-metric-positive border-metric-positive/20' 
                  : displayTrend === 'down' 
                    ? 'bg-metric-negative/15 text-metric-negative border-metric-negative/20' 
                    : 'bg-muted/50 text-muted-foreground border-muted/30'
              )}>
                <TrendIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
              </div>
            </TooltipTrigger>
            {changeLabel && (
              <TooltipContent 
                side="top" 
                sideOffset={4}
                className="text-xs bg-popover text-popover-foreground border border-border shadow-lg z-[9999]"
              >
                {changeLabel}
              </TooltipContent>
            )}
          </Tooltip>
          {changeLabel && (
            <span className="hidden sm:inline text-xs text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}