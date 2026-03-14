import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GeniusAccess {
  hasAccess: boolean;
  expiresAt: string | null;
  source: "plan" | "credits" | null;
  daysRemaining: number | null;
}

export function useGeniusAccess(featureType: "proposal_ai" | "ranking_ai") {
  const { user } = useAuth();
  const [access, setAccess] = useState<GeniusAccess>({
    hasAccess: false,
    expiresAt: null,
    source: null,
    daysRemaining: null,
  });
  const [loading, setLoading] = useState(true);

  const checkAccess = useCallback(async () => {
    if (!user) {
      setAccess({ hasAccess: false, expiresAt: null, source: null, daysRemaining: null });
      setLoading(false);
      return;
    }

    try {
      // Check if user has active access via credits
      const { data: accessData } = await (supabase as any)
        .from("genius_access")
        .select("*")
        .eq("user_id", user.id)
        .eq("feature_type", featureType)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (accessData) {
        const expiresAt = new Date(accessData.expires_at);
        const now = new Date();
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        setAccess({
          hasAccess: true,
          expiresAt: accessData.expires_at,
          source: "credits",
          daysRemaining,
        });
        setLoading(false);
        return;
      }

      // Check plan-based access
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user.id)
        .single();

      if (profile?.user_type === "freelancer") {
        const { data: freelancerPlan } = await (supabase as any)
          .from("freelancer_plans")
          .select("plan_type, status")
          .eq("freelancer_user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (freelancerPlan?.plan_type === "elite" || freelancerPlan?.plan_type === "pro") {
          setAccess({
            hasAccess: true,
            expiresAt: null,
            source: "plan",
            daysRemaining: null,
          });
          setLoading(false);
          return;
        }
      } else if (profile?.user_type === "company") {
        const { data: companyPlan } = await supabase
          .from("company_plans")
          .select("plan_type, status")
          .eq("company_user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (companyPlan?.plan_type === "elite" || companyPlan?.plan_type === "pro") {
          setAccess({
            hasAccess: true,
            expiresAt: null,
            source: "plan",
            daysRemaining: null,
          });
          setLoading(false);
          return;
        }
      }

      setAccess({ hasAccess: false, expiresAt: null, source: null, daysRemaining: null });
    } catch (error) {
      console.error("Error checking genius access:", error);
      setAccess({ hasAccess: false, expiresAt: null, source: null, daysRemaining: null });
    } finally {
      setLoading(false);
    }
  }, [user, featureType]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return { ...access, loading, refetch: checkAccess };
}
