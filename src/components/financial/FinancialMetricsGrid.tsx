import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Target,
  Percent,
  ShoppingCart,
  Phone,
  Calendar,
  FileText,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FinancialMetric {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface FinancialMetricsGridProps {
  businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | 'infoproduto';
  metrics?: {
    revenue?: number;
    sales?: number;
    averageTicket?: number;
    conversionRate?: number;
    leadsReceived?: number;
    leadsContacted?: number;
    meetingsScheduled?: number;
    proposalsSent?: number;
    dealsClosed?: number;
  };
  isLoading?: boolean;
}

export function FinancialMetricsGrid({ 
  businessModel, 
  metrics = {},
  isLoading = false 
}: FinancialMetricsGridProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Métricas base que aparecem em todos os modelos
  const baseMetrics: FinancialMetric[] = [
    {
      id: 'revenue',
      label: 'Faturamento Total',
      value: metrics.revenue ? formatCurrency(metrics.revenue) : 'R$ 0,00',
      icon: DollarSign,
      change: 12.5,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
    {
      id: 'sales',
      label: 'Vendas Realizadas',
      value: metrics.sales ? formatNumber(metrics.sales) : '0',
      icon: ShoppingCart,
      change: 8.3,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
    {
      id: 'avgTicket',
      label: 'Ticket Médio',
      value: metrics.averageTicket ? formatCurrency(metrics.averageTicket) : 'R$ 0,00',
      icon: Target,
      change: -2.1,
      changeLabel: 'vs. período anterior',
      trend: 'down'
    },
    {
      id: 'conversionRate',
      label: 'Taxa de Conversão',
      value: metrics.conversionRate ? formatPercent(metrics.conversionRate) : '0%',
      icon: Percent,
      change: 1.8,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
  ];

  // Métricas específicas para Inside Sales
  const insideSalesMetrics: FinancialMetric[] = [
    {
      id: 'leadsReceived',
      label: 'Leads Recebidos',
      value: metrics.leadsReceived ? formatNumber(metrics.leadsReceived) : '0',
      icon: Users,
      change: 15.2,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
    {
      id: 'leadsContacted',
      label: 'Leads Contatados',
      value: metrics.leadsContacted ? formatNumber(metrics.leadsContacted) : '0',
      icon: Phone,
      change: 10.5,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
    {
      id: 'meetings',
      label: 'Reuniões Agendadas',
      value: metrics.meetingsScheduled ? formatNumber(metrics.meetingsScheduled) : '0',
      icon: Calendar,
      change: 22.0,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
    {
      id: 'proposals',
      label: 'Propostas Enviadas',
      value: metrics.proposalsSent ? formatNumber(metrics.proposalsSent) : '0',
      icon: FileText,
      change: 5.5,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
    {
      id: 'deals',
      label: 'Vendas Fechadas',
      value: metrics.dealsClosed ? formatNumber(metrics.dealsClosed) : '0',
      icon: CheckCircle2,
      change: 18.7,
      changeLabel: 'vs. período anterior',
      trend: 'up'
    },
  ];

  // Seleciona as métricas baseado no modelo de negócio
  const displayMetrics = businessModel === 'inside_sales' 
    ? [...baseMetrics, ...insideSalesMetrics]
    : baseMetrics;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {displayMetrics.map((metric) => {
        const Icon = metric.icon;
        const TrendIcon = metric.trend === 'up' ? ArrowUpRight : ArrowDownRight;
        
        return (
          <Card 
            key={metric.id} 
            className="relative overflow-hidden group hover:border-primary/30 transition-colors"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {metric.value}
              </div>
              {metric.change !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    metric.trend === 'up' && "text-metric-positive",
                    metric.trend === 'down' && "text-metric-negative",
                    metric.trend === 'neutral' && "text-muted-foreground"
                  )}>
                    <TrendIcon className="h-3 w-3" />
                    {Math.abs(metric.change)}%
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {metric.changeLabel}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
