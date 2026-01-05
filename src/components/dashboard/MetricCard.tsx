import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect, useState, useRef } from 'react';

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

// Hook para animação de contagem
function useCountAnimation(value: string | number, duration: number = 1000) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  
  useEffect(() => {
    // Se o valor não mudou, não anima
    if (prevValue.current === value) return;
    prevValue.current = value;
    
    const stringValue = String(value);
    
    // Extrai o número do valor (ex: "R$ 24.908,65" -> 24908.65)
    const numericMatch = stringValue.match(/[\d.,]+/g);
    if (!numericMatch) {
      setDisplayValue(value);
      return;
    }
    
    // Pega a primeira ocorrência de número
    const numericString = numericMatch.join('');
    // Converte para número (considerando formato brasileiro)
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
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentNumber = startNumber + (targetNumber - startNumber) * easeOut;
      
      // Formata o número de volta ao formato original
      const prefix = stringValue.match(/^[^\d]*/)?.[0] || '';
      const suffix = stringValue.match(/[^\d.,]*$/)?.[0] || '';
      
      // Detecta formato do número original
      const hasDecimal = stringValue.includes(',') && stringValue.match(/,\d{2}$/);
      const formatted = hasDecimal 
        ? currentNumber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : currentNumber.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      
      setDisplayValue(`${prefix}${formatted}${suffix}`);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value); // Garante valor final exato
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
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const animatedValue = useCountAnimation(value, 800);
  
  const trendColor = trend === 'up' 
    ? 'text-metric-positive' 
    : trend === 'down' 
      ? 'text-metric-negative' 
      : 'text-muted-foreground';

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
    <div className={cn('metric-card group cursor-default', className)}>
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      </div>
      
      {/* Sparkle effects */}
      <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
      <div className="absolute top-4 right-6 w-0.5 h-0.5 rounded-full bg-primary/70 opacity-0 group-hover:opacity-100 group-hover:animate-ping" style={{ animationDelay: '0.2s' }} />
      <div className="absolute bottom-4 left-3 w-0.5 h-0.5 rounded-full bg-primary/50 opacity-0 group-hover:opacity-100 group-hover:animate-ping" style={{ animationDelay: '0.4s' }} />
      
      <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1 sm:mb-2 relative z-10">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-base sm:text-lg md:text-xl font-bold truncate text-foreground group-hover:text-primary transition-colors duration-500">
            {animatedValue}
          </p>
        </div>
        {Icon && (
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-500 flex-shrink-0 overflow-hidden">
            {/* Icon glow ring */}
            <div className="absolute inset-0 rounded-xl border border-primary/20 group-hover:border-primary/40 transition-colors duration-500" />
            <div className="absolute inset-[2px] rounded-lg bg-gradient-to-br from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Rotating gradient on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 bg-gradient-conic from-primary/30 via-transparent to-primary/30 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            
            <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-primary relative z-10 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_currentColor] transition-all duration-500" />
          </div>
        )}
      </div>
      
      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap relative z-10">
          <div className={cn(
            'flex items-center gap-1 text-xs sm:text-sm font-medium px-2.5 py-1 rounded-full backdrop-blur-sm border transition-all duration-300', 
            trend === 'up' ? 'bg-metric-positive/15 text-metric-positive border-metric-positive/20 group-hover:bg-metric-positive/25' :
            trend === 'down' ? 'bg-metric-negative/15 text-metric-negative border-metric-negative/20 group-hover:bg-metric-negative/25' :
            'bg-muted/50 text-muted-foreground border-muted/30 group-hover:bg-muted/70'
          )}>
            <TrendIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {change !== undefined && (
              <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
            )}
          </div>
          {changeLabel && (
            <span className="text-xs sm:text-sm text-muted-foreground truncate">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
