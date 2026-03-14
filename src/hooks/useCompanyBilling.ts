import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: string;
  due_date: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

export interface UpcomingInvoice {
  amount_due: number;
  currency: string;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
}

export interface CompanyBillingSummary {
  plan_type: string;
  plan_source: string | null;
  status: string | null;
  subscription: StripeSubscription | null;
  upcomingInvoice: UpcomingInvoice | null;
  invoices: StripeInvoice[];
  hasStripeCustomer: boolean;
}

export function useCompanyBilling() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<CompanyBillingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingSummary = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke(
        "billing-company-summary"
      );

      if (fnError) throw fnError;
      
      setSummary(data as CompanyBillingSummary);
    } catch (err) {
      console.error("Error fetching billing summary:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch billing info");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const openCustomerPortal = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "company-customer-portal"
      );

      if (fnError) throw fnError;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchBillingSummary();
  }, [fetchBillingSummary]);

  return {
    summary,
    loading,
    error,
    refetch: fetchBillingSummary,
    openCustomerPortal,
  };
}
