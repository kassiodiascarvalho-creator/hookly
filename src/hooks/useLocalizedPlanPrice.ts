import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCurrencyByCountry } from "@/lib/currencyByCountry";
import { formatMoney } from "@/lib/formatMoney";

interface ExchangeRates {
  [key: string]: number;
}

const CACHE_KEY = "fx_rates_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedRates {
  rates: ExchangeRates;
  timestamp: number;
}

function getCachedRates(): ExchangeRates | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedRates = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.rates;
  } catch {
    return null;
  }
}

function setCachedRates(rates: ExchangeRates) {
  try {
    const cache: CachedRates = { rates, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

export function useLocalizedPlanPrice() {
  const { user } = useAuth();
  const [rates, setRates] = useState<ExchangeRates>({});
  const [loading, setLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState("USD");

  // Get user's country code from their profile
  useEffect(() => {
    const fetchCountryCode = async () => {
      if (!user?.id) return;

      try {
        // Try company profile first
        const { data: companyData } = await supabase
          .from("company_profiles")
          .select("country")
          .eq("user_id", user.id)
          .single();
        
        if (companyData?.country) {
          const currency = getCurrencyByCountry(companyData.country);
          setUserCurrency(currency);
          return;
        }

        // Try freelancer profile
        const { data: freelancerData } = await supabase
          .from("freelancer_profiles")
          .select("country_code")
          .eq("user_id", user.id)
          .single();
        
        if (freelancerData?.country_code) {
          const currency = getCurrencyByCountry(freelancerData.country_code);
          setUserCurrency(currency);
        }
      } catch (err) {
        console.error("Error fetching user country:", err);
      }
    };

    fetchCountryCode();
  }, [user?.id]);

  // Fetch exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      // Check cache first
      const cached = getCachedRates();
      if (cached) {
        setRates(cached);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("https://open.er-api.com/v6/latest/USD");
        if (response.ok) {
          const data = await response.json();
          if (data.rates) {
            setRates(data.rates);
            setCachedRates(data.rates);
          }
        }
      } catch (err) {
        console.error("Error fetching exchange rates:", err);
        // Use fallback rates
        setRates({
          USD: 1,
          BRL: 5.8,
          EUR: 0.93,
          GBP: 0.79,
          CAD: 1.35,
          AUD: 1.54,
          MXN: 17.8,
          JPY: 149,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  // Convert USD cents to local currency and format
  const formatLocalPrice = useCallback(
    (usdCents: number): string => {
      const usdAmount = usdCents / 100;
      
      // If user currency is USD or no rate available, return USD
      if (userCurrency === "USD" || !rates[userCurrency]) {
        return formatMoney(usdAmount, "USD");
      }

      // Convert to local currency
      const localAmount = usdAmount * rates[userCurrency];
      return formatMoney(localAmount, userCurrency);
    },
    [userCurrency, rates]
  );

  // Get both USD and local price for display
  const getPriceDisplay = useCallback(
    (usdCents: number): { local: string; usd: string; currency: string } => {
      const usdAmount = usdCents / 100;
      const usdFormatted = formatMoney(usdAmount, "USD");

      if (userCurrency === "USD" || !rates[userCurrency]) {
        return { local: usdFormatted, usd: usdFormatted, currency: "USD" };
      }

      const localAmount = usdAmount * rates[userCurrency];
      return {
        local: formatMoney(localAmount, userCurrency),
        usd: usdFormatted,
        currency: userCurrency,
      };
    },
    [userCurrency, rates]
  );

  return {
    formatLocalPrice,
    getPriceDisplay,
    userCurrency,
    loading,
    rates,
  };
}
