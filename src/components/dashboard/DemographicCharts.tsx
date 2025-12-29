import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DemographicInsights, DemographicData } from '@/hooks/useDemographicInsights';
import { Users, Smartphone, Globe, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemographicChartsProps {
  data: DemographicInsights | null;
  isLoading: boolean;
  className?: string;
}

const COLORS = [
  'hsl(220, 70%, 50%)',
  'hsl(142, 76%, 36%)',
  'hsl(280, 70%, 50%)',
  'hsl(30, 70%, 50%)',
  'hsl(340, 70%, 50%)',
  'hsl(180, 70%, 45%)',
  'hsl(0, 70%, 50%)',
  'hsl(50, 80%, 45%)',
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toFixed(0);
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Feminino',
  unknown: 'Desconhecido',
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  desktop: 'Desktop',
  tablet: 'Tablet',
  unknown: 'Desconhecido',
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  audience_network: 'Audience Network',
  whatsapp: 'WhatsApp',
  unknown: 'Desconhecido',
};

function translateLabel(type: string, value: string): string {
  switch (type) {
    case 'gender':
      return GENDER_LABELS[value.toLowerCase()] || value;
    case 'device_platform':
      return DEVICE_LABELS[value.toLowerCase()] || value;
    case 'publisher_platform':
      return PLATFORM_LABELS[value.toLowerCase()] || value;
    default:
      return value;
  }
}

function DemographicPieChart({ 
  data, 
  type, 
  title, 
  icon: Icon 
}: { 
  data: DemographicData[]; 
  type: string;
  title: string; 
  icon: React.ElementType;
}) {
  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);
  
  const chartData = data.map((d, i) => ({
    name: translateLabel(type, d.breakdown_value),
    value: d.spend,
    percent: totalSpend > 0 ? (d.spend / totalSpend * 100).toFixed(1) : 0,
    impressions: d.impressions,
    clicks: d.clicks,
    color: COLORS[i % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-2">{item.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Gasto:</span>
            <span className="font-medium">{formatCurrency(item.value)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Porcentagem:</span>
            <span className="font-medium">{item.percent}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Impressões:</span>
            <span className="font-medium">{formatNumber(item.impressions)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Cliques:</span>
            <span className="font-medium">{formatNumber(item.clicks)}</span>
          </div>
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          Sem dados demográficos
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </div>
                <span className="text-muted-foreground">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AgeBarChart({ data }: { data: DemographicData[] }) {
  const chartData = data.map((d) => ({
    name: d.breakdown_value,
    spend: d.spend,
    conversions: d.conversions,
  })).sort((a, b) => {
    // Sort by age range naturally
    const ageA = parseInt(a.name.split('-')[0]) || 0;
    const ageB = parseInt(b.name.split('-')[0]) || 0;
    return ageA - ageB;
  });

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Faixa Etária
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de faixa etária
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Faixa Etária
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="name" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={formatCurrency}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'spend' ? formatCurrency(value) : formatNumber(value),
                  name === 'spend' ? 'Gasto' : 'Conversões'
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar 
                dataKey="spend" 
                name="Gasto" 
                fill="hsl(220, 70%, 50%)" 
                radius={[4, 4, 0, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function DemographicCharts({ data, isLoading, className }: DemographicChartsProps) {
  if (isLoading) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-secondary/50 rounded w-1/3" />
          <div className="h-[200px] bg-secondary/30 rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCircle2 className="w-5 h-5" />
          Dados Demográficos
        </h3>
        <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
          <p>Sem dados demográficos disponíveis</p>
          <p className="text-sm mt-1">Sincronize os dados para visualizar</p>
        </div>
      </div>
    );
  }

  const hasData = 
    data.gender.length > 0 || 
    data.age.length > 0 || 
    data.device_platform.length > 0 || 
    data.publisher_platform.length > 0;

  if (!hasData) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCircle2 className="w-5 h-5" />
          Dados Demográficos
        </h3>
        <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
          <p>Sem dados demográficos para o período</p>
          <p className="text-sm mt-1">Sincronize os dados para visualizar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <UserCircle2 className="w-5 h-5" />
        Dados Demográficos
      </h3>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DemographicPieChart
          data={data.gender}
          type="gender"
          title="Gênero"
          icon={UserCircle2}
        />
        <AgeBarChart data={data.age} />
        <DemographicPieChart
          data={data.device_platform}
          type="device_platform"
          title="Dispositivos"
          icon={Smartphone}
        />
        <DemographicPieChart
          data={data.publisher_platform}
          type="publisher_platform"
          title="Plataformas"
          icon={Globe}
        />
      </div>
    </div>
  );
}
