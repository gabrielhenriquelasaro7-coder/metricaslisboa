import { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface GeoData {
  breakdown_value: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversion_value: number;
}

interface GeographicHeatMapProps {
  countryData: GeoData[];
  regionData: GeoData[];
  isLoading: boolean;
  className?: string;
  currency?: string;
}

// Coordenadas para estados brasileiros
const BRAZIL_STATES_COORDS: Record<string, [number, number]> = {
  'Acre': [-9.0238, -70.8120],
  'Alagoas': [-9.5713, -36.7820],
  'Amapá': [1.4102, -51.7772],
  'Amazonas': [-3.4168, -65.8561],
  'Bahia': [-12.5797, -41.7007],
  'Ceará': [-5.4984, -39.3206],
  'Distrito Federal': [-15.7998, -47.8645],
  'Espírito Santo': [-19.1834, -40.3089],
  'Goiás': [-15.8270, -49.8362],
  'Maranhão': [-4.9609, -45.2744],
  'Mato Grosso': [-12.6819, -56.9211],
  'Mato Grosso do Sul': [-20.7722, -54.7852],
  'Minas Gerais': [-18.5122, -44.5550],
  'Pará': [-3.4168, -52.2166],
  'Paraíba': [-7.2400, -36.7820],
  'Paraná': [-24.8934, -51.5500],
  'Pernambuco': [-8.3137, -37.8597],
  'Piauí': [-7.7183, -42.7289],
  'Rio de Janeiro': [-22.2587, -42.6505],
  'Rio Grande do Norte': [-5.8126, -36.5900],
  'Rio Grande do Sul': [-30.0346, -51.2177],
  'Rondônia': [-10.8307, -63.3461],
  'Roraima': [2.7376, -62.0751],
  'Santa Catarina': [-27.2423, -50.2189],
  'São Paulo': [-22.1922, -48.7945],
  'Sao Paulo': [-22.1922, -48.7945],
  'Sergipe': [-10.5741, -37.3857],
  'Tocantins': [-10.1753, -48.2982],
};

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('pt-BR');
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

type MetricType = 'clicks' | 'impressions' | 'conversions' | 'spend';

// Componente para o Heat Layer
function HeatLayer({ 
  data, 
  metric, 
  maxValue 
}: { 
  data: Array<{ coords: [number, number] | null; value: number }>; 
  metric: MetricType;
  maxValue: number;
}) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Remover layer anterior se existir
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Preparar dados para o heat map
    const heatData = data
      .filter(d => d.coords)
      .map(d => {
        const intensity = d.value / maxValue;
        return [d.coords![0], d.coords![1], intensity] as [number, number, number];
      });

    if (heatData.length === 0) return;

    // Criar heat layer - intensidade proporcional
    // @ts-ignore - leaflet.heat types
    heatLayerRef.current = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 12,
      max: 1.0,
      minOpacity: 0.4,
      gradient: {
        0.0: '#10b981',
        0.25: '#84cc16',
        0.5: '#eab308',
        0.75: '#f97316',
        1.0: '#ef4444'
      }
    }).addTo(map);

    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, data, metric, maxValue]);

  return null;
}

