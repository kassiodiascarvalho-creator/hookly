import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CompanyPlanType = "free" | "starter" | "pro" | "elite";

export interface CompanyPlanInfo {
  plan_type: CompanyPlanType;
  status: string | null;
  plan_source: "manual" | "stripe" | null;
  isSubscribed: boolean;
}

/**
 * Centralized function to derive effective plan type from raw DB data
 * Used for consistency across the entire app
 */
export function getEffectiveCompanyPlan(
  planType: string | null,
  status: string | null,
  planSource: string | null
): CompanyPlanType {
  if (!planType || !planSource) return "free";

  if (planSource === "manual") {
    // Manual plans always use plan_type as-is
    return planType as CompanyPlanType;
  }

  if (planSource === "stripe") {
    // Stripe requires active/trialing status
    if (status === "active" || status === "trialing") {
      return planType as CompanyPlanType;
    }
  }

  return "free";
}

/**
 * Hook to fetch company plan info for any company user
 * This is a lightweight hook for displaying badges/rings, not for managing subscriptions
 */
export function useCompanyPlanData(companyUserId: string | undefined) {
  const [planInfo, setPlanInfo] = useState<CompanyPlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!companyUserId) {
      setPlanInfo(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("company_plans")
        .select("plan_type, status, plan_source")
        .eq("company_user_id", companyUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching company plan:", error);
        setPlanInfo(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setPlanInfo({
          plan_type: "free",
          status: null,
          plan_source: null,
          isSubscribed: false,
        });
        setLoading(false);
        return;
      }

      const planSource = data.plan_source as "manual" | "stripe" | null;
      const effectivePlan = getEffectiveCompanyPlan(data.plan_type, data.status, planSource);

      setPlanInfo({
        plan_type: effectivePlan,
        status: data.status,
        plan_source: planSource,
        isSubscribed: effectivePlan !== "free",
      });
    } catch (err) {
      console.error("Error in useCompanyPlanData:", err);
      setPlanInfo(null);
    } finally {
      setLoading(false);
    }
  }, [companyUserId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { planInfo, loading, refetch: fetchPlan };
}
