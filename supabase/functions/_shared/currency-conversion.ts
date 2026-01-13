/**
 * Currency Conversion Module v2
 * 
 * Features:
 * - Converts any currency to USD using real-time exchange rates
 * - Applies configurable platform spread (fee) per currency
 * - Caches rates with configurable TTL
 * - Automatic fallback to cached/hardcoded rates when API fails
 * - Tracks rate source for auditing (live, cached, fallback)
 * - Blocks transactions if no valid rate available
 */

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CURRENCY-CONVERSION] ${step}${detailsStr}`);
};

// ================== CACHE CONFIGURATION ==================

interface CachedRate {
  rate: number;
  timestamp: number;
  source: 'live' | 'cached' | 'fallback';
}

// Primary cache: Recent API responses (5 min TTL for fresh data)
const rateCache = new Map<string, CachedRate>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Secondary cache: Last known good rates (1 hour TTL for fallback)
const lastKnownRates = new Map<string, CachedRate>();
const LAST_KNOWN_TTL_MS = 60 * 60 * 1000; // 1 hour

// ================== CURRENCY DECIMALS ==================

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

// ================== TYPES ==================

export type FxRateSource = 'live' | 'cached' | 'fallback';

export interface FxConversionResult {
  success: boolean;
  amount_usd_minor: number;
  fx_rate_market: number;
  fx_rate_applied: number;
  fx_spread_percent: number;
  fx_spread_amount_usd_minor: number;
  fx_provider: string;
  fx_timestamp: string;
  fx_rate_source: FxRateSource;
  error?: string;
}

export interface ConversionParams {
  payment_amount_minor: number;
  payment_currency: string;
  spread_percent?: number;
  block_on_no_rate?: boolean; // Default true - block if no valid rate
}

// ================== FALLBACK RATES ==================

/**
 * Hardcoded fallback rates for when API and cache are unavailable
 * These should be periodically reviewed and updated
 * Last updated: 2026-01-13
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

// ================== RATE FETCHING ==================

/**
 * Fetch exchange rate with multi-tier fallback:
 * 1. Primary cache (5 min TTL)
 * 2. Live API call
 * 3. Last known rate (1 hour TTL)
 * 4. Hardcoded fallback
 */
async function fetchExchangeRate(
  fromCurrency: string, 
  toCurrency: string
): Promise<{ rate: number; source: FxRateSource } | null> {
  const cacheKey = `${fromCurrency}_${toCurrency}`;
  const now = Date.now();
  
  // Tier 1: Check primary cache (fresh rates)
  const cached = rateCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    logStep("Using fresh cached rate", { cacheKey, rate: cached.rate, age: `${Math.round((now - cached.timestamp) / 1000)}s` });
    return { rate: cached.rate, source: 'cached' };
  }

  // Tier 2: Try live API
  try {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${fromCurrency}`,
      { signal: AbortSignal.timeout(5000) } // 5s timeout
    );

    if (response.ok) {
      const data = await response.json();
      
      if (data.rates && data.rates[toCurrency]) {
        const rate = data.rates[toCurrency];
        
        // Update both caches
        const cacheEntry: CachedRate = { rate, timestamp: now, source: 'live' };
        rateCache.set(cacheKey, cacheEntry);
        lastKnownRates.set(cacheKey, cacheEntry);
        
        logStep("Fetched live rate", { fromCurrency, toCurrency, rate });
        return { rate, source: 'live' };
      }
    }
    
    logStep("API response invalid", { status: response.status });
  } catch (error) {
    logStep("API call failed", { error: String(error) });
  }

  // Tier 3: Check last known rate (stale but valid)
  const lastKnown = lastKnownRates.get(cacheKey);
  if (lastKnown && now - lastKnown.timestamp < LAST_KNOWN_TTL_MS) {
    logStep("Using last known rate", { 
      cacheKey, 
      rate: lastKnown.rate, 
      age: `${Math.round((now - lastKnown.timestamp) / 60000)}min` 
    });
    return { rate: lastKnown.rate, source: 'cached' };
  }

  // Tier 4: Hardcoded fallback
  const fallbackRate = FALLBACK_RATES_TO_USD[fromCurrency];
  if (fallbackRate && toCurrency === 'USD') {
    logStep("Using hardcoded fallback", { fromCurrency, fallbackRate });
    return { rate: fallbackRate, source: 'fallback' };
  }

  // No rate available
  logStep("No rate available", { fromCurrency, toCurrency });
  return null;
}

// ================== SPREAD CONFIGURATION ==================

export interface SpreadLimits {
  min: number;
  max: number;
}

/**
 * Get spread limits from platform settings
 */
