// Utilitário de cálculo de períodos temporais com suporte a timezone
// Baseado na lógica fornecida para cálculos precisos de datas

export interface DatePeriod {
  since: string;
  until: string;
}

export interface TimePeriods {
  reference_date: string;
  days_into_month: number;
  days_into_quarter: number;
  today: DatePeriod;
  yesterday: DatePeriod;
  last_7_days: DatePeriod;
  last_14_days: DatePeriod;
  last_30_days: DatePeriod;
  last_60_days: DatePeriod;
  last_90_days: DatePeriod;
  this_year: DatePeriod;
  last_year: DatePeriod;
  week_current: DatePeriod;
  week_last: DatePeriod;
  week_before_last: DatePeriod;
  month_current: DatePeriod;
  month_last: DatePeriod;
  month_before_last: DatePeriod;
  quarter_current: DatePeriod;
  quarter_last: DatePeriod;
  quarter_before_last: DatePeriod;
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

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function firstDayOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

function daysSinceStart(startDate: Date, currentDate: Date): number {
  return Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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

  // === DIAS ===
  const yesterday = subDays(today, 1);

  // === SEMANAS ===
  const mondayThisWeek = getMonday(today);
  const sundayThisWeek = getSunday(today);
  const mondayLastWeek = subDays(mondayThisWeek, 7);
  const sundayLastWeek = subDays(sundayThisWeek, 7);
  const mondayWeekBefore = subDays(mondayLastWeek, 7);
  const sundayWeekBefore = subDays(sundayLastWeek, 7);

  // === MESES (proporcional) ===
  const firstDayThisMonth = firstDayOfMonth(today);
  const daysIntoMonth = daysSinceStart(firstDayThisMonth, today);
  const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const untilLastMonth = new Date(firstDayLastMonth);
  untilLastMonth.setDate(untilLastMonth.getDate() + daysIntoMonth);
  const firstDayMonthBefore = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const untilMonthBefore = new Date(firstDayMonthBefore);
  untilMonthBefore.setDate(untilMonthBefore.getDate() + daysIntoMonth);

  // === TRIMESTRES (proporcional) ===
  const firstDayThisQuarter = firstDayOfQuarter(today);
  const daysIntoQuarter = daysSinceStart(firstDayThisQuarter, today);
  const firstDayLastQuarter = firstDayOfQuarter(new Date(today.getFullYear(), today.getMonth() - 3, 1));
  const untilLastQuarter = new Date(firstDayLastQuarter);
  untilLastQuarter.setDate(untilLastQuarter.getDate() + daysIntoQuarter);
  const firstDayQuarterBefore = firstDayOfQuarter(new Date(today.getFullYear(), today.getMonth() - 6, 1));
  const untilQuarterBefore = new Date(firstDayQuarterBefore);
  untilQuarterBefore.setDate(untilQuarterBefore.getDate() + daysIntoQuarter);

  // === ANO ===
  const firstDayThisYear = new Date(today.getFullYear(), 0, 1);
  const firstDayLastYear = new Date(today.getFullYear() - 1, 0, 1);
  const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);

  return {
    reference_date: formatDate(today),
    days_into_month: daysIntoMonth + 1,
    days_into_quarter: daysIntoQuarter + 1,

    today: {
      since: formatDate(today),
      until: formatDate(today),
    },

    yesterday: {
      since: formatDate(yesterday),
      until: formatDate(yesterday),
    },

    last_7_days: {
      since: formatDate(subDays(today, 6)),
      until: formatDate(today),
    },

    last_14_days: {
      since: formatDate(subDays(today, 13)),
      until: formatDate(today),
    },

    last_30_days: {
      since: formatDate(subDays(today, 29)),
      until: formatDate(today),
    },

    last_60_days: {
      since: formatDate(subDays(today, 59)),
      until: formatDate(today),
    },

    last_90_days: {
      since: formatDate(subDays(today, 89)),
      until: formatDate(today),
    },

    this_year: {
      since: formatDate(firstDayThisYear),
      until: formatDate(today),
    },

    last_year: {
      since: formatDate(firstDayLastYear),
      until: formatDate(lastDayLastYear),
    },

    week_current: {
      since: formatDate(mondayThisWeek),
      until: formatDate(today),
    },

    week_last: {
      since: formatDate(mondayLastWeek),
      until: formatDate(sundayLastWeek),
    },

    week_before_last: {
      since: formatDate(mondayWeekBefore),
      until: formatDate(sundayWeekBefore),
    },

    month_current: {
      since: formatDate(firstDayThisMonth),
      until: formatDate(today),
    },

    month_last: {
      since: formatDate(firstDayLastMonth),
      until: formatDate(untilLastMonth),
    },

    month_before_last: {
      since: formatDate(firstDayMonthBefore),
      until: formatDate(untilMonthBefore),
    },

    quarter_current: {
      since: formatDate(firstDayThisQuarter),
      until: formatDate(today),
    },

    quarter_last: {
      since: formatDate(firstDayLastQuarter),
      until: formatDate(untilLastQuarter),
    },

    quarter_before_last: {
      since: formatDate(firstDayQuarterBefore),
      until: formatDate(untilQuarterBefore),
    },
  };
}

// Presets para o DateRangePicker com IDs que mapeiam para a Meta API
export type DatePresetKey = 
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'this_year'
  | 'last_year'
  | 'week_current'
  | 'week_last'
  | 'month_current'
  | 'month_last'
  | 'quarter_current'
  | 'quarter_last'
  | 'custom';

export interface DatePresetOption {
  key: DatePresetKey;
  label: string;
  metaPreset?: string; // Preset da Meta API (se aplicável)
}

export const DATE_PRESETS: DatePresetOption[] = [
  { key: 'today', label: 'Hoje', metaPreset: 'today' },
  { key: 'yesterday', label: 'Ontem', metaPreset: 'yesterday' },
  { key: 'last_7_days', label: 'Últimos 7 dias', metaPreset: 'last_7d' },
  { key: 'last_14_days', label: 'Últimos 14 dias', metaPreset: 'last_14d' },
  { key: 'last_30_days', label: 'Últimos 30 dias', metaPreset: 'last_30d' },
  { key: 'last_60_days', label: 'Últimos 60 dias' },
  { key: 'last_90_days', label: 'Últimos 90 dias', metaPreset: 'last_90d' },
  { key: 'week_current', label: 'Esta semana', metaPreset: 'this_week_sun_today' },
  { key: 'week_last', label: 'Semana passada', metaPreset: 'last_week_sun_sat' },
  { key: 'month_current', label: 'Este mês', metaPreset: 'this_month' },
  { key: 'month_last', label: 'Mês passado', metaPreset: 'last_month' },
  { key: 'quarter_current', label: 'Este trimestre', metaPreset: 'this_quarter' },
  { key: 'quarter_last', label: 'Trimestre passado', metaPreset: 'last_quarter' },
  { key: 'this_year', label: 'Este ano', metaPreset: 'this_year' },
  { key: 'last_year', label: 'Ano passado', metaPreset: 'last_year' },
  { key: 'custom', label: 'Personalizado' },
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
