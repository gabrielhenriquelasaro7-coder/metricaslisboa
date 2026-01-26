import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState, useRef } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  changeLabel?: string;
  className?: string;
  tooltip?: string;
  // Props mantidas apenas para compatibilidade, mas não usadas
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
    const startNumber = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentNumber = startNumber + (targetNumber - startNumber) * easeOut;

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
  change: _c, // Ignorados
  trend: _t,
  index: _i,
  format: _f,
}: MetricCardProps) {
  const animatedValue = useCountAnimation(value);

  const titleContent = (
    <span className="text-sm font-medium text-muted-foreground truncate tracking-tight">{title}</span>
  );

  return (
    <div
      className={cn(
        "premium-card group relative overflow-hidden p-4 transition-all duration-300 hover:border-primary/20",
        className,
      )}
    >
      {/* Cabeçalho alinhado ao centro (items-center) para evitar titulo "bugado/torto" */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger className="cursor-help text-left truncate w-full">{titleContent}</TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            titleContent
          )}
        </div>

        {Icon && (
          <div className="premium-icon w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}
      </div>

      {/* Valor Principal */}
      <div className="flex flex-col gap-1">
        <h3 className="text-2xl font-bold text-foreground tracking-tight truncate">{animatedValue}</h3>

        {changeLabel && <p className="text-xs text-muted-foreground truncate opacity-80">{changeLabel}</p>}
      </div>
    </div>
  );
}
