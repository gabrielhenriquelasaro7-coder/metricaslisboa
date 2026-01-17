import { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { useIsMobile } from '@/hooks/use-mobile';

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
  'Rio de Janeiro (state)': [-22.2587, -42.6505],
  'Rio Grande do Norte': [-5.8126, -36.5900],
  'Rio Grande do Sul': [-30.0346, -51.2177],
  'Rondônia': [-10.8307, -63.3461],
  'Roraima': [2.7376, -62.0751],
  'Santa Catarina': [-27.2423, -50.2189],
  'São Paulo': [-22.1922, -48.7945],
  'Sao Paulo': [-22.1922, -48.7945],
  'São Paulo (state)': [-22.1922, -48.7945],
  'Sao Paulo (state)': [-22.1922, -48.7945],
  'Sergipe': [-10.5741, -37.3857],
  'Tocantins': [-10.1753, -48.2982],
};

// Coordenadas para estados dos EUA
const USA_STATES_COORDS: Record<string, [number, number]> = {
  'Alabama': [32.806671, -86.791130],
  'Alaska': [61.370716, -152.404419],
  'Arizona': [33.729759, -111.431221],
  'Arkansas': [34.969704, -92.373123],
  'California': [36.116203, -119.681564],
  'Colorado': [39.059811, -105.311104],
  'Connecticut': [41.597782, -72.755371],
  'Delaware': [39.318523, -75.507141],
  'Florida': [27.766279, -81.686783],
  'Georgia': [33.040619, -83.643074],
  'Hawaii': [21.094318, -157.498337],
  'Idaho': [44.240459, -114.478828],
  'Illinois': [40.349457, -88.986137],
  'Indiana': [39.849426, -86.258278],
  'Iowa': [42.011539, -93.210526],
  'Kansas': [38.526600, -96.726486],
  'Kentucky': [37.668140, -84.670067],
  'Louisiana': [31.169546, -91.867805],
  'Maine': [44.693947, -69.381927],
  'Maryland': [39.063946, -76.802101],
  'Massachusetts': [42.230171, -71.530106],
  'Michigan': [43.326618, -84.536095],
  'Minnesota': [45.694454, -93.900192],
  'Mississippi': [32.741646, -89.678696],
  'Missouri': [38.456085, -92.288368],
  'Montana': [46.921925, -110.454353],
  'Nebraska': [41.125370, -98.268082],
  'Nevada': [38.313515, -117.055374],
  'New Hampshire': [43.452492, -71.563896],
  'New Jersey': [40.298904, -74.521011],
  'New Mexico': [34.840515, -106.248482],
  'New York': [42.165726, -74.948051],
  'North Carolina': [35.630066, -79.806419],
  'North Dakota': [47.528912, -99.784012],
  'Ohio': [40.388783, -82.764915],
  'Oklahoma': [35.565342, -96.928917],
  'Oregon': [44.572021, -122.070938],
  'Pennsylvania': [40.590752, -77.209755],
  'Rhode Island': [41.680893, -71.511780],
  'South Carolina': [33.856892, -80.945007],
  'South Dakota': [44.299782, -99.438828],
  'Tennessee': [35.747845, -86.692345],
  'Texas': [31.054487, -97.563461],
  'Utah': [40.150032, -111.862434],
  'Vermont': [44.045876, -72.710686],
  'Virginia': [37.769337, -78.169968],
  'Washington': [47.400902, -121.490494],
  'West Virginia': [38.491226, -80.954456],
  'Wisconsin': [44.268543, -89.616508],
  'Wyoming': [42.755966, -107.302490],
  'District of Columbia': [38.897438, -77.026817],
  'Washington, D.C.': [38.897438, -77.026817],
};

