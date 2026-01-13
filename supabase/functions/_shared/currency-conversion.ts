/**
 * Currency Conversion Module
 * 
 * Converts any currency to USD using real-time exchange rates.
 * Applies a configurable platform spread (fee).
 * 
 * Uses Exchange Rate API (https://exchangerate-api.com) for rates.
 * Free tier: 1500 requests/month, updates daily.
 */

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CURRENCY-CONVERSION] ${step}${detailsStr}`);
};

// Exchange rate cache (5 min TTL)
const rateCache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Currency decimal places for proper conversion
const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2, BRL: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, 
  MXN: 2, ARS: 2, CLP: 0, COP: 2, PEN: 2, CHF: 2, INR: 2,
  JPY: 0, KRW: 0, VND: 0, CNY: 2,
  KWD: 3, BHD: 3, OMR: 3,
};

function getDecimalPlaces(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

function getMinorUnitDivisor(currency: string): number {
  return Math.pow(10, getDecimalPlaces(currency));
}

export interface FxConversionResult {
  success: boolean;
  amount_usd_minor: number;
  fx_rate_market: number;
  fx_rate_applied: number;
  fx_spread_percent: number;
  fx_spread_amount_usd_minor: number;
  fx_provider: string;
  fx_timestamp: string;
  error?: string;
}

export interface ConversionParams {
  payment_amount_minor: number;
  payment_currency: string;
  spread_percent?: number; // Default 0.008 (0.8%)
}

/**
 * Fetch exchange rate from API
 */
async function fetchExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  const cacheKey = `${fromCurrency}_${toCurrency}`;
  const cached = rateCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logStep("Using cached rate", { cacheKey, rate: cached.rate });
    return cached.rate;
  }

  try {
    // Use Exchange Rate API (free tier)
    // Alternative: Open Exchange Rates, Fixer.io
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${fromCurrency}`
    );

    if (!response.ok) {
      logStep("Exchange rate API error", { status: response.status });
      return null;
    }

    const data = await response.json();
    
    if (!data.rates || !data.rates[toCurrency]) {
      logStep("Rate not found in response", { fromCurrency, toCurrency });
      return null;
    }

    const rate = data.rates[toCurrency];
    
    // Cache the rate
    rateCache.set(cacheKey, { rate, timestamp: Date.now() });
    logStep("Fetched and cached rate", { fromCurrency, toCurrency, rate });
    
    return rate;
  } catch (error) {
    logStep("Error fetching exchange rate", { error: String(error) });
    return null;
  }
}

/**
 * Fallback rates for when API is unavailable
 * Updated periodically for common currencies
 */
const FALLBACK_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  BRL: 0.17,    // ~1 USD = 5.8 BRL
  EUR: 1.08,    // ~1 USD = 0.93 EUR
  GBP: 1.26,    // ~1 USD = 0.79 GBP
  CAD: 0.74,    // ~1 USD = 1.35 CAD
  AUD: 0.65,    // ~1 USD = 1.54 AUD
  MXN: 0.056,   // ~1 USD = 17.8 MXN
  JPY: 0.0067,  // ~1 USD = 149 JPY
  CNY: 0.14,    // ~1 USD = 7.1 CNY
  INR: 0.012,   // ~1 USD = 83 INR
  CHF: 1.13,    // ~1 USD = 0.88 CHF
  ARS: 0.001,   // ~1 USD = 1000 ARS
  CLP: 0.001,   // ~1 USD = 1000 CLP
  COP: 0.00025, // ~1 USD = 4000 COP
  PEN: 0.27,    // ~1 USD = 3.7 PEN
};

/**
 * Convert a payment amount to USD with spread
 * 
 * @param params - Conversion parameters
 * @returns Conversion result with all FX details
 */
export async function convertToUSD(params: ConversionParams): Promise<FxConversionResult> {
  const { payment_amount_minor, payment_currency, spread_percent = 0.008 } = params;
  
  const timestamp = new Date().toISOString();
  
  logStep("Starting conversion", { payment_amount_minor, payment_currency, spread_percent });

  // If already USD, no conversion needed
  if (payment_currency === 'USD') {
    return {
      success: true,
      amount_usd_minor: payment_amount_minor,
      fx_rate_market: 1.0,
      fx_rate_applied: 1.0,
      fx_spread_percent: 0,
      fx_spread_amount_usd_minor: 0,
      fx_provider: 'none',
      fx_timestamp: timestamp,
    };
  }

  // Convert minor units to major units
  const divisor = getMinorUnitDivisor(payment_currency);
  const amountMajor = payment_amount_minor / divisor;

  // Get exchange rate (from source currency to USD)
  let marketRate = await fetchExchangeRate(payment_currency, 'USD');
  let provider = 'exchangerate-api.com';

  if (marketRate === null) {
    // Use fallback rates
    marketRate = FALLBACK_RATES_TO_USD[payment_currency];
    provider = 'fallback';
    
    if (!marketRate) {
      logStep("No rate available for currency", { payment_currency });
      return {
        success: false,
        amount_usd_minor: 0,
        fx_rate_market: 0,
        fx_rate_applied: 0,
        fx_spread_percent: spread_percent,
        fx_spread_amount_usd_minor: 0,
        fx_provider: 'none',
        fx_timestamp: timestamp,
        error: `No exchange rate available for ${payment_currency}`,
      };
    }
    
    logStep("Using fallback rate", { payment_currency, marketRate });
  }

  // Apply spread (platform fee)
  // If converting TO USD, we reduce the rate (customer gets slightly less USD)
  const appliedRate = marketRate * (1 - spread_percent);
  
  // Calculate USD amounts
  const amountUsdMajor = amountMajor * appliedRate;
  const amountUsdMajorWithoutSpread = amountMajor * marketRate;
  
  // Spread amount in USD (platform profit)
  const spreadAmountUsdMajor = amountUsdMajorWithoutSpread - amountUsdMajor;
  
  // Convert to minor units (USD has 2 decimals)
  const amountUsdMinor = Math.round(amountUsdMajor * 100);
  const spreadAmountUsdMinor = Math.round(spreadAmountUsdMajor * 100);

  logStep("Conversion complete", {
    amountMajor,
    marketRate,
    appliedRate,
    amountUsdMajor,
    amountUsdMinor,
    spreadAmountUsdMinor,
  });

  return {
    success: true,
    amount_usd_minor: amountUsdMinor,
    fx_rate_market: marketRate,
    fx_rate_applied: appliedRate,
    fx_spread_percent: spread_percent,
    fx_spread_amount_usd_minor: spreadAmountUsdMinor,
    fx_provider: provider,
    fx_timestamp: timestamp,
  };
}

/**
 * Get the platform FX spread percentage from settings
 */
export async function getPlatformSpread(supabaseAdmin: any): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'fx_spread_percent')
      .single();
    
    if (data?.value?.value) {
      return Number(data.value.value);
    }
  } catch (error) {
    logStep("Error fetching platform spread, using default", { error: String(error) });
  }
  
  return 0.008; // Default 0.8%
}

/**
 * Extract payment method from gateway payload
 */
export function extractPaymentMethod(provider: string, gatewayPayload: Record<string, unknown>): string {
  if (provider === 'mercadopago') {
    // Mercado Pago payment types
    const paymentTypeId = gatewayPayload.payment_type_id as string;
    const paymentMethodId = gatewayPayload.payment_method_id as string;
    
    if (paymentTypeId === 'pix' || paymentMethodId?.toLowerCase().includes('pix')) {
      return 'pix';
    }
    if (paymentTypeId === 'credit_card') {
      return 'credit_card';
    }
    if (paymentTypeId === 'debit_card') {
      return 'debit_card';
    }
    if (paymentTypeId === 'bank_transfer') {
      return 'bank_transfer';
    }
    if (paymentTypeId === 'ticket' || paymentMethodId?.toLowerCase().includes('boleto')) {
      return 'boleto';
    }
    return paymentTypeId || 'unknown';
  }
  
  if (provider === 'stripe') {
    // Stripe payment method types from PaymentIntent
    const paymentMethodTypes = gatewayPayload.payment_method_types as string[] | undefined;
    const paymentMethodType = paymentMethodTypes?.[0];
    
    if (paymentMethodType === 'card') {
      return 'card';
    }
    if (paymentMethodType === 'bank_transfer') {
      return 'bank_transfer';
    }
    return paymentMethodType || 'card';
  }
  
  return 'unknown';
}
