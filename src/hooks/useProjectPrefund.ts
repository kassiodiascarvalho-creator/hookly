import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseProjectPrefundReturn {
  prefundAmount: number;
  loading: boolean;
  refetch: () => Promise<void>;
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
      const { data, error } = await supabase
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
 * Check if a project has verified payment (prefund > 0)
 */
export async function checkProjectHasPrefund(projectId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ledger_transactions')
      .select('id')
      .filter('metadata->>purpose', 'eq', 'project_prefund')
      .filter('metadata->>project_id', 'eq', projectId)
      .limit(1);
    
    return !error && data && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fetch prefund status for multiple projects at once
 */
export async function fetchProjectsPrefundStatus(
  projectIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  
  if (projectIds.length === 0) return result;
  
  try {
    const { data, error } = await supabase
      .from('ledger_transactions')
      .select('metadata')
      .filter('metadata->>purpose', 'eq', 'project_prefund')
      .gt('amount', 0);
    
    if (!error && data) {
      data.forEach((row) => {
        const metadata = row.metadata as Record<string, unknown> | null;
        if (metadata?.project_id && typeof metadata.project_id === 'string') {
          result.set(metadata.project_id, true);
        }
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
