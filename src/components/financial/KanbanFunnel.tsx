import { useState, useMemo } from 'react';
import { 
  Users, 
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  sort: number;
  leads_count: number;
  total_value: number;
}

export interface FunnelDeal {
  id: string;
  title: string;
  contact_name?: string;
  contact_phone?: string;
  value?: number;
  stage_id: string;
  created_date?: string;
  utm_source?: string;
}

interface KanbanFunnelProps {
  stages: FunnelStage[];
  deals: FunnelDeal[];
  isLoading?: boolean;
  crmUrl?: string;
  onRefresh?: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  '#fffeb2': 'bg-yellow-500/20 border-yellow-500/40',
  '#ffce5a': 'bg-amber-500/20 border-amber-500/40',
  '#ffdbdb': 'bg-red-200/30 border-red-300/40',
  '#d6eaff': 'bg-blue-200/30 border-blue-300/40',
  '#dbe8d0': 'bg-green-200/30 border-green-300/40',
  '#ccc8f9': 'bg-purple-200/30 border-purple-300/40',
  '#eb93ff': 'bg-pink-400/20 border-pink-400/40',
  '#ffc8c8': 'bg-red-300/20 border-red-300/40',
  '#87ceeb': 'bg-sky-400/20 border-sky-400/40',
};

const getStageColorClass = (color: string): string => {
  return STAGE_COLORS[color.toLowerCase()] || 'bg-muted/50 border-border';
};

export function KanbanFunnel({
  stages,
  deals,
  isLoading,
  crmUrl,
  onRefresh
}: KanbanFunnelProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(stages.map(s => s.id)));
  const [maxDealsPerStage, setMaxDealsPerStage] = useState(10);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, FunnelDeal[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = deals.filter(d => d.stage_id === stage.id);
    });
    return grouped;
  }, [stages, deals]);

  // Calculate totals
  const totals = useMemo(() => ({
    leads: deals.length,
    revenue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
  }), [deals]);

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageId)) {
        newSet.delete(stageId);
      } else {
        newSet.add(stageId);
      }
      return newSet;
    });
  };

  const formatRelativeDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const date = parseISO(dateStr);
      const days = differenceInDays(new Date(), date);
      if (days === 0) return 'Hoje';
      if (days === 1) return 'Ontem';
      if (days < 7) return `${days}d atrás`;
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const formatCurrency = (value: number): string => {
    if (value === 0) return 'R$ 0';
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const getSourceBadge = (source?: string) => {
    if (!source) return null;
    const sourceMap: Record<string, { label: string; color: string }> = {
      'facebook': { label: 'Meta Ads', color: 'bg-blue-500/20 text-blue-400' },
      'fb': { label: 'Meta Ads', color: 'bg-blue-500/20 text-blue-400' },
      'meta': { label: 'Meta Ads', color: 'bg-blue-500/20 text-blue-400' },
      'google': { label: 'Google Ads', color: 'bg-red-500/20 text-red-400' },
      'organic': { label: 'Orgânico', color: 'bg-green-500/20 text-green-400' },
    };
    const lowerSource = source.toLowerCase();
    for (const [key, config] of Object.entries(sourceMap)) {
      if (lowerSource.includes(key)) {
        return (
          <Badge variant="outline" className={cn('text-xs border-0', config.color)}>
            {config.label}
          </Badge>
        );
      }
    }
    return (
      <Badge variant="outline" className="text-xs bg-muted/50">
        {source}
      </Badge>
    );
  };

  if (stages.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum estágio de funil encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header with totals */}
      <CardHeader className="pb-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Funil de Vendas
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{totals.leads}</p>
              <p className="text-xs text-muted-foreground">Total de Leads</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-right">
              <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(totals.revenue)}</p>
              <p className="text-xs text-muted-foreground">Valor Total</p>
            </div>
            {crmUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(crmUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                Abrir CRM
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Kanban columns */}
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="flex gap-0 min-w-max">
            {stages.sort((a, b) => a.sort - b.sort).map((stage, idx) => {
              const stageDeals = dealsByStage[stage.id] || [];
              const isExpanded = expandedStages.has(stage.id);
              const displayedDeals = stageDeals.slice(0, maxDealsPerStage);
              const hasMore = stageDeals.length > maxDealsPerStage;

              return (
                <div 
                  key={stage.id} 
                  className={cn(
                    'flex-1 min-w-[280px] max-w-[320px] border-r last:border-r-0',
                    idx % 2 === 0 ? 'bg-muted/10' : 'bg-transparent'
                  )}
                >
                  {/* Stage header */}
                  <button
                    onClick={() => toggleStage(stage.id)}
                    className={cn(
                      'w-full p-3 border-b flex items-center justify-between hover:bg-muted/50 transition-colors',
                      getStageColorClass(stage.color)
                    )}
                  >
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-sm uppercase tracking-wide truncate">
                        {stage.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{stage.leads_count} leads</span>
                        {stage.total_value > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatCurrency(stage.total_value)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Deals list */}
                  {isExpanded && (
                    <ScrollArea className="h-[400px]">
                      <div className="p-2 space-y-2">
                        {displayedDeals.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            Nenhum lead neste estágio
                          </div>
                        ) : (
                          displayedDeals.map((deal) => (
                            <div
                              key={deal.id}
                              className="p-3 rounded-lg bg-card border hover:border-primary/40 transition-all cursor-pointer group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                    {deal.contact_name || deal.title}
                                  </p>
                                  {deal.contact_name && deal.title !== deal.contact_name && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {deal.title}
                                    </p>
                                  )}
                                </div>
                                {deal.created_date && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatRelativeDate(deal.created_date)}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-2">
                                {getSourceBadge(deal.utm_source)}
                                {deal.value && deal.value > 0 && (
                                  <span className="text-xs font-medium text-primary flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    {formatCurrency(deal.value)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}

                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => setMaxDealsPerStage(prev => prev + 10)}
                          >
                            Ver mais {stageDeals.length - maxDealsPerStage} leads
                          </Button>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
