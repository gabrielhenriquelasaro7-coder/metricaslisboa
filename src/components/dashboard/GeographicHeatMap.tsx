import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Globe, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';

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

// Coordenadas aproximadas para países
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'BR': [-14.235, -51.925],
  'US': [37.090, -95.712],
  'PT': [39.399, -8.224],
  'ES': [40.463, -3.749],
  'AR': [-38.416, -63.616],
  'MX': [23.634, -102.552],
  'CO': [4.570, -74.297],
  'CL': [-35.675, -71.542],
  'PE': [-9.189, -75.015],
  'UY': [-32.522, -55.765],
  'GB': [55.378, -3.436],
  'FR': [46.227, 2.213],
  'DE': [51.165, 10.451],
  'IT': [41.871, 12.567],
  'CA': [56.130, -106.346],
  'AU': [-25.274, 133.775],
  'JP': [36.204, 138.252],
  'IN': [20.593, 78.962],
  'CN': [35.861, 104.195],
};

// Coordenadas para estados brasileiros
const BRAZIL_STATES: Record<string, [number, number]> = {
  'São Paulo': [-23.550, -46.633],
  'Sao Paulo': [-23.550, -46.633],
  'Rio de Janeiro': [-22.906, -43.172],
  'Minas Gerais': [-19.917, -43.934],
  'Bahia': [-12.971, -38.501],
  'Paraná': [-25.428, -49.273],
  'Rio Grande do Sul': [-30.034, -51.217],
  'Pernambuco': [-8.047, -34.877],
  'Ceará': [-3.717, -38.543],
  'Pará': [-1.455, -48.490],
  'Santa Catarina': [-27.594, -48.548],
  'Goiás': [-16.686, -49.264],
  'Maranhão': [-2.530, -44.265],
  'Amazonas': [-3.119, -60.021],
  'Paraíba': [-7.115, -34.861],
  'Espírito Santo': [-20.319, -40.337],
  'Rio Grande do Norte': [-5.779, -35.200],
  'Mato Grosso': [-15.601, -56.097],
  'Mato Grosso do Sul': [-20.469, -54.620],
  'Alagoas': [-9.665, -35.735],
  'Piauí': [-5.092, -42.803],
  'Distrito Federal': [-15.780, -47.929],
  'Sergipe': [-10.947, -37.073],
  'Rondônia': [-8.761, -63.903],
  'Tocantins': [-10.184, -48.333],
  'Acre': [-9.975, -67.810],
  'Amapá': [0.034, -51.066],
  'Roraima': [2.820, -60.672],
};

// Nomes de países
const COUNTRY_NAMES: Record<string, string> = {
  'BR': 'Brasil',
  'US': 'Estados Unidos',
  'PT': 'Portugal',
  'ES': 'Espanha',
  'AR': 'Argentina',
  'MX': 'México',
  'CO': 'Colômbia',
  'CL': 'Chile',
  'PE': 'Peru',
  'UY': 'Uruguai',
  'GB': 'Reino Unido',
  'FR': 'França',
  'DE': 'Alemanha',
  'IT': 'Itália',
  'CA': 'Canadá',
  'AU': 'Austrália',
  'JP': 'Japão',
  'IN': 'Índia',
  'CN': 'China',
};

function getCoords(value: string, type: 'country' | 'region'): [number, number] | null {
  if (type === 'country') {
    return COUNTRY_COORDS[value] || null;
  }
  // Try to match state names
  const normalized = value.trim();
  return BRAZIL_STATES[normalized] || null;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(value);
}

// Componente para ajustar o mapa quando dados mudam
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

type MetricType = 'impressions' | 'clicks' | 'conversions' | 'spend';

