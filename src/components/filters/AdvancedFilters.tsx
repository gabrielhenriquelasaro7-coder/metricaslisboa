import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Filter, SortAsc, SortDesc, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterConfig {
  status?: string[];
  objective?: string[];
  minSpend?: number;
  maxSpend?: number;
  minRoas?: number;
  maxRoas?: number;
  search?: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

interface AdvancedFiltersProps {
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
  sortOptions: { value: string; label: string }[];
}

const statusOptions = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'DELETED', label: 'Excluído' },
  { value: 'ARCHIVED', label: 'Arquivado' },
];

const objectiveOptions = [
  { value: 'CONVERSIONS', label: 'Conversões' },
  { value: 'LINK_CLICKS', label: 'Cliques no Link' },
  { value: 'REACH', label: 'Alcance' },
  { value: 'BRAND_AWARENESS', label: 'Reconhecimento' },
  { value: 'VIDEO_VIEWS', label: 'Visualizações de Vídeo' },
  { value: 'LEAD_GENERATION', label: 'Geração de Leads' },
];

export default function AdvancedFilters({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  sortOptions,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = [
    filters.status?.length,
    filters.objective?.length,
    filters.minSpend,
    filters.maxSpend,
    filters.minRoas,
    filters.maxRoas,
  ].filter(Boolean).length;

  const handleStatusChange = (value: string, checked: boolean) => {
    const currentStatus = filters.status || [];
    const newStatus = checked
      ? [...currentStatus, value]
      : currentStatus.filter((s) => s !== value);
    onFiltersChange({ ...filters, status: newStatus.length ? newStatus : undefined });
  };

  const handleObjectiveChange = (value: string, checked: boolean) => {
    const currentObjective = filters.objective || [];
    const newObjective = checked
      ? [...currentObjective, value]
      : currentObjective.filter((o) => o !== value);
    onFiltersChange({ ...filters, objective: newObjective.length ? newObjective : undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-0 w-full sm:max-w-md">
        <Input
          placeholder="Buscar..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          className="pr-8 text-sm h-10"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: undefined })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {/* Filter Popover */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-1.5 sm:gap-2 flex-1 sm:flex-none h-10 text-sm">
              <Filter className="w-4 h-4" />
              <span className="hidden xs:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-5 px-1.5 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-3 sm:p-4 max-h-[70vh] overflow-y-auto" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filtros Avançados</h4>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                    Limpar
                  </Button>
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                      <Checkbox
                        checked={filters.status?.includes(option.value) || false}
                        onCheckedChange={(checked) => handleStatusChange(option.value, !!checked)}
                      />
                      <span className="text-xs sm:text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Objective Filter */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Objetivo</Label>
                <div className="space-y-1.5">
                  {objectiveOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                      <Checkbox
                        checked={filters.objective?.includes(option.value) || false}
                        onCheckedChange={(checked) => handleObjectiveChange(option.value, !!checked)}
                      />
                      <span className="text-xs sm:text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Spend Range */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Gasto (R$)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Mín"
                    value={filters.minSpend || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        minSpend: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full h-9 text-sm"
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <Input
                    type="number"
                    placeholder="Máx"
                    value={filters.maxSpend || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        maxSpend: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full h-9 text-sm"
                  />
                </div>
              </div>

              {/* ROAS Range */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">ROAS</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Mín"
                    value={filters.minRoas || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        minRoas: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full h-9 text-sm"
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Máx"
                    value={filters.maxRoas || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        maxRoas: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Select value={sort.field} onValueChange={(value) => onSortChange({ ...sort, field: value })}>
          <SelectTrigger className="w-auto min-w-[100px] sm:w-[140px] h-10 text-xs sm:text-sm">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          onClick={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
        >
          {sort.direction === 'asc' ? (
            <SortAsc className="w-4 h-4" />
          ) : (
            <SortDesc className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Active Filters Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.status?.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {statusOptions.find((o) => o.value === status)?.label}
              <button onClick={() => handleStatusChange(status, false)}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {filters.objective?.map((objective) => (
            <Badge key={objective} variant="secondary" className="gap-1">
              {objectiveOptions.find((o) => o.value === objective)?.label}
              <button onClick={() => handleObjectiveChange(objective, false)}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
