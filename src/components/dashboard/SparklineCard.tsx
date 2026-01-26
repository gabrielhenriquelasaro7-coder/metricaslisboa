import { Card } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Interface expandida para aceitar TODAS as propriedades que o Dashboard tenta enviar
interface SparklineCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  className?: string;

  // Dados do gráfico: aceita ambos os formatos (objeto ou lista de números)
  data?: { value: number }[];
  sparklineData?: number[];

  // Propriedades mantidas para compatibilidade (evita erros de TypeScript)
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
  // Recebemos estas variáveis mas não as usamos (o "_" indica isso), para limpar o visual
  change: _change,
  trend: _trend,
  changeLabel: _changeLabel,
  invertTrend: _invertTrend,
  sparklineColor: _sparklineColor,
}: SparklineCardProps) {
  // Lógica inteligente: Se vier 'data', usa. Se vier 'sparklineData' (lista de números), converte.
  const chartData = data || (sparklineData ? sparklineData.map((val) => ({ value: val })) : []);

  // Cor fixa (Vermelho V4) para manter o design consistente, ignorando cores antigas
  const chartColor = "hsl(0, 85%, 55%)";

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 flex flex-col justify-between h-full premium-card group hover:border-primary/40 transition-all duration-300",
        className,
      )}
    >
      {/* Topo: Título e Ícone */}
      <div className="flex items-center justify-between mb-4 z-10 relative">
        <span className="text-sm font-medium text-muted-foreground truncate pr-2">{title}</span>
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Meio: Valor e Descrição */}
      <div className="flex flex-col z-10 relative mb-2">
        {/* Valor com tamanho responsivo */}
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">{value}</h3>
        {description && <p className="text-xs text-muted-foreground mt-1 truncate opacity-80">{description}</p>}
      </div>

      {/* Fundo: Gráfico (Grande e Visível) */}
      <div className="absolute bottom-0 right-0 w-full h-[60px] opacity-20 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none">
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