// Coordenadas para países (centro geográfico)
const COUNTRY_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  'Brazil': { center: [-14.235, -51.925], zoom: 4 },
  'Brasil': { center: [-14.235, -51.925], zoom: 4 },
  'BR': { center: [-14.235, -51.925], zoom: 4 },
  'United States': { center: [39.8283, -98.5795], zoom: 4 },
  'US': { center: [39.8283, -98.5795], zoom: 4 },
  'USA': { center: [39.8283, -98.5795], zoom: 4 },
  'Mexico': { center: [23.6345, -102.5528], zoom: 5 },
  'MX': { center: [23.6345, -102.5528], zoom: 5 },
  'Argentina': { center: [-38.4161, -63.6167], zoom: 4 },
  'AR': { center: [-38.4161, -63.6167], zoom: 4 },
  'Colombia': { center: [4.5709, -74.2973], zoom: 5 },
  'CO': { center: [4.5709, -74.2973], zoom: 5 },
  'Chile': { center: [-35.6751, -71.5430], zoom: 4 },
  'CL': { center: [-35.6751, -71.5430], zoom: 4 },
  'Peru': { center: [-9.19, -75.0152], zoom: 5 },
  'PE': { center: [-9.19, -75.0152], zoom: 5 },
  'Portugal': { center: [39.3999, -8.2245], zoom: 6 },
  'PT': { center: [39.3999, -8.2245], zoom: 6 },
  'Spain': { center: [40.4637, -3.7492], zoom: 5 },
  'ES': { center: [40.4637, -3.7492], zoom: 5 },
  'United Kingdom': { center: [55.3781, -3.4360], zoom: 5 },
  'UK': { center: [55.3781, -3.4360], zoom: 5 },
  'GB': { center: [55.3781, -3.4360], zoom: 5 },
  'Germany': { center: [51.1657, 10.4515], zoom: 5 },
  'DE': { center: [51.1657, 10.4515], zoom: 5 },
  'France': { center: [46.2276, 2.2137], zoom: 5 },
  'FR': { center: [46.2276, 2.2137], zoom: 5 },
  'Italy': { center: [41.8719, 12.5674], zoom: 5 },
  'IT': { center: [41.8719, 12.5674], zoom: 5 },
  'Canada': { center: [56.1304, -106.3468], zoom: 3 },
  'CA': { center: [56.1304, -106.3468], zoom: 3 },
  'Australia': { center: [-25.2744, 133.7751], zoom: 4 },
  'AU': { center: [-25.2744, 133.7751], zoom: 4 },
};

// Combina todas as coordenadas de regiões
function getRegionCoords(regionName: string): [number, number] | null {
  // Tenta Brasil primeiro
  if (BRAZIL_STATES_COORDS[regionName]) {
    return BRAZIL_STATES_COORDS[regionName];
  }
  // Tenta EUA
  if (USA_STATES_COORDS[regionName]) {
    return USA_STATES_COORDS[regionName];
  }
  return null;
}

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

type MetricType = 'impressions' | 'spend' | 'clicks';

// Componente para atualizar view do mapa
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);
  
  return null;
}

