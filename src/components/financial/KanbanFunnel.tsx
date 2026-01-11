import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, differenceInHours } from 'date-fns';
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

const formatCurrency = (value: number): string => {
  if (value === 0) return 'R$0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatRelativeDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    const now = new Date();
    const hours = differenceInHours(now, date);
    const days = differenceInDays(now, date);
    
    if (hours < 24) {
      if (hours < 1) return 'Agora';
      return `Ontem ${format(date, 'HH:mm')}`;
    }
    if (days === 1) return `Ontem ${format(date, 'HH:mm')}`;
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '';
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
  return source;
};

// Get header background color based on Kommo stage color
const getHeaderStyle = (color: string): React.CSSProperties => {
  // Kommo colors are in hex format
  return {
    backgroundColor: color || '#1a1f2e',
    borderBottom: `2px solid ${color || '#2a3142'}`,
  };
};

export function KanbanFunnel({
  stages,
  deals,
  isLoading,
  crmUrl,
}: KanbanFunnelProps) {
  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, FunnelDeal[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = deals
        .filter(d => d.stage_id === stage.id)
        .sort((a, b) => {
          // Sort by created_date descending (newest first)
          if (!a.created_date) return 1;
          if (!b.created_date) return -1;
          return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
        });
    });
    return grouped;
  }, [stages, deals]);

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p>Nenhum estágio de funil encontrado</p>
        <p className="text-sm mt-1">Selecione um funil acima</p>
      </div>
    );
  }

  const sortedStages = [...stages].sort((a, b) => a.sort - b.sort);

  return (
    <div className="flex flex-col h-full">
      {/* CRM Link */}
      {crmUrl && (
        <div className="flex justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => window.open(crmUrl, '_blank')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir Kommo
          </Button>
        </div>
      )}

      {/* Kanban Grid */}
      <ScrollArea className="w-full flex-1">
        <div className="flex gap-0 min-w-max">
          {sortedStages.map((stage) => {
            const stageDeals = dealsByStage[stage.id] || [];
            
            return (
              <div 
                key={stage.id} 
                className="flex-shrink-0 w-[280px] flex flex-col bg-[#0d1117] border-r border-[#1e2433] last:border-r-0"
              >
                {/* Stage Header - Kommo Style */}
                <div 
                  className="px-4 py-3 flex flex-col"
                  style={getHeaderStyle(stage.color)}
                >
                  <h3 className="font-semibold text-sm text-white uppercase tracking-wide truncate">
                    {stage.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-white/70">
                    <span>{stage.leads_count} leads:</span>
                    <span>{formatCurrency(stage.total_value)}</span>
                  </div>
                </div>

                {/* Quick Add Button - Like Kommo */}
                <button className="px-4 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-[#1a1f2e] transition-colors border-b border-[#1e2433]">
                  Adição rápida
                </button>

                {/* Deals List */}
                <ScrollArea className="flex-1 max-h-[500px]">
                  <div className="divide-y divide-[#1e2433]">
                    {stageDeals.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Nenhum lead
                      </div>
                    ) : (
                      stageDeals.map((deal) => {
                        const sourceLabel = getSourceLabel(deal.utm_source);
                        
                        return (
                          <div
                            key={deal.id}
                            className="px-4 py-3 hover:bg-[#1a1f2e] transition-colors cursor-pointer group"
                          >
                            {/* Row 1: Title + Date */}
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm text-foreground truncate flex-1">
                                {deal.title}
                              </p>
                              {deal.created_date && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatRelativeDate(deal.created_date)}
                                </span>
                              )}
                            </div>

                            {/* Row 2: Contact Name as Link */}
                            {deal.contact_name && (
                              <p className="text-sm text-primary hover:underline cursor-pointer mt-0.5 truncate">
                                {deal.contact_name}
                              </p>
                            )}

                            {/* Row 3: Source Badge + Status */}
                            <div className="flex items-center justify-between mt-2">
                              {sourceLabel && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#1a3a5c] text-[#5ba4e6] border border-[#2a4a6c]">
                                  {sourceLabel}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Sem Tarefas
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
