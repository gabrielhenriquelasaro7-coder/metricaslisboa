import { Card } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Interface completa para aceitar tudo o que o Dashboard envia
interface SparklineCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  className?: string;

  // Dados do gráfico
  data?: { value: number }[];
  sparklineData?: number[];

  // Tooltip (Adicionado para corrigir o erro)
  tooltip?: string;

  // Propriedades mantidas para compatibilidade (evita erros de TypeScript), mas visivelmente ignoradas
  change?: number;
  trend?: "up" | "down" | "neutral";
  description?: string;
  changeLabel?: string;
  invertTrend?: boolean;
  sparklineColor?: string;
}

export default function SparklineCard({
  title,
  value,
  icon: Icon,
  data,
  sparklineData,
  className,
  description,
  tooltip,
  // Ignoramos estas props para manter o visual limpo
  change: _change,
  trend: _trend,
  changeLabel: _changeLabel,
  invertTrend: _invertTrend,
  sparklineColor: _sparklineColor,
}: SparklineCardProps) {
  // Converte lista de números [10, 20] para formato de objeto [{value: 10}, {value: 20}] se necessário
  const chartData = data || (sparklineData ? sparklineData.map((val) => ({ value: val })) : []);

  // Cor fixa (Vermelho V4)
  const chartColor = "hsl(0, 85%, 55%)";

  // Lógica do Título com Tooltip (se existir)
  const titleContent = (
    <span
      className={cn(
        "text-sm font-medium text-muted-foreground truncate pr-2",
        tooltip && "cursor-help border-b border-dashed border-muted-foreground/50",
      )}
    >
      {title}
    </span>
  );

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-2 sm:p-2.5 flex flex-col justify-between h-full premium-card group hover:border-primary/40 transition-all duration-300",
        className,
      )}
    >
      {/* Topo: Título e Ícone */}
      <div className="flex items-center justify-between mb-1 z-10 relative">
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "text-[10px] sm:text-xs font-medium text-muted-foreground truncate pr-2",
                "cursor-help border-b border-dashed border-muted-foreground/50",
              )}>{title}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] z-50">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate pr-2">{title}</span>
        )}

        <div className="w-6 h-6 flex items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Meio: Valor e Descrição */}
      <div className="flex flex-col z-10 relative mb-1">
        <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate">{value}</h3>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate opacity-80">{description}</p>}
      </div>

      {/* Fundo: Gráfico */}
      <div className="absolute bottom-0 right-0 w-full h-[40px] opacity-20 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.8} />
                <stop offset="90%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#gradient-${title.replace(/\s+/g, "-")})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
