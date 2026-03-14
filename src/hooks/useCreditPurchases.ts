import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * MONETARY UNITS DOCUMENTATION:
 * 
 * credit_purchases table:
 *   - amount_paid_minor: INTEGER (cents/minor units) - actual money paid
 *   - credits_granted: INTEGER (1 credit = $1 USD) - base credits given
 *   - bonus_credits: INTEGER (1 credit = $1 USD) - bonus credits given
 * 
 * unified_payments table:
 *   - amount_cents: INTEGER (cents/minor units) - base amount in cents
 *   - payment_amount_minor: INTEGER (cents/minor units) - actual payment in local currency
 *   - credits_amount: INTEGER (1 credit = $1 USD) - credits associated with payment
 * 
 * platform_credits table:
 *   - balance: INTEGER (1 credit = $1 USD) - user's current credit balance
 * 
 * DISPLAY RULES:
 *   - Money values (cents): use formatMoneyFromCents(value, currency)
 *   - Credit values (integer): display directly as number, or formatMoney(value, 'USD') if showing as money
 */

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

// Unified payment record shape for fallback
interface UnifiedPaymentRecord {
  id: string;
  user_id: string;
  user_type: string;
  status: string;
  payment_type: string;
  amount_cents: number;
  payment_amount_minor: number | null;
  payment_currency: string | null;
  currency: string;
  payment_method: string | null;
  credits_amount: number | null;
  paid_at: string | null;
  created_at: string;
}

export interface CreditPurchaseSummary {
  total_revenue_by_currency: Record<string, number>;
  total_credits_granted: number;
  total_bonus_credits: number;
  average_ticket_by_currency: Record<string, number>;
  purchase_count: number;
  // Flag to indicate if data is from fallback (unified_payments)
  is_fallback: boolean;
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
  is_fallback: boolean;
}

type DateFilterOption = "7days" | "30days" | "all";

// Payment types that represent credit purchases
const CREDIT_PAYMENT_TYPES = [
  "freelancer_credits",
  "company_credits", 
  "platform_credits",
  "company_wallet"
];