// Componente para o Heat Layer - Estilo GA4/Looker Studio
function HeatLayer({ 
  data, 
  metric, 
  maxValue,
  minValue
}: { 
  data: Array<{ coords: [number, number] | null; value: number }>; 
  metric: MetricType;
  maxValue: number;
  minValue: number;
}) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  const updateHeatLayer = (currentZoom: number) => {
    if (!map) return;

    // Remove layer anterior
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Filtrar apenas pontos COM coordenadas válidas (regra 10)
    const validPoints = data.filter(d => d.coords !== null && d.value > 0);
    
    if (validPoints.length === 0) return;

    // Normalização logarítmica para evitar que valores altos dominem (regra 6)
    const logValues = validPoints.map(d => Math.log10(d.value + 1));
    const logMin = Math.min(...logValues);
    const logMax = Math.max(...logValues);
    const logRange = logMax - logMin;

    // Criar pontos de calor com intensidade normalizada
    const heatData = validPoints.map(d => {
      const logValue = Math.log10(d.value + 1);
      
      let intensity: number;
      
      // Se há apenas 1 ponto OU todos têm o mesmo valor → máxima intensidade (vermelho)
      if (validPoints.length === 1 || logRange === 0) {
        intensity = 1.0;
      } else {
        // Normalização 0-1 com escala logarítmica
        const normalizedIntensity = (logValue - logMin) / logRange;
        // Garantir mínimo de 0.2 para visibilidade e máximo de 1.0
        intensity = Math.max(0.2, Math.min(1.0, normalizedIntensity));
      }
      
      return [d.coords![0], d.coords![1], intensity] as [number, number, number];
    });

    // Raio dinâmico baseado no zoom
    const baseRadius = 30;
    const zoomFactor = Math.max(0.6, Math.pow(1.12, currentZoom - 4));
    const dynamicRadius = Math.min(Math.max(baseRadius * zoomFactor, 20), 55);
    
    // Blur baixo para bordas definidas - estilo GA4 (regra 9)
    const dynamicBlur = dynamicRadius * 0.4;

    // @ts-ignore
    heatLayerRef.current = L.heatLayer(heatData, {
      radius: dynamicRadius,
      blur: dynamicBlur,
      maxZoom: 12, // Limitar expansão do calor (regra 7)
      max: 1.0,
      minOpacity: 0.4, // Visibilidade mínima (regra 7)
      gradient: {
        // Gradiente suave: amarelo claro (baixo) -> vermelho escuro (alto)
        0.0: '#fefce8',  // Amarelo muito claro
        0.15: '#fef08a', // Amarelo claro
        0.3: '#fde047',  // Amarelo
        0.45: '#facc15', // Amarelo dourado
        0.55: '#f59e0b', // Laranja
        0.7: '#ea580c',  // Laranja escuro
        0.85: '#dc2626', // Vermelho
        1.0: '#991b1b'   // Vermelho escuro
      }
    }).addTo(map);
  };

  useEffect(() => {
    if (!map) return;

    updateHeatLayer(map.getZoom());

    const onZoom = () => updateHeatLayer(map.getZoom());
    map.on('zoomend', onZoom);

    return () => {
      map.off('zoomend', onZoom);
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, data, metric, maxValue, minValue]);

  return null;
}

export function GeographicHeatMap({ 
  countryData, 
  regionData, 
  isLoading, 
  className,
  currency = 'BRL'
}: GeographicHeatMapProps) {
  const [metric, setMetric] = useState<MetricType>('impressions');
  const isMobile = useIsMobile();

  // Detectar país principal baseado nos dados
  const { mapCenter, mapZoom, detectedCountry } = useMemo(() => {
    if (!countryData?.length) {
      return { mapCenter: [-14.235, -51.925] as [number, number], mapZoom: 4, detectedCountry: 'Brazil' };
    }

    // Ordenar por spend para encontrar o país principal
    const sortedCountries = [...countryData].sort((a, b) => b.spend - a.spend);
    const topCountry = sortedCountries[0]?.breakdown_value || 'Brazil';

    // Buscar configuração do país
    const countryConfig = COUNTRY_COORDS[topCountry];
    if (countryConfig) {
      return { 
        mapCenter: countryConfig.center, 
        mapZoom: countryConfig.zoom, 
        detectedCountry: topCountry 
      };
    }

    // Fallback para Brasil
    return { mapCenter: [-14.235, -51.925] as [number, number], mapZoom: 4, detectedCountry: topCountry };
  }, [countryData]);

  // Processar dados de região
  const processedData = useMemo(() => {
    if (!regionData?.length) return [];
    
    const totalImpressions = regionData.reduce((sum, item) => sum + item.impressions, 0);
    const minThreshold = Math.max(10, totalImpressions * 0.01);
    
    return regionData
      .filter(item => item.impressions >= minThreshold || item.clicks > 0 || item.spend > 1)
      .map(item => {
        const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
        const cpc = item.clicks > 0 ? item.spend / item.clicks : 0;
        const coords = getRegionCoords(item.breakdown_value);
        return {
          ...item,
          ctr,
          cpc,
          coords
        };
      })
      .sort((a, b) => b[metric] - a[metric]);
  }, [regionData, metric]);

  const heatMapData = useMemo(() => {
    return processedData.map(item => ({
      coords: item.coords,
      value: item[metric]
    }));
  }, [processedData, metric]);

  const maxValue = useMemo(() => {
    if (!processedData.length) return 1;
    return Math.max(...processedData.map(d => d[metric]));
  }, [processedData, metric]);

  const minValue = useMemo(() => {
    if (!processedData.length) return 0;
    const values = processedData.map(d => d[metric]).filter(v => v > 0);
    return values.length > 0 ? Math.min(...values) : 0;
  }, [processedData, metric]);

  const getMetricLabel = (m: MetricType): string => {
    switch (m) {
      case 'impressions': return 'Impressões';
      case 'spend': return 'Investimento';
      case 'clicks': return 'Cliques';
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
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-6 sm:h-8 w-1 bg-gradient-to-b from-orange-500 to-red-500 rounded-full" />
            <div>
              <CardTitle className="text-sm sm:text-lg font-semibold">Mapa de Calor</CardTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {detectedCountry} • {processedData.length} regiões
              </p>
            </div>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
            <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="impressions">Impressões</SelectItem>
              <SelectItem value="clicks">Cliques</SelectItem>
              <SelectItem value="spend">Investimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {/* Mapa de calor interativo */}
        <div className="relative h-[220px] sm:h-[300px] md:h-[400px] lg:h-[450px] rounded-lg border border-border overflow-hidden">
          <MapContainer
            center={mapCenter}
            zoom={isMobile ? Math.max(mapZoom - 1, 3) : mapZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={!isMobile}
            zoomControl={!isMobile}
            dragging={!isMobile}
            touchZoom={false}
            doubleClickZoom={!isMobile}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapUpdater center={mapCenter} zoom={isMobile ? Math.max(mapZoom - 1, 3) : mapZoom} />
            <HeatLayer 
              data={heatMapData} 
              metric={metric} 
              maxValue={maxValue}
              minValue={minValue}
            />
          </MapContainer>

          {/* Legenda - simplificada no mobile */}
          <div className="absolute bottom-2 left-2 right-2 sm:left-3 sm:right-auto flex items-center justify-between sm:justify-start gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground bg-card/95 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-border z-[1000]">
            <span className="hidden sm:inline">{getMetricLabel(metric)}</span>
            <div className="flex items-center h-2 sm:h-3 w-16 sm:w-24 rounded-sm overflow-hidden">
              <div className="h-full flex-1" style={{ background: 'linear-gradient(to right, #fef08a, #fbbf24, #f97316, #ef4444, #991b1b)' }}></div>
            </div>
            <span className="text-[10px] sm:text-xs">{formatNumber(minValue)} - {formatNumber(maxValue)}</span>
          </div>
        </div>

        {/* Top Regiões - Lista simples no mobile */}
        <div className="mt-3 sm:mt-4">
          <h4 className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 flex items-center gap-2">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
            Top Regiões
          </h4>
          <ScrollArea className="h-[160px] sm:h-[200px]">
            <div className="space-y-1">
              {processedData.slice(0, 10).map((item, index) => (
                <div 
                  key={item.breakdown_value} 
                  className="flex items-center justify-between py-2 px-2 sm:px-3 rounded-md hover:bg-muted/30 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-[10px] sm:text-xs text-muted-foreground w-4 sm:w-5 shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-medium truncate">
                      {item.breakdown_value}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <span className="text-xs sm:text-sm font-semibold">
                      {metric === 'spend' 
                        ? formatCurrency(item[metric], currency)
                        : formatNumber(item[metric])}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                      CTR {formatPercent(item.ctr)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
