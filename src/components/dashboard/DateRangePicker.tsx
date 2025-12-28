import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  DATE_PRESETS, 
  DatePresetKey, 
  getDateRangeFromPreset, 
  datePeriodToDateRange,
  calculateTimePeriods
} from '@/utils/dateUtils';

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  timezone?: string;
  onPresetChange?: (presetKey: DatePresetKey) => void;
}

// Presets rápidos para botões
const quickPresets: DatePresetKey[] = ['last_7_days', 'last_30_days', 'last_90_days'];

export default function DateRangePicker({ 
  dateRange, 
  onDateRangeChange, 
  timezone = 'America/Sao_Paulo',
  onPresetChange
}: DateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('last_30_days');

  // Calcula os períodos baseado no timezone
  const periods = useMemo(() => calculateTimePeriods(timezone), [timezone]);

  const handlePresetClick = (presetKey: DatePresetKey) => {
    setSelectedPreset(presetKey);
    
    if (presetKey === 'custom') {
      setIsCalendarOpen(true);
      onPresetChange?.(presetKey);
      return;
    }

    const period = getDateRangeFromPreset(presetKey, timezone);
    if (period) {
      const range = datePeriodToDateRange(period);
      onDateRangeChange(range);
      onPresetChange?.(presetKey);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onDateRangeChange(range);
    if (range?.from && range?.to) {
      setSelectedPreset('custom');
      onPresetChange?.('custom');
    }
  };

  // Encontra o label do preset selecionado
  const selectedPresetLabel = DATE_PRESETS.find(p => p.key === selectedPreset)?.label || 'Selecionar período';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Quick preset buttons */}
      {quickPresets.map((presetKey) => {
        const preset = DATE_PRESETS.find(p => p.key === presetKey);
        if (!preset) return null;
        
        return (
          <Button
            key={presetKey}
            variant={selectedPreset === presetKey ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick(presetKey)}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              selectedPreset === presetKey && "bg-secondary text-foreground"
            )}
          >
            {preset.label}
          </Button>
        );
      })}
      
      {/* Full presets dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <span className="text-muted-foreground">Mais:</span>
            <span>{selectedPresetLabel}</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {DATE_PRESETS.filter(p => !quickPresets.includes(p.key) && p.key !== 'custom').map((preset, index) => (
            <DropdownMenuItem
              key={preset.key}
              onClick={() => handlePresetClick(preset.key)}
              className="flex items-center justify-between"
            >
              {preset.label}
              {selectedPreset === preset.key && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handlePresetClick('custom')}
            className="flex items-center justify-between"
          >
            Personalizado
            {selectedPreset === 'custom' && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Calendar picker */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal min-w-[280px]',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'dd MMM, yyyy', { locale: ptBR })} -{' '}
                  {format(dateRange.to, 'dd MMM, yyyy', { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, 'dd MMM, yyyy', { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {/* Timezone indicator */}
      <span className="text-xs text-muted-foreground hidden lg:inline">
        Fuso: {timezone.replace('America/', '').replace('_', ' ')}
      </span>
    </div>
  );
}