export function useCreditPurchases(dateFilter: DateFilterOption = "all") {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CreditPurchaseSummary>({
    total_revenue_by_currency: {},
    total_credits_granted: 0,
    total_bonus_credits: 0,
    average_ticket_by_currency: {},
    purchase_count: 0,
    is_fallback: false,
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
      const dateStart = getDateStart(dateFilter);

      // PHASE 1: Try credit_purchases first (primary source)
      let creditQuery = (supabase as any)
        .from("credit_purchases")
        .select("*")
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      if (dateStart) {
        creditQuery = creditQuery.gte("confirmed_at", dateStart.toISOString());
      }

      const { data: creditData, error: creditError } = await creditQuery;

      if (creditError) {
        console.error("[useCreditPurchases] credit_purchases error:", creditError);
      }

      const confirmedPurchases = (creditData || []) as unknown as CreditPurchase[];

      // PHASE 2: If credit_purchases is empty, fallback to unified_payments
      if (confirmedPurchases.length === 0) {
        console.log("[useCreditPurchases] credit_purchases empty, using unified_payments fallback");

        let unifiedQuery = (supabase as any)
          .from("unified_payments")
          .select("*")
          .eq("status", "paid")
          .in("payment_type", CREDIT_PAYMENT_TYPES)
          .order("created_at", { ascending: false });

        if (dateStart) {
          unifiedQuery = unifiedQuery.gte("paid_at", dateStart.toISOString());
        }

        const { data: unifiedData, error: unifiedError } = await unifiedQuery;

        if (unifiedError) {
          console.error("[useCreditPurchases] unified_payments fallback error:", unifiedError);
          setLoading(false);
          return;
        }

        const unifiedPayments = (unifiedData || []) as unknown as UnifiedPaymentRecord[];

        // Calculate summary from unified_payments
        // Revenue = payment_amount_minor (if exists) or amount_cents
        // Currency = payment_currency (if exists) or currency
        const revenueByCurrency: Record<string, number> = {};
        const countByCurrency: Record<string, number> = {};
        let totalCredits = 0;

        unifiedPayments.forEach((p) => {
          // Use payment_amount_minor if available, otherwise amount_cents
          // Both are in minor units (cents)
          const amount = p.payment_amount_minor ?? p.amount_cents;
          const currency = p.payment_currency || p.currency || "USD";
          
          revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + amount;
          countByCurrency[currency] = (countByCurrency[currency] || 0) + 1;
          
          // credits_amount is INTEGER (1 credit = $1 USD)
          totalCredits += p.credits_amount || 0;
        });

        const avgByCurrency: Record<string, number> = {};
        Object.keys(revenueByCurrency).forEach((currency) => {
          avgByCurrency[currency] = Math.round(revenueByCurrency[currency] / countByCurrency[currency]);
        });

        // Map unified_payments to CreditPurchase format for compatibility
        const mappedPurchases: CreditPurchase[] = unifiedPayments.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          user_type: p.user_type,
          status: "confirmed",
          amount_paid_minor: p.payment_amount_minor ?? p.amount_cents,
          currency_paid: p.payment_currency || p.currency || "USD",
          payment_method: p.payment_method,
          credits_granted: p.credits_amount || 0,
          bonus_credits: 0, // Not tracked in unified_payments
          promotion_code: null,
          unified_payment_id: p.id,
          created_at: p.created_at,
          confirmed_at: p.paid_at,
        }));

        setPurchases(mappedPurchases);
        setSummary({
          total_revenue_by_currency: revenueByCurrency,
          total_credits_granted: totalCredits,
          total_bonus_credits: 0, // Not available in fallback
          average_ticket_by_currency: avgByCurrency,
          purchase_count: unifiedPayments.length,
          is_fallback: true,
        });

        setLoading(false);
        return;
      }

      // Use credit_purchases data (primary source)
      setPurchases(confirmedPurchases);

      // Calculate summary from credit_purchases
      const revenueByCurrency: Record<string, number> = {};
      const countByCurrency: Record<string, number> = {};
      let totalCredits = 0;
      let totalBonus = 0;

      confirmedPurchases.forEach((p) => {
        const currency = p.currency_paid || "USD";
        // amount_paid_minor is in cents (minor units)
        revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + p.amount_paid_minor;
        countByCurrency[currency] = (countByCurrency[currency] || 0) + 1;
        // credits_granted and bonus_credits are INTEGER (1 credit = $1 USD)
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
        is_fallback: false,
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

/**
 * Fetch credit stats for a specific user
 * Uses credit_purchases as primary source, unified_payments as fallback
 */
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

  // Fetch current balance (INTEGER credits: 1 credit = $1 USD)
  // platform_credits is the SINGLE source of truth for platform credits
  const { data: platformCredits } = await supabase
    .from("platform_credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  const currentBalance = platformCredits?.balance || 0;

  // Try credit_purchases first
  const { data: creditPurchases } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(20);

  const confirmedPurchases = (creditPurchases || []) as CreditPurchase[];

  // If credit_purchases has data, use it
  if (confirmedPurchases.length > 0) {
    const totalPaidByCurrency: Record<string, number> = {};
    let totalCreditsGranted = 0;

    confirmedPurchases.forEach((p) => {
      const currency = p.currency_paid || "USD";
      // amount_paid_minor is in cents
      totalPaidByCurrency[currency] = (totalPaidByCurrency[currency] || 0) + p.amount_paid_minor;
      // credits_granted is INTEGER
      totalCreditsGranted += p.credits_granted;
    });

    const totalPaidUsd = totalPaidByCurrency["USD"] || 0;

    return {
      user_id: userId,
      email: profile.email,
      user_type: profile.user_type || "unknown",
      name,
      total_paid_usd: totalPaidUsd,
      total_paid_by_currency: totalPaidByCurrency,
      total_credits_granted: totalCreditsGranted,
      current_balance: currentBalance,
      last_purchase_at: confirmedPurchases[0]?.confirmed_at || null,
      purchases: confirmedPurchases,
      is_fallback: false,
    };
  }

  // Fallback: use unified_payments
  const { data: unifiedPayments } = await supabase
    .from("unified_payments")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "paid")
    .in("payment_type", CREDIT_PAYMENT_TYPES)
    .order("created_at", { ascending: false })
    .limit(20);

  const payments = (unifiedPayments || []) as UnifiedPaymentRecord[];

  const totalPaidByCurrency: Record<string, number> = {};
  let totalCreditsGranted = 0;

  payments.forEach((p) => {
    const amount = p.payment_amount_minor ?? p.amount_cents;
    const currency = p.payment_currency || p.currency || "USD";
    totalPaidByCurrency[currency] = (totalPaidByCurrency[currency] || 0) + amount;
    totalCreditsGranted += p.credits_amount || 0;
  });

  const totalPaidUsd = totalPaidByCurrency["USD"] || 0;

  // Map to CreditPurchase format
  const mappedPurchases: CreditPurchase[] = payments.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    user_type: p.user_type,
    status: "confirmed",
    amount_paid_minor: p.payment_amount_minor ?? p.amount_cents,
    currency_paid: p.payment_currency || p.currency || "USD",
    payment_method: p.payment_method,
    credits_granted: p.credits_amount || 0,
    bonus_credits: 0,
    promotion_code: null,
    unified_payment_id: p.id,
    created_at: p.created_at,
    confirmed_at: p.paid_at,
  }));

  return {
    user_id: userId,
    email: profile.email,
    user_type: profile.user_type || "unknown",
    name,
    total_paid_usd: totalPaidUsd,
    total_paid_by_currency: totalPaidByCurrency,
    total_credits_granted: totalCreditsGranted,
    current_balance: currentBalance,
    last_purchase_at: payments[0]?.paid_at || null,
    purchases: mappedPurchases,
    is_fallback: true,
  };
}
