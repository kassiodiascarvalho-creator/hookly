/**
 * Currency Configuration and Formatting Utilities
 * 
 * CRITICAL: All monetary values in the database are stored in MINOR UNITS (cents).
 * This module provides centralized formatting that:
 * 1. Converts minor units → major units based on currency-specific decimal places
 * 2. Formats using Intl.NumberFormat with proper locale and currency symbol
 * 3. Handles edge cases (unknown currencies, missing values)
 */

// Currency configuration with decimal places (minor unit scale)
const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; decimals: number }> = {
  // 2 decimal currencies (most common)
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
  CLP: { symbol: 'CL$', locale: 'es-CL', decimals: 0 }, // No decimal places
  COP: { symbol: 'CO$', locale: 'es-CO', decimals: 2 },
  PEN: { symbol: 'S/', locale: 'es-PE', decimals: 2 },
  // 0 decimal currencies
  JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
  CNY: { symbol: '¥', locale: 'zh-CN', decimals: 2 },
  KRW: { symbol: '₩', locale: 'ko-KR', decimals: 0 },
  VND: { symbol: '₫', locale: 'vi-VN', decimals: 0 },
  // 3 decimal currencies
  KWD: { symbol: 'KD', locale: 'ar-KW', decimals: 3 },
  BHD: { symbol: 'BD', locale: 'ar-BH', decimals: 3 },
  OMR: { symbol: 'OMR', locale: 'ar-OM', decimals: 3 },
};

export const COMMON_CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP'];

export const ALL_CURRENCIES = Object.keys(CURRENCY_CONFIG);

/**
 * Get the number of decimal places for a currency
 */
export function getCurrencyDecimals(currency: string): number {
  return CURRENCY_CONFIG[currency]?.decimals ?? 2;
}

/**
 * Get the divisor to convert from minor to major units
 * e.g., USD = 100, JPY = 1, KWD = 1000
 */
export function getMinorUnitDivisor(currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  return Math.pow(10, decimals);
}

/**
 * Convert minor units (cents) to major units
 */
export function minorToMajor(amountMinor: number, currency: string): number {
  const divisor = getMinorUnitDivisor(currency);
  return amountMinor / divisor;
}

/**
 * Convert major units to minor units (cents)
 */
export function majorToMinor(amountMajor: number, currency: string): number {
  const divisor = getMinorUnitDivisor(currency);
  return Math.round(amountMajor * divisor);
}

/**
 * Format a monetary value for display
 * 
 * @param amount - The amount to format (in MAJOR units by default, e.g., 100.00)
 * @param currency - ISO 4217 currency code (e.g., 'USD', 'BRL', 'EUR')
 * @param locale - Optional locale override
 * @returns Formatted currency string (e.g., 'R$ 100,00', '$100.00')
 * 
 * IMPORTANT: If your values are stored in cents (minor units), 
 * use formatMoneyFromCents() instead!
 */
export function formatMoney(
  amount: number,
  currency: string = 'USD',
  locale?: string
): string {
  // Handle invalid values
  if (amount === null || amount === undefined || isNaN(amount)) {
    console.error('[formatMoney] Invalid amount:', amount, 'currency:', currency);
    return '—';
  }
  
  const config = CURRENCY_CONFIG[currency] || { symbol: currency, locale: 'en-US', decimals: 2 };
  const useLocale = locale || config.locale;
  const decimals = config.decimals;
  
  try {
    return new Intl.NumberFormat(useLocale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch (error) {
    console.error('[formatMoney] Formatting error:', error, 'currency:', currency);
    // Fallback for unsupported currencies
    return `${config.symbol} ${amount.toFixed(decimals)}`;
  }
}

/**
 * Format a monetary value from MINOR UNITS (cents) for display
 * 
 * @param amountMinor - The amount in minor units (cents) as stored in database
 * @param currency - ISO 4217 currency code (e.g., 'USD', 'BRL', 'EUR')
 * @param locale - Optional locale override
 * @returns Formatted currency string (e.g., 'R$ 100,00', '$100.00')
 * 
 * USAGE:
 * - Database stores 10000 cents for BRL → displays "R$ 100,00"
 * - Database stores 100 cents for USD → displays "$1.00"
 * - Database stores 100 yen for JPY → displays "¥100"
 */
export function formatMoneyFromCents(
  amountMinor: number,
  currency: string = 'USD',
  locale?: string
): string {
  // Handle invalid values
  if (amountMinor === null || amountMinor === undefined || isNaN(amountMinor)) {
    console.error('[formatMoneyFromCents] Invalid amount:', amountMinor, 'currency:', currency);
    return '—';
  }
  
  const amountMajor = minorToMajor(amountMinor, currency);
  return formatMoney(amountMajor, currency, locale);
}

/**
 * Get just the currency symbol without formatting
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_CONFIG[currency]?.symbol || currency;
}

/**
 * Validate that a currency is supported
 */
export function isSupportedCurrency(currency: string): boolean {
  return currency in CURRENCY_CONFIG;
}
