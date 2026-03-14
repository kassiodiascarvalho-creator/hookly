/**
 * Currency Configuration and Formatting Utilities
 * 
 * CRITICAL: All monetary values in the database are stored in MINOR UNITS (cents).
 */

const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; decimals: number }> = {
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  BRL: { symbol: 'R$', locale: 'pt-BR', decimals: 2 },
  EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
  GBP: { symbol: '£', locale: 'en-GB', decimals: 2 },
  AUD: { symbol: 'A$', locale: 'en-AU', decimals: 2 },
  CAD: { symbol: 'C$', locale: 'en-CA', decimals: 2 },
  CHF: { symbol: 'CHF', locale: 'de-CH', decimals: 2 },
  INR: { symbol: '₹', locale: 'en-IN', decimals: 2 },
  MXN: { symbol: 'MX$', locale: 'es-MX', decimals: 2 },
  ARS: { symbol: 'AR$', locale: 'es-AR', decimals: 2 },
  CLP: { symbol: 'CL$', locale: 'es-CL', decimals: 0 },
  COP: { symbol: 'CO$', locale: 'es-CO', decimals: 2 },
  PEN: { symbol: 'S/', locale: 'es-PE', decimals: 2 },
  JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
  CNY: { symbol: '¥', locale: 'zh-CN', decimals: 2 },
  KRW: { symbol: '₩', locale: 'ko-KR', decimals: 0 },
  VND: { symbol: '₫', locale: 'vi-VN', decimals: 0 },
  KWD: { symbol: 'KD', locale: 'ar-KW', decimals: 3 },
  BHD: { symbol: 'BD', locale: 'ar-BH', decimals: 3 },
  OMR: { symbol: 'OMR', locale: 'ar-OM', decimals: 3 },
};

export const COMMON_CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP'];
export const ALL_CURRENCIES = Object.keys(CURRENCY_CONFIG);

export function getCurrencyDecimals(currency: string): number {
  return CURRENCY_CONFIG[currency]?.decimals ?? 2;
}

export function getMinorUnitDivisor(currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  return Math.pow(10, decimals);
}

export function minorToMajor(amountMinor: number, currency: string): number {
  const divisor = getMinorUnitDivisor(currency);
  return amountMinor / divisor;
}

export function majorToMinor(amountMajor: number, currency: string): number {
  const divisor = getMinorUnitDivisor(currency);
  return Math.round(amountMajor * divisor);
}

export function parseAmountToMinor(input: string, currency: string): number {
  const sanitized = input.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(sanitized);
  if (isNaN(parsed) || parsed < 0) return 0;
  return majorToMinor(parsed, currency);
}

export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = 'USD',
  locale?: string
): string {
  if (amount === null || amount === undefined) return '—';
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return '—';
  
  const config = CURRENCY_CONFIG[currency] || { symbol: currency, locale: 'en-US', decimals: 2 };
  const useLocale = locale || config.locale;
  const decimals = config.decimals;
  
  try {
    return new Intl.NumberFormat(useLocale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numericAmount);
  } catch (error) {
    return `${config.symbol} ${numericAmount.toFixed(decimals)}`;
  }
}

export function formatMoneyFromCents(
  amountMinor: number | string | null | undefined,
  currency: string = 'USD',
  locale?: string
): string {
  if (amountMinor === null || amountMinor === undefined) return '—';
  const numericAmount = typeof amountMinor === 'string' ? parseFloat(amountMinor) : amountMinor;
  if (isNaN(numericAmount)) return '—';
  const amountMajor = minorToMajor(numericAmount, currency);
  return formatMoney(amountMajor, currency, locale);
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_CONFIG[currency]?.symbol || currency;
}

export function isSupportedCurrency(currency: string): boolean {
  return currency in CURRENCY_CONFIG;
}

export function formatMoneyDynamic(
  amount: string | number | null | undefined,
  currency: string = 'BRL',
  locale?: string
): string {
  return formatMoney(amount, currency, locale);
}

export function formatMoneyFromCentsDynamic(
  amountMinor: number | string | null | undefined,
  currency: string = 'USD',
  locale?: string
): string {
  return formatMoneyFromCents(amountMinor, currency, locale);
}