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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        'premium-card group relative cursor-default p-4',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-2xl font-bold mt-1 text-foreground transition-colors duration-300">
            {value}
          </p>
          {previousValue !== undefined && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Anterior: {previousValue}
            </p>
          )}
        </div>
        {Icon && (
          <div className="premium-icon w-11 h-11 flex-shrink-0 ml-3">
            <Icon className="w-5 h-5 text-primary transition-all duration-300 group-hover:scale-110" />
          </div>
        )}
      </div>
      
      {/* Sparkline */}
      {sparklineData.length > 1 && (
        <div className="h-14 -mx-2 mt-2 relative z-10">
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
      
      {/* Change indicator */}
      {change !== undefined && (
        <div className="flex items-center gap-2 mt-3 relative z-10">
          <div className={cn(
            'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full',
            'transition-all duration-300 border',
            displayTrend === 'up' 
              ? 'bg-metric-positive/15 text-metric-positive border-metric-positive/20' 
              : displayTrend === 'down' 
                ? 'bg-metric-negative/15 text-metric-negative border-metric-negative/20' 
                : 'bg-muted/50 text-muted-foreground border-muted/30'
          )}>
            <TrendIcon className="w-4 h-4" />
            <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          </div>
          {changeLabel && (
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}