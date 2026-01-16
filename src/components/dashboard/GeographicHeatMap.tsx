import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

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

// Coordenadas SVG para estados brasileiros (posição relativa no mapa)
const BRAZIL_STATES_COORDS: Record<string, { x: number; y: number }> = {
  'Acre': { x: 85, y: 195 },
  'Alagoas': { x: 380, y: 220 },
  'Amapá': { x: 275, y: 80 },
  'Amazonas': { x: 150, y: 150 },
  'Bahia': { x: 345, y: 250 },
  'Ceará': { x: 360, y: 175 },
  'Distrito Federal': { x: 290, y: 285 },
  'Espírito Santo': { x: 355, y: 310 },
  'Goiás': { x: 270, y: 280 },
  'Maranhão': { x: 305, y: 165 },
  'Mato Grosso': { x: 210, y: 250 },
  'Mato Grosso do Sul': { x: 215, y: 330 },
  'Minas Gerais': { x: 315, y: 300 },
  'Pará': { x: 240, y: 140 },
  'Paraíba': { x: 385, y: 190 },
  'Paraná': { x: 245, y: 365 },
  'Pernambuco': { x: 375, y: 200 },
  'Piauí': { x: 325, y: 195 },
  'Rio de Janeiro': { x: 340, y: 335 },
  'Rio Grande do Norte': { x: 385, y: 175 },
  'Rio Grande do Sul': { x: 230, y: 410 },
  'Rondônia': { x: 135, y: 225 },
  'Roraima': { x: 165, y: 75 },
  'Santa Catarina': { x: 255, y: 385 },
  'São Paulo': { x: 280, y: 340 },
  'Sao Paulo': { x: 280, y: 340 },
  'Sergipe': { x: 380, y: 235 },
  'Tocantins': { x: 285, y: 215 },
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

export function GeographicHeatMap({ 
  countryData, 
  regionData, 
  isLoading, 
  className,
  currency = 'BRL'
}: GeographicHeatMapProps) {
  const [metric, setMetric] = useState<MetricType>('clicks');

  // Processar dados de região com métricas calculadas
  const processedData = useMemo(() => {
    if (!regionData?.length) return [];
    
    return regionData
      .map(item => {
        const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
        const cpc = item.clicks > 0 ? item.spend / item.clicks : 0;
        return {
          ...item,
          ctr,
          cpc,
          coords: BRAZIL_STATES_COORDS[item.breakdown_value] || null
        };
      })
      .sort((a, b) => b[metric] - a[metric]);
  }, [regionData, metric]);

  // Valor máximo para escala de cores
  const maxValue = useMemo(() => {
    if (!processedData.length) return 1;
    return Math.max(...processedData.map(d => d[metric]));
  }, [processedData, metric]);

  // Função para calcular cor baseada no valor (verde -> amarelo -> laranja -> vermelho)
  const getHeatColor = (value: number): string => {
    const ratio = value / maxValue;
    if (ratio > 0.75) return '#ef4444'; // Vermelho
    if (ratio > 0.5) return '#f97316'; // Laranja
    if (ratio > 0.25) return '#eab308'; // Amarelo
    return '#22c55e'; // Verde
  };

  // Função para calcular opacidade e tamanho baseado no valor
  const getHeatIntensity = (value: number): { opacity: number; radius: number } => {
    const ratio = value / maxValue;
    return {
      opacity: 0.4 + ratio * 0.5,
      radius: 15 + ratio * 35
    };
  };

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
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tabela de dados */}
          <ScrollArea className="h-[400px] rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">CPC médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.map((item, index) => {
                  const isTop = index < 3;
                  return (
                    <TableRow 
                      key={item.breakdown_value}
                      className={isTop ? 'bg-red-500/10' : ''}
                    >
                      <TableCell className="text-center text-muted-foreground">{index + 1}.</TableCell>
                      <TableCell className="font-medium">{item.breakdown_value}</TableCell>
                      <TableCell className={`text-right ${isTop ? 'text-emerald-400 font-semibold' : ''}`}>
                        {formatNumber(item.clicks)}
                      </TableCell>
                      <TableCell className={`text-right ${isTop ? 'text-emerald-400' : ''}`}>
                        {formatNumber(item.impressions)}
                      </TableCell>
                      <TableCell className={`text-right ${item.ctr > 5 ? 'text-emerald-400' : item.ctr < 2 ? 'text-red-400' : ''}`}>
                        {formatPercent(item.ctr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.conversions)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.cpc, currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Mapa de calor SVG */}
          <div className="relative h-[400px] bg-muted/30 rounded-lg border border-border overflow-hidden">
            {/* Mapa do Brasil simplificado em SVG */}
            <svg 
              viewBox="0 0 450 480" 
              className="w-full h-full"
              style={{ background: 'linear-gradient(180deg, hsl(var(--muted)/0.3) 0%, hsl(var(--muted)/0.1) 100%)' }}
            >
              {/* Contorno simplificado do Brasil */}
              <path
                d="M165,60 L195,45 L245,55 L290,50 L320,70 L360,85 L395,120 L405,160 L395,200 L400,240 L390,280 L375,320 L355,355 L330,380 L290,410 L250,430 L220,440 L190,430 L170,400 L150,370 L140,330 L125,290 L115,250 L105,210 L95,170 L100,130 L120,90 L165,60 Z"
                fill="hsl(var(--muted)/0.2)"
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
              
              {/* Pontos de calor para cada estado */}
              {processedData.map((item) => {
                if (!item.coords) return null;
                const { opacity, radius } = getHeatIntensity(item[metric]);
                const color = getHeatColor(item[metric]);
                
                return (
                  <g key={item.breakdown_value}>
                    {/* Glow exterior */}
                    <circle
                      cx={item.coords.x}
                      cy={item.coords.y}
                      r={radius * 1.5}
                      fill={color}
                      opacity={opacity * 0.3}
                      style={{ filter: 'blur(10px)' }}
                    />
                    {/* Círculo principal */}
                    <circle
                      cx={item.coords.x}
                      cy={item.coords.y}
                      r={radius}
                      fill={color}
                      opacity={opacity * 0.6}
                      style={{ filter: 'blur(5px)' }}
                    />
                    {/* Centro mais intenso */}
                    <circle
                      cx={item.coords.x}
                      cy={item.coords.y}
                      r={radius * 0.4}
                      fill={color}
                      opacity={opacity * 0.9}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Legenda */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-muted-foreground bg-card/80 backdrop-blur-sm px-2 py-1 rounded">
              <span>{getMetricLabel(metric)}</span>
              <div className="flex items-center gap-0.5">
                <div className="w-4 h-2 bg-green-500 rounded-sm opacity-70"></div>
                <div className="w-4 h-2 bg-yellow-500 rounded-sm opacity-70"></div>
                <div className="w-4 h-2 bg-orange-500 rounded-sm opacity-70"></div>
                <div className="w-4 h-2 bg-red-500 rounded-sm opacity-70"></div>
              </div>
              <span>{formatNumber(maxValue)}</span>
            </div>

            {/* Paginação simulada */}
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-card/80 backdrop-blur-sm px-2 py-1 rounded">
              1 - {processedData.length} / {processedData.length}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
