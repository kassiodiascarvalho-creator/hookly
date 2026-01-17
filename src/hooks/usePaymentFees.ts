import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentFeeConfig {
  id: string;
  fee_key: string;
  fee_percent: number;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  updated_at: string;
}

interface PaymentFeesData {
  fees: Record<string, PaymentFeeConfig>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getFeePercent: (feeKey: string) => number;
  getDisplayPercent: (feeKey: string) => string;
}

// Fee keys - match the DB keys
export const FEE_KEYS = {
  INTERNATIONAL_CARD: "international_card",
  BRL_PIX: "brl_pix",
  BRL_CARD: "brl_card",
} as const;

// Default fee values (used as fallback if DB fetch fails)
const DEFAULT_FEES: Record<string, number> = {
  [FEE_KEYS.INTERNATIONAL_CARD]: 0.15, // 15%
  [FEE_KEYS.BRL_PIX]: 0.02, // 2%
  [FEE_KEYS.BRL_CARD]: 0.06, // 6%
};

/**
 * Central hook to fetch payment fee configurations from the database.
 * Provides dynamic fee values that sync with Admin settings.
 */
export function usePaymentFees(): PaymentFeesData {
  const [fees, setFees] = useState<Record<string, PaymentFeeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("payment_fee_configs")
        .select("*")
        .eq("is_enabled", true);

      if (fetchError) {
        console.error("[usePaymentFees] Error fetching fees:", fetchError);
        setError(fetchError.message);
        return;
      }

      // Convert array to object keyed by fee_key
      const feesMap: Record<string, PaymentFeeConfig> = {};
      (data || []).forEach((config) => {
        feesMap[config.fee_key] = {
          ...config,
          fee_percent: Number(config.fee_percent),
        };
      });

      setFees(feesMap);
      console.log("[usePaymentFees] Fees loaded:", feesMap);
    } catch (err) {
      console.error("[usePaymentFees] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  /**
   * Get fee percent as decimal (e.g., 0.15 for 15%)
   * Falls back to default values if not found in DB
   */
  const getFeePercent = useCallback(
    (feeKey: string): number => {
      const config = fees[feeKey];
      if (config && config.is_enabled) {
        return config.fee_percent;
      }
      return DEFAULT_FEES[feeKey] ?? 0;
    },
    [fees]
  );

  /**
   * Get fee percent as display string (e.g., "15%")
   */
  const getDisplayPercent = useCallback(
    (feeKey: string): string => {
      const percent = getFeePercent(feeKey) * 100;
      // Show up to 2 decimal places, but remove trailing zeros
      return `${parseFloat(percent.toFixed(2))}%`;
    },
    [getFeePercent]
  );

  return {
    fees,
    loading,
    error,
    refetch: fetchFees,
    getFeePercent,
    getDisplayPercent,
  };
}

/**
 * Helper function to calculate fee and total amounts
 */
export function calculatePaymentFee(
  amount: number,
  feePercent: number
): {
  feeAmount: number;
  totalAmount: number;
  totalAmountCents: number;
} {
  const feeAmount = amount * feePercent;
  const totalAmount = amount + feeAmount;
  const totalAmountCents = Math.round(totalAmount * 100);

  return {
    feeAmount,
    totalAmount,
    totalAmountCents,
  };
}

/**
 * Get the appropriate fee key based on currency and payment method
 */
export function getPaymentFeeKey(
  currency: string,
  paymentMethod: "pix" | "card"
): string {
  if (currency === "BRL") {
    return paymentMethod === "pix" ? FEE_KEYS.BRL_PIX : FEE_KEYS.BRL_CARD;
  }
  return FEE_KEYS.INTERNATIONAL_CARD;
}
