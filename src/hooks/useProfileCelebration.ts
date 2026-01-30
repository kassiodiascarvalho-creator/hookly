import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileCelebrationData {
  showCelebration: boolean;
  bonusCredits: number;
  userType: 'freelancer' | 'company' | null;
  triggerCelebration: (completionPercent: number, userType: 'freelancer' | 'company') => Promise<boolean>;
  closeCelebration: () => void;
  bonusAlreadyClaimed: boolean;
}

export function useProfileCelebration(): ProfileCelebrationData {
  const { user } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);
  const [bonusCredits, setBonusCredits] = useState(10);
  const [userType, setUserType] = useState<'freelancer' | 'company' | null>(null);
  const [bonusAlreadyClaimed, setBonusAlreadyClaimed] = useState(false);

  const triggerCelebration = useCallback(async (
    completionPercent: number, 
    type: 'freelancer' | 'company'
  ): Promise<boolean> => {
    if (!user || completionPercent < 100) {
      console.log("[CELEBRATION] Not triggering - incomplete or no user", { completionPercent, hasUser: !!user });
      return false;
    }

    try {
      // Check if bonus was already claimed
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completion_bonus_claimed")
        .eq("user_id", user.id)
        .single();

      if (profile?.profile_completion_bonus_claimed) {
        console.log("[CELEBRATION] Bonus already claimed - not showing celebration");
        setBonusAlreadyClaimed(true);
        return false;
      }

      // Get bonus amount from config
      const { data: bonusConfig } = await supabase
        .from("platform_action_costs")
        .select("cost_credits, is_enabled")
        .eq("action_key", "profile_completion_bonus")
        .single();

      if (bonusConfig) {
        setBonusCredits(bonusConfig.cost_credits);
        
        if (!bonusConfig.is_enabled) {
          console.log("[CELEBRATION] Bonus is disabled");
          return false;
        }
      }

      // Try to claim the bonus
      console.log("[CELEBRATION] Attempting to claim bonus...");
      const { data, error } = await supabase.rpc('grant_profile_completion_bonus', {
        p_user_id: user.id,
        p_user_type: type
      });

      console.log("[CELEBRATION] RPC response:", { data, error });

      if (error) {
        console.error("[CELEBRATION] Error claiming bonus:", error);
        return false;
      }

      if (data === true) {
        console.log("[CELEBRATION] Bonus granted! Showing celebration...");
        setUserType(type);
        setShowCelebration(true);
        setBonusAlreadyClaimed(true);
        return true;
      } else {
        console.log("[CELEBRATION] Bonus not granted (already claimed in DB)");
        setBonusAlreadyClaimed(true);
        return false;
      }
    } catch (error) {
      console.error("[CELEBRATION] Error:", error);
      return false;
    }
  }, [user]);

  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  return {
    showCelebration,
    bonusCredits,
    userType,
    triggerCelebration,
    closeCelebration,
    bonusAlreadyClaimed,
  };
}
