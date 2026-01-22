import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileGateData {
  allowed: boolean;
  reason: string | null;
  completionPercent: number;
  loading: boolean;
  refetch: () => Promise<void>;
  checkMonthlyCredits: () => Promise<{granted: boolean; amount?: number}>;
}

interface GateCheckResult {
  allowed: boolean;
  reason: string | null;
  completion_percent: number;
}

interface MonthlyCreditsResult {
  granted: boolean;
  amount?: number;
  reason?: string;
  next_grant_at?: string;
}

export function useProfileGate(userType: 'freelancer' | 'company'): ProfileGateData {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchGateStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Use direct query instead of rpc to avoid type issues with newly created functions
      const functionName = userType === 'freelancer' 
        ? 'check_freelancer_can_send_proposal'
        : 'check_company_can_publish_project';
      
      const paramName = userType === 'freelancer'
        ? 'p_freelancer_user_id'
        : 'p_company_user_id';

      const { data, error } = await supabase.rpc(functionName as any, {
        [paramName]: user.id
      });

      if (error) throw error;

      const result = data as unknown as GateCheckResult;
      setAllowed(result?.allowed ?? false);
      setReason(result?.reason ?? null);
      setCompletionPercent(result?.completion_percent ?? 0);
    } catch (err) {
      console.error('[useProfileGate] Error:', err);
      // Default to blocking on error
      setAllowed(false);
      setReason('ERROR');
      setCompletionPercent(0);
    } finally {
      setLoading(false);
    }
  }, [user, userType]);

  const checkMonthlyCredits = useCallback(async (): Promise<{granted: boolean; amount?: number}> => {
    if (!user) return { granted: false };

    try {
      const { data, error } = await supabase.rpc('check_and_grant_monthly_credits' as any, {
        p_user_id: user.id,
        p_user_type: userType
      });

      if (error) {
        console.error('[useProfileGate] Monthly credits error:', error);
        return { granted: false };
      }

      const result = data as unknown as MonthlyCreditsResult;
      return { 
        granted: result?.granted ?? false, 
        amount: result?.amount ?? 0 
      };
    } catch (err) {
      console.error('[useProfileGate] Monthly credits error:', err);
      return { granted: false };
    }
  }, [user, userType]);

  useEffect(() => {
    fetchGateStatus();
  }, [fetchGateStatus]);

  return {
    allowed,
    reason,
    completionPercent,
    loading,
    refetch: fetchGateStatus,
    checkMonthlyCredits,
  };
}
