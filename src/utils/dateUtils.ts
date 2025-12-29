// Utilitário de cálculo de períodos temporais com suporte a timezone
// Períodos: yesterday, this_month, last_month, this_year, last_year

export interface DatePeriod {
  since: string;
  until: string;
}

export interface TimePeriods {
  reference_date: string;
  yesterday: DatePeriod;
  this_month: DatePeriod;
  last_month: DatePeriod;
  this_year: DatePeriod;
  last_year: DatePeriod;
}

// Map de timezones para offset em horas
const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/Sao_Paulo': -3,
  'America/New_York': -5,
  'America/Los_Angeles': -8,
  'America/Chicago': -6,
  'Europe/London': 0,
  'Europe/Paris': 1,
  'Europe/Berlin': 1,
  'Asia/Tokyo': 9,
  'Asia/Shanghai': 8,
  'Australia/Sydney': 11,
  'UTC': 0,
};

function getOffsetFromTimezone(timezone: string): number {
  return TIMEZONE_OFFSETS[timezone] ?? -3; // Default para Brasília
}

function toTimezone(date: Date, offsetHours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + d.getTimezoneOffset() / 60 + offsetHours);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

export function calculateTimePeriods(timezone: string = 'America/Sao_Paulo'): TimePeriods {
  const now = new Date();
  const offsetHours = getOffsetFromTimezone(timezone);
  const today = toTimezone(now, offsetHours);

  // Yesterday
  const yesterday = subDays(today, 1);

  // This month
  const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Last month (full month)
  const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // This year
  const firstDayThisYear = new Date(today.getFullYear(), 0, 1);

  // Last year (full year)
  const firstDayLastYear = new Date(today.getFullYear() - 1, 0, 1);
  const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);

  return {
    reference_date: formatDate(today),

    yesterday: {
      since: formatDate(yesterday),
      until: formatDate(yesterday),
    },

    this_month: {
      since: formatDate(firstDayThisMonth),
      until: formatDate(today),
    },

    last_month: {
      since: formatDate(firstDayLastMonth),
      until: formatDate(lastDayLastMonth),
    },

    this_year: {
      since: formatDate(firstDayThisYear),
      until: formatDate(today),
    },

    last_year: {
      since: formatDate(firstDayLastYear),
      until: formatDate(lastDayLastYear),
    },
  };
}

// Presets para o DateRangePicker - APENAS OS 5 NOVOS PERÍODOS
export type DatePresetKey = 
  | 'yesterday'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface DatePresetOption {
  key: DatePresetKey;
  label: string;
}

export const DATE_PRESETS: DatePresetOption[] = [
  { key: 'yesterday', label: 'Ontem' },
  { key: 'this_month', label: 'Este Mês' },
  { key: 'last_month', label: 'Mês Passado' },
  { key: 'this_year', label: 'Este Ano' },
  { key: 'last_year', label: 'Ano Passado' },
];

// Retorna o período de datas para um preset específico
export function getDateRangeFromPreset(
  presetKey: DatePresetKey, 
  timezone: string = 'America/Sao_Paulo'
): DatePeriod | null {
  if (presetKey === 'custom') return null;
  
  const periods = calculateTimePeriods(timezone);
  return periods[presetKey] || null;
}

// Converte DatePeriod para DateRange (react-day-picker format)
export function datePeriodToDateRange(period: DatePeriod): { from: Date; to: Date } {
  return {
    from: new Date(period.since + 'T00:00:00'),
    to: new Date(period.until + 'T23:59:59'),
  };
}

// Mapeia preset key para o period_key usado no banco
export function presetKeyToPeriodKey(presetKey: DatePresetKey): string {
  return presetKey;
}
