// Currency symbols and formatting helper
const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string }> = {
  USD: { symbol: '$', locale: 'en-US' },
  BRL: { symbol: 'R$', locale: 'pt-BR' },
  EUR: { symbol: '€', locale: 'de-DE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  AUD: { symbol: 'A$', locale: 'en-AU' },
  CAD: { symbol: 'C$', locale: 'en-CA' },
  CHF: { symbol: 'CHF', locale: 'de-CH' },
  JPY: { symbol: '¥', locale: 'ja-JP' },
  CNY: { symbol: '¥', locale: 'zh-CN' },
  INR: { symbol: '₹', locale: 'en-IN' },
  MXN: { symbol: 'MX$', locale: 'es-MX' },
  ARS: { symbol: 'AR$', locale: 'es-AR' },
  CLP: { symbol: 'CL$', locale: 'es-CL' },
  COP: { symbol: 'CO$', locale: 'es-CO' },
  PEN: { symbol: 'S/', locale: 'es-PE' },
};

export const COMMON_CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP'];

export const ALL_CURRENCIES = Object.keys(CURRENCY_CONFIG);

export function formatMoney(
  amount: number,
  currency: string = 'USD',
  locale?: string
): string {
  const config = CURRENCY_CONFIG[currency] || { symbol: currency, locale: 'en-US' };
  const useLocale = locale || config.locale;
  
  try {
    return new Intl.NumberFormat(useLocale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    return `${config.symbol} ${amount.toFixed(2)}`;
  }
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_CONFIG[currency]?.symbol || currency;
}
