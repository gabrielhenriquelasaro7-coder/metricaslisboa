import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

const STATE_COORDINATES: Record<string, [number, number]> = {
  SP: [-23.5505, -46.6333],
  RJ: [-22.9068, -43.1729],
  MG: [-19.9167, -43.9345],
  RS: [-30.0346, -51.2177],
  PR: [-25.4284, -49.2733],
  SC: [-27.5954, -48.548],
  BA: [-12.9777, -38.5016],
  DF: [-15.7975, -47.8919],
  PE: [-8.0476, -34.877],
  CE: [-3.7172, -38.5434],
  // Adicione outros estados conforme necessário
};

interface GeoData {
  state: string;
  impressions: number;
  clicks: number;
  spend: number;
  platform?: string;
}

interface GeographicHeatMapProps {
  data: GeoData[];
  platformFilter?: string;
  className?: string;
  countryData?: any[]; // Mantido para compatibilidade
  regionData?: any[]; // Mantido para compatibilidade
  isLoading?: boolean; // Mantido para compatibilidade
  currency?: string; // Mantido para compatibilidade
}

export function GeographicHeatMap({
  data,
  platformFilter = "all",
  className,
  regionData, // Se vier do Dashboard antigo
}: GeographicHeatMapProps) {
  const { t } = useTranslation();
  const [selectedMetric, setSelectedMetric] = useState<"impressions" | "clicks" | "spend">("spend");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Usa 'data' ou 'regionData' (fallback)
  const sourceData = data || regionData || [];

  const filteredData = sourceData.filter((item) => {
    if (!platformFilter || platformFilter === "all") return true;
    const itemPlatform = (item.platform || "").toLowerCase();
    const filter = platformFilter.toLowerCase();
    if (filter.includes("google")) return itemPlatform.includes("google");
    if (filter.includes("meta")) return itemPlatform.includes("meta");
    return itemPlatform === filter;
  });

  const stateData = filteredData.reduce(
    (acc, curr) => {
      const state = curr.state || "Unknown";
      if (!acc[state]) {
        acc[state] = { state, impressions: 0, clicks: 0, spend: 0 };
      }
      acc[state].impressions += curr.impressions || 0;
      acc[state].clicks += curr.clicks || 0;
      acc[state].spend += curr.spend || 0;
      return acc;
    },
    {} as Record<string, GeoData>,
  );

  const chartData = Object.values(stateData);
  const maxValue = Math.max(...chartData.map((d) => d[selectedMetric] || 0), 1);

  if (!mounted) return <Card className={cn("h-[500px] premium-card", className)} />;

  return (
    <Card className={cn("flex flex-col h-[500px] premium-card overflow-hidden", className)}>
      <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 z-[1000] relative bg-card/50 backdrop-blur-sm">
        <h3 className="text-lg font-semibold">{t("geographic.title", "Mapa Geográfico")}</h3>

        <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("common.filter", "Filtrar")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spend">{t("metrics.spend", "Investimento")}</SelectItem>
            <SelectItem value="impressions">{t("metrics.impressions", "Impressões")}</SelectItem>
            <SelectItem value="clicks">{t("metrics.clicks", "Cliques")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 w-full relative z-0">
        <MapContainer
          center={[-14.235, -51.925]}
          zoom={3.5}
          scrollWheelZoom={false}
          className="w-full h-full bg-slate-900/20"
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {chartData.map((item) => {
            const coords = STATE_COORDINATES[item.state];
            if (!coords) return null;

            const value = item[selectedMetric];
            const radius = 5 + (value / maxValue) * 25;

            return (
              <CircleMarker
                key={item.state}
                center={coords}
                radius={radius}
                fillColor="hsl(0, 85%, 55%)"
                color="hsl(0, 85%, 55%)"
                weight={1}
                opacity={0.8}
                fillOpacity={0.6}
              >
                <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="text-center">
                    <strong className="block text-sm">{item.state}</strong>
                    <span className="text-xs text-muted-foreground">
                      {selectedMetric === "spend"
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
                        : new Intl.NumberFormat("pt-BR").format(value)}
                    </span>
                  </div>
                </LeafletTooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </Card>
  );
}
