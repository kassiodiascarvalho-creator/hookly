import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ActionCost {
  action_key: string;
  cost_credits: number;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
}

interface PlatformCreditsData {
  balance: number;
  loading: boolean;
  actionCosts: Record<string, ActionCost>;
  refreshBalance: () => Promise<void>;
  checkCredits: (actionKey: string) => boolean;
  spendCredits: (actionKey: string, description?: string) => Promise<{ success: boolean; error?: string }>;
  getActionCost: (actionKey: string) => number;
}

export function usePlatformCredits(): PlatformCreditsData {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionCosts, setActionCosts] = useState<Record<string, ActionCost>>({});

  // Fetch balance and action costs
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch balance from platform_credits table (the correct source)
    const { data: platformCredits } = await supabase
      .from("platform_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    // If no record exists, also check freelancer_profiles as fallback
    // and ensure we create a platform_credits record
    if (platformCredits) {
      setBalance(platformCredits.balance || 0);
    } else {
      // Fallback: check freelancer_profiles for proposal_credits
      const { data: profile } = await supabase
        .from("freelancer_profiles")
        .select("proposal_credits")
        .eq("user_id", user.id)
        .maybeSingle();

      const creditsFromProfile = profile?.proposal_credits || 0;
      setBalance(creditsFromProfile);

      // Create platform_credits record if user has credits in profile
      if (creditsFromProfile > 0) {
        await supabase.from("platform_credits").upsert({
          user_id: user.id,
          user_type: "freelancer",
          balance: creditsFromProfile,
        }, { onConflict: "user_id" });
      }
    }

    // Fetch action costs
    const { data: costs } = await supabase
      .from("platform_action_costs")
      .select("*")
      .eq("is_enabled", true);

    if (costs) {
      const costsMap: Record<string, ActionCost> = {};
      costs.forEach((cost) => {
        costsMap[cost.action_key] = cost;
      });
      setActionCosts(costsMap);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshBalance = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const getActionCost = useCallback((actionKey: string): number => {
    return actionCosts[actionKey]?.cost_credits || 0;
  }, [actionCosts]);

  const checkCredits = useCallback((actionKey: string): boolean => {
    const cost = getActionCost(actionKey);
    return balance >= cost;
  }, [balance, getActionCost]);

  const spendCredits = useCallback(async (
    actionKey: string, 
    description?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: "Usuário não autenticado" };
    }

    const cost = getActionCost(actionKey);
    
    if (balance < cost) {
      return { success: false, error: "Créditos insuficientes" };
    }

    // Call RPC to spend credits
    const { data, error } = await supabase.rpc("spend_platform_credits", {
      p_user_id: user.id,
      p_action_key: actionKey,
      p_description: description,
    });

    if (error) {
      console.error("[usePlatformCredits] Error spending credits:", error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Falha ao consumir créditos" };
    }

    // Refresh balance after spending
    await refreshBalance();

    return { success: true };
  }, [user, balance, getActionCost, refreshBalance]);

  return {
    balance,
    loading,
    actionCosts,
    refreshBalance,
    checkCredits,
    spendCredits,
    getActionCost,
  };
}

// Action keys for type safety
export const PLATFORM_ACTIONS = {
  SEND_PROPOSAL: "send_proposal",
  VIEW_COMPANY_DATA: "view_company_data",
  HIGHLIGHT_PROPOSAL: "highlight_proposal",
  BOOST_PROFILE: "boost_profile",
} as const;

export type PlatformActionKey = typeof PLATFORM_ACTIONS[keyof typeof PLATFORM_ACTIONS];
