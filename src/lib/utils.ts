import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata número como moeda (suporta BRL e USD)
 * Para USD usa locale en-US ($1,234.56)
 * Para BRL usa locale pt-BR (R$ 1.234,56)
 */
export function formatCurrency(value: number, currency: string = 'BRL'): string {
  const locale = currency === 'USD' ? 'en-US' : 'pt-BR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata número grande de forma abreviada (1K, 1M)
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString('pt-BR');
}

/**
 * Formata número com casas decimais específicas
 */
export function formatDecimal(num: number, decimals: number = 2): string {
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
