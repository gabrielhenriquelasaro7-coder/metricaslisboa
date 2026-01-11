import { useState, useMemo, useRef } from 'react';
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
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Timer,
  AlertCircle,
  Building2
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KanbanFilters, defaultFilters, filterDeals, type KanbanFiltersState } from './KanbanFilters';

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  sort: number;
  type: number; // 0=open, 1=won, 2=lost
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
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  owner_name?: string;
  status?: string;
  lead_source?: string;
  custom_fields?: Record<string, string>;
  company_name?: string;
}

interface KanbanFunnelProps {
  stages: FunnelStage[];
  deals: FunnelDeal[];
  isLoading?: boolean;
  crmUrl?: string;
  onRefresh?: () => void;
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

const formatDateShort = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    return format(date, "dd/MM/yy", { locale: ptBR });
  } catch {
    return '-';
  }
};

// Get Kommo stage color as CSS
const getStageColor = (color: string) => {
  // Kommo colors are hex codes like #ffc107
  if (color.startsWith('#')) {
    return color;
  }
  // Map Kommo color names to hex
  const colorMap: Record<string, string> = {
    'red': '#ef5350',
    'green': '#4caf50',
    'blue': '#2196f3',
    'yellow': '#ffc107',
    'orange': '#ff9800',
    'purple': '#9c27b0',
    'gray': '#9e9e9e',
    'pink': '#e91e63',
    'cyan': '#00bcd4',
    'teal': '#009688',
  };
  return colorMap[color.toLowerCase()] || '#6b7280';
};

