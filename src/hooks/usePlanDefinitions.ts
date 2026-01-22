import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlanDefinition {
  id: string;
  plan_type: string;
  name: string;
  description: string | null;
  price_usd_cents: number;
  stripe_price_id: string | null;
  features: string[];
  projects_limit: number | null;
  highlight_proposals: boolean;
  priority_support: boolean;
  dedicated_manager: boolean;
  popular: boolean;
  display_order: number;
  is_active: boolean;
}

export function usePlanDefinitions() {
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("company_plan_definitions")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : JSON.parse(p.features || "[]"),
      }));

      setPlans(mapped);
      setError(null);
    } catch (err) {
      console.error("Error fetching plan definitions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    loading,
    error,
    refetch: fetchPlans,
  };
}