export function GeographicHeatMap({ 
  countryData, 
  regionData, 
  isLoading, 
  className,
  currency = 'BRL'
}: GeographicHeatMapProps) {
  const [viewMode, setViewMode] = useState<'country' | 'region'>('country');
  const [metric, setMetric] = useState<MetricType>('impressions');
  
  const data = viewMode === 'country' ? countryData : regionData;
  
  // Preparar dados com coordenadas
  const mappedData = useMemo(() => {
    if (!data?.length) return [];
    
    return data
      .map(item => {
        const coords = getCoords(item.breakdown_value, viewMode);
        return coords ? { ...item, coords } : null;
      })
      .filter((item): item is GeoData & { coords: [number, number] } => item !== null);
  }, [data, viewMode]);

  // Calcular valores máximos para escala de cores
  const maxValue = useMemo(() => {
    if (!mappedData.length) return 1;
    return Math.max(...mappedData.map(d => d[metric]));
  }, [mappedData, metric]);

  // Calcular centro e zoom
  const { center, zoom } = useMemo(() => {
    if (viewMode === 'region') {
      return { center: [-14.235, -51.925] as [number, number], zoom: 4 };
    }
    return { center: [0, -30] as [number, number], zoom: 2 };
  }, [viewMode]);

  // Função para calcular cor baseada no valor
  const getColor = (value: number): string => {
    const ratio = value / maxValue;
    if (ratio > 0.8) return '#ef4444'; // red
    if (ratio > 0.6) return '#f97316'; // orange
    if (ratio > 0.4) return '#eab308'; // yellow
    if (ratio > 0.2) return '#22c55e'; // green
    return '#3b82f6'; // blue
  };

  // Função para calcular raio baseado no valor
  const getRadius = (value: number): number => {
    const ratio = value / maxValue;
    return Math.max(8, Math.min(40, 8 + ratio * 32));
  };

  const getMetricLabel = (m: MetricType): string => {
    switch (m) {
      case 'impressions': return 'Impressões';
      case 'clicks': return 'Cliques';
      case 'conversions': return 'Conversões';
      case 'spend': return 'Investimento';
    }
  };

  const getDisplayName = (value: string): string => {
    if (viewMode === 'country') {
      return COUNTRY_NAMES[value] || value;
    }
    return value;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Mapa Geográfico
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasData = mappedData.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Distribuição Geográfica
          </CardTitle>
          <div className="flex gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'country' | 'region')}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="country">Por País</SelectItem>
                <SelectItem value="region">Por Estado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="impressions">Impressões</SelectItem>
                <SelectItem value="clicks">Cliques</SelectItem>
                <SelectItem value="conversions">Conversões</SelectItem>
                <SelectItem value="spend">Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <Globe className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">Nenhum dado geográfico disponível</p>
            <p className="text-xs mt-1">Sincronize os dados demográficos para ver o mapa</p>
          </div>
        ) : (
          <div className="relative">
            <div className="h-[400px] rounded-lg overflow-hidden border border-border">
              <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater center={center} zoom={zoom} />
                {mappedData.map((item, index) => (
                  <CircleMarker
                    key={`${item.breakdown_value}-${index}`}
                    center={item.coords}
                    radius={getRadius(item[metric])}
                    fillColor={getColor(item[metric])}
                    fillOpacity={0.7}
                    stroke={true}
                    weight={1}
                    color="#fff"
                    opacity={0.8}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">{getDisplayName(item.breakdown_value)}</p>
                        <div className="space-y-0.5 text-xs">
                          <p>Impressões: {formatNumber(item.impressions)}</p>
                          <p>Cliques: {formatNumber(item.clicks)}</p>
                          <p>Conversões: {formatNumber(item.conversions)}</p>
                          <p>Investimento: {formatCurrency(item.spend, currency)}</p>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            {/* Legenda */}
            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 text-xs">
              <p className="font-medium mb-1">{getMetricLabel(metric)}</p>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Baixo</span>
                <div className="w-3 h-3 rounded-full bg-green-500 ml-1"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Alto</span>
              </div>
            </div>

            {/* Top locations */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {mappedData.slice(0, 5).map((item, index) => (
                <div 
                  key={item.breakdown_value} 
                  className="bg-muted/50 rounded-lg p-2 text-center"
                >
                  <p className="text-xs text-muted-foreground">#{index + 1}</p>
                  <p className="font-medium text-sm truncate">{getDisplayName(item.breakdown_value)}</p>
                  <p className="text-xs text-muted-foreground">
                    {metric === 'spend' 
                      ? formatCurrency(item[metric], currency) 
                      : formatNumber(item[metric])}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