export function KanbanFunnel({
  stages,
  deals,
  isLoading,
  crmUrl,
}: KanbanFunnelProps) {
  const [selectedDeal, setSelectedDeal] = useState<FunnelDeal | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<KanbanFiltersState>(defaultFilters);

  // Apply filters to deals
  const filteredDeals = useMemo(() => {
    return filterDeals(deals, filters);
  }, [deals, filters]);

  // Group filtered deals by stage
  const dealsByStage = useMemo(() => {
    const map: Record<string, FunnelDeal[]> = {};
    stages.forEach(stage => {
      map[stage.id] = [];
    });
    filteredDeals.forEach(deal => {
      if (map[deal.stage_id]) {
        map[deal.stage_id].push(deal);
      }
    });
    return map;
  }, [stages, filteredDeals]);

  // Filter only open stages (type 0) for display
  const openStages = useMemo(() => {
    return stages.filter(s => s.type === 0).sort((a, b) => a.sort - b.sort);
  }, [stages]);

  // Calculate total leads and conversion rate (using filtered deals)
  const totalLeads = useMemo(() => filteredDeals.length, [filteredDeals]);
  const totalValue = useMemo(() => filteredDeals.reduce((sum, d) => sum + (d.value || 0), 0), [filteredDeals]);

  // Calculate conversion rates between stages
  const conversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    for (let i = 0; i < openStages.length - 1; i++) {
      const current = dealsByStage[openStages[i].id]?.length || 0;
      const next = dealsByStage[openStages[i + 1].id]?.length || 0;
      rates[openStages[i].id] = current > 0 ? (next / current) * 100 : 0;
    }
    return rates;
  }, [openStages, dealsByStage]);

  const handleDealClick = (deal: FunnelDeal) => {
    setSelectedDeal(deal);
    setIsDrawerOpen(true);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Overview Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        
        {/* Kanban Skeleton */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando funil...</span>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-64">
              <Skeleton className="h-12 mb-2 rounded-lg" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 rounded-lg" />
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
    <div className="space-y-6">
      {/* Filters */}
      <KanbanFilters 
        deals={deals} 
        filters={filters} 
        onFiltersChange={setFilters} 
      />

      {/* Overview Cards - Kommo Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-600/20 to-blue-900/30 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">
                LEADS {filteredDeals.length !== deals.length && '(FILTRADO)'}
              </span>
              <MessageSquare className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-blue-100">{totalLeads}</p>
            <p className="text-xs text-blue-300/70 mt-1">
              {filteredDeals.length !== deals.length 
                ? `de ${deals.length} total • ${formatCurrency(totalValue)} em pipeline`
                : `${formatCurrency(totalValue)} em pipeline`
              }
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600/20 to-amber-900/30 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-200 uppercase tracking-wider">EM NEGOCIAÇÃO</span>
              <Timer className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-amber-100">
              {filteredDeals.filter(d => d.status === 'open').length}
            </p>
            <p className="text-xs text-amber-300/70 mt-1">leads ativos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/20 to-purple-900/30 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-200 uppercase tracking-wider">ETAPAS DO FUNIL</span>
              <AlertCircle className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-purple-100">{openStages.length}</p>
            <p className="text-xs text-purple-300/70 mt-1">etapas configuradas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/30 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-200 uppercase tracking-wider">VALOR TOTAL</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-100">
              {formatCurrency(totalValue)}
            </p>
            <p className="text-xs text-emerald-300/70 mt-1">em oportunidades</p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">Funil de Vendas</h3>
          <Badge variant="outline" className="text-xs">
            {totalLeads} leads {filteredDeals.length !== deals.length && `de ${deals.length}`}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={scrollLeft} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={scrollRight} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {crmUrl && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={crmUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir Kommo
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* No results message when filtered */}
      {filteredDeals.length === 0 && deals.length > 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-muted/30 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h4 className="font-medium mb-1">Nenhum lead encontrado</h4>
          <p className="text-sm text-muted-foreground max-w-md">
            Nenhum lead corresponde aos filtros selecionados. Tente ajustar os filtros ou limpar a busca.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4"
            onClick={() => setFilters(defaultFilters)}
          >
            Limpar filtros
          </Button>
        </div>
      )}

      {/* Horizontal Kanban - ONLY this scrolls horizontally */}
      {filteredDeals.length > 0 && (
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto pb-4 -mx-4 px-4"
          style={{ scrollbarWidth: 'thin' }}
        >
        <div className="flex gap-3 min-w-max">
          {openStages.map((stage, stageIndex) => {
            const stageDeals = dealsByStage[stage.id] || [];
            const stageColor = getStageColor(stage.color);
            const conversionRate = conversionRates[stage.id];
            const isLastStage = stageIndex === openStages.length - 1;

            return (
              <div key={stage.id} className="flex items-start gap-2">
                {/* Stage Column */}
                <div className="flex-shrink-0 w-64 flex flex-col bg-card/50 rounded-lg border border-border/50">
                  {/* Stage Header */}
                  <div 
                    className="px-3 py-2.5 rounded-t-lg border-b"
                    style={{ 
                      backgroundColor: `${stageColor}15`,
                      borderColor: `${stageColor}30`
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 
                        className="font-semibold text-sm uppercase tracking-wide truncate"
                        style={{ color: stageColor }}
                      >
                        {stage.name}
                      </h4>
                      <span 
                        className="text-xl font-bold ml-2"
                        style={{ color: stageColor }}
                      >
                        {stageDeals.length}
                      </span>
                    </div>
                    {!isLastStage && conversionRate !== undefined && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        <span>Conv: {conversionRate.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  {/* Leads List - Vertical Scroll Inside */}
                  <div className="flex-1 overflow-y-auto max-h-[500px] p-2 space-y-2">
                    {stageDeals.length === 0 ? (
                      <div className="flex items-center justify-center py-8 text-center">
                        <p className="text-sm text-muted-foreground">Nenhum lead</p>
                      </div>
                    ) : (
                      stageDeals.map((deal) => {
                        const sourceLabel = deal.utm_source || deal.lead_source;
                        
                        return (
                          <div
                            key={deal.id}
                            onClick={() => handleDealClick(deal)}
                            className={cn(
                              "p-3 rounded-lg border bg-card cursor-pointer",
                              "hover:bg-accent/10 hover:border-accent/50 transition-all duration-150",
                              "group"
                            )}
                          >
                            {/* Lead Title */}
                            <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {deal.title || deal.contact_name || 'Lead sem nome'}
                            </p>

                            {/* Contact Name if different */}
                            {deal.contact_name && deal.contact_name !== deal.title && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {deal.contact_name}
                              </p>
                            )}

                            {/* Value and Date Row */}
                            <div className="flex items-center justify-between mt-2 gap-2">
                              {deal.value && deal.value > 0 ? (
                                <span className="text-xs font-medium text-emerald-400">
                                  {formatCurrency(deal.value)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {formatDateShort(deal.created_date)}
                              </span>
                            </div>

                            {/* Source Badge */}
                            {sourceLabel && (
                              <Badge 
                                variant="secondary" 
                                className="mt-2 text-[10px] px-1.5 py-0 h-5"
                              >
                                {sourceLabel}
                              </Badge>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Arrow between columns */}
                {!isLastStage && (
                  <div className="flex items-center justify-center h-12 mt-3 text-muted-foreground/30">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
      {/* Lead Detail Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
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
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDeal.stage_name && (
                    <Badge variant="secondary">
                      {selectedDeal.stage_name}
                    </Badge>
                  )}
                  {selectedDeal.status && (
                    <Badge variant={
                      selectedDeal.status === 'won' ? 'default' : 
                      selectedDeal.status === 'lost' ? 'destructive' : 'outline'
                    }>
                      {selectedDeal.status === 'won' ? 'Ganho' : 
                       selectedDeal.status === 'lost' ? 'Perdido' : 'Em Aberto'}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Informações de Contato
                </h4>

                {(() => {
                  // Try to get email and phone from custom_fields if not in dedicated fields
                  const email = selectedDeal.contact_email || selectedDeal.custom_fields?.Email || selectedDeal.custom_fields?.email;
                  const phone = selectedDeal.contact_phone || selectedDeal.custom_fields?.Phone || selectedDeal.custom_fields?.phone || selectedDeal.custom_fields?.Telefone || selectedDeal.custom_fields?.telefone;
                  
                  return (
                    <div className="space-y-2">
                      {selectedDeal.contact_name && (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Nome</p>
                            <p className="text-sm font-medium truncate">{selectedDeal.contact_name}</p>
                          </div>
                        </div>
                      )}

                      {email && (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">E-mail comercial</p>
                            <a 
                              href={`mailto:${email}`}
                              className="text-sm font-medium text-primary hover:underline truncate block"
                            >
                              {email}
                            </a>
                          </div>
                        </div>
                      )}

                      {phone && (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Tel. comercial</p>
                            <a 
                              href={`tel:${phone}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {phone}
                            </a>
                          </div>
                        </div>
                      )}

                      {selectedDeal.company_name && (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Empresa</p>
                            <p className="text-sm font-medium truncate">{selectedDeal.company_name}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <Separator />

              {/* UTMs - All of them */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Origem / UTMs
                </h4>

                <div className="space-y-2 text-sm">
                  {selectedDeal.utm_source && (
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">utm_source</p>
                        <p className="font-medium break-words">{selectedDeal.utm_source}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.utm_medium && (
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">utm_medium</p>
                        <p className="font-medium break-words">{selectedDeal.utm_medium}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.utm_campaign && (
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">utm_campaign</p>
                        <p className="font-medium break-words">{selectedDeal.utm_campaign}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.utm_content && (
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">utm_content</p>
                        <p className="font-medium break-words">{selectedDeal.utm_content}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.utm_term && (
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">utm_term</p>
                        <p className="font-medium break-words">{selectedDeal.utm_term}</p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.lead_source && (
                    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">lead_source</p>
                        <p className="font-medium break-words">{selectedDeal.lead_source}</p>
                      </div>
                    </div>
                  )}

                  {!selectedDeal.utm_source && !selectedDeal.utm_campaign && !selectedDeal.lead_source && (
                    <p className="text-muted-foreground text-sm italic">Nenhuma informação de origem</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Custom Fields from Kommo */}
              {selectedDeal.custom_fields && Object.keys(selectedDeal.custom_fields).length > 0 && (
                <>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Campos Personalizados
                    </h4>

                    <div className="space-y-2 text-sm">
                      {Object.entries(selectedDeal.custom_fields).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                          <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">{key}</p>
                            <p className="font-medium break-words">{value || '-'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Value and Responsible */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Negociação
                </h4>

                <div className="space-y-2">
                  {selectedDeal.value !== undefined && selectedDeal.value > 0 && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-500/10">
                      <DollarSign className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Valor do Negócio</p>
                        <p className="text-sm font-medium text-emerald-400">
                          {formatCurrency(selectedDeal.value)}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedDeal.owner_name && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
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
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Histórico
                </h4>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Entrada</p>
                      <p className="text-sm font-medium">{formatDate(selectedDeal.created_date)}</p>
                    </div>
                  </div>

                  {selectedDeal.closed_date && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data de Fechamento</p>
                        <p className="text-sm font-medium">{formatDate(selectedDeal.closed_date)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {crmUrl && (
                <>
                  <Separator />
                  <Button className="w-full gap-2" asChild>
                    <a 
                      href={`${crmUrl}/leads/detail/${selectedDeal.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver no Kommo
                    </a>
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
