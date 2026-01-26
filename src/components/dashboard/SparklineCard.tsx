import { Card } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SparklineCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  data: { value: number }[];
  className?: string;
  // Props mantidas para compatibilidade, mas ignoradas no render
  change?: number;
  trend?: "up" | "down" | "neutral";
  description?: string;
}

export default function SparklineCard({
  title,
  value,
  icon: Icon,
  data,
  className,
  // Ignoramos change e trend para não mostrar o badge
  change: _change,
  trend: _trend,
  description,
}: SparklineCardProps) {
  // Cor do gráfico baseada apenas no tema (sempre clean)
  const chartColor = "hsl(var(--primary))";

  return (
    <Card className={cn("p-4 flex flex-col justify-between overflow-hidden premium-card group", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground truncate tracking-tight">{title}</span>
        <div className="premium-icon w-8 h-8 flex items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <h3 className="text-2xl font-bold tracking-tight truncate">{value}</h3>
          {description && <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>}
        </div>

        <div className="h-[40px] w-[80px] shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
