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

  const titleElement = tooltip ? (
    <Tooltip>
      <TooltipTrigger className="text-xs text-muted-foreground mb-1 border-b border-dashed border-muted-foreground/50 cursor-help inline-block text-left">
        {title}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-background/95 backdrop-blur-xl border-border/50">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-xs text-muted-foreground mb-1 block">{title}</span>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className={cn('premium-card group cursor-default p-4', className)}
    >
      <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-lg md:text-xl font-bold truncate text-foreground group-hover:text-primary transition-colors duration-300">
            {animatedValue}
          </p>
        </div>
        {Icon && (
          <div className="premium-icon w-10 h-10 flex-shrink-0">
            <Icon className="w-4 h-4 text-muted-foreground transition-colors duration-300" />
          </div>
        )}
      </div>
      
      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-2 flex-wrap relative z-10">
          <div className={cn(
            'flex items-center gap-1 text-xs sm:text-sm font-medium px-2.5 py-1 rounded-full border transition-all duration-300', 
            trend === 'up' ? 'bg-metric-positive/15 text-metric-positive border-metric-positive/20' :
            trend === 'down' ? 'bg-metric-negative/15 text-metric-negative border-metric-negative/20' :
            'bg-muted/50 text-muted-foreground border-muted/30'
          )}>
            <TrendIcon className="w-3 h-3" />
            {change !== undefined && (
              <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
            )}
          </div>
          {changeLabel && (
            <span className="text-xs text-muted-foreground truncate">{changeLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}