import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseProjectPrefundReturn {
  prefundAmount: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

interface PrefundStatusRow {
  project_id: string;
  has_verified_payment: boolean;
}

/**
 * Hook to get the prefund amount for a project
 */
export function useProjectPrefund(projectId: string | null | undefined): UseProjectPrefundReturn {
  const [prefundAmount, setPrefundAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchPrefundAmount = useCallback(async () => {
    if (!projectId) {
      setPrefundAmount(0);
      setLoading(false);
      return;
    }

    try {
      // Query ledger_transactions using metadata filter
      // Using contract_funding as fallback since project_prefund might not exist yet in enum
      const { data, error } = await (supabase as any)
        .from('ledger_transactions')
        .select('amount, metadata')
        .filter('metadata->>purpose', 'eq', 'project_prefund')
        .filter('metadata->>project_id', 'eq', projectId);
      
      if (error) {
        console.error('[useProjectPrefund] Query error:', error);
        setPrefundAmount(0);
      } else {
        const total = data?.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 0;
        setPrefundAmount(total);
      }
    } catch (err) {
      console.error('[useProjectPrefund] Error:', err);
      setPrefundAmount(0);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPrefundAmount();
  }, [fetchPrefundAmount]);

  return {
    prefundAmount,
    loading,
    refetch: fetchPrefundAmount,
  };
}

/**
 * Check if a project has verified payment (prefund with status 'paid')
 * Uses RPC to bypass RLS and allow freelancers to see company payment status
 */
export async function checkProjectHasPrefund(projectId: string): Promise<boolean> {
  try {
    // Use type assertion since RPC is dynamically created and not in generated types
    const { data, error } = await (supabase.rpc as Function)(
      'get_projects_prefund_status', 
      { project_ids: [projectId] }
    ) as { data: PrefundStatusRow[] | null; error: Error | null };
    
    if (error || !data || data.length === 0) {
      return false;
    }
    
    return data[0]?.has_verified_payment || false;
  } catch {
    return false;
  }
}

/**
 * Fetch prefund status for multiple projects at once
 * Uses SECURITY DEFINER RPC to allow all authenticated users to check status
 */
export async function fetchProjectsPrefundStatus(
  projectIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  
  if (projectIds.length === 0) return result;
  
  try {
    // Use type assertion since RPC is dynamically created and not in generated types
    const { data, error } = await (supabase.rpc as Function)(
      'get_projects_prefund_status', 
      { project_ids: projectIds }
    ) as { data: PrefundStatusRow[] | null; error: Error | null };
    
    if (!error && data) {
      data.forEach((row: PrefundStatusRow) => {
        result.set(row.project_id, row.has_verified_payment);
      });
    }
  } catch (err) {
    console.error('[fetchProjectsPrefundStatus] Error:', err);
  }
  
  // Set false for projects not found
  projectIds.forEach((id) => {
    if (!result.has(id)) {
      result.set(id, false);
    }
  });
  
  return result;
}
