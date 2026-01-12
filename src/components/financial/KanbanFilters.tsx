import { useState, useMemo } from 'react';
import { 
  Filter, 
  Calendar, 
  User, 
  Tag, 
  DollarSign, 
  X,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { FunnelDeal } from './KanbanFunnel';

export interface KanbanFiltersState {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  status: 'all' | 'open' | 'won' | 'lost';
  owner: string | null;
  utmCampaign: string | null;
  utmSource: string | null;
  valueMin: number | null;
  valueMax: number | null;
  search: string;
}

interface KanbanFiltersProps {
  deals: FunnelDeal[];
  filters: KanbanFiltersState;
  onFiltersChange: (filters: KanbanFiltersState) => void;
}

const QUICK_DATE_OPTIONS = [
  { label: 'Hoje', getDates: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Últimos 7 dias', getDates: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Últimos 30 dias', getDates: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Este mês', getDates: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Mês passado', getDates: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 90 dias', getDates: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
];

export const defaultFilters: KanbanFiltersState = {
  dateRange: { from: undefined, to: undefined },
  status: 'all',
  owner: null,
  utmCampaign: null,
  utmSource: null,
  valueMin: null,
  valueMax: null,
  search: '',
};

export function KanbanFilters({ deals, filters, onFiltersChange }: KanbanFiltersProps) {
  const [isDateOpen, setIsDateOpen] = useState(false);

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const owners = new Set<string>();
    const utmCampaigns = new Set<string>();
    const utmSources = new Set<string>();

    deals.forEach(deal => {
      if (deal.owner_name) owners.add(deal.owner_name);
      if (deal.utm_campaign) utmCampaigns.add(deal.utm_campaign);
      if (deal.utm_source) utmSources.add(deal.utm_source);
      // Also check custom_fields for utm_campaign
      if (deal.custom_fields?.utm_campaign) utmCampaigns.add(deal.custom_fields.utm_campaign);
      if (deal.custom_fields?.utm_source) utmSources.add(deal.custom_fields.utm_source);
    });

    return {
      owners: Array.from(owners).sort(),
      utmCampaigns: Array.from(utmCampaigns).sort(),
      utmSources: Array.from(utmSources).sort(),
    };
  }, [deals]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.status !== 'all') count++;
    if (filters.owner) count++;
    if (filters.utmCampaign) count++;
    if (filters.utmSource) count++;
    if (filters.valueMin !== null || filters.valueMax !== null) count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  const handleQuickDate = (option: typeof QUICK_DATE_OPTIONS[0]) => {
    const { from, to } = option.getDates();
    onFiltersChange({ ...filters, dateRange: { from, to } });
    setIsDateOpen(false);
  };

  const clearAllFilters = () => {
    onFiltersChange(defaultFilters);
  };

  const formatDateRange = () => {
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(filters.dateRange.to, 'dd/MM', { locale: ptBR })}`;
    }
    if (filters.dateRange.from) {
      return `A partir de ${format(filters.dateRange.from, 'dd/MM', { locale: ptBR })}`;
    }
    return 'Período';
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Search and Quick Actions - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search - Full width on mobile */}
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Input
            placeholder="Buscar lead..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="h-8 sm:h-9 pr-8 text-sm"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter buttons - horizontal scroll on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
            {/* Date Range Filter */}
            <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant={filters.dateRange.from ? "secondary" : "outline"} 
                  size="sm" 
                  className="h-7 sm:h-9 gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{filters.dateRange.from ? formatDateRange() : 'Período'}</span>
                  <span className="sm:hidden">{filters.dateRange.from ? formatDateRange() : 'Data'}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] sm:w-auto p-0" align="start" side="bottom" sideOffset={4}>
                <div className="flex flex-col">
                  {/* Quick Options */}
                  <div className="border-b p-2 space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">Atalhos</p>
                    {QUICK_DATE_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => handleQuickDate(option)}
                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded-md transition-colors"
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        onFiltersChange({ ...filters, dateRange: { from: undefined, to: undefined } });
                        setIsDateOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-md transition-colors"
                    >
                      Limpar período
                    </button>
                  </div>
                  {/* Calendar */}
                  <div className="p-2">
                    <CalendarComponent
                      mode="range"
                      selected={{ from: filters.dateRange.from, to: filters.dateRange.to }}
                      onSelect={(range) => {
                        onFiltersChange({ 
                          ...filters, 
                          dateRange: { from: range?.from, to: range?.to } 
                        });
                      }}
                      locale={ptBR}
                      numberOfMonths={1}
                      className="text-sm"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(value: 'all' | 'open' | 'won' | 'lost') => 
                onFiltersChange({ ...filters, status: value })
              }
            >
              <SelectTrigger className={cn(
                "h-7 sm:h-9 w-[90px] sm:w-[130px] text-xs sm:text-sm",
                filters.status !== 'all' && "bg-secondary"
              )}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Em Aberto</SelectItem>
                <SelectItem value="won">Ganhos</SelectItem>
                <SelectItem value="lost">Perdidos</SelectItem>
              </SelectContent>
            </Select>

            {/* Owner Filter - Hidden on small mobile */}
            {filterOptions.owners.length > 0 && (
              <Select
                value={filters.owner || 'all'}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, owner: value === 'all' ? null : value })
                }
              >
                <SelectTrigger className={cn(
                  "h-7 sm:h-9 w-[100px] sm:w-[160px] text-xs sm:text-sm",
                  filters.owner && "bg-secondary"
                )}>
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
                  <span className="truncate">
                    <SelectValue placeholder="Resp." />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filterOptions.owners.map((owner) => (
                    <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* UTM Campaign Filter - Hidden on mobile */}
            {filterOptions.utmCampaigns.length > 0 && (
              <Select
                value={filters.utmCampaign || 'all'}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, utmCampaign: value === 'all' ? null : value })
                }
              >
                <SelectTrigger className={cn(
                  "h-7 sm:h-9 w-[100px] sm:w-[180px] text-xs sm:text-sm hidden xs:flex",
                  filters.utmCampaign && "bg-secondary"
                )}>
                  <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
                  <span className="truncate">
                    {filters.utmCampaign ? filters.utmCampaign.slice(0, 12) + '...' : 'Camp.'}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-w-[300px] sm:max-w-[400px]">
                  <SelectItem value="all">Todas</SelectItem>
                  {filterOptions.utmCampaigns.map((campaign) => (
                    <SelectItem key={campaign} value={campaign} className="truncate">
                      {campaign}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Value Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={(filters.valueMin !== null || filters.valueMax !== null) ? "secondary" : "outline"} 
                  size="sm" 
                  className="h-7 sm:h-9 gap-1 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Valor</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 sm:w-64 p-3 sm:p-4" align="start">
                <div className="space-y-3 sm:space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="valueMin" className="text-xs sm:text-sm">Valor mínimo (R$)</Label>
                    <Input
                      id="valueMin"
                      type="number"
                      placeholder="0"
                      className="h-8 sm:h-9"
                      value={filters.valueMin ?? ''}
                      onChange={(e) => onFiltersChange({ 
                        ...filters, 
                        valueMin: e.target.value ? Number(e.target.value) : null 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valueMax" className="text-xs sm:text-sm">Valor máximo (R$)</Label>
                    <Input
                      id="valueMax"
                      type="number"
                      placeholder="Sem limite"
                      className="h-8 sm:h-9"
                      value={filters.valueMax ?? ''}
                      onChange={(e) => onFiltersChange({ 
                        ...filters, 
                        valueMax: e.target.value ? Number(e.target.value) : null 
                      })}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-8"
                    onClick={() => onFiltersChange({ ...filters, valueMin: null, valueMax: null })}
                  >
                    Limpar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Clear All Filters */}
            {activeFilterCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 sm:h-9 gap-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground px-2"
                onClick={clearAllFilters}
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Limpar</span>
                ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active Filters Display - Mobile Optimized */}
      {activeFilterCount > 0 && (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
            <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Filtros:</span>
            
            {filters.dateRange.from && (
              <Badge variant="secondary" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {formatDateRange()}
                <button onClick={() => onFiltersChange({ ...filters, dateRange: { from: undefined, to: undefined } })}>
                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5" />
                </button>
              </Badge>
            )}

            {filters.status !== 'all' && (
              <Badge variant="secondary" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {filters.status === 'open' ? 'Aberto' : filters.status === 'won' ? 'Ganhos' : 'Perdidos'}
                <button onClick={() => onFiltersChange({ ...filters, status: 'all' })}>
                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5" />
                </button>
              </Badge>
            )}

            {filters.owner && (
              <Badge variant="secondary" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 max-w-[100px] sm:max-w-none">
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                <span className="truncate">{filters.owner}</span>
                <button onClick={() => onFiltersChange({ ...filters, owner: null })}>
                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5 shrink-0" />
                </button>
              </Badge>
            )}

            {filters.utmCampaign && (
              <Badge variant="secondary" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 max-w-[120px] sm:max-w-[200px]">
                <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                <span className="truncate">{filters.utmCampaign}</span>
                <button onClick={() => onFiltersChange({ ...filters, utmCampaign: null })}>
                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5 shrink-0" />
                </button>
              </Badge>
            )}

            {(filters.valueMin !== null || filters.valueMax !== null) && (
              <Badge variant="secondary" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {filters.valueMin !== null && `${filters.valueMin}`}
                {filters.valueMin !== null && filters.valueMax !== null && '-'}
                {filters.valueMax !== null && `${filters.valueMax}`}
                <button onClick={() => onFiltersChange({ ...filters, valueMin: null, valueMax: null })}>
                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5" />
                </button>
              </Badge>
            )}

            {filters.search && (
              <Badge variant="secondary" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 max-w-[100px] sm:max-w-none">
                <span className="truncate">"{filters.search}"</span>
                <button onClick={() => onFiltersChange({ ...filters, search: '' })}>
                  <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5" />
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Utility function to filter deals based on filters
export function filterDeals(deals: FunnelDeal[], filters: KanbanFiltersState): FunnelDeal[] {
  return deals.filter(deal => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        deal.title?.toLowerCase().includes(searchLower) ||
        deal.contact_name?.toLowerCase().includes(searchLower) ||
        deal.contact_email?.toLowerCase().includes(searchLower) ||
        deal.contact_phone?.includes(filters.search);
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (filters.dateRange.from || filters.dateRange.to) {
      if (!deal.created_date) return false;
      const dealDate = new Date(deal.created_date);
      if (filters.dateRange.from && dealDate < filters.dateRange.from) return false;
      if (filters.dateRange.to) {
        const endOfDay = new Date(filters.dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (dealDate > endOfDay) return false;
      }
    }

    // Status filter
    if (filters.status !== 'all') {
      if (deal.status !== filters.status) return false;
    }

    // Owner filter
    if (filters.owner) {
      if (deal.owner_name !== filters.owner) return false;
    }

    // UTM Campaign filter
    if (filters.utmCampaign) {
      const dealCampaign = deal.utm_campaign || deal.custom_fields?.utm_campaign;
      if (dealCampaign !== filters.utmCampaign) return false;
    }

    // UTM Source filter
    if (filters.utmSource) {
      const dealSource = deal.utm_source || deal.custom_fields?.utm_source;
      if (dealSource !== filters.utmSource) return false;
    }

    // Value range filter
    if (filters.valueMin !== null) {
      if (!deal.value || deal.value < filters.valueMin) return false;
    }
    if (filters.valueMax !== null) {
      if (!deal.value || deal.value > filters.valueMax) return false;
    }

    return true;
  });
}
