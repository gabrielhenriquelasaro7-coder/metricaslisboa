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

  // Sankey data for funnel flow - separated campaigns and stages
  const sankeyData = useMemo(() => {
    // Group deals by campaign and stage
    const campaignStageMap = new Map<string, Map<string, number>>();
    
    deals.forEach(deal => {
      // Get campaign name from UTM or use a default
      const campaign = deal.utm_campaign || deal.custom_fields?.utm_campaign || 'Desconhecido';
      const shortCampaign = campaign.length > 25 ? campaign.slice(0, 22) + '...' : campaign;
      
      if (!campaignStageMap.has(shortCampaign)) {
        campaignStageMap.set(shortCampaign, new Map());
      }
      
      // Determine stage name
      let stageName = deal.stage_name || 'Lead';
      if (deal.status === 'won') stageName = 'Ganho';
      if (deal.status === 'lost') stageName = 'Perdido';
      
      const stageMap = campaignStageMap.get(shortCampaign)!;
      stageMap.set(stageName, (stageMap.get(stageName) || 0) + 1);
    });

    if (campaignStageMap.size === 0) return null;

    // Get top campaigns by lead count
    const topCampaigns = Array.from(campaignStageMap.entries())
      .map(([name, stageMap]) => ({
        name,
        total: Array.from(stageMap.values()).reduce((s, v) => s + v, 0),
        stageMap
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Collect all unique stages across all campaigns
    const allStages = new Map<string, number>();
    topCampaigns.forEach(({ stageMap }) => {
      stageMap.forEach((count, stage) => {
        allStages.set(stage, (allStages.get(stage) || 0) + count);
      });
    });

    // Sort stages: regular stages first, then Ganho, then Perdido
    const sortedStages = Array.from(allStages.entries())
      .sort((a, b) => {
        if (a[0] === 'Ganho') return 1;
        if (b[0] === 'Ganho') return -1;
        if (a[0] === 'Perdido') return 1;
        if (b[0] === 'Perdido') return -1;
        return b[1] - a[1]; // Sort by count descending
      });

    // Build links between campaigns and stages
    const links: { campaignIdx: number; stageIdx: number; value: number }[] = [];
    topCampaigns.forEach((campaign, campIdx) => {
      sortedStages.forEach(([stageName], stageIdx) => {
        const count = campaign.stageMap.get(stageName) || 0;
        if (count > 0) {
          links.push({ campaignIdx: campIdx, stageIdx, value: count });
        }
      });
    });

    if (links.length === 0) return null;

    return {
      campaigns: topCampaigns.map(c => ({ name: c.name, total: c.total })),
      stages: sortedStages.map(([name, count]) => ({ name, count })),
      links
    };
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
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-600/20 to-blue-900/30 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">Cobertura UTM</span>
              <Target className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-blue-100">{overviewMetrics.utmCoverage.toFixed(0)}%</p>
            <p className="text-xs text-blue-300/70 mt-1">
              {overviewMetrics.withUtm} de {overviewMetrics.totalLeads} leads
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/30 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-200 uppercase tracking-wider">ROAS Real</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-100">{overviewMetrics.roas.toFixed(2)}x</p>
            <p className="text-xs text-emerald-300/70 mt-1">
              {formatCurrency(overviewMetrics.revenue)} faturado
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600/20 to-amber-900/30 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-200 uppercase tracking-wider">CPL Real</span>
              <DollarSign className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-amber-100">{formatCurrency(overviewMetrics.cpl)}</p>
            <p className="text-xs text-amber-300/70 mt-1">
              Gasto: {formatCurrency(adSpend)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/20 to-purple-900/30 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-200 uppercase tracking-wider">CAC</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-purple-100">
              {overviewMetrics.cac > 0 ? formatCurrency(overviewMetrics.cac) : '-'}
            </p>
            <p className="text-xs text-purple-300/70 mt-1">
              {overviewMetrics.wonDeals} vendas • {overviewMetrics.conversionRate.toFixed(1)}% conv.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <CardTitle>Performance por Campanha</CardTitle>
          </div>
          <CardDescription>
            Ranking de campanhas por volume de leads e conversão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaignData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma campanha com UTM encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaignData.map((campaign, index) => (
                <div key={campaign.fullName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: COLORS[index % COLORS.length] + '30', color: COLORS[index % COLORS.length] }}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium truncate" title={campaign.fullName}>
                        {campaign.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {campaign.leads} leads
                      </span>
                      <Badge variant={campaign.won > 0 ? 'default' : 'secondary'}>
                        {campaign.won} vendas
                      </Badge>
                      <span className="font-medium w-16 text-right">
                        {campaign.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(campaign.leads / (campaignData[0]?.leads || 1)) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Creative Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Performance por Criativo</CardTitle>
            </div>
            <CardDescription>
              Análise por utm_term (criativo/copy)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {creativeData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Palette className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Sem dados de criativos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={creativeData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120} 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={11}
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
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Performance por Público</CardTitle>
            </div>
            <CardDescription>
              Análise por utm_medium (segmentação)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {audienceData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Sem dados de públicos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {audienceData.slice(0, 5).map((audience, index) => (
                  <div key={audience.fullName} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={audience.fullName}>
                        {audience.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{audience.leads} leads</span>
                        <span>•</span>
                        <span>{audience.won} vendas</span>
                        <span>•</span>
                        <span>{audience.conversionRate.toFixed(1)}% conv.</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{audience.leads}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom Flow Diagram - Funnel Flow */}
      {sankeyData && sankeyData.links.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              <CardTitle>Fluxo do Funil por Campanha</CardTitle>
            </div>
            <CardDescription>
              Visualização do caminho dos leads: Campanha → Etapa atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Flow diagram */}
              <div className="flex items-stretch gap-8 min-h-[280px]">
                {/* Left column - Campaigns */}
                <div className="flex-1 flex flex-col gap-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Campanhas</h4>
                  {sankeyData.campaigns.map((campaign, idx) => (
                    <div 
                      key={campaign.name} 
                      className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      style={{ borderLeftColor: COLORS[idx % COLORS.length], borderLeftWidth: '4px' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">{campaign.total} leads</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Middle - Flow lines */}
                <div className="flex flex-col items-center justify-center gap-1 py-4">
                  {sankeyData.stages.slice(0, 5).map((_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="w-8 h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" />
                      <ArrowRight className="h-3 w-3 text-primary/40" />
                      <div className="w-8 h-0.5 bg-gradient-to-r from-primary/20 to-primary/60" />
                    </div>
                  ))}
                </div>

                {/* Right column - Stages */}
                <div className="flex-1 flex flex-col gap-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Etapas</h4>
                  {sankeyData.stages.map((stage, idx) => {
                    const isWon = stage.name === 'Ganho';
                    const isLost = stage.name === 'Perdido';
                    return (
                      <div 
                        key={stage.name} 
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                          isWon ? 'bg-emerald-500/10 border-emerald-500/30' :
                          isLost ? 'bg-red-500/10 border-red-500/30' :
                          'bg-card hover:bg-accent/50'
                        }`}
                      >
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ 
                            backgroundColor: isWon ? '#10b981' : isLost ? '#ef4444' : COLORS[idx % COLORS.length] 
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{stage.name}</p>
                          <p className="text-xs text-muted-foreground">{stage.count} leads</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Flow summary */}
              <div className="mt-4 pt-4 border-t flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span>Total de conexões: {sankeyData.links.length}</span>
                <span>•</span>
                <span>Campanhas rastreadas: {sankeyData.campaigns.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
