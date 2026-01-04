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
      <TooltipContent className="max-w-xs bg-background/95 backdrop-blur-sm border-border/50">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-xs text-muted-foreground mb-1 block">{title}</span>
  );

  return (
    <div className={cn('metric-card group hover-lift', className)}>
      {/* Top neon border accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-neon-purple to-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-glow-rotate bg-[length:200%_100%]" />
      
      <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1 sm:mb-2">
        <div className="flex-1 min-w-0">
          {titleElement}
          <p className="text-base sm:text-lg md:text-xl font-bold truncate bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80 group-hover:from-primary group-hover:to-foreground transition-all duration-500">
            {animatedValue}
          </p>
        </div>
        {Icon && (
          <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all duration-500 flex-shrink-0">
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary group-hover:drop-shadow-[0_0_8px_currentColor] transition-all duration-500" />
          </div>
        )}
      </div>
      
      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <div className={cn('flex items-center gap-1 text-xs sm:text-sm font-medium px-2 py-0.5 rounded-full backdrop-blur-sm', 
            trend === 'up' ? 'bg-metric-positive/15 text-metric-positive' :
            trend === 'down' ? 'bg-metric-negative/15 text-metric-negative' :
            'bg-muted/50 text-muted-foreground'
          )}>
            <TrendIcon className="w-3 h-3 sm:w-4 sm:h-4" />
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
