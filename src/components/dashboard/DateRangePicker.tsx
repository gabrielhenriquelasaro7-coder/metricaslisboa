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
}

export default function DateRangePicker({ 
  dateRange, 
  onDateRangeChange, 
  timezone = 'America/Sao_Paulo',
  onPresetChange
}: DateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');

  // Calcula os períodos baseado no timezone
  const periods = useMemo(() => calculateTimePeriods(timezone), [timezone]);

  const handlePresetChange = (presetKey: DatePresetKey) => {
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

  return (
    <div className="flex items-center gap-2">
      {/* Period selector */}
      <Select value={selectedPreset} onValueChange={(value) => handlePresetChange(value as DatePresetKey)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
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
              'justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'dd/MM', { locale: ptBR })} - {format(dateRange.to, 'dd/MM', { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, 'dd/MM/yy', { locale: ptBR })
              )
            ) : (
              <span>Datas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover/95 backdrop-blur-sm border-border/50 shadow-xl" align="start">
          <div className="p-2 border-b border-border/30">
            <p className="text-xs text-muted-foreground font-medium">Selecione o período</p>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={ptBR}
          />
          {dateRange?.from && dateRange?.to && (
            <div className="p-3 border-t border-border/30 bg-muted/30">
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
