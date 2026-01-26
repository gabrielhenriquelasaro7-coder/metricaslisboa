import { Card } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// Interface dos dados
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

  // Filtragem robusta (ignora maiúsculas/minúsculas)
  const filteredData = data.filter((item) => {
    if (!platformFilter || platformFilter === "all") return true;
    const itemPlatform = (item.platform || "").toLowerCase();
    const filter = platformFilter.toLowerCase();

    if (filter.includes("google")) return itemPlatform.includes("google");
    if (filter.includes("meta") || filter.includes("facebook")) return itemPlatform.includes("meta");

    return itemPlatform === filter;
  });

  // Agrupa os dados se houver duplicatas após o filtro (ex: soma impressões de todas as campanhas)
  const aggregatedData = Object.values(
    filteredData.reduce(
      (acc, curr) => {
        if (!acc[curr.name]) {
          acc[curr.name] = { ...curr, value: 0 };
        }
        acc[curr.name].value += curr.value;
        return acc;
      },
      {} as Record<string, FunnelStep>,
    ),
  );

  // Ordem lógica do funil (se necessário, pode ajustar esta lista)
  const sortOrder = ["impressions", "clicks", "conversions", "sales"];
  aggregatedData.sort((a, b) => sortOrder.indexOf(a.name) - sortOrder.indexOf(b.name));

  // Função auxiliar para traduzir o nome da etapa
  const getTranslatedLabel = (key: string) => {
    // Tenta encontrar em 'metrics', depois em 'dashboard', ou usa a chave original
    return t(`metrics.${key}`, t(`dashboard.${key}`, key));
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  // Cores personalizadas para o funil
  const colors = ["#ef4444", "#f97316", "#eab308", "#10b981"];

  return (
    <Card className={cn("p-6 flex flex-col h-[400px] premium-card", className)}>
      <h3 className="text-lg font-semibold mb-6">{t("dashboard.funnelChart", "Funil de Conversão")}</h3>

      <div className="flex-1 w-full min-h-0">
        {aggregatedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aggregatedData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tickFormatter={(value) => getTranslatedLabel(value)} // TRADUÇÃO AQUI
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
                        <p className="text-sm font-medium">{getTranslatedLabel(data.name)}</p>
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
                {aggregatedData.map((entry, index) => (
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
