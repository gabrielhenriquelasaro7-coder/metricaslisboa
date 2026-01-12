import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Megaphone,
  Palette,
  ArrowRight,
  Percent,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FunnelDeal, FunnelStage } from './KanbanFunnel';

interface AttributionAnalysisProps {
  deals: FunnelDeal[];
  stages: FunnelStage[];
  adSpend: number;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  if (value === 0) return 'R$ 0';
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
];

export function AttributionAnalysis({ deals, stages, adSpend, isLoading }: AttributionAnalysisProps) {
  // Calculate campaign performance
  const campaignData = useMemo(() => {
    const map = new Map<string, { leads: number; won: number; revenue: number }>();
    
    deals.forEach(deal => {
      const campaign = deal.utm_campaign || deal.custom_fields?.utm_campaign || 'Sem UTM';
      const current = map.get(campaign) || { leads: 0, won: 0, revenue: 0 };
      current.leads++;
      if (deal.status === 'won') {
        current.won++;
        current.revenue += deal.value || 0;
      }
      map.set(campaign, current);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name: name.length > 40 ? name.slice(0, 37) + '...' : name,
        fullName: name,
        ...data,
        conversionRate: data.leads > 0 ? (data.won / data.leads) * 100 : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);
  }, [deals]);

  // Calculate creative (utm_term) performance
  const creativeData = useMemo(() => {
    const map = new Map<string, { leads: number; won: number; revenue: number }>();
    
    deals.forEach(deal => {
      const creative = deal.utm_term || deal.custom_fields?.utm_term || 'Sem Criativo';
      const current = map.get(creative) || { leads: 0, won: 0, revenue: 0 };
      current.leads++;
      if (deal.status === 'won') {
        current.won++;
        current.revenue += deal.value || 0;
      }
      map.set(creative, current);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name: name.length > 35 ? name.slice(0, 32) + '...' : name,
        fullName: name,
        ...data,
        conversionRate: data.leads > 0 ? (data.won / data.leads) * 100 : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);
  }, [deals]);

  // Calculate audience (utm_medium) performance
  const audienceData = useMemo(() => {
    const map = new Map<string, { leads: number; won: number; revenue: number }>();
    
    deals.forEach(deal => {
      const medium = deal.utm_medium || deal.custom_fields?.utm_medium || 'Sem Público';
      const current = map.get(medium) || { leads: 0, won: 0, revenue: 0 };
      current.leads++;
      if (deal.status === 'won') {
        current.won++;
        current.revenue += deal.value || 0;
      }
      map.set(medium, current);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name: name.length > 50 ? name.slice(0, 47) + '...' : name,
        fullName: name,
        ...data,
        conversionRate: data.leads > 0 ? (data.won / data.leads) * 100 : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 8);
  }, [deals]);


  // Overview metrics
  const overviewMetrics = useMemo(() => {
    const withUtm = deals.filter(d => 
      d.utm_campaign || d.custom_fields?.utm_campaign || 
      d.utm_source || d.custom_fields?.utm_source
    );
    const wonDeals = deals.filter(d => d.status === 'won');
    const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalLeads = deals.length;
    
    // Calculate CAC if we have spend and sales
    const cac = wonDeals.length > 0 && adSpend > 0 ? adSpend / wonDeals.length : 0;
    
    // Calculate CPL
    const cpl = totalLeads > 0 && adSpend > 0 ? adSpend / totalLeads : 0;

    // ROAS real
    const roas = adSpend > 0 ? totalRevenue / adSpend : 0;

    return {
      totalLeads,
      withUtm: withUtm.length,
      withoutUtm: totalLeads - withUtm.length,
      utmCoverage: totalLeads > 0 ? (withUtm.length / totalLeads) * 100 : 0,
      wonDeals: wonDeals.length,
      revenue: totalRevenue,
      cac,
      cpl,
      roas,
      conversionRate: totalLeads > 0 ? (wonDeals.length / totalLeads) * 100 : 0,
    };
  }, [deals, adSpend]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview Metrics */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-600/20 to-blue-900/30 border-blue-500/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs font-medium text-blue-200 uppercase tracking-wider truncate">Cobertura UTM</span>
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-blue-100">{overviewMetrics.utmCoverage.toFixed(0)}%</p>
            <p className="text-[10px] sm:text-xs text-blue-300/70 mt-0.5 sm:mt-1 truncate">
              {overviewMetrics.withUtm}/{overviewMetrics.totalLeads} leads
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/30 border-emerald-500/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs font-medium text-emerald-200 uppercase tracking-wider">ROAS</span>
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-emerald-100">{overviewMetrics.roas.toFixed(2)}x</p>
            <p className="text-[10px] sm:text-xs text-emerald-300/70 mt-0.5 sm:mt-1 truncate">
              {formatCurrency(overviewMetrics.revenue)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600/20 to-amber-900/30 border-amber-500/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs font-medium text-amber-200 uppercase tracking-wider">CPL</span>
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-amber-100">{formatCurrency(overviewMetrics.cpl)}</p>
            <p className="text-[10px] sm:text-xs text-amber-300/70 mt-0.5 sm:mt-1 truncate">
              Gasto: {formatCurrency(adSpend)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/20 to-purple-900/30 border-purple-500/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs font-medium text-purple-200 uppercase tracking-wider">CAC</span>
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-400 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-purple-100">
              {overviewMetrics.cac > 0 ? formatCurrency(overviewMetrics.cac) : '-'}
            </p>
            <p className="text-[10px] sm:text-xs text-purple-300/70 mt-0.5 sm:mt-1 truncate">
              {overviewMetrics.wonDeals} vendas • {overviewMetrics.conversionRate.toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance - Performance por Campanha */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <CardTitle className="text-sm sm:text-base">Performance por Campanha</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Ranking de campanhas por volume de leads e conversão
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {campaignData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
              <Target className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-2 sm:mb-3" />
              <p className="text-xs sm:text-sm text-muted-foreground">Nenhuma campanha com UTM</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5 sm:col-span-6">Campanha</div>
                <div className="col-span-2 text-center">Leads</div>
                <div className="col-span-2 text-center">Vendas</div>
                <div className="col-span-3 sm:col-span-2 text-right">Conv.</div>
              </div>
              
              {campaignData.slice(0, 10).map((campaign, index) => (
                <div key={campaign.fullName} className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="col-span-5 sm:col-span-6 flex items-center gap-2 min-w-0">
                      <span 
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] + '30', color: COLORS[index % COLORS.length] }}
                      >
                        {index + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-medium truncate" title={campaign.fullName}>
                        {campaign.name}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs sm:text-sm font-medium">{campaign.leads}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">leads</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <Badge variant={campaign.won > 0 ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                        {campaign.won} vendas
                      </Badge>
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-right">
                      <span className={cn(
                        "text-xs sm:text-sm font-semibold",
                        campaign.conversionRate > 0 ? "text-metric-positive" : "text-muted-foreground"
                      )}>
                        {campaign.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(campaign.leads / (campaignData[0]?.leads || 1)) * 100} 
                    className="h-1 mx-2"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Creative Performance */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <CardTitle className="text-sm sm:text-lg">Por Criativo</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Análise por utm_term
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {creativeData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                <Palette className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">Sem dados de criativos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={creativeData.slice(0, 5)} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={80} 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={9}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [value, name === 'leads' ? 'Leads' : 'Vendas']}
                  />
                  <Bar dataKey="leads" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Audience Performance */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <CardTitle className="text-sm sm:text-lg">Por Público</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Análise por utm_medium
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {audienceData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                <Users className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">Sem dados de públicos</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {audienceData.slice(0, 5).map((audience, index) => (
                  <div key={audience.fullName} className="flex items-center gap-2 sm:gap-3">
                    <div 
                      className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate" title={audience.fullName}>
                        {audience.name}
                      </p>
                      <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                        <span>{audience.leads} leads</span>
                        <span>•</span>
                        <span>{audience.won} vendas</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">{audience.conversionRate.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base sm:text-lg font-bold">{audience.leads}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* UTM Coverage Warning */}
      {overviewMetrics.utmCoverage < 50 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h4 className="font-medium text-amber-200">Baixa cobertura de UTMs</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Apenas {overviewMetrics.utmCoverage.toFixed(0)}% dos seus leads possuem UTMs. 
                  Considere revisar a configuração dos parâmetros UTM nas suas campanhas para 
                  melhorar a atribuição e análise de performance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