export async function getSpreadLimits(supabaseAdmin: any): Promise<SpreadLimits> {
  const defaultLimits: SpreadLimits = { min: 0, max: 0.05 }; // 0% to 5%
  
  try {
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('key, value')
      .in('key', ['fx_spread_min_percent', 'fx_spread_max_percent']);
    
    if (data && data.length > 0) {
      const minSetting = data.find((s: any) => s.key === 'fx_spread_min_percent');
      const maxSetting = data.find((s: any) => s.key === 'fx_spread_max_percent');
      
      return {
        min: minSetting?.value?.value ?? defaultLimits.min,
        max: maxSetting?.value?.value ?? defaultLimits.max,
      };
    }
  } catch (error) {
    logStep("Error fetching spread limits, using defaults", { error: String(error) });
  }
  
  return defaultLimits;
}

/**
 * Get spread percentage for a specific currency
 * First checks fx_spread_configs table, then platform_settings, then default
 * Validates against spread limits
 */
export async function getSpreadForCurrency(
  supabaseAdmin: any, 
  currency: string
): Promise<{ spread: number; valid: boolean; error?: string }> {
  const limits = await getSpreadLimits(supabaseAdmin);
  
  try {
    // Check currency-specific spread
    const { data: currencySpread } = await supabaseAdmin
      .from('fx_spread_configs')
      .select('spread_percent, is_enabled')
      .eq('currency_code', currency)
      .eq('is_enabled', true)
      .single();
    
    if (currencySpread?.spread_percent !== undefined) {
      const spread = Number(currencySpread.spread_percent);
      
      // Validate against limits
      if (spread < limits.min || spread > limits.max) {
        logStep("BLOCKING: Spread outside limits", { currency, spread, limits });
        return {
          spread,
          valid: false,
          error: `Spread ${(spread * 100).toFixed(2)}% for ${currency} is outside allowed range [${(limits.min * 100).toFixed(2)}%, ${(limits.max * 100).toFixed(2)}%]`,
        };
      }
      
      logStep("Using currency-specific spread", { currency, spread });
      return { spread, valid: true };
    }
  } catch {
    // Currency not found, try default
  }
  
  // Fall back to platform default
  const defaultSpread = await getPlatformSpread(supabaseAdmin);
  
  // Validate default against limits
  if (defaultSpread < limits.min || defaultSpread > limits.max) {
    logStep("BLOCKING: Default spread outside limits", { defaultSpread, limits });
    return {
      spread: defaultSpread,
      valid: false,
      error: `Default spread ${(defaultSpread * 100).toFixed(2)}% is outside allowed range`,
    };
  }
  
  return { spread: defaultSpread, valid: true };
}

/**
 * Get the default platform FX spread percentage from settings
 */
export async function getPlatformSpread(supabaseAdmin: any): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'fx_spread_percent')
      .single();
    
    if (data?.value?.value !== undefined) {
      return Number(data.value.value);
    }
  } catch (error) {
    logStep("Error fetching platform spread, using default", { error: String(error) });
  }
  
  return 0.008; // Default 0.8%
}

// ================== MAIN CONVERSION ==================

/**
 * Convert a payment amount to USD with spread
 * 
 * Features:
 * - Multi-tier rate fallback (live -> cached -> fallback)
 * - Currency-specific spread configuration
 * - Blocks transaction if no valid rate (configurable)
 * - Full audit trail (rate source, timestamps)
 */
