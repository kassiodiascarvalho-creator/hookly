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
}

export function useFreelancerPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<FreelancerPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setPlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch freelancer plan from database
      const { data: planData, error: planError } = await supabase
        .from("freelancer_plans")
        .select("*")
        .eq("freelancer_user_id", user.id)
        .maybeSingle();

      if (planError && planError.code !== "PGRST116") {
        throw planError;
      }

      // If no plan exists, return default free plan
      if (!planData) {
        setPlan({
          plan_type: "free",
          status: "active",
          proposals_used: 0,
          proposals_limit: 5,
          subscription_end: null,
          cancel_at_period_end: false,
        });
        setError(null);
        setLoading(false);
        return;
      }

      // Fetch plan definition to get proposals limit
      const { data: planDef } = await supabase
        .from("freelancer_plan_definitions")
        .select("proposals_limit")
        .eq("plan_type", planData.plan_type)
        .eq("is_active", true)
        .single();

      setPlan({
        plan_type: planData.plan_type,
        status: planData.status,
        proposals_used: planData.proposals_this_month || 0,
        proposals_limit: planDef?.proposals_limit ?? null,
        subscription_end: planData.current_period_end,
        cancel_at_period_end: planData.cancel_at_period_end || false,
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
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  return {
    plan,
    loading,
    error,
    isSubscribed: plan?.plan_type !== "free" && plan?.status === "active",
    checkSubscription,
    openCustomerPortal,
  };
}
