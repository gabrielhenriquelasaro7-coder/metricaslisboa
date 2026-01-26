import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState, useRef } from "react";

// Aceitamos as props antigas na interface para silenciar os erros do TypeScript,
// mas elas são ignoradas no código abaixo.
interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  changeLabel?: string;
  className?: string;
  tooltip?: string;
  // Propriedades mantidas APENAS para compatibilidade com Dashboard.tsx e ProjectDetail.tsx
  change?: any;
  trend?: any;
  index?: number;
  format?: string;
}

function useCountAnimation(value: string | number, duration: number = 800) {
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
    const numericString = numericMatch.join("");
    const cleanNumber = numericString.replace(/\./g, "").replace(",", ".");
    const targetNumber = parseFloat(cleanNumber);
    if (isNaN(targetNumber)) {
      setDisplayValue(value);
      return;
    }
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentNumber = targetNumber * easeOut;
      const prefix = stringValue.match(/^[^\d]*/)?.[0] || "";
      const suffix = stringValue.match(/[^\d.,]*$/)?.[0] || "";
      const hasDecimal =
        stringValue.includes(",") || (stringValue.includes(".") && stringValue.split(".")[1]?.length === 2);
      const formatted = currentNumber.toLocaleString("pt-BR", {
        minimumFractionDigits: hasDecimal ? 2 : 0,
        maximumFractionDigits: 2,
      });
      setDisplayValue(`${prefix}${formatted}${suffix}`);
      if (progress < 1) requestAnimationFrame(animate);
      else setDisplayValue(value);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  return displayValue;
}

export default function MetricCard({
  title,
  value,
  icon: Icon,
  changeLabel,
  className,
  tooltip,
  change: _c,
  trend: _t,
  index: _i,
  format: _f, // Ignorados propositalmente
}: MetricCardProps) {
  const animatedValue = useCountAnimation(value);

  return (
    <div className={cn("premium-card group p-3 sm:p-4 transition-all duration-300", className)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger className="text-[10px] sm:text-xs text-muted-foreground border-b border-dashed border-muted-foreground/50 truncate uppercase font-medium">
                {title}
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-[10px] sm:text-xs text-muted-foreground truncate uppercase font-medium">{title}</span>
          )}
        </div>
        {Icon && (
          <div className="premium-icon w-7 h-7 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center rounded-lg bg-primary/10">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">{animatedValue}</h3>
        {changeLabel && (
          <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 truncate opacity-70">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
