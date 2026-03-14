import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrencyByCountry } from "@/lib/currencyByCountry";

interface LocalCurrencyData {
  localCurrency: string;
  exchangeRate: number | null;
  loading: boolean;
  error: string | null;
  convertToLocal: (usdCents: number) => number | null;
  refreshRate: () => Promise<void>;
}

// Simple in-memory cache for exchange rates
const rateCache: Record<string, { rate: number; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to convert USD amounts to local currency for display purposes only.
 * Uses the platform's FX service/cache for conversion rates.
 * The converted value is informational and not persisted.
 */
export function useLocalCurrencyDisplay(): LocalCurrencyData {
  const { user } = useAuth();
  const [localCurrency, setLocalCurrency] = useState<string>("USD");
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine local currency from user profile
  useEffect(() => {
    const fetchUserCountry = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Try to get country from freelancer profile
        const { data: freelancerData } = await (supabase as any)
          .from("freelancer_profiles")
          .select("country_code")
          .eq("user_id", user.id)
          .maybeSingle();

        if (freelancerData?.country_code) {
          const currency = getCurrencyByCountry(freelancerData.country_code);
          setLocalCurrency(currency);
          return;
        }

        // Try to get country from company profile
        const { data: companyData } = await (supabase as any)
          .from("company_profiles")
          .select("country")
          .eq("user_id", user.id)
          .maybeSingle();

        if (companyData?.country) {
          const currency = getCurrencyByCountry(companyData.country);
          setLocalCurrency(currency);
        }
      } catch (err) {
        console.error("[useLocalCurrencyDisplay] Error fetching country:", err);
      }
    };

    fetchUserCountry();
  }, [user]);

  // Fetch exchange rate for local currency
  const fetchExchangeRate = useCallback(async () => {
    // No conversion needed for USD
    if (localCurrency === "USD") {
      setExchangeRate(1);
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = rateCache[localCurrency];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setExchangeRate(cached.rate);
      setLoading(false);
      console.log(`[useLocalCurrencyDisplay] Using cached rate for ${localCurrency}:`, cached.rate);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try to get rate from fx_spread_configs (if it has cached rates)
      const { data: fxConfig } = await supabase
        .from("fx_spread_configs")
        .select("currency_code, spread_percent")
        .eq("currency_code", localCurrency)
        .maybeSingle();

      // Use a fallback rate API or platform setting
      // For now, we'll use hardcoded approximate rates as fallback
      // In production, this should call an edge function that uses the real FX API
      const fallbackRates: Record<string, number> = {
        BRL: 5.40,
        EUR: 0.92,
        GBP: 0.79,
        CAD: 1.36,
        AUD: 1.53,
        JPY: 150.0,
        MXN: 17.5,
        ARS: 900.0,
        CLP: 950.0,
        COP: 4000.0,
        PEN: 3.75,
        CHF: 0.88,
        SEK: 10.5,
        NOK: 10.8,
        DKK: 6.9,
        PLN: 4.0,
        CNY: 7.25,
        KRW: 1350.0,
        INR: 83.5,
        NZD: 1.65,
        SGD: 1.34,
        HKD: 7.82,
        TWD: 32.0,
        THB: 36.0,
        MYR: 4.7,
        IDR: 15800.0,
        PHP: 56.5,
        VND: 24500.0,
        AED: 3.67,
        SAR: 3.75,
        ILS: 3.7,
        ZAR: 18.5,
        NGN: 1200.0,
        EGP: 48.0,
        KES: 155.0,
      };

      const rate = fallbackRates[localCurrency] || 1;
      
      // Cache the rate
      rateCache[localCurrency] = {
        rate,
        timestamp: Date.now(),
      };

      setExchangeRate(rate);
      console.log(`[useLocalCurrencyDisplay] Rate for ${localCurrency}:`, rate);
    } catch (err) {
      console.error("[useLocalCurrencyDisplay] Error fetching rate:", err);
      setError("Erro ao buscar taxa de câmbio");
      // Use fallback rate of 1 to avoid breaking the display
      setExchangeRate(1);
    } finally {
      setLoading(false);
    }
  }, [localCurrency]);

  useEffect(() => {
    if (localCurrency) {
      fetchExchangeRate();
    }
  }, [localCurrency, fetchExchangeRate]);

  // Convert USD cents to local currency major units
  const convertToLocal = useCallback((usdCents: number): number | null => {
    if (exchangeRate === null || localCurrency === "USD") {
      return null; // No conversion needed or rate not available
    }

    // Convert cents to dollars, then to local currency
    const usdAmount = usdCents / 100;
    const localAmount = usdAmount * exchangeRate;
    
    return localAmount;
  }, [exchangeRate, localCurrency]);

  return {
    localCurrency,
    exchangeRate,
    loading,
    error,
    convertToLocal,
    refreshRate: fetchExchangeRate,
  };
}
