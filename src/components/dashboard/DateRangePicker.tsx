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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  selectedPreset?: DatePresetKey;
}

export default function DateRangePicker({ 
  dateRange, 
  onDateRangeChange, 
  timezone = 'America/Sao_Paulo',
  onPresetChange,
  selectedPreset: externalPreset
}: DateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [internalPreset, setInternalPreset] = useState<DatePresetKey>('this_month');
  
  // Use external preset if provided, otherwise use internal state
  const selectedPreset = externalPreset ?? internalPreset;

  // Calcula os períodos baseado no timezone
  const periods = useMemo(() => calculateTimePeriods(timezone), [timezone]);

  const handlePresetChange = (presetKey: DatePresetKey) => {
    setInternalPreset(presetKey);
    
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
      setInternalPreset('custom');
      onPresetChange?.('custom');
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
      {/* Period selector */}
      <Select value={selectedPreset} onValueChange={(value) => handlePresetChange(value as DatePresetKey)}>
        <SelectTrigger className="w-full sm:w-[160px] h-9 sm:h-10 text-xs sm:text-sm">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {DATE_PRESETS.map((preset) => (
            <SelectItem key={preset.key} value={preset.key}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Calendar picker - only show when custom or always for date display */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'justify-start text-left font-normal h-9 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            {dateRange?.from ? (
              dateRange.to ? (
                <span className="truncate">
                  {format(dateRange.from, 'dd/MM', { locale: ptBR })} - {format(dateRange.to, 'dd/MM', { locale: ptBR })}
                </span>
              ) : (
                format(dateRange.from, 'dd/MM', { locale: ptBR })
              )
            ) : (
              <span>Datas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 bg-popover/95 backdrop-blur-sm border-border/50 shadow-xl max-w-[95vw]" 
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b border-border/30">
            <p className="text-xs text-muted-foreground font-medium">Selecione o período</p>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={1}
            locale={ptBR}
            className="p-2"
          />
          {dateRange?.from && dateRange?.to && (
            <div className="p-2 sm:p-3 border-t border-border/30 bg-muted/30">
              <p className="text-xs text-center text-muted-foreground">
                <span className="font-medium text-foreground">
                  {format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                {' até '}
                <span className="font-medium text-foreground">
                  {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