export async function convertToUSD(
  params: ConversionParams,
  supabaseAdmin?: any
): Promise<FxConversionResult> {
  const { 
    payment_amount_minor, 
    payment_currency, 
    spread_percent,
    block_on_no_rate = true 
  } = params;
  
  const timestamp = new Date().toISOString();
  
  logStep("Starting conversion", { payment_amount_minor, payment_currency });

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
      fx_rate_source: 'live',
    };
  }

  // Get exchange rate with fallback chain
  const rateResult = await fetchExchangeRate(payment_currency, 'USD');
  
  if (!rateResult) {
    if (block_on_no_rate) {
      logStep("BLOCKING: No rate available", { payment_currency });
      return {
        success: false,
        amount_usd_minor: 0,
        fx_rate_market: 0,
        fx_rate_applied: 0,
        fx_spread_percent: 0,
        fx_spread_amount_usd_minor: 0,
        fx_provider: 'none',
        fx_timestamp: timestamp,
        fx_rate_source: 'fallback',
        error: `No exchange rate available for ${payment_currency}. Transaction blocked.`,
      };
    }
    
    // Use USD 1:1 as last resort (dangerous, only for testing)
    logStep("WARNING: Using 1:1 rate as last resort");
  }

  const marketRate = rateResult?.rate ?? 1;
  const rateSource = rateResult?.source ?? 'fallback';
  const provider = rateSource === 'live' ? 'exchangerate-api.com' : rateSource;

  // Get spread (currency-specific or default) with validation
  let finalSpread = spread_percent;
  let spreadValid = true;
  let spreadError: string | undefined;
  
  if (finalSpread === undefined && supabaseAdmin) {
    const spreadResult = await getSpreadForCurrency(supabaseAdmin, payment_currency);
    finalSpread = spreadResult.spread;
    spreadValid = spreadResult.valid;
    spreadError = spreadResult.error;
  }
  
  // Block transaction if spread is invalid (outside limits)
  if (!spreadValid && block_on_no_rate) {
    logStep("BLOCKING: Invalid spread configuration", { payment_currency, finalSpread, spreadError });
    return {
      success: false,
      amount_usd_minor: 0,
      fx_rate_market: marketRate,
      fx_rate_applied: 0,
      fx_spread_percent: finalSpread ?? 0,
      fx_spread_amount_usd_minor: 0,
      fx_provider: provider,
      fx_timestamp: timestamp,
      fx_rate_source: rateSource,
      error: spreadError || `Invalid spread configuration for ${payment_currency}. Transaction blocked.`,
    };
  }
  
  finalSpread = finalSpread ?? 0.008;

  // Convert minor units to major units
  const divisor = getMinorUnitDivisor(payment_currency);
  const amountMajor = payment_amount_minor / divisor;

  // Apply spread (platform fee reduces conversion rate)
  const appliedRate = marketRate * (1 - finalSpread);
  
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
    amountUsdMinor,
    spreadAmountUsdMinor,
    rateSource,
  });

  return {
    success: true,
    amount_usd_minor: amountUsdMinor,
    fx_rate_market: marketRate,
    fx_rate_applied: appliedRate,
    fx_spread_percent: finalSpread,
    fx_spread_amount_usd_minor: spreadAmountUsdMinor,
    fx_provider: provider,
    fx_timestamp: timestamp,
    fx_rate_source: rateSource,
  };
}

// ================== VALIDATION HELPERS ==================

/**
 * Check if a rate is anomalous (potential fraud/error)
 * Returns true if rate seems suspicious
 */
export function isRateAnomalous(
  currency: string,
  rate: number,
  tolerancePercent: number = 0.15 // 15% tolerance from fallback
): { anomalous: boolean; reason?: string } {
  const expectedRate = FALLBACK_RATES_TO_USD[currency];
  
  if (!expectedRate) {
    return { anomalous: false }; // Can't validate unknown currency
  }

  const lowerBound = expectedRate * (1 - tolerancePercent);
  const upperBound = expectedRate * (1 + tolerancePercent);

  if (rate < lowerBound || rate > upperBound) {
    return {
      anomalous: true,
      reason: `Rate ${rate} is outside expected range [${lowerBound.toFixed(6)}, ${upperBound.toFixed(6)}] for ${currency}`,
    };
  }

  return { anomalous: false };
}

/**
 * Validate spread is within acceptable limits
 */
export function isSpreadValid(
  spreadPercent: number,
  minSpread: number = 0,
  maxSpread: number = 0.05 // 5% max
): { valid: boolean; reason?: string } {
  if (spreadPercent < minSpread) {
    return { valid: false, reason: `Spread ${spreadPercent} is below minimum ${minSpread}` };
  }
  if (spreadPercent > maxSpread) {
    return { valid: false, reason: `Spread ${spreadPercent} exceeds maximum ${maxSpread}` };
  }
  return { valid: true };
}

// ================== PAYMENT METHOD EXTRACTION ==================

/**
 * Extract payment method from gateway payload
 */
export function extractPaymentMethod(provider: string, gatewayPayload: Record<string, unknown>): string {
  if (provider === 'mercadopago') {
    const paymentTypeId = gatewayPayload.payment_type_id as string;
    const paymentMethodId = gatewayPayload.payment_method_id as string;
    
    if (paymentTypeId === 'pix' || paymentMethodId?.toLowerCase().includes('pix')) {
      return 'pix';
    }
    if (paymentTypeId === 'credit_card') return 'credit_card';
    if (paymentTypeId === 'debit_card') return 'debit_card';
    if (paymentTypeId === 'bank_transfer') return 'bank_transfer';
    if (paymentTypeId === 'ticket' || paymentMethodId?.toLowerCase().includes('boleto')) {
      return 'boleto';
    }
    return paymentTypeId || 'unknown';
  }
  
  if (provider === 'stripe') {
    const paymentMethodTypes = gatewayPayload.payment_method_types as string[] | undefined;
    const paymentMethodType = paymentMethodTypes?.[0];
    
    if (paymentMethodType === 'card') return 'card';
    if (paymentMethodType === 'bank_transfer') return 'bank_transfer';
    return paymentMethodType || 'card';
  }
  
  return 'unknown';
}