import type { Devise, DeviseInfo } from '../types';

// =======================================================================
//   DEVISES & TAUX DE CHANGE
// =======================================================================
//
// EUR est la devise pivot (taux = 1, non modifiable).
// Les taux par défaut représentent une référence stable à la mise en
// production. L'admin peut les ajuster dans la page Paramètres ;
// les valeurs personnalisées sont stockées dans le localStorage et
// poussées vers ce module via `setExchangeRate()`.

export const DEVISES: Record<Devise, DeviseInfo> = {
  EUR: { code: 'EUR', symbol: '€',  label: 'Euro',            defaultRate: 1 },
  USD: { code: 'USD', symbol: '$',  label: 'Dollar US',       defaultRate: 1.08 },
  GBP: { code: 'GBP', symbol: '£',  label: 'Livre sterling',  defaultRate: 0.85 },
  JPY: { code: 'JPY', symbol: '¥',  label: 'Yen japonais',    defaultRate: 161.5 },
  CNY: { code: 'CNY', symbol: '¥',  label: 'Yuan chinois',    defaultRate: 7.85 },
};

export const DEVISE_LIST: DeviseInfo[] = Object.values(DEVISES);

/** Taux par défaut (pour reset). */
export const DEFAULT_EXCHANGE_RATES: Record<Devise, number> = {
  EUR: 1,
  USD: DEVISES.USD.defaultRate,
  GBP: DEVISES.GBP.defaultRate,
  JPY: DEVISES.JPY.defaultRate,
  CNY: DEVISES.CNY.defaultRate,
};

// État vivant des taux. Modifié par AppContext au boot (depuis le
// localStorage) puis à chaque édition dans la page Paramètres.
// Module-scope volontaire : permet à `formatMoney()` de rester pure
// (pas de prop drilling de taux dans 200 composants).
let activeRates: Record<Devise, number> = { ...DEFAULT_EXCHANGE_RATES };

/** Renvoie le taux actif pour une devise (1 EUR = X devise). */
export function getExchangeRate(devise: Devise): number {
  return activeRates[devise];
}

/** Renvoie une copie des taux actifs. */
export function getAllExchangeRates(): Record<Devise, number> {
  return { ...activeRates };
}

/**
 * Définit le taux d'une devise (1 EUR = X devise).
 * EUR est ignoré (toujours 1). Taux invalides (≤ 0, NaN) ignorés silencieusement.
 */
export function setExchangeRate(devise: Devise, rate: number): void {
  if (devise === 'EUR') return;
  if (!isFinite(rate) || rate <= 0) return;
  activeRates = { ...activeRates, [devise]: rate };
}

/** Remplace tous les taux d'un coup (utilisé au boot depuis le localStorage). */
export function setAllExchangeRates(rates: Partial<Record<Devise, number>>): void {
  const next: Record<Devise, number> = { ...DEFAULT_EXCHANGE_RATES };
  for (const [k, v] of Object.entries(rates) as Array<[Devise, number]>) {
    if (k === 'EUR') continue;
    if (typeof v === 'number' && isFinite(v) && v > 0) next[k] = v;
  }
  activeRates = next;
}

/** Reset aux valeurs par défaut. */
export function resetExchangeRates(): void {
  activeRates = { ...DEFAULT_EXCHANGE_RATES };
}

// =======================================================================
//   Conversion et formatage
// =======================================================================

export function convert(amountEUR: number, target: Devise): number {
  return amountEUR * activeRates[target];
}

const localeForDevise: Record<Devise, string> = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
};

// TVA standard (jouets, France). Le PVC stocké fait office de TTC ; le HT en est
// DÉRIVÉ (estimation — aucune TVA réelle n'est fournie par les fichiers sources).
export const TVA_TAUX = 0.2;
export function toHT(montantTTC: number, taux = TVA_TAUX): number {
  return montantTTC / (1 + taux);
}

export function formatMoney(
  amountEUR: number,
  devise: Devise,
  opts: { compact?: boolean; decimals?: number; ht?: boolean } = {},
): string {
  const value = convert(opts.ht ? toHT(amountEUR) : amountEUR, devise);
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

export function moneyFormatter(devise: Devise, opts: { compact?: boolean; decimals?: number } = {}) {
  return (v: unknown) => formatMoney(typeof v === 'number' ? v : 0, devise, opts);
}
