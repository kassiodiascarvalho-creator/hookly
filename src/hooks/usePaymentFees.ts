import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PaymentFeeConfig {
  id: string;
  fee_key: string;
  fee_percent: number;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  updated_at: string;
}

export interface TierFeeOverride {
  tier: string;
  fee_key: string;
  fee_percent_override: number;
}

interface PaymentFeesData {
  fees: Record<string, PaymentFeeConfig>;
  tierOverrides: Record<string, number>; // fee_key -> override percent for current user's tier
  userTier: "standard" | "pro" | "top_rated";
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getFeePercent: (feeKey: string) => number;
  getDisplayPercent: (feeKey: string) => string;
  getBaseFeePercent: (feeKey: string) => number;
  hasTierDiscount: (feeKey: string) => boolean;
}

// Fee keys - match the DB keys
export const FEE_KEYS = {
  INTERNATIONAL_CARD: "international_card",
  BRL_PIX: "brl_pix",
  BRL_CARD: "brl_card",
  WITHDRAWAL: "withdrawal",
} as const;

// Default fee values (used as fallback if DB fetch fails)
const DEFAULT_FEES: Record<string, number> = {
  [FEE_KEYS.INTERNATIONAL_CARD]: 0.15, // 15%
  [FEE_KEYS.BRL_PIX]: 0.02, // 2%
  [FEE_KEYS.BRL_CARD]: 0.06, // 6%
  [FEE_KEYS.WITHDRAWAL]: 0.15, // 15%
};

/**
 * Central hook to fetch payment fee configurations from the database.
 * Now includes tier-based fee overrides for pro/top_rated users.
 */
export function usePaymentFees(): PaymentFeesData {
  const { user } = useAuth();
  const [fees, setFees] = useState<Record<string, PaymentFeeConfig>>({});
  const [tierOverrides, setTierOverrides] = useState<Record<string, number>>({});
  const [userTier, setUserTier] = useState<"standard" | "pro" | "top_rated">("standard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch base fees
      const { data: feesData, error: feesError } = await (supabase as any)
        .from("payment_fee_configs")
        .select("*")
        .eq("is_enabled", true);

      if (feesError) {
        console.error("[usePaymentFees] Error fetching fees:", feesError);
        setError(feesError.message);
        return;
      }

      // Convert array to object keyed by fee_key
      const feesMap: Record<string, PaymentFeeConfig> = {};
      (feesData || []).forEach((config) => {
        feesMap[config.fee_key] = {
          ...config,
          fee_percent: Number(config.fee_percent),
        };
      });
      setFees(feesMap);

      // Fetch user's tier if logged in
      if (user) {
        const { data: profileData } = await supabase
          .from("freelancer_profiles")
          .select("tier")
          .eq("user_id", user.id)
          .maybeSingle();

        const tier = (profileData?.tier as "standard" | "pro" | "top_rated") || "standard";
        setUserTier(tier);

        // Fetch tier overrides if user has a special tier
        if (tier !== "standard") {
          const { data: overridesData } = await supabase
            .from("tier_fee_overrides")
            .select("fee_key, fee_percent_override")
            .eq("tier", tier);

          const overridesMap: Record<string, number> = {};
          (overridesData || []).forEach((override) => {
            overridesMap[override.fee_key] = Number(override.fee_percent_override);
          });
          setTierOverrides(overridesMap);
        } else {
          setTierOverrides({});
        }
      }

      console.log("[usePaymentFees] Fees loaded:", feesMap);
    } catch (err) {
      console.error("[usePaymentFees] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  /**
   * Get BASE fee percent (without tier discount)
   */
  const getBaseFeePercent = useCallback(
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
   * Get EFFECTIVE fee percent (with tier discount applied if applicable)
   */
  const getFeePercent = useCallback(
    (feeKey: string): number => {
      // Check for tier override first
      if (tierOverrides[feeKey] !== undefined) {
        return tierOverrides[feeKey];
      }
      return getBaseFeePercent(feeKey);
    },
    [tierOverrides, getBaseFeePercent]
  );

  /**
   * Check if user has a tier discount for this fee
   */
  const hasTierDiscount = useCallback(
    (feeKey: string): boolean => {
      return tierOverrides[feeKey] !== undefined && 
             tierOverrides[feeKey] < getBaseFeePercent(feeKey);
    },
    [tierOverrides, getBaseFeePercent]
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
    tierOverrides,
    userTier,
    loading,
    error,
    refetch: fetchFees,
    getFeePercent,
    getDisplayPercent,
    getBaseFeePercent,
    hasTierDiscount,
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
