import { useState, useMemo } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Tag,
  Clock,
  ArrowRight,
  Loader2,
  Users,
  Target
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
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
  contact_email?: string;
  contact_phone?: string;
  value?: number;
  stage_id: string;
  stage_name?: string;
  created_date?: string;
  closed_date?: string;
  utm_source?: string;
  utm_campaign?: string;
  owner_name?: string;
  status?: string;
  lead_source?: string;
}

interface KanbanFunnelProps {
  stages: FunnelStage[];
  deals: FunnelDeal[];
  isLoading?: boolean;
  crmUrl?: string;
  onRefresh?: () => void;
}

// Map stages to funnel categories
type FunnelCategory = 'leads' | 'mql' | 'sql' | 'vendas';

interface FunnelColumn {
  id: FunnelCategory;
  label: string;
  stageIds: string[];
  stages: FunnelStage[];
  deals: FunnelDeal[];
  totalValue: number;
  count: number;
}

const formatCurrency = (value: number): string => {
  if (value === 0) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '-';
  }
};

const getSourceLabel = (source?: string): string | null => {
  if (!source) return null;
  const lowerSource = source.toLowerCase();
  if (lowerSource.includes('facebook') || lowerSource.includes('fb') || lowerSource.includes('meta')) {
    return 'Meta Ads';
  }
  if (lowerSource.includes('google')) return 'Google Ads';
  if (lowerSource.includes('organic')) return 'Orgânico';
  if (lowerSource.includes('direct')) return 'Direto';
  if (lowerSource.includes('referral')) return 'Indicação';
  return source;
};

