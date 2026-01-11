import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

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
  index?: number;
}

// Hook for count animation
function useCountAnimation(value: string | number, duration: number = 1000) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  
  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    
    const stringValue = String(value);
    const numericMatch = stringValue.match(/[\d.,]+/g);
    if (!numericMatch) {
      setDisplayValue(value);
      return;
    }
    
    const numericString = numericMatch.join('');
    const cleanNumber = numericString.replace(/\./g, '').replace(',', '.');
    const targetNumber = parseFloat(cleanNumber);
    
    if (isNaN(targetNumber)) {
      setDisplayValue(value);
      return;
    }
    
    const startTime = performance.now();
    const startNumber = 0;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentNumber = startNumber + (targetNumber - startNumber) * easeOut;
      
      const prefix = stringValue.match(/^[^\d]*/)?.[0] || '';
      const suffix = stringValue.match(/[^\d.,]*$/)?.[0] || '';
      const hasDecimal = stringValue.includes(',') && stringValue.match(/,\d{2}$/);
      const formatted = hasDecimal 
        ? currentNumber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : currentNumber.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      
      setDisplayValue(`${prefix}${formatted}${suffix}`);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return displayValue;
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
  index = 0,
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const animatedValue = useCountAnimation(value, 800);

  // MetricDeltaBadge - Hidden on mobile, visible on sm+ screens
  const MetricDeltaBadge = change !== undefined && (
    <span 
      className={cn(
        // Hidden on mobile, visible on tablet+
        'hidden sm:inline-flex',
        // Base styles
        'items-center gap-0.5 whitespace-nowrap shrink-0',
        'px-1.5 py-0.5 text-[10px] font-medium rounded-full border leading-none',
        // Dynamic colors based on trend
        trend === 'up' 
          ? 'bg-metric-positive/15 text-metric-positive border-metric-positive/20' 
          : trend === 'down' 
            ? 'bg-metric-negative/15 text-metric-negative border-metric-negative/20' 
            : 'bg-muted/50 text-muted-foreground border-muted/30'
      )}
    >
      <TrendIcon className="w-2.5 h-2.5 shrink-0" />
      <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
    </span>
  );

  const titleElement = tooltip ? (
    <Tooltip>
      <TooltipTrigger className="text-xs text-muted-foreground border-b border-dashed border-muted-foreground/50 cursor-help text-left truncate">
        {title}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-background/95 backdrop-blur-xl border-border/50">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-xs text-muted-foreground truncate">{title}</span>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn('premium-card group cursor-default p-1.5 sm:p-3 overflow-hidden w-full max-w-full box-border', className)}
      style={{ minWidth: 0 }}
    >
      {/* Header row: Title + Badge aligned, Icon on right */}
      <div className="flex items-center justify-between gap-1 mb-0.5 relative z-10 w-full">
        {/* Title and Badge container - flex with center alignment */}
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {titleElement}
          {MetricDeltaBadge}
        </div>
        {Icon && (
          <div className="premium-icon w-5 h-5 sm:w-8 sm:h-8 shrink-0">
            <Icon className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-primary transition-all duration-300 group-hover:scale-110" />
          </div>
        )}
      </div>
      
      {/* Value - smaller font to fit large numbers */}
      <p className="text-[10px] sm:text-xs md:text-sm font-bold text-foreground transition-colors duration-300 truncate overflow-hidden w-full">
        {animatedValue}
      </p>
      
      {/* Change label (e.g., "Anterior: R$ 1.922,54") */}
      {changeLabel && (
        <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-0.5 truncate overflow-hidden w-full">
          {changeLabel}
        </p>
      )}
    </motion.div>
  );
}