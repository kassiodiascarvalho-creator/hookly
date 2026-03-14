import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FREE_DAILY_LIMIT = 10;

export interface TranslationUsageInfo {
  usedToday: number;
  remaining: number;
  limit: number;
  isPremium: boolean;
  tier: string;
}

export function useTranslationUsage() {
  const { user } = useAuth();
  const [info, setInfo] = useState<TranslationUsageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setInfo(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get user type
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user.id)
        .single();

      const userType = profile?.user_type as "company" | "freelancer" | null;

      // Determine premium status based on tier/plan
      let isPremium = false;
      let tier = "standard";

      if (userType === "freelancer") {
        const { data: freelancerProfile } = await (supabase as any)
          .from("freelancer_profiles")
          .select("tier")
          .eq("user_id", user.id)
          .maybeSingle();

        tier = freelancerProfile?.tier || "standard";
        isPremium = tier === "pro" || tier === "top_rated";
      } else if (userType === "company") {
        const { data: plan } = await supabase
          .from("company_plans")
          .select("plan_type, status")
          .eq("company_user_id", user.id)
          .maybeSingle();

        if (plan?.status === "active") {
          tier = plan.plan_type || "free";
          isPremium = tier === "pro" || tier === "elite";
        }
      }

      // If premium, no need to count
      if (isPremium) {
        setInfo({
          usedToday: 0,
          remaining: Infinity,
          limit: Infinity,
          isPremium: true,
          tier,
        });
        setLoading(false);
        return;
      }

      // Count today's translations from genius_usage_log
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("genius_usage_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature_type", "translate_message")
        .gte("created_at", today.toISOString());

      const usedToday = count || 0;

      setInfo({
        usedToday,
        remaining: Math.max(0, FREE_DAILY_LIMIT - usedToday),
        limit: FREE_DAILY_LIMIT,
        isPremium: false,
        tier,
      });
    } catch (err) {
      console.error("Error fetching translation usage:", err);
      setInfo({
        usedToday: 0,
        remaining: FREE_DAILY_LIMIT,
        limit: FREE_DAILY_LIMIT,
        isPremium: false,
        tier: "standard",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    info,
    loading,
    refetch: fetchUsage,
  };
}
