import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FreelancerPlan {
  plan_type: string;
  status: string;
  proposals_used: number;
  proposals_limit: number | null;
  subscription_end: string | null;
  cancel_at_period_end: boolean;
  unlimited_proposals: boolean;
  reset_at: string | null;
}

interface ProposalUsageResult {
  proposals_used: number;
  proposals_limit: number | null;
  unlimited: boolean;
  reset_at: string | null;
}

export function useFreelancerPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<FreelancerPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRecentProposalsCount = useCallback(async (freelancerUserId: string) => {
    // Source of truth for UI + blocking: count proposals rows in last 30 days.
    // This avoids relying on cached counters/RPCs that might be out of sync.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("freelancer_user_id", freelancerUserId)
      .gte("created_at", since);

    if (countError) throw countError;
    return count ?? 0;
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setPlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch freelancer profile to check tier (pro/top_rated have unlimited)
      const { data: profileData } = await (supabase as any)
        .from("freelancer_profiles")
        .select("tier")
        .eq("user_id", user.id)
        .maybeSingle();

      const tier = profileData?.tier;
      const isUnlimitedTier = tier === "pro" || tier === "top_rated";

      // Fetch freelancer plan from database
      const { data: planData, error: planError } = await (supabase as any)
        .from("freelancer_plans")
        .select("*")
        .eq("freelancer_user_id", user.id)
        .maybeSingle();

      if (planError && planError.code !== "PGRST116") {
        throw planError;
      }

      // Try to get proposal usage from RPC first (handles tier check and reset logic)
      let usage: ProposalUsageResult | null = null;
      try {
        const { data: usageData, error: usageError } = await supabase.rpc(
          "get_freelancer_proposal_usage" as any,
          { p_freelancer_user_id: user.id }
        );
        if (!usageError && usageData) {
          usage = usageData as unknown as ProposalUsageResult;
        }
      } catch (rpcErr) {
        // RPC might not exist yet, fall back to direct query
        console.log("[useFreelancerPlan] RPC not available, using fallback");
      }

      // Always try to compute proposals_used from actual proposals table (last 30 days)
      // so the UI in Settings/Billing and the blocking in ProjectView are correct.
      let proposalsUsedFromDb: number | null = null;
      if (!isUnlimitedTier) {
        try {
          proposalsUsedFromDb = await getRecentProposalsCount(user.id);
        } catch (countErr) {
          // Non-fatal: keep using RPC/cached values
          console.log(
            "[useFreelancerPlan] Could not count proposals from table, using RPC/cached values"
          );
        }
      }

      // Fallback: get limit from plan definition
      let proposalsLimit: number | null = null;
      if (!usage && !isUnlimitedTier) {
        const planType = planData?.plan_type || "free";
        const { data: defData } = await (supabase as any)
          .from("freelancer_plan_definitions")
          .select("proposals_limit")
          .eq("plan_type", planType)
          .eq("is_active", true)
          .maybeSingle();
        proposalsLimit = defData?.proposals_limit ?? 5;
      }

      // If no plan exists, return default free plan
      if (!planData) {
        const proposalsUsed = Math.max(
          usage?.proposals_used ?? 0,
          proposalsUsedFromDb ?? 0
        );
        setPlan({
          plan_type: "free",
          status: "active",
          proposals_used: proposalsUsed,
          proposals_limit: usage?.proposals_limit ?? proposalsLimit ?? 5,
          subscription_end: null,
          cancel_at_period_end: false,
          unlimited_proposals: usage?.unlimited ?? isUnlimitedTier,
          reset_at: usage?.reset_at ?? null,
        });
        setError(null);
        setLoading(false);
        return;
      }

      const proposalsUsed = Math.max(
        proposalsUsedFromDb ?? 0,
        usage?.proposals_used ?? planData.proposals_this_month ?? 0
      );

      setPlan({
        plan_type: planData.plan_type,
        status: planData.status,
        proposals_used: proposalsUsed,
        proposals_limit: usage?.proposals_limit ?? proposalsLimit,
        subscription_end: planData.current_period_end,
        cancel_at_period_end: planData.cancel_at_period_end || false,
        unlimited_proposals: usage?.unlimited ?? isUnlimitedTier,
        reset_at: usage?.reset_at ?? (planData.proposals_reset_at ? new Date(new Date(planData.proposals_reset_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null),
      });
      setError(null);
    } catch (err) {
      console.error("Error checking freelancer subscription:", err);
      setError(err instanceof Error ? err.message : "Failed to check subscription");
      // Default to free plan on error
      setPlan({
        plan_type: "free",
        status: "active",
        proposals_used: 0,
        proposals_limit: 5,
        subscription_end: null,
        cancel_at_period_end: false,
        unlimited_proposals: false,
        reset_at: null,
      });
    } finally {
      setLoading(false);
    }
  }, [user, getRecentProposalsCount]);

  const openCustomerPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("freelancer-customer-portal");
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every minute
  useEffect(() => {
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const canSendProposal = plan?.unlimited_proposals || 
    (plan?.proposals_limit !== null && (plan?.proposals_used ?? 0) < (plan?.proposals_limit ?? 0));

  return {
    plan,
    loading,
    error,
    isSubscribed: plan?.plan_type !== "free" && plan?.status === "active",
    canSendProposal,
    checkSubscription,
    openCustomerPortal,
  };
}
