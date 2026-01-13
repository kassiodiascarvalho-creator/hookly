/**
 * Country to Currency mapping and validation utilities
 * Used to restrict currency options based on user's country
 */

// ISO 3166-1 country code to ISO 4217 currency code mapping
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // Americas
  US: "USD",
  BR: "BRL",
  CA: "CAD",
  MX: "MXN",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
  
  // Europe
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  GB: "GBP",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  
  // Asia-Pacific
  JP: "JPY",
  CN: "CNY",
  KR: "KRW",
  IN: "INR",
  AU: "AUD",
  NZ: "NZD",
  SG: "SGD",
  HK: "HKD",
  TW: "TWD",
  TH: "THB",
  MY: "MYR",
  ID: "IDR",
  PH: "PHP",
  VN: "VND",
  
  // Middle East
  AE: "AED",
  SA: "SAR",
  IL: "ILS",
  
  // Africa
  ZA: "ZAR",
  NG: "NGN",
  EG: "EGP",
  KE: "KES",
};

// Default currency for unknown countries
export const DEFAULT_CURRENCY = "USD";

/**
 * Get the official currency for a country
 */
export function getCurrencyByCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || DEFAULT_CURRENCY;
}

/**
 * Get allowed currencies for a user based on their country
 * Always includes USD as the platform's base currency
 */
export function getAllowedCurrencies(countryCode: string | null | undefined): string[] {
  const localCurrency = getCurrencyByCountry(countryCode);
  
  // If local currency is USD, only return USD
  if (localCurrency === "USD") {
    return ["USD"];
  }
  
  // Return both local currency and USD
  return [localCurrency, "USD"];
}

/**
 * Check if a currency is allowed for a given country
 */
export function isCurrencyAllowed(currency: string, countryCode: string | null | undefined): boolean {
  const allowedCurrencies = getAllowedCurrencies(countryCode);
  return allowedCurrencies.includes(currency.toUpperCase());
}

/**
 * Get currency options formatted for Select component
 */
export function getCurrencyOptions(countryCode: string | null | undefined): Array<{ value: string; label: string }> {
  const allowed = getAllowedCurrencies(countryCode);
  
  return allowed.map(currency => ({
    value: currency,
    label: currency,
  }));
}

/**
 * Validate and return the appropriate currency based on country
 * If the requested currency is not allowed, returns the local currency
 */
export function validateCurrency(requestedCurrency: string, countryCode: string | null | undefined): string {
  if (isCurrencyAllowed(requestedCurrency, countryCode)) {
    return requestedCurrency.toUpperCase();
  }
  return getCurrencyByCountry(countryCode);
}
