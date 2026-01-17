import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreditPurchase {
  id: string;
  user_id: string;
  user_type: string;
  status: string;
  amount_paid_minor: number;
  currency_paid: string;
  payment_method: string | null;
  credits_granted: number;
  bonus_credits: number;
  promotion_code: string | null;
  unified_payment_id: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface CreditPurchaseSummary {
  total_revenue_by_currency: Record<string, number>;
  total_credits_granted: number;
  total_bonus_credits: number;
  average_ticket_by_currency: Record<string, number>;
  purchase_count: number;
}

export interface UserCreditStats {
  user_id: string;
  email: string;
  user_type: string;
  name: string;
  total_paid_usd: number;
  total_paid_by_currency: Record<string, number>;
  total_credits_granted: number;
  current_balance: number;
  last_purchase_at: string | null;
  purchases: CreditPurchase[];
}

type DateFilterOption = "7days" | "30days" | "all";

export function useCreditPurchases(dateFilter: DateFilterOption = "all") {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CreditPurchaseSummary>({
    total_revenue_by_currency: {},
    total_credits_granted: 0,
    total_bonus_credits: 0,
    average_ticket_by_currency: {},
    purchase_count: 0,
  });
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);

  const getDateStart = (filter: DateFilterOption): Date | null => {
    const now = new Date();
    switch (filter) {
      case "7days":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30days":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("credit_purchases")
        .select("*")
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      const dateStart = getDateStart(dateFilter);
      if (dateStart) {
        query = query.gte("confirmed_at", dateStart.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error("[useCreditPurchases] Error:", error);
        return;
      }

      const confirmedPurchases = (data || []) as CreditPurchase[];
      setPurchases(confirmedPurchases);

      // Calculate summary
      const revenueByCurrency: Record<string, number> = {};
      const countByCurrency: Record<string, number> = {};
      let totalCredits = 0;
      let totalBonus = 0;

      confirmedPurchases.forEach((p) => {
        const currency = p.currency_paid || "USD";
        revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + p.amount_paid_minor;
        countByCurrency[currency] = (countByCurrency[currency] || 0) + 1;
        totalCredits += p.credits_granted;
        totalBonus += p.bonus_credits;
      });

      const avgByCurrency: Record<string, number> = {};
      Object.keys(revenueByCurrency).forEach((currency) => {
        avgByCurrency[currency] = Math.round(revenueByCurrency[currency] / countByCurrency[currency]);
      });

      setSummary({
        total_revenue_by_currency: revenueByCurrency,
        total_credits_granted: totalCredits,
        total_bonus_credits: totalBonus,
        average_ticket_by_currency: avgByCurrency,
        purchase_count: confirmedPurchases.length,
      });
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  return {
    loading,
    summary,
    purchases,
    refetch: fetchPurchases,
  };
}

export async function fetchUserCreditStats(userId: string): Promise<UserCreditStats | null> {
  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, user_type")
    .eq("user_id", userId)
    .single();

  if (!profile) return null;

  // Fetch name based on user type
  let name = "";
  if (profile.user_type === "freelancer") {
    const { data } = await supabase
      .from("freelancer_profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();
    name = data?.full_name || "";
  } else {
    const { data } = await supabase
      .from("company_profiles")
      .select("company_name, contact_name")
      .eq("user_id", userId)
      .single();
    name = data?.company_name || data?.contact_name || "";
  }

  // Fetch purchases
  const { data: purchases } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch current balance
  const { data: creditBalance } = await supabase
    .from("platform_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  // Calculate totals
  const confirmedPurchases = (purchases || []) as CreditPurchase[];
  const totalPaidByCurrency: Record<string, number> = {};
  let totalCreditsGranted = 0;

  confirmedPurchases.forEach((p) => {
    const currency = p.currency_paid || "USD";
    totalPaidByCurrency[currency] = (totalPaidByCurrency[currency] || 0) + p.amount_paid_minor;
    totalCreditsGranted += p.credits_granted;
  });

  // For USD equivalent, just use USD if available
  const totalPaidUsd = totalPaidByCurrency["USD"] || 0;

  return {
    user_id: userId,
    email: profile.email,
    user_type: profile.user_type || "unknown",
    name,
    total_paid_usd: totalPaidUsd,
    total_paid_by_currency: totalPaidByCurrency,
    total_credits_granted: totalCreditsGranted,
    current_balance: creditBalance?.balance || 0,
    last_purchase_at: confirmedPurchases[0]?.confirmed_at || null,
    purchases: confirmedPurchases,
  };
}
