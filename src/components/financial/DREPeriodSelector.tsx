import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon, ChevronDown, History, Check, CalendarRange } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DREPeriod } from './CompleteDRE';
import type { DateRange } from 'react-day-picker';

interface DREPeriodSelectorProps {
  value: DREPeriod;
  onChange: (period: DREPeriod) => void;
  onOpenHistory?: () => void;
  periodDescription?: string;
  customDateRange?: DateRange;
  onCustomDateRangeChange?: (range: DateRange | undefined) => void;
}

const PERIOD_OPTIONS: { key: DREPeriod; label: string }[] = [
  { key: 'this_month', label: 'Mês atual' },
  { key: 'last_month', label: 'Mês passado' },
  { key: 'last_7d', label: 'Últimos 7 dias' },
  { key: 'last_30d', label: 'Últimos 30 dias' },
];

export function DREPeriodSelector({ 
  value, onChange, onOpenHistory, periodDescription,
  customDateRange, onCustomDateRangeChange
}: DREPeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const currentLabel = value === 'custom' && customDateRange?.from
    ? `${format(customDateRange.from, 'dd/MM')}${customDateRange.to ? ` - ${format(customDateRange.to, 'dd/MM')}` : ''}`
    : PERIOD_OPTIONS.find(p => p.key === value)?.label || 'Período';

  const handleCustomSelect = (range: DateRange | undefined) => {
    onCustomDateRangeChange?.(range);
    if (range?.from && range?.to) {
      onChange('custom');
      setShowCalendar(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!showCalendar ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="truncate max-w-[160px]">{currentLabel}</span>
              {periodDescription && value !== 'custom' && (
                <span className="text-xs text-muted-foreground hidden sm:inline">({periodDescription})</span>
              )}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {PERIOD_OPTIONS.map(({ key, label }) => (
              <DropdownMenuItem
                key={key}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className="flex items-center justify-between"
              >
                {label}
                {value === key && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                setShowCalendar(true);
              }}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />
                Personalizado
              </span>
              {value === 'custom' && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            {onOpenHistory && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenHistory} className="gap-2">
                  <History className="h-4 w-4" />
                  Histórico de DRE
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Popover open={showCalendar} onOpenChange={setShowCalendar}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarRange className="h-4 w-4" />
              <span>Selecione o período</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={customDateRange}
              onSelect={handleCustomSelect}
              numberOfMonths={2}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