export function GeographicHeatMap({ 
  countryData, 
  regionData, 
  isLoading, 
  className,
  currency = 'BRL'
}: GeographicHeatMapProps) {
  const [metric, setMetric] = useState<MetricType>('clicks');

  // Processar dados de região com métricas calculadas
  // FILTRAR regiões com dados insignificantes (menos de 10 impressões ou menos de 1% do total)
  const processedData = useMemo(() => {
    if (!regionData?.length) return [];
    
    // Calcular total para threshold
    const totalImpressions = regionData.reduce((sum, item) => sum + item.impressions, 0);
    const minThreshold = Math.max(10, totalImpressions * 0.01); // Mínimo 10 impressões ou 1% do total
    
    return regionData
      .filter(item => item.impressions >= minThreshold || item.clicks > 0 || item.spend > 1)
      .map(item => {
        const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
        const cpc = item.clicks > 0 ? item.spend / item.clicks : 0;
        const coords = BRAZIL_STATES_COORDS[item.breakdown_value] || null;
        return {
          ...item,
          ctr,
          cpc,
          coords
        };
      })
      .sort((a, b) => b[metric] - a[metric]);
  }, [regionData, metric]);

  // Dados para o heat map
  const heatMapData = useMemo(() => {
    return processedData.map(item => ({
      coords: item.coords,
      value: item[metric]
    }));
  }, [processedData, metric]);

  // Valor máximo para escala
  const maxValue = useMemo(() => {
    if (!processedData.length) return 1;
    return Math.max(...processedData.map(d => d[metric]));
  }, [processedData, metric]);

  const getMetricLabel = (m: MetricType): string => {
    switch (m) {
      case 'clicks': return 'Cliques';
      case 'impressions': return 'Impressões';
      case 'conversions': return 'Conversões';
      case 'spend': return 'Investimento';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasData = processedData.length > 0;

  if (!hasData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Geolocalização
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <MapPin className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">Nenhum dado geográfico disponível</p>
          <p className="text-xs mt-1">Sincronize os dados demográficos para ver o mapa</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <CardTitle className="text-base text-emerald-400">Geolocalização</CardTitle>
            <span className="text-xs text-muted-foreground">Cliques, Impressões, CTR e CPC</span>
          </div>
          <div className="flex items-center gap-4">
            <CardTitle className="text-base text-emerald-400">Mapa de Calor</CardTitle>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clicks">Cliques</SelectItem>
                <SelectItem value="impressions">Impressões</SelectItem>
                <SelectItem value="conversions">Conversões</SelectItem>
                <SelectItem value="spend">Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mapa de calor interativo - GRANDE */}
        <div className="relative h-[500px] rounded-lg border border-border overflow-hidden">
          <MapContainer
            center={[-14.235, -51.925]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <HeatLayer 
              data={heatMapData} 
              metric={metric} 
              maxValue={maxValue} 
            />
          </MapContainer>

          {/* Legenda */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border z-[1000]">
            <span>{getMetricLabel(metric)}</span>
            <div className="flex items-center h-3 w-24 rounded-sm overflow-hidden">
              <div className="h-full flex-1" style={{ background: 'linear-gradient(to right, #00ff00, #7fff00, #ffff00, #ff7f00, #ff0000)' }}></div>
            </div>
            <span>{formatNumber(maxValue)}</span>
          </div>

          {/* Contador */}
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border z-[1000]">
            {processedData.length} regiões
          </div>
        </div>

        {/* Tabela de dados - EMBAIXO */}
        <div className="rounded-xl border border-border overflow-hidden bg-card/50">
          <div className="grid grid-cols-7 gap-0 bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground border-b border-border">
            <div className="text-center">#</div>
            <div>Região</div>
            <div className="text-right">Cliques</div>
            <div className="text-right">Impressões</div>
            <div className="text-right">CTR</div>
            <div className="text-right">Conversões</div>
            <div className="text-right">CPC</div>
          </div>
          <ScrollArea className="h-[250px]">
            <div className="divide-y divide-border/50">
              {processedData.map((item, index) => {
                const isTop = index < 3;
                const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
                return (
                  <div 
                    key={item.breakdown_value}
                    className={`grid grid-cols-7 gap-0 px-4 py-3 text-sm transition-colors hover:bg-muted/20 ${isTop ? 'bg-gradient-to-r from-red-500/5 to-transparent' : ''}`}
                  >
                    <div className={`text-center font-bold ${isTop ? rankColors[index] : 'text-muted-foreground'}`}>
                      {index + 1}
                    </div>
                    <div className="font-medium truncate">{item.breakdown_value}</div>
                    <div className={`text-right tabular-nums ${isTop ? 'text-emerald-400 font-semibold' : ''}`}>
                      {formatNumber(item.clicks)}
                    </div>
                    <div className={`text-right tabular-nums ${isTop ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {formatNumber(item.impressions)}
                    </div>
                    <div className={`text-right tabular-nums ${item.ctr > 5 ? 'text-emerald-400' : item.ctr < 2 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {formatPercent(item.ctr)}
                    </div>
                    <div className={`text-right tabular-nums ${item.conversions > 0 ? 'text-purple-400 font-medium' : 'text-muted-foreground'}`}>
                      {formatNumber(item.conversions)}
                    </div>
                    <div className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(item.cpc, currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
