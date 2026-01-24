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

      // Determine effective plan
      const planSource = data.plan_source as "manual" | "stripe" | null;
      const status = data.status;
      const planType = data.plan_type as CompanyPlanType;

      let effectivePlan: CompanyPlanType = "free";
      let isSubscribed = false;

      if (planSource === "manual") {
        // Manual always uses plan_type
        effectivePlan = planType;
        isSubscribed = planType !== "free";
      } else if (planSource === "stripe") {
        // Stripe requires active/trialing
        if (status === "active" || status === "trialing") {
          effectivePlan = planType;
          isSubscribed = planType !== "free";
        }
      }

      setPlanInfo({
        plan_type: effectivePlan,
        status,
        plan_source: planSource,
        isSubscribed,
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
