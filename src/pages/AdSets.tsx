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
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/campaigns" className="text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="text-3xl font-bold">Conjuntos de Anúncios</h1>
        </div>
        <p className="text-muted-foreground">
          {campaign ? `Campanha: ${campaign.name}` : 'Carregando...'}
          {selectedProject && (
            <span className="ml-2 text-xs">
              ({isEcommerce ? 'E-commerce' : isInsideSales ? 'Inside Sales' : 'PDV'})
            </span>
          )}
        </p>

        {loading ? (
          <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : adSets.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum conjunto encontrado</h3>
            <p className="text-muted-foreground">Sincronize os dados na página de campanhas.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard title="Gasto Total" value={formatCurrency(totals.spend)} icon={DollarSign} />
              <MetricCard title="Alcance" value={formatNumber(totals.reach)} icon={Users} />
              <MetricCard title="Impressões" value={formatNumber(totals.impressions)} icon={Eye} />
              <MetricCard title="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
              <MetricCard 
                title={isEcommerce ? "Compras" : "Leads"} 
                value={formatNumber(totals.conversions)} 
                icon={isEcommerce ? ShoppingCart : Users} 
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

            <AdvancedFilters filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} sortOptions={sortOptions} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredAdSets.map((adSet) => (
                <div key={adSet.id} className="glass-card-hover p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Layers className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{adSet.name}</h3>
                        <Badge variant="secondary" className={cn(adSet.status === 'ACTIVE' && 'bg-metric-positive/20 text-metric-positive', adSet.status === 'PAUSED' && 'bg-metric-warning/20 text-metric-warning')}>
                          {adSet.status === 'ACTIVE' ? 'Ativo' : adSet.status === 'PAUSED' ? 'Pausado' : adSet.status}
                        </Badge>
                      </div>
                    </div>
                    <Link to={`/adset/${adSet.id}/ads`} className="text-muted-foreground hover:text-foreground"><ChevronRight className="w-5 h-5" /></Link>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Orçamento</span>
                      <span>{formatCurrency(adSet.spend)} / {formatCurrency(adSet.daily_budget || adSet.lifetime_budget || 0)}</span>
                    </div>
                    <Progress value={Math.min(((adSet.spend / (adSet.daily_budget || adSet.lifetime_budget || 1)) * 100), 100)} className="h-2" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatNumber(adSet.reach)}</p>
                      <p className="text-xs text-muted-foreground">Alcance</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{adSet.frequency.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Frequência</p>
                    </div>
                    {isEcommerce ? (
                      <div className="text-center">
                        <p className={cn("text-2xl font-bold", adSet.roas >= 5 ? 'text-metric-positive' : adSet.roas >= 3 ? 'text-metric-warning' : 'text-metric-negative')}>
                          {adSet.roas.toFixed(2)}x
                        </p>
                        <p className="text-xs text-muted-foreground">ROAS</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-chart-1">
                          {formatCurrency(adSet.cpa)}
                        </p>
                        <p className="text-xs text-muted-foreground">CPL</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}