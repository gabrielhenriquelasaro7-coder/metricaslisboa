import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Search, Filter, Trophy, Target, DollarSign, Users, ShoppingCart, Percent } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  reach: number;
}

interface TopCampaignsCardProps {
  campaigns: Campaign[];
  businessModel: string | null;
  currency?: string;
}

type SortOption = 'spend' | 'conversions' | 'roas' | 'cpl' | 'ctr' | 'clicks';
type StatusFilter = 'all' | 'ACTIVE' | 'PAUSED';

export function TopCampaignsCard({ campaigns, businessModel, currency = 'BRL' }: TopCampaignsCardProps) {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<SortOption>('spend');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(5);

  const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'spend', label: t('topCampaigns.highestSpend'), icon: <DollarSign className="h-3 w-3" /> },
    { value: 'conversions', label: t('topCampaigns.mostConversions'), icon: <Target className="h-3 w-3" /> },
    { value: 'roas', label: t('topCampaigns.bestRoas'), icon: <TrendingUp className="h-3 w-3" /> },
    { value: 'cpl', label: t('topCampaigns.lowestCpl'), icon: <Users className="h-3 w-3" /> },
    { value: 'ctr', label: t('topCampaigns.highestCtr'), icon: <Percent className="h-3 w-3" /> },
    { value: 'clicks', label: t('topCampaigns.mostClicks'), icon: <ArrowUpRight className="h-3 w-3" /> },
  ];

  const isEcommerce = businessModel === 'ecommerce';
  const isInsideSales = businessModel === 'inside_sales';
  const isPdv = businessModel === 'pdv';
  const isInfoproduto = businessModel === 'infoproduto';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const filteredAndSortedCampaigns = useMemo(() => {
    let result = [...campaigns];

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.objective?.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'spend':
          return b.spend - a.spend;
        case 'conversions':
          return b.conversions - a.conversions;
        case 'roas':
          return b.roas - a.roas;
        case 'cpl':
          const cplA = a.conversions > 0 ? a.spend / a.conversions : Infinity;
          const cplB = b.conversions > 0 ? b.spend / b.conversions : Infinity;
          return cplA - cplB;
        case 'ctr':
          return b.ctr - a.ctr;
        case 'clicks':
          return b.clicks - a.clicks;
        default:
          return b.spend - a.spend;
      }
    });

    return result.slice(0, limit);
  }, [campaigns, sortBy, statusFilter, searchQuery, limit]);

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <span className="text-xs font-bold text-gray-400">2º</span>;
    if (index === 2) return <span className="text-xs font-bold text-amber-600">3º</span>;
    return <span className="text-xs text-muted-foreground">{index + 1}º</span>;
  };

  const getResultLabel = () => {
    if (isEcommerce || isInfoproduto) return t('dashboard.purchases');
    if (isInsideSales) return t('dashboard.leads');
    if (isPdv) return t('dashboard.visits');
    return t('dashboard.conversions');
  };

  const getCostPerResultLabel = () => {
    if (isEcommerce || isInfoproduto) return t('dashboard.cpa');
    if (isInsideSales) return t('dashboard.cpl');
    if (isPdv) return t('dashboard.costPerVisit');
    return t('dashboard.cpa');
  };

  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;
  const pausedCount = campaigns.filter(c => c.status === 'PAUSED').length;

  return (
    <div className="premium-card overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent z-10" />
      
      <div className="p-6 border-b border-border/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg premium-bar flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t('topCampaigns.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {filteredAndSortedCampaigns.length} {t('topCampaigns.of')} {campaigns.length} {t('topCampaigns.campaigns')}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('topCampaigns.searchCampaign')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 w-full sm:w-[180px]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-9 text-[11px] sm:text-sm sm:w-[130px]">
                  <Filter className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('topCampaigns.allStatus')} ({campaigns.length})</SelectItem>
                  <SelectItem value="ACTIVE">{t('topCampaigns.activeOnly')} ({activeCount})</SelectItem>
                  <SelectItem value="PAUSED">{t('topCampaigns.pausedOnly')} ({pausedCount})</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-9 text-[11px] sm:text-sm sm:w-[160px]">
                  <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {opt.icon}
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger className="h-9 text-[11px] sm:text-sm sm:w-[80px]">
                  <span className="truncate">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Top 5</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="15">Top 15</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Link to="/campaigns" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">{t('common.viewAll')}</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('campaigns.campaign')}</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('campaigns.status')}</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.spend')}</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.impressions')}</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.clicks')}</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.ctr')}</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{getResultLabel()}</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{getCostPerResultLabel()}</th>
              {(isEcommerce || isInfoproduto) && (
                <>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.revenue')}</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.roas')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredAndSortedCampaigns.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-muted-foreground">
                  <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('topCampaigns.noCampaignsFilters')}</p>
                </td>
              </tr>
            ) : (
              filteredAndSortedCampaigns.map((campaign, index) => {
                const cpl = campaign.conversions > 0 ? campaign.spend / campaign.conversions : 0;
                
                return (
                  <tr 
                    key={campaign.id} 
                    className={cn(
                      "hover:bg-secondary/30 transition-colors",
                      index === 0 && "bg-yellow-500/5"
                    )}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center w-6 h-6">
                        {getRankBadge(index)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="max-w-[250px]">
                        <Link 
                          to={`/campaigns`}
                          className="font-medium hover:text-primary transition-colors truncate block"
                        >
                          {campaign.name}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">
                          {campaign.objective?.replace(/_/g, ' ') || t('common.noObjective')}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge 
                        variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={cn(
                          "text-[10px] uppercase",
                          campaign.status === 'ACTIVE' && "bg-green-500/10 text-green-600 border-green-500/20",
                          campaign.status === 'PAUSED' && "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                        )}
                      >
                        {campaign.status === 'ACTIVE' ? t('status.active') : campaign.status === 'PAUSED' ? t('status.paused') : campaign.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right font-medium">
                      {formatCurrency(campaign.spend)}
                    </td>
                    <td className="py-4 px-4 text-right text-muted-foreground">
                      {formatNumber(campaign.impressions)}
                    </td>
                    <td className="py-4 px-4 text-right text-muted-foreground">
                      {formatNumber(campaign.clicks)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={cn(
                        campaign.ctr >= 2 ? "text-metric-positive" : campaign.ctr >= 1 ? "text-foreground" : "text-metric-negative"
                      )}>
                        {campaign.ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-semibold">
                      {campaign.conversions}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={cn(
                        cpl > 0 && cpl <= 50 ? "text-metric-positive" : cpl <= 100 ? "text-foreground" : "text-metric-negative"
                      )}>
                        {cpl > 0 ? formatCurrency(cpl) : '-'}
                      </span>
                    </td>
                    {(isEcommerce || isInfoproduto) && (
                      <>
                        <td className="py-4 px-4 text-right font-medium text-metric-positive">
                          {formatCurrency(campaign.conversion_value)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {campaign.roas >= 3 ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-metric-positive" />
                            ) : campaign.roas < 1 ? (
                              <ArrowDownRight className="h-3.5 w-3.5 text-metric-negative" />
                            ) : null}
                            <span className={cn(
                              "font-bold",
                              campaign.roas >= 3 ? "text-metric-positive" : campaign.roas >= 1 ? "text-foreground" : "text-metric-negative"
                            )}>
                              {campaign.roas.toFixed(2)}x
                            </span>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredAndSortedCampaigns.length > 0 && (
        <div className="p-3 sm:p-4 bg-secondary/20 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-6 w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-muted-foreground text-[10px] sm:text-sm">{t('topCampaigns.totalSpend')}:</span>
                <span className="font-semibold text-xs sm:text-sm sm:ml-2 truncate">{formatCurrency(filteredAndSortedCampaigns.reduce((sum, c) => sum + c.spend, 0))}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-muted-foreground text-[10px] sm:text-sm">{t('common.totalResult')} {getResultLabel()}:</span>
                <span className="font-semibold text-xs sm:text-sm sm:ml-2">{filteredAndSortedCampaigns.reduce((sum, c) => sum + c.conversions, 0)}</span>
              </div>
              {(isEcommerce || isInfoproduto) && (
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-muted-foreground text-[10px] sm:text-sm">{t('topCampaigns.totalRevenue')}:</span>
                  <span className="font-semibold text-xs sm:text-sm text-metric-positive sm:ml-2 truncate">
                    {formatCurrency(filteredAndSortedCampaigns.reduce((sum, c) => sum + c.conversion_value, 0))}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {t('common.sortedBy')}: {sortOptions.find(o => o.value === sortBy)?.label}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}