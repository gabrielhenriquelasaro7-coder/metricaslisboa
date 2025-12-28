import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import AdvancedFilters, { FilterConfig, SortConfig } from '@/components/filters/AdvancedFilters';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { 
  Layers, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Eye,
  ShoppingCart,
  ChevronRight,
  ChevronLeft,
  Users,
  RefreshCw,
  AlertCircle,
  Target
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AdSet {
  id: string;
  campaign_id: string;
  project_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  targeting: Record<string, unknown> | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  reach: number;
  frequency: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
}

export default function AdSets() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { projects } = useProjects();
  const [campaign, setCampaign] = useState<{ id: string; name: string; project_id: string } | null>(null);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterConfig>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'spend', direction: 'desc' });

  // Get project for this campaign to determine business model
  const selectedProject = projects.find(p => p.id === campaign?.project_id);
  const isEcommerce = selectedProject?.business_model === 'ecommerce';
  const isInsideSales = selectedProject?.business_model === 'inside_sales';

  // Sort options based on business model
  const sortOptions = [
    { value: 'spend', label: 'Gasto' },
    { value: 'conversions', label: isEcommerce ? 'Compras' : 'Leads' },
    { value: 'ctr', label: 'CTR' },
    { value: 'cpa', label: isEcommerce ? 'CPA' : 'CPL' },
    { value: 'name', label: 'Nome' },
    ...(isEcommerce ? [{ value: 'roas', label: 'ROAS' }] : []),
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId) return;
      setLoading(true);
      try {
        const { data: campaignData } = await supabase
          .from('campaigns')
          .select('id, name, project_id')
          .eq('id', campaignId)
          .single();
        if (campaignData) setCampaign(campaignData);

        const { data: adSetsData } = await supabase
          .from('ad_sets')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('spend', { ascending: false });
        setAdSets((adSetsData as AdSet[]) || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [campaignId]);

  const filteredAdSets = adSets
    .filter((a) => !filters.search || a.name.toLowerCase().includes(filters.search.toLowerCase()))
    .filter((a) => !filters.status?.length || filters.status.includes(a.status))
    .sort((a, b) => {
      const m = sort.direction === 'asc' ? 1 : -1;
      if (sort.field === 'name') return a.name.localeCompare(b.name) * m;
      return ((a[sort.field as keyof AdSet] as number) - (b[sort.field as keyof AdSet] as number)) * m;
    });

  const totals = filteredAdSets.reduce((acc, a) => ({
    spend: acc.spend + a.spend,
    impressions: acc.impressions + a.impressions,
    clicks: acc.clicks + a.clicks,
    conversions: acc.conversions + a.conversions,
    revenue: acc.revenue + a.conversion_value,
    reach: acc.reach + a.reach,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, reach: 0 });

  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCpl = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

  const formatNumber = (n: number) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString();
  const formatCurrency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      ACTIVE: { label: 'Ativo', className: 'bg-metric-positive/20 text-metric-positive border-metric-positive/30' },
      PAUSED: { label: 'Pausado', className: 'bg-metric-warning/20 text-metric-warning border-metric-warning/30' },
      DELETED: { label: 'Deletado', className: 'bg-muted text-muted-foreground' },
      ARCHIVED: { label: 'Arquivado', className: 'bg-muted text-muted-foreground' },
    };
    return statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link 
            to="/campaigns" 
            className="p-2 rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Conjuntos de Anúncios</h1>
            <p className="text-muted-foreground mt-1">
              {campaign ? `Campanha: ${campaign.name}` : 'Carregando...'}
              {selectedProject && (
                <Badge variant="outline" className="ml-3 text-xs">
                  {isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'}
                </Badge>
              )}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : adSets.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum conjunto encontrado</h3>
            <p className="text-muted-foreground">Sincronize os dados na página de campanhas.</p>
          </div>
        ) : (
          <>
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard title="Gasto Total" value={formatCurrency(totals.spend)} icon={DollarSign} />
              <MetricCard title="Alcance" value={formatNumber(totals.reach)} icon={Users} />
              <MetricCard title="Impressões" value={formatNumber(totals.impressions)} icon={Eye} />
              <MetricCard title="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
              <MetricCard 
                title={isEcommerce ? "Compras" : "Leads"} 
                value={formatNumber(totals.conversions)} 
                icon={isEcommerce ? ShoppingCart : Target} 
              />
              {isEcommerce ? (
                <MetricCard 
                  title="ROAS Médio" 
                  value={`${avgRoas.toFixed(2)}x`} 
                  icon={TrendingUp} 
                  className="border-l-4 border-l-metric-positive" 
                />
              ) : (
                <MetricCard 
                  title="CPL Médio" 
                  value={formatCurrency(avgCpl)} 
                  icon={DollarSign} 
                  className="border-l-4 border-l-chart-1" 
                />
              )}
            </div>

            {/* Filters */}
            <AdvancedFilters 
              filters={filters} 
              onFiltersChange={setFilters} 
              sort={sort} 
              onSortChange={setSort} 
              sortOptions={sortOptions} 
            />

            {/* Ad Sets Grid - Redesigned */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAdSets.map((adSet) => {
                const statusBadge = getStatusBadge(adSet.status);
                const budget = adSet.daily_budget || adSet.lifetime_budget || 0;
                const spendPercent = budget > 0 ? Math.min((adSet.spend / budget) * 100, 100) : 0;
                
                return (
                  <Link 
                    key={adSet.id} 
                    to={`/adset/${adSet.id}`} 
                    className="glass-card group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-5 pb-4 border-b border-border/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                            adSet.status === 'ACTIVE' 
                              ? 'bg-metric-positive/10' 
                              : 'bg-secondary/50'
                          )}>
                            <Layers className={cn(
                              "w-5 h-5",
                              adSet.status === 'ACTIVE' ? 'text-metric-positive' : 'text-muted-foreground'
                            )} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                              {adSet.name}
                            </h3>
                            <Badge variant="outline" className={cn("text-xs mt-1", statusBadge.className)}>
                              {statusBadge.label}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                      </div>
                    </div>

                    {/* Budget Progress */}
                    <div className="px-5 py-3 bg-secondary/20">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Orçamento</span>
                        <span className="font-medium">
                          {formatCurrency(adSet.spend)} 
                          <span className="text-muted-foreground"> / {formatCurrency(budget)}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all",
                            spendPercent >= 90 ? 'bg-metric-negative' :
                            spendPercent >= 70 ? 'bg-metric-warning' :
                            'bg-primary'
                          )}
                          style={{ width: `${spendPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="p-5 pt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-xl font-bold">{formatNumber(adSet.reach)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Alcance</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold">{adSet.ctr.toFixed(2)}%</p>
                          <p className="text-xs text-muted-foreground mt-0.5">CTR</p>
                        </div>
                        {isEcommerce ? (
                          <div className="text-center">
                            <p className={cn(
                              "text-xl font-bold",
                              adSet.roas >= 5 ? 'text-metric-positive' : 
                              adSet.roas >= 3 ? 'text-metric-warning' : 
                              adSet.roas > 0 ? 'text-metric-negative' : ''
                            )}>
                              {adSet.roas.toFixed(2)}x
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">ROAS</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-xl font-bold text-chart-1">
                              {formatCurrency(adSet.cpa)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">CPL</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Secondary metrics */}
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Conversões</span>
                          <span className="text-sm font-medium">{adSet.conversions}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Frequência</span>
                          <span className="text-sm font-medium">{adSet.frequency.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
