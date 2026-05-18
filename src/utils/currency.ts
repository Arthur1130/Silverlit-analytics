import type { Devise, DeviseInfo } from '../types';

export const DEVISES: Record<Devise, DeviseInfo> = {
  EUR: { code: 'EUR', symbol: '€', rate: 1, label: 'Euro' },
  USD: { code: 'USD', symbol: '$', rate: 1.08, label: 'Dollar US' },
  GBP: { code: 'GBP', symbol: '£', rate: 0.85, label: 'Livre sterling' },
  JPY: { code: 'JPY', symbol: '¥', rate: 161.5, label: 'Yen japonais' },
  CNY: { code: 'CNY', symbol: '¥', rate: 7.85, label: 'Yuan chinois' },
};

export const DEVISE_LIST: DeviseInfo[] = Object.values(DEVISES);

export function convert(amountEUR: number, target: Devise): number {
  return amountEUR * DEVISES[target].rate;
}

const localeForDevise: Record<Devise, string> = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
};

export function formatMoney(
  amountEUR: number,
  devise: Devise,
  opts: { compact?: boolean; decimals?: number } = {},
): string {
  const value = convert(amountEUR, devise);
  const { compact = false, decimals } = opts;
  const fractionDigits =
    decimals !== undefined ? decimals : devise === 'JPY' || devise === 'CNY' ? 0 : 2;

  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat(localeForDevise[devise], {
      style: 'currency',
      currency: devise,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(localeForDevise[devise], {
    style: 'currency',
    currency: devise,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatNumber(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('fr-FR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('fr-FR').format(n);
}

export function formatPct(pct: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// Helper for Recharts tooltip formatters where ValueType can be undefined
export function moneyFormatter(devise: Devise, opts: { compact?: boolean; decimals?: number } = {}) {
  return (v: unknown) => formatMoney(typeof v === 'number' ? v : 0, devise, opts);
}
