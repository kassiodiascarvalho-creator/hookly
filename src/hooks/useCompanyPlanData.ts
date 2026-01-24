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
 * Fetch company plan badges for multiple companies using SECURITY DEFINER RPC
 * This bypasses RLS safely and allows freelancers to see company plan types
 * Falls back to direct query if RPC not yet deployed
 */
export async function fetchCompanyPlanBadges(
  companyUserIds: string[]
): Promise<Map<string, CompanyPlanType>> {
  if (!companyUserIds.length) return new Map();

  const planMap = new Map<string, CompanyPlanType>();

  try {
    // Try the RPC first (bypasses RLS for freelancers)
    // Type assertion needed because RPC may not be in generated types yet
    const { data, error } = await (supabase.rpc as Function)("get_company_plan_badges", {
      p_company_ids: companyUserIds,
    });

    if (!error && data && Array.isArray(data)) {
      for (const row of data as { company_user_id: string; plan_type: string }[]) {
        planMap.set(row.company_user_id, row.plan_type as CompanyPlanType);
      }
      // Default to "free" for companies not in result
      for (const id of companyUserIds) {
        if (!planMap.has(id)) {
          planMap.set(id, "free");
        }
      }
      return planMap;
    }

    // Fallback: try direct query (works if user is company owner or admin)
    const { data: plans } = await supabase
      .from("company_plans")
      .select("company_user_id, plan_type, status, plan_source")
      .in("company_user_id", companyUserIds);

    if (plans) {
      for (const p of plans) {
        const effective = getEffectiveCompanyPlan(p.plan_type, p.status, p.plan_source);
        planMap.set(p.company_user_id, effective);
      }
    }

    // Default missing to "free"
    for (const id of companyUserIds) {
      if (!planMap.has(id)) {
        planMap.set(id, "free");
      }
    }

    return planMap;
  } catch (err) {
    console.error("Error in fetchCompanyPlanBadges:", err);
    // Return "free" for all on error
    for (const id of companyUserIds) {
      planMap.set(id, "free");
    }
    return planMap;
  }
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
      // First try RPC (works for any authenticated user)
      const planMap = await fetchCompanyPlanBadges([companyUserId]);
      const effectivePlan = planMap.get(companyUserId) || "free";

      setPlanInfo({
        plan_type: effectivePlan,
        status: null, // RPC doesn't return status
        plan_source: null, // RPC doesn't return source
        isSubscribed: effectivePlan !== "free",
      });
    } catch (err) {
      console.error("Error in useCompanyPlanData:", err);
      setPlanInfo({
        plan_type: "free",
        status: null,
        plan_source: null,
        isSubscribed: false,
      });
    } finally {
      setLoading(false);
    }
  }, [companyUserId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { planInfo, loading, refetch: fetchPlan };
}
