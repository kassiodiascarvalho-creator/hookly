import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CompanyPlanType = "free" | "starter" | "pro" | "elite";

export interface CompanyBadgeInfo {
  plan_type: CompanyPlanType;
  is_verified: boolean;
}

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
 * Fetch company badges (plan + verified) for multiple companies using SECURITY DEFINER RPC
 * This bypasses RLS safely and allows freelancers to see company plan types and verification
 */
export async function fetchCompanyBadges(
  companyUserIds: string[]
): Promise<Map<string, CompanyBadgeInfo>> {
  if (!companyUserIds.length) return new Map();

  const badgeMap = new Map<string, CompanyBadgeInfo>();

  try {
    // Try the new RPC first (includes is_verified)
    const { data, error } = await (supabase.rpc as Function)("get_company_badges", {
      p_company_ids: companyUserIds,
    });

    if (!error && data && Array.isArray(data)) {
      for (const row of data as { company_user_id: string; plan_type: string; is_verified: boolean }[]) {
        badgeMap.set(row.company_user_id, {
          plan_type: row.plan_type as CompanyPlanType,
          is_verified: row.is_verified,
        });
      }
      // Default to free/unverified for companies not in result
      for (const id of companyUserIds) {
        if (!badgeMap.has(id)) {
          badgeMap.set(id, { plan_type: "free", is_verified: false });
        }
      }
      return badgeMap;
    }

    // Fallback: try the older RPC
    const { data: oldData, error: oldError } = await (supabase.rpc as Function)("get_company_plan_badges", {
      p_company_ids: companyUserIds,
    });

    if (!oldError && oldData && Array.isArray(oldData)) {
      for (const row of oldData as { company_user_id: string; plan_type: string }[]) {
        badgeMap.set(row.company_user_id, {
          plan_type: row.plan_type as CompanyPlanType,
          is_verified: false, // Old RPC doesn't include this
        });
      }
      for (const id of companyUserIds) {
        if (!badgeMap.has(id)) {
          badgeMap.set(id, { plan_type: "free", is_verified: false });
        }
      }
      return badgeMap;
    }

    // Final fallback: try direct query (works if user is company owner or admin)
    const { data: plans } = await supabase
      .from("company_plans")
      .select("company_user_id, plan_type, status, plan_source")
      .in("company_user_id", companyUserIds);

    if (plans) {
      for (const p of plans) {
        const effective = getEffectiveCompanyPlan(p.plan_type, p.status, p.plan_source);
        badgeMap.set(p.company_user_id, { plan_type: effective, is_verified: false });
      }
    }

    // Default missing to free/unverified
    for (const id of companyUserIds) {
      if (!badgeMap.has(id)) {
        badgeMap.set(id, { plan_type: "free", is_verified: false });
      }
    }

    return badgeMap;
  } catch (err) {
    console.error("Error in fetchCompanyBadges:", err);
    // Return free/unverified for all on error
    for (const id of companyUserIds) {
      badgeMap.set(id, { plan_type: "free", is_verified: false });
    }
    return badgeMap;
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function fetchCompanyPlanBadges(
  companyUserIds: string[]
): Promise<Map<string, CompanyPlanType>> {
  const badges = await fetchCompanyBadges(companyUserIds);
  const planMap = new Map<string, CompanyPlanType>();
  badges.forEach((info, id) => planMap.set(id, info.plan_type));
  return planMap;
}

/**
 * Hook to fetch company plan info for any company user
 * This is a lightweight hook for displaying badges/rings, not for managing subscriptions
 */
export function useCompanyPlanData(companyUserId: string | undefined) {
  const [planInfo, setPlanInfo] = useState<CompanyPlanInfo | null>(null);
  const [badgeInfo, setBadgeInfo] = useState<CompanyBadgeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!companyUserId) {
      setPlanInfo(null);
      setBadgeInfo(null);
      setLoading(false);
      return;
    }

    try {
      const badges = await fetchCompanyBadges([companyUserId]);
      const badge = badges.get(companyUserId) || { plan_type: "free" as CompanyPlanType, is_verified: false };

      setBadgeInfo(badge);
      setPlanInfo({
        plan_type: badge.plan_type,
        status: null,
        plan_source: null,
        isSubscribed: badge.plan_type !== "free",
      });
    } catch (err) {
      console.error("Error in useCompanyPlanData:", err);
      const defaultBadge = { plan_type: "free" as CompanyPlanType, is_verified: false };
      setBadgeInfo(defaultBadge);
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

  return { planInfo, badgeInfo, loading, refetch: fetchPlan };
}