// Funnel Stage Colors
const FUNNEL_COLORS: Record<FunnelCategory, { bg: string; border: string; text: string; badge: string }> = {
  leads: { 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/30', 
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  mql: { 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/30', 
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  sql: { 
    bg: 'bg-purple-500/10', 
    border: 'border-purple-500/30', 
    text: 'text-purple-400',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  vendas: { 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/30', 
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
};

export function KanbanFunnel({
  stages,
  deals,
  isLoading,
}: KanbanFunnelProps) {
  const [selectedDeal, setSelectedDeal] = useState<FunnelDeal | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Map stages to funnel categories (divide into 4 parts)
  const funnelColumns = useMemo<FunnelColumn[]>(() => {
    const sortedStages = [...stages].sort((a, b) => a.sort - b.sort);
    const totalStages = sortedStages.length;
    
    if (totalStages === 0) {
      return [
        { id: 'leads', label: 'Leads', stageIds: [], stages: [], deals: [], totalValue: 0, count: 0 },
        { id: 'mql', label: 'MQL', stageIds: [], stages: [], deals: [], totalValue: 0, count: 0 },
        { id: 'sql', label: 'SQL', stageIds: [], stages: [], deals: [], totalValue: 0, count: 0 },
        { id: 'vendas', label: 'Vendas', stageIds: [], stages: [], deals: [], totalValue: 0, count: 0 },
      ];
    }

    // Divide stages into 4 buckets
    const bucketSize = Math.ceil(totalStages / 4);
    const buckets: FunnelStage[][] = [[], [], [], []];
    
    sortedStages.forEach((stage, index) => {
      const bucketIndex = Math.min(Math.floor(index / bucketSize), 3);
      buckets[bucketIndex].push(stage);
    });

    const categories: FunnelCategory[] = ['leads', 'mql', 'sql', 'vendas'];
    const labels = ['Leads', 'MQL', 'SQL', 'Vendas'];

    return categories.map((cat, i) => {
      const stageIds = buckets[i].map(s => s.id);
      const columnDeals = deals.filter(d => stageIds.includes(d.stage_id));
      const totalValue = columnDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      
      return {
        id: cat,
        label: labels[i],
        stageIds,
        stages: buckets[i],
        deals: columnDeals,
        totalValue,
        count: columnDeals.length,
      };
    });
  }, [stages, deals]);

  // Calculate conversion rates
  const conversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    for (let i = 0; i < funnelColumns.length - 1; i++) {
      const current = funnelColumns[i].count;
      const next = funnelColumns[i + 1].count;
      rates[funnelColumns[i].id] = current > 0 ? (next / current) * 100 : 0;
    }
    return rates;
  }, [funnelColumns]);

  // Total conversion
  const totalConversion = useMemo(() => {
    const leads = funnelColumns[0].count;
    const vendas = funnelColumns[3].count;
    return leads > 0 ? (vendas / leads) * 100 : 0;
  }, [funnelColumns]);

  const handleDealClick = (deal: FunnelDeal) => {
    setSelectedDeal(deal);
    setIsDrawerOpen(true);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando funil...</span>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-72">
              <Skeleton className="h-12 mb-3 rounded-lg" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-20 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Nenhum funil disponível</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Selecione um funil de vendas acima ou conecte seu CRM para visualizar os leads e oportunidades.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Funnel Header - Fixed */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Funil de Vendas</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            Conversão Total: {totalConversion.toFixed(1)}%
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{deals.length} leads no total</span>
        </div>
      </div>

      {/* Horizontal Scrollable Funnel */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {funnelColumns.map((column, colIndex) => {
            const colors = FUNNEL_COLORS[column.id];
            const conversionRate = conversionRates[column.id];
            const isLastColumn = colIndex === funnelColumns.length - 1;

            return (
              <div key={column.id} className="flex items-start gap-2">
                {/* Column */}
                <div className="flex-shrink-0 w-72">
                  {/* Column Header */}
                  <div className={cn(
                    "rounded-t-lg border px-4 py-3",
                    colors.bg,
                    colors.border
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={cn("font-semibold text-sm uppercase tracking-wide", colors.text)}>
                        {column.label}
                      </h4>
                      <span className={cn("text-2xl font-bold", colors.text)}>
                        {column.count}
                      </span>
                    </div>
                    {column.totalValue > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(column.totalValue)}
                      </p>
                    )}
                    {!isLastColumn && conversionRate !== undefined && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        <span>Conv: {conversionRate.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  {/* Leads List - Vertical Scroll */}
                  <div className={cn(
                    "border border-t-0 rounded-b-lg bg-card/50",
                    colors.border
                  )}>
                    <ScrollArea className="h-[450px]">
                      <div className="p-2 space-y-2">
                        {column.deals.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-sm text-muted-foreground">
                              Nenhum lead nesta etapa
                            </p>
                          </div>
                        ) : (
                          column.deals.map((deal) => {
                            const sourceLabel = getSourceLabel(deal.utm_source || deal.lead_source);
                            
                            return (
                              <div
                                key={deal.id}
                                onClick={() => handleDealClick(deal)}
                                className={cn(
                                  "p-3 rounded-lg border bg-card cursor-pointer",
                                  "hover:bg-accent/5 hover:border-accent/30 transition-all duration-200",
                                  "group"
                                )}
                              >
                                {/* Lead Name */}
                                <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                  {deal.title || deal.contact_name || 'Lead sem nome'}
                                </p>

                                {/* Contact Info */}
                                {deal.contact_name && deal.contact_name !== deal.title && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {deal.contact_name}
                                  </p>
                                )}

                                {/* Value if exists */}
                                {deal.value && deal.value > 0 && (
                                  <p className="text-xs font-medium text-emerald-400 mt-1">
                                    {formatCurrency(deal.value)}
                                  </p>
                                )}

                                {/* Footer: Source Badge */}
                                {sourceLabel && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn("mt-2 text-[10px]", colors.badge)}
                                  >
                                    {sourceLabel}
                                  </Badge>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Arrow between columns */}
                {!isLastColumn && (
                  <div className="flex items-center justify-center h-12 mt-4 text-muted-foreground/30">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Lead Detail Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-left">Detalhes do Lead</SheetTitle>
          </SheetHeader>

          {selectedDeal && (
            <div className="space-y-6">
              {/* Lead Name and Status */}
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {selectedDeal.title || selectedDeal.contact_name || 'Lead sem nome'}
                </h3>
                {selectedDeal.stage_name && (
                  <Badge variant="secondary" className="mt-2">
                    {selectedDeal.stage_name}
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Informações de Contato
                </h4>

                <div className="space-y-3">
                  {selectedDeal.contact_name && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nome</p>
                        <p className="text-sm font-medium">{selectedDeal.contact_name}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.contact_email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{selectedDeal.contact_email}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.contact_phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="text-sm font-medium">{selectedDeal.contact_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Origin */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Origem
                </h4>

                <div className="space-y-3">
                  {(selectedDeal.utm_source || selectedDeal.lead_source) && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fonte</p>
                        <p className="text-sm font-medium">
                          {getSourceLabel(selectedDeal.utm_source || selectedDeal.lead_source) || 'Não informado'}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.utm_campaign && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Campanha</p>
                        <p className="text-sm font-medium">{selectedDeal.utm_campaign}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Value and Responsible */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Negociação
                </h4>

                <div className="space-y-3">
                  {selectedDeal.value !== undefined && selectedDeal.value > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor do Negócio</p>
                        <p className="text-sm font-medium text-emerald-400">
                          {formatCurrency(selectedDeal.value)}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.owner_name && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Responsável</p>
                        <p className="text-sm font-medium">{selectedDeal.owner_name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Dates */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Histórico
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Entrada</p>
                      <p className="text-sm font-medium">{formatDate(selectedDeal.created_date)}</p>
                    </div>
                  </div>

                  {selectedDeal.closed_date && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Data de Fechamento</p>
                        <p className="text-sm font-medium">{formatDate(selectedDeal.closed_date)}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.status && (
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        selectedDeal.status === 'won' ? 'bg-emerald-500/10' : 
                        selectedDeal.status === 'lost' ? 'bg-red-500/10' : 'bg-muted'
                      )}>
                        <Target className={cn(
                          "h-4 w-4",
                          selectedDeal.status === 'won' ? 'text-emerald-400' : 
                          selectedDeal.status === 'lost' ? 'text-red-400' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className={cn(
                          "text-sm font-medium",
                          selectedDeal.status === 'won' ? 'text-emerald-400' : 
                          selectedDeal.status === 'lost' ? 'text-red-400' : ''
                        )}>
                          {selectedDeal.status === 'won' ? 'Ganho' : 
                           selectedDeal.status === 'lost' ? 'Perdido' : 
                           selectedDeal.status === 'open' ? 'Em Aberto' : selectedDeal.status}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
