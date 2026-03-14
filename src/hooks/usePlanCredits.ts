import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanCreditsInfo {
  monthlyCredits: number;
  creditCap: number | null;
  currentBalance: number;
  planAvailable: number;
  purchasedAvailable: number;
  totalAvailable: number;
  lastGrantAt: string | null;
  nextGrantDate: Date | null;
  daysUntilGrant: number | null;
  planType: string;
  isSubscribed: boolean;
  tier: string; // canonical tier for freelancers
}

export function usePlanCredits(userType: 'freelancer' | 'company') {
  const { user } = useAuth();
  const [info, setInfo] = useState<PlanCreditsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanCredits = useCallback(async () => {
    if (!user) {
      setInfo(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get current balances from platform_credits (dual-balance system)
      const { data: credits } = await (supabase as any)
        .from("platform_credits")
        .select("plan_balance, purchased_balance, balance")
        .eq("user_id", user.id)
        .maybeSingle();

      const creditsData = credits as { plan_balance?: number; purchased_balance?: number; balance?: number } | null;
      const planBalance = creditsData?.plan_balance || 0;
      const purchasedBalance = creditsData?.purchased_balance || 0;
      const currentBalance = creditsData?.balance || (planBalance + purchasedBalance);

      // Get plan info based on user type
      let planType = 'free';
      let lastGrantAt: string | null = null;
      let isSubscribed = false;
      let tier = 'standard';

      if (userType === 'freelancer') {
        // CANONICAL SOURCE: freelancer_profiles.tier for plan status
        const { data: profile } = await supabase
          .from("freelancer_profiles")
          .select("tier")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const profileData = profile as { tier?: string } | null;
        tier = profileData?.tier || 'standard';
        
        // Map tier to planType for definitions lookup
        if (tier === 'pro') {
          planType = 'pro';
        } else if (tier === 'top_rated') {
          planType = 'elite';
        } else {
          planType = 'free';
        }
        
        // Also check freelancer_plans for grant date (optional, for subscription-based users)
        const { data: plan } = await supabase
          .from("freelancer_plans")
          .select("plan_type, status, last_credit_grant_at, stripe_subscription_id")
          .eq("freelancer_user_id", user.id)
          .maybeSingle();

        const planData = plan as { plan_type?: string; status?: string; last_credit_grant_at?: string; stripe_subscription_id?: string } | null;
        if (planData) {
          lastGrantAt = planData.last_credit_grant_at || null;
          // Consider subscribed if tier is premium OR has active Stripe subscription
          isSubscribed = (tier === 'pro' || tier === 'top_rated') || 
            (planData.status === 'active' && !!planData.stripe_subscription_id);
        } else {
          // No plan record, but still can be premium via tier
          isSubscribed = tier === 'pro' || tier === 'top_rated';
        }
      } else {
        const { data: plan } = await supabase
          .from("company_plans")
          .select("plan_type, status, last_credit_grant_at")
          .eq("company_user_id", user.id)
          .maybeSingle();

        const planData = plan as { plan_type?: string; status?: string; last_credit_grant_at?: string } | null;
        if (planData) {
          planType = planData.plan_type || 'free';
          lastGrantAt = planData.last_credit_grant_at || null;
          isSubscribed = planData.status === 'active' && planType !== 'free';
        }
      }

      // Get plan definition for monthly credits and cap
      // For freelancers, use tier-mapped planType
      let monthlyCredits = 0;
      let creditCap: number | null = null;

      if (userType === 'freelancer') {
        const { data: def } = await supabase
          .from("freelancer_plan_definitions")
          .select("monthly_credits, credit_cap")
          .eq("plan_type", planType)
          .eq("is_active", true)
          .maybeSingle();

        const defData = def as { monthly_credits?: number; credit_cap?: number | null } | null;
        if (defData) {
          monthlyCredits = defData.monthly_credits || 0;
          creditCap = defData.credit_cap ?? null;
        }
      } else {
        const { data: def } = await supabase
          .from("company_plan_definitions")
          .select("monthly_credits, credit_cap")
          .eq("plan_type", planType)
          .eq("is_active", true)
          .maybeSingle();

        const defData = def as { monthly_credits?: number; credit_cap?: number | null } | null;
        if (defData) {
          monthlyCredits = defData.monthly_credits || 0;
          creditCap = defData.credit_cap ?? null;
        }
      }

      // Calculate next grant date
      let nextGrantDate: Date | null = null;
      let daysUntilGrant: number | null = null;

      if (lastGrantAt && isSubscribed) {
        const lastGrant = new Date(lastGrantAt);
        nextGrantDate = new Date(lastGrant.getTime() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        daysUntilGrant = Math.max(0, Math.ceil((nextGrantDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      }

      // Use actual dual-balance values from database (no more guessing)
      const planAvailable = planBalance;
      const purchasedAvailable = purchasedBalance;
      const totalAvailable = planBalance + purchasedBalance;

      setInfo({
        monthlyCredits,
        creditCap,
        currentBalance,
        planAvailable,
        purchasedAvailable,
        totalAvailable,
        lastGrantAt,
        nextGrantDate,
        daysUntilGrant,
        planType,
        isSubscribed,
        tier,
      });
      setError(null);
    } catch (err) {
      console.error("Error fetching plan credits:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch plan credits");
    } finally {
      setLoading(false);
    }
  }, [user, userType]);

  // Check and trigger lazy grant
  const checkAndGrantCredits = useCallback(async (): Promise<{ granted: boolean; amount?: number }> => {
    if (!user) return { granted: false };

    try {
      // Use the new function via raw SQL call since types may not be updated
      const { data, error } = await supabase.rpc("check_and_grant_plan_credits" as any, {
        p_user_id: user.id,
        p_user_type: userType,
      });

      if (error) {
        console.error("Error checking plan credits:", error);
        return { granted: false };
      }

      const result = data as { granted?: boolean; amount?: number } | null;
      
      if (result?.granted) {
        await fetchPlanCredits(); // Refresh data
      }

      return { granted: result?.granted || false, amount: result?.amount };
    } catch (err) {
      console.error("Error in checkAndGrantCredits:", err);
      return { granted: false };
    }
  }, [user, userType, fetchPlanCredits]);

  useEffect(() => {
    fetchPlanCredits();
  }, [fetchPlanCredits]);

  // Auto-check for grants on mount (lazy renewal)
  useEffect(() => {
    if (user && info?.isSubscribed) {
      checkAndGrantCredits();
    }
  }, [user, info?.isSubscribed]);

  return {
    info,
    loading,
    error,
    refetch: fetchPlanCredits,
    checkAndGrantCredits,
  };
}
