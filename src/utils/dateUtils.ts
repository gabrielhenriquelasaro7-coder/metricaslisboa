// Utilitário de cálculo de períodos temporais com suporte a timezone
// Períodos: yesterday, last_7d, last_14d, last_30d, last_60d, last_90d, this_month, last_month, this_year, last_year

export interface DatePeriod {
  since: string;
  until: string;
}

export interface TimePeriods {
  reference_date: string;
  yesterday: DatePeriod;
  last_7d: DatePeriod;
  last_14d: DatePeriod;
  last_30d: DatePeriod;
  last_60d: DatePeriod;
  last_90d: DatePeriod;
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
  return TIMEZONE_OFFSETS[timezone] ?? -3;
}

function toTimezone(date: Date, offsetHours: number): Date {
  // Create a new date in the target timezone
  // We need to get the current time in the specified timezone
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const targetTime = utcTime + (offsetHours * 60 * 60 * 1000);
  return new Date(targetTime);
}

function formatDate(date: Date): string {
  // Format as YYYY-MM-DD without timezone conversion issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  
  // Get the actual date components from the adjusted time
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();
  
  console.log(`[DateUtils] Calculating periods - Today: ${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')} (timezone: ${timezone})`);

  // Yesterday
  const yesterday = subDays(today, 1);

  // This month
  const firstDayThisMonth = new Date(todayYear, todayMonth, 1);

  // Last month (full month)
  const firstDayLastMonth = new Date(todayYear, todayMonth - 1, 1);
  const lastDayLastMonth = new Date(todayYear, todayMonth, 0);

  // This year
  const firstDayThisYear = new Date(todayYear, 0, 1);

  // Last year (full year) - this should be the ENTIRE previous year
  const lastYear = todayYear - 1;
  const firstDayLastYear = new Date(lastYear, 0, 1);
  const lastDayLastYear = new Date(lastYear, 11, 31);
  
  console.log(`[DateUtils] Last year range: ${formatDate(firstDayLastYear)} to ${formatDate(lastDayLastYear)}`);

  return {
    reference_date: formatDate(today),

    yesterday: {
      since: formatDate(yesterday),
      until: formatDate(yesterday),
    },

    last_7d: {
      since: formatDate(subDays(today, 7)),
      until: formatDate(yesterday),
    },

    last_14d: {
      since: formatDate(subDays(today, 14)),
      until: formatDate(yesterday),
    },

    last_30d: {
      since: formatDate(subDays(today, 30)),
      until: formatDate(yesterday),
    },

    last_60d: {
      since: formatDate(subDays(today, 60)),
      until: formatDate(yesterday),
    },

    last_90d: {
      since: formatDate(subDays(today, 90)),
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

// TODOS os presets disponíveis
export type DatePresetKey = 
  | 'yesterday'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_60d'
  | 'last_90d'
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
  { key: 'last_7d', label: 'Últimos 7 dias' },
  { key: 'last_14d', label: 'Últimos 14 dias' },
  { key: 'last_30d', label: 'Últimos 30 dias' },
  { key: 'last_60d', label: 'Últimos 60 dias' },
  { key: 'last_90d', label: 'Últimos 90 dias' },
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
  return periods[presetKey as keyof Omit<TimePeriods, 'reference_date'>] || null;
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

// Lista de todos os period_keys para sync
export const ALL_PERIOD_KEYS = [
  'yesterday',
  'last_7d',
  'last_14d', 
  'last_30d',
  'last_60d',
  'last_90d',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
] as const;
