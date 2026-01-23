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
 * Use this when converting user input (e.g., "2.00") to database format
 */
export function majorToMinor(amountMajor: number, currency: string): number {
  const divisor = getMinorUnitDivisor(currency);
  return Math.round(amountMajor * divisor);
}

/**
 * Safely parse a user input string as major units and convert to minor units
 * Returns 0 for invalid inputs
 */
export function parseAmountToMinor(input: string, currency: string): number {
  const sanitized = input.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(sanitized);
  if (isNaN(parsed) || parsed < 0) return 0;
  return majorToMinor(parsed, currency);
}

/**
 * Format a monetary value for display
 * 
 * ALWAYS shows the standard decimal places for the currency (e.g., BRL/USD = 2, JPY = 0).
 * Never hides ".00" for currencies with 2 decimal places.
 * 
 * @param amount - The amount to format (in MAJOR units, e.g., 100.00). Can be string or number (Supabase NUMERIC often comes as string).
 * @param currency - ISO 4217 currency code (e.g., 'USD', 'BRL', 'EUR')
 * @param locale - Optional locale override
 * @returns Formatted currency string (e.g., 'R$ 100,00', '$100.00', '¥100')
 * 
 * Examples:
 * - formatMoney(1904, 'BRL') → "R$ 1.904,00"
 * - formatMoney(10, 'BRL') → "R$ 10,00" 
 * - formatMoney(5.5, 'BRL') → "R$ 5,50"
 * - formatMoney(100, 'JPY') → "¥100"
 * 
 * IMPORTANT: If your values are stored in cents (minor units), 
 * use formatMoneyFromCents() instead!
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = 'USD',
  locale?: string
): string {
  // Handle invalid/missing values
  if (amount === null || amount === undefined) {
    return '—';
  }
  
  // Convert string to number (Supabase NUMERIC often comes as string)
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
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
    }).format(numericAmount);
  } catch (error) {
    console.error('[formatMoney] Formatting error:', error, 'currency:', currency);
    // Fallback for unsupported currencies
    return `${config.symbol} ${numericAmount.toFixed(decimals)}`;
  }
}

/**
 * Format a monetary value from MINOR UNITS (cents) for display
 * 
 * ALWAYS shows the standard decimal places for the currency.
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
  amountMinor: number | string | null | undefined,
  currency: string = 'USD',
  locale?: string
): string {
  // Handle invalid/missing values
  if (amountMinor === null || amountMinor === undefined) {
    return '—';
  }
  
  // Convert string to number (Supabase NUMERIC often comes as string)
  const numericAmount = typeof amountMinor === 'string' ? parseFloat(amountMinor) : amountMinor;
  
  if (isNaN(numericAmount)) {
    console.error('[formatMoneyFromCents] Invalid amount:', amountMinor, 'currency:', currency);
    return '—';
  }
  
  const amountMajor = minorToMajor(numericAmount, currency);
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

// ============================================================
// DEPRECATED: Dynamic decimal formatting functions
// These are kept for backward compatibility but should NOT be used.
// Always use formatMoney() or formatMoneyFromCents() instead.
// ============================================================

/**
 * @deprecated Use formatMoney() instead. This function is kept for backward compatibility.
 * 
 * Format a monetary value - now ALWAYS shows standard decimal places (no longer "dynamic").
 */
export function formatMoneyDynamic(
  amount: string | number | null | undefined,
  currency: string = 'BRL',
  locale?: string
): string {
  return formatMoney(amount, currency, locale);
}

/**
 * @deprecated Use formatMoneyFromCents() instead. This function is kept for backward compatibility.
 * 
 * Format from minor units - now ALWAYS shows standard decimal places (no longer "dynamic").
 */
export function formatMoneyFromCentsDynamic(
  amountMinor: number | string | null | undefined,
  currency: string = 'USD',
  locale?: string
): string {
  return formatMoneyFromCents(amountMinor, currency, locale);
}
