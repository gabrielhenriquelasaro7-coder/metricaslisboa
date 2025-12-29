import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { DatePresetKey, DATE_PRESETS, getDateRangeFromPreset } from '@/utils/dateUtils';
import { DateRange } from 'react-day-picker';

interface PeriodContextType {
  selectedPreset: DatePresetKey;
  dateRange: DateRange | undefined;
  periodLabel: string;
  setSelectedPreset: (preset: DatePresetKey) => void;
  setDateRange: (range: DateRange | undefined) => void;
  periodDescription: string;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [selectedPreset, setSelectedPresetState] = useState<DatePresetKey>(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem('selectedPeriodPreset');
    return (saved as DatePresetKey) || 'this_month';
  });
  
  const [dateRange, setDateRangeState] = useState<DateRange | undefined>(() => {
    const saved = localStorage.getItem('selectedPeriodPreset') as DatePresetKey || 'this_month';
    const period = getDateRangeFromPreset(saved, 'America/Sao_Paulo');
    if (period) {
      return {
        from: new Date(period.since + 'T00:00:00'),
        to: new Date(period.until + 'T23:59:59'),
      };
    }
    return undefined;
  });

  const setSelectedPreset = useCallback((preset: DatePresetKey) => {
    setSelectedPresetState(preset);
    localStorage.setItem('selectedPeriodPreset', preset);
    
    if (preset !== 'custom') {
      const period = getDateRangeFromPreset(preset, 'America/Sao_Paulo');
      if (period) {
        setDateRangeState({
          from: new Date(period.since + 'T00:00:00'),
          to: new Date(period.until + 'T23:59:59'),
        });
      }
    }
  }, []);

  const setDateRange = useCallback((range: DateRange | undefined) => {
    setDateRangeState(range);
    if (range) {
      setSelectedPresetState('custom');
      localStorage.setItem('selectedPeriodPreset', 'custom');
    }
  }, []);

  // Get human readable label for the selected period
  const periodLabel = DATE_PRESETS.find(p => p.key === selectedPreset)?.label || 'Período personalizado';
  
  // Get period description with dates
  const periodDescription = dateRange?.from && dateRange?.to
    ? `${dateRange.from.toLocaleDateString('pt-BR')} - ${dateRange.to.toLocaleDateString('pt-BR')}`
    : 'Selecione um período';

  return (
    <PeriodContext.Provider value={{
      selectedPreset,
      dateRange,
      periodLabel,
      setSelectedPreset,
      setDateRange,
      periodDescription,
    }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriodContext() {
  const context = useContext(PeriodContext);
  if (context === undefined) {
    throw new Error('usePeriodContext must be used within a PeriodProvider');
  }
  return context;
}
