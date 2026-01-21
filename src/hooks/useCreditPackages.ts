import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreditPackage {
  id: string;
  name: string;
  credits_amount: number;
  bonus_credits: number;
  price_cents: number;
  currency: string;
  is_active: boolean;
  display_order: number;
  badge_text: string | null;
}

interface CreditPackagesData {
  packages: CreditPackage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch available credit packages for purchase
 */
export function useCreditPackages(): CreditPackagesData {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (fetchError) {
        console.error("[useCreditPackages] Error:", fetchError);
        setError(fetchError.message);
        return;
      }

      setPackages(data || []);
    } catch (err) {
      console.error("[useCreditPackages] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  return {
    packages,
    loading,
    error,
    refetch: fetchPackages,
  };
}
