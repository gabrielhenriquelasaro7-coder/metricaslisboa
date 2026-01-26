import { Card } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface FunnelStep {
  name: string;
  value: number;
  platform?: string;
  fill?: string;
}

interface FunnelChartProps {
  data: FunnelStep[];
  platformFilter?: string;
  className?: string;
}

export default function FunnelChart({ data, platformFilter = "all", className }: FunnelChartProps) {
  const { t } = useTranslation();

  // Filtragem dos dados (Google vs Meta)
  const filteredData = data.filter((item) => {
    if (!platformFilter || platformFilter === "all") return true;
    const itemPlatform = (item.platform || "").toLowerCase();
    const filter = platformFilter.toLowerCase();

    if (filter.includes("google")) return itemPlatform.includes("google");
    if (filter.includes("meta")) return itemPlatform.includes("meta");

    return itemPlatform === filter;
  });

  // Agrupamento e Soma dos valores
  const aggregatedData = Object.values(
    filteredData.reduce(
      (acc, curr) => {
        // Normaliza a chave para minúsculas (ex: "Impressions" -> "impressions")
        const key = curr.name.toLowerCase();
        if (!acc[key]) {
          acc[key] = { ...curr, name: key, value: 0 };
        }
        acc[key].value += curr.value;
        return acc;
      },
      {} as Record<string, FunnelStep>,
    ),
  );

  // Ordem correta do funil
  const sortOrder = ["impressions", "clicks", "conversions", "sales", "leads", "purchases"];
  aggregatedData.sort((a, b) => {
    const indexA = sortOrder.indexOf(a.name.toLowerCase());
    const indexB = sortOrder.indexOf(b.name.toLowerCase());
    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
  });

  // Função que resolve o problema dos nomes estranhos
  const getTranslatedLabel = (key: string) => {
    if (!key) return "";
    const lowerKey = key.toLowerCase();

    // Procura a tradução em várias secções do seu arquivo JSON
    // Tenta 'metrics.impressions', se não achar tenta 'dashboard.impressions', etc.
    const label = t(`metrics.${lowerKey}`, t(`dashboard.${lowerKey}`, t(`comparison.${lowerKey}`, "")));

    // Se achou tradução, usa. Se não, deixa a primeira letra maiúscula (fallback).
    return label || key.charAt(0).toUpperCase() + key.slice(1);
  };

  const colors = ["#ef4444", "#f97316", "#eab308", "#10b981", "#3b82f6"];

  return (
    <Card className={cn("p-6 flex flex-col h-[400px] premium-card", className)}>
      <h3 className="text-lg font-semibold mb-6">{t("dashboard.funnelChart", "Funil de Conversão")}</h3>

      <div className="flex-1 w-full min-h-0">
        {aggregatedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aggregatedData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tickFormatter={(value) => getTranslatedLabel(value)}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border p-2 rounded-lg shadow-lg">
                        <p className="text-sm font-medium text-foreground">{getTranslatedLabel(data.name)}</p>
                        <p className="text-2xl font-bold text-primary">
                          {new Intl.NumberFormat("pt-BR").format(data.value)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                {aggregatedData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                    className="opacity-80 hover:opacity-100 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
            {t("common.noData", "Sem dados disponíveis")}
          </div>
        )}
      </div>
    </Card>
  );
}
