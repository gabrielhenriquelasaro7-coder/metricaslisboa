import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState, useRef } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  changeLabel?: string;
  icon?: LucideIcon;
  className?: string;
  tooltip?: string;
}

// Hook para animação suave dos números
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
    const startNumber = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentNumber = startNumber + (targetNumber - startNumber) * easeOut;

      const prefix = stringValue.match(/^[^\d]*/)?.[0] || "";
      const suffix = stringValue.match(/[^\d.,]*$/)?.[0] || "";
      const hasDecimal = stringValue.includes(",") || stringValue.includes(".");

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

export default function MetricCard({ title, value, changeLabel, icon: Icon, className, tooltip }: MetricCardProps) {
  const animatedValue = useCountAnimation(value);

  const titleElement = tooltip ? (
    <Tooltip>
      <TooltipTrigger className="text-[10px] sm:text-xs text-muted-foreground border-b border-dashed border-muted-foreground/50 cursor-help text-left truncate uppercase tracking-wider font-medium">
        {title}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-background/95 backdrop-blur-xl border-border/50">{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-[10px] sm:text-xs text-muted-foreground truncate uppercase tracking-wider font-medium">
      {title}
    </span>
  );

  return (
    <div
      className={cn(
        "premium-card group cursor-default p-3 sm:p-4 transition-all duration-300 hover:border-primary/30",
        className,
      )}
    >
      {/* Topo: Título e Ícone */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">{titleElement}</div>
        {Icon && (
          <div className="premium-icon w-7 h-7 sm:w-9 sm:h-9 shrink-0">
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}
      </div>

      {/* Valor Principal - Tamanho robusto e responsivo */}
      <div className="flex flex-col">
        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight truncate">
          {animatedValue}
        </h3>

        {/* Rótulo de comparação (Opcional) */}
        {changeLabel && (
          <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 truncate opacity-80">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
