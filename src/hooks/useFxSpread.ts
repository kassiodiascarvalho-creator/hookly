import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FxSpreadData {
  spreadPercent: number;
  loading: boolean;
}

/**
 * Hook to fetch the default FX spread percentage from platform_settings
 * Returns the spread as a decimal (e.g., 0.01 = 1%)
 */
export function useFxSpread(): FxSpreadData {
  const [spreadPercent, setSpreadPercent] = useState<number>(0.01); // Default 1%
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpread = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "fx_spread_percent")
          .single();

        if (error) {
          console.error("[useFxSpread] Error fetching spread:", error);
          return;
        }

        // Extract the value from the JSON structure
        const spreadValue = (data?.value as { value?: number })?.value;
        
        if (typeof spreadValue === "number" && spreadValue >= 0) {
          setSpreadPercent(spreadValue);
          console.log("[useFxSpread] Spread loaded:", spreadValue);
        }
      } catch (err) {
        console.error("[useFxSpread] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSpread();
  }, []);

  return { spreadPercent, loading };
}

/**
 * Calculate FX fee and converted amount
 * Fee is deducted from the original amount (not added)
 */
export function calculateFxFee(
  amount: number,
  spreadPercent: number,
  currency: string
): {
  feeAmount: number;
  amountAfterFee: number;
  shouldApplyFee: boolean;
} {
  // No fee for USD
  const shouldApplyFee = currency !== "USD" && spreadPercent > 0;
  
  if (!shouldApplyFee) {
    return {
      feeAmount: 0,
      amountAfterFee: amount,
      shouldApplyFee: false,
    };
  }

  const feeAmount = amount * spreadPercent;
  const amountAfterFee = amount - feeAmount;

  return {
    feeAmount,
    amountAfterFee,
    shouldApplyFee: true,
  };
}
