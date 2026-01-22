import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CompanyPlan {
  subscribed: boolean;
  plan_type: "free" | "starter" | "pro" | "elite";
  subscription_end: string | null;
  projects_used: number;
  projects_limit: number | null;
  cancel_at_period_end?: boolean;
}

export interface PlanConfig {
  type: "free" | "starter" | "pro" | "elite";
  name: string;
  price: number; // in BRL cents
  priceDisplay: string;
  features: string[];
  projectsLimit: number | null;
  popular?: boolean;
}

export const COMPANY_PLANS: PlanConfig[] = [
  {
    type: "free",
    name: "Grátis",
    price: 0,
    priceDisplay: "R$ 0",
    features: [
      "Publicar projetos básicos",
      "Receber propostas",
      "Pagamento protegido (escrow)",
      "Suporte por email",
    ],
    projectsLimit: null,
  },
  {
    type: "starter",
    name: "Business Starter",
    price: 14900,
    priceDisplay: "R$ 149",
    features: [
      "Até 5 projetos/mês",
      "Match acelerado com talentos",
      "Suporte por email prioritário",
      "Relatórios básicos",
      "Pagamento protegido",
    ],
    projectsLimit: 5,
  },
  {
    type: "pro",
    name: "Business Pro",
    price: 29900,
    priceDisplay: "R$ 299",
    features: [
      "Projetos ilimitados",
      "Destaque automático de projetos",
      "Suporte prioritário",
      "Relatórios avançados",
      "Match acelerado",
      "Pagamento protegido",
    ],
    projectsLimit: null,
    popular: true,
  },
  {
    type: "elite",
    name: "Business Elite",
    price: 49900,
    priceDisplay: "R$ 499",
    features: [
      "Tudo do Pro +",
      "Conta dedicada",
      "Prioridade de talentos",
      "Acesso à API",
      "Dashboard de RH",
      "Suporte 24/7",
    ],
    projectsLimit: null,
  },
];

export function useCompanyPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<CompanyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setPlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("check-company-subscription");
      
      if (error) throw error;
      
      setPlan(data as CompanyPlan);
      setError(null);
    } catch (err) {
      console.error("Error checking subscription:", err);
      setError(err instanceof Error ? err.message : "Failed to check subscription");
      setPlan({
        subscribed: false,
        plan_type: "free",
        subscription_end: null,
        projects_used: 0,
        projects_limit: null,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createCheckout = useCallback(async (planType: "starter" | "pro" | "elite") => {
    try {
      const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
        body: { planType },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error creating checkout:", err);
      throw err;
    }
  }, []);

  const openCustomerPortal = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("company-customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
      throw err;
    }
  }, []);

  const getPlanConfig = useCallback((planType: string): PlanConfig | undefined => {
    return COMPANY_PLANS.find((p) => p.type === planType);
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return {
    plan,
    loading,
    error,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    getPlanConfig,
    isSubscribed: plan?.subscribed ?? false,
    currentPlan: plan?.plan_type ?? "free",
  };
}
