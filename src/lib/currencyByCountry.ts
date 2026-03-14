export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  US: "USD", BR: "BRL", CA: "CAD", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR",
  IE: "EUR", FI: "EUR", GR: "EUR", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  JP: "JPY", CN: "CNY", KR: "KRW", IN: "INR", AU: "AUD", NZ: "NZD", SG: "SGD", HK: "HKD",
  TW: "TWD", TH: "THB", MY: "MYR", ID: "IDR", PH: "PHP", VN: "VND",
  AE: "AED", SA: "SAR", IL: "ILS", ZA: "ZAR", NG: "NGN", EG: "EGP", KE: "KES",
};

export const DEFAULT_CURRENCY = "USD";

export function getCurrencyByCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || DEFAULT_CURRENCY;
}

export function getAllowedCurrencies(countryCode: string | null | undefined): string[] {
  const localCurrency = getCurrencyByCountry(countryCode);
  if (localCurrency === "USD") return ["USD"];
  return [localCurrency, "USD"];
}

export function isCurrencyAllowed(currency: string, countryCode: string | null | undefined): boolean {
  return getAllowedCurrencies(countryCode).includes(currency.toUpperCase());
}

export function getCurrencyOptions(countryCode: string | null | undefined): Array<{ value: string; label: string }> {
  return getAllowedCurrencies(countryCode).map(currency => ({ value: currency, label: currency }));
}

export function validateCurrency(requestedCurrency: string, countryCode: string | null | undefined): string {
  if (isCurrencyAllowed(requestedCurrency, countryCode)) return requestedCurrency.toUpperCase();
  return getCurrencyByCountry(countryCode);
}