import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Crown, Zap, User, Rocket, Check,
  Calendar, Settings, ChevronRight, Sparkles, Coins, RefreshCw, Infinity
} from "lucide-react";
import { useFreelancerPlan } from "@/hooks/useFreelancerPlan";
import { useFreelancerPlanDefinitions, FreelancerPlanDefinition } from "@/hooks/useFreelancerPlanDefinitions";
import { usePlanCredits } from "@/hooks/usePlanCredits";
import { FreelancerPlanUpgradeModal } from "./FreelancerPlanUpgradeModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import type { FreelancerTier } from "@/components/freelancer/TierBadge";

const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: User,
  standard: User,
  starter: Zap,
  pro: Rocket,
  top_rated: Crown,
  elite: Crown,
};

// Map tier from DB to display name
const tierDisplayName: Record<string, string> = {
  standard: "Grátis",
  pro: "Pro",
  top_rated: "Elite",
};

// Map tier from DB to plan_type used in definitions
const tierToPlanType: Record<string, string> = {
  standard: "free",
  pro: "pro",
  top_rated: "elite",
};

export function FreelancerPlanCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { plan, loading, isSubscribed, openCustomerPortal } = useFreelancerPlan();
  const { plans, loading: plansLoading } = useFreelancerPlanDefinitions();
  const { info: creditsInfo, loading: creditsLoading } = usePlanCredits('freelancer');
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  
  // Fetch the REAL tier from freelancer_profiles (source of truth)
  const [freelancerTier, setFreelancerTier] = useState<FreelancerTier>("standard");
  const [freelancerProfile, setFreelancerProfile] = useState<{ avatar_url: string | null; full_name: string | null } | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);

  useEffect(() => {
    async function fetchTier() {
      if (!user) {
        setTierLoading(false);
        return;
      }
      
      // Fetch tier from freelancer_profiles
      const { data } = await supabase
        .from("freelancer_profiles")
        .select("tier, avatar_url, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setFreelancerTier((data.tier as FreelancerTier) || "standard");
        setFreelancerProfile({ avatar_url: data.avatar_url, full_name: data.full_name });
      }

      // Check if user has Stripe subscription
      const { data: planData } = await supabase
        .from("freelancer_plans")
        .select("stripe_subscription_id, status")
        .eq("freelancer_user_id", user.id)
        .maybeSingle();
      
      setHasStripeSubscription(!!(planData?.stripe_subscription_id && planData?.status === "active"));
      setTierLoading(false);
    }
    fetchTier();
  }, [user]);

  // Use tier from DB for display, not plan_type from subscription
  const displayTier = freelancerTier;
  const isPaidTier = displayTier === "pro" || displayTier === "top_rated";
  
  // Map tier to plan definition - try to find matching plan
  const getPlanDefinitionForTier = (tier: FreelancerTier): FreelancerPlanDefinition | null => {
    // Map tier to possible plan_type values
    const possibleTypes = tier === "standard" 
      ? ["free", "standard"] 
      : tier === "top_rated" 
        ? ["elite", "top_rated"] 
        : [tier];
    
    return plans.find((p) => possibleTypes.includes(p.plan_type)) || null;
  };
  
  const currentPlanConfig = getPlanDefinitionForTier(displayTier) || plans.find(p => p.plan_type === "free") || plans[0];
  const PlanIcon = planIcons[displayTier] || User;

  const handleManageSubscription = async () => {
    // If no Stripe subscription, show toast and open upgrade modal instead
    if (!hasStripeSubscription) {
      toast.info("Seu plano foi atribuído manualmente e não possui portal de assinatura para gerenciar.", {
        description: "Use 'Trocar Plano' para ver opções de assinatura.",
        duration: 5000,
      });
      setUpgradeModalOpen(true);
      return;
    }

    try {
      setManagingPortal(true);
      await openCustomerPortal();
    } catch (err) {
      toast.error("Erro ao abrir portal de gerenciamento", {
        description: "Tente novamente mais tarde ou entre em contato com o suporte.",
      });
    } finally {
      setManagingPortal(false);
    }
  };

  if (loading || plansLoading || tierLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Get tier-specific benefits from plan definition
  const monthlyCredits = currentPlanConfig?.monthly_credits || 0;
  const creditCap = currentPlanConfig?.credit_cap || null;
  const proposalsLimit = isPaidTier ? null : (currentPlanConfig?.proposals_limit || 5);
  const features = currentPlanConfig?.features || [];

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Decorative gradient for paid tiers */}
        {isPaidTier && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        )}
        
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Show TieredAvatar with real tier */}
              <TieredAvatar
                avatarUrl={freelancerProfile?.avatar_url}
                name={freelancerProfile?.full_name}
                tier={displayTier}
                size="lg"
                showBadge={true}
              />
              <div>
                <CardTitle className="flex items-center gap-2">
                  {tierDisplayName[displayTier] || "Grátis"}
                  {isPaidTier && (
                    <Badge variant="default" className={`text-xs ${displayTier === "pro" ? "bg-blue-500" : "bg-amber-500"}`}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      {displayTier === "pro" ? "PRO" : "ELITE"}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isPaidTier ? "Plano ativo" : "Plano gratuito"}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Monthly Credits Info - for paid tiers */}
          {isPaidTier && monthlyCredits > 0 && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Créditos mensais</span>
                </div>
                <Badge variant="secondary" className="font-bold">
                  {monthlyCredits}/mês
                </Badge>
              </div>
              {creditCap && (
                <div className="text-xs text-muted-foreground mt-1">
                  Acumula até {creditCap} créditos (3x mensal)
                </div>
              )}
            </div>
          )}

          {/* Current Balance - always show real balance */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm">Saldo atual</span>
              <span className="font-bold text-lg">
                {creditsLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  `${creditsInfo?.currentBalance ?? 0} créditos`
                )}
              </span>
            </div>
            {!creditsLoading && creditsInfo?.nextGrantDate && creditsInfo.daysUntilGrant !== null && isPaidTier && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <RefreshCw className="h-3 w-3" />
                <span>
                  Próxima recarga em {creditsInfo.daysUntilGrant} dias 
                  ({format(creditsInfo.nextGrantDate, "d MMM", { locale: ptBR })})
                </span>
              </div>
            )}
          </div>

          {/* Proposals usage - show limit for standard, unlimited for pro/elite */}
          {isPaidTier || plan?.unlimited_proposals ? (
            <div className="p-3 rounded-lg bg-primary/10 flex items-center gap-2">
              <Infinity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Propostas ilimitadas</span>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm mb-1">
                <span>Propostas este mês</span>
                <span className="font-medium">
                  {plan?.proposals_used ?? 0} / {plan?.proposals_limit ?? proposalsLimit ?? 5}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ 
                    width: `${Math.min(100, ((plan?.proposals_used ?? 0) / (plan?.proposals_limit ?? proposalsLimit ?? 5)) * 100)}%` 
                  }}
                />
              </div>
              {plan?.reset_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  Renova em {format(new Date(plan.reset_at), "d 'de' MMMM", { locale: ptBR })}
                </div>
              )}
            </div>
          )}

          {/* Subscription info */}
          {hasStripeSubscription && plan?.subscription_end && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {plan.cancel_at_period_end ? "Cancela em " : "Renova em "}
                {format(new Date(plan.subscription_end), "d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
          )}

          {/* Features preview - tier-specific */}
          {features.length > 0 && (
            <div className="space-y-2">
              {features.slice(0, 4).map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
              {features.length > 4 && (
                <div className="text-sm text-muted-foreground">
                  +{features.length - 4} recursos
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {!isPaidTier ? (
              <Button 
                className="flex-1 gap-2" 
                onClick={() => setUpgradeModalOpen(true)}
              >
                <Rocket className="h-4 w-4" />
                Ver Planos Freelancer
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                {hasStripeSubscription && (
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={handleManageSubscription}
                    disabled={managingPortal}
                  >
                    <Settings className="h-4 w-4" />
                    {managingPortal ? "Abrindo..." : "Gerenciar"}
                  </Button>
                )}
                <Button 
                  variant={hasStripeSubscription ? "outline" : "default"}
                  className={hasStripeSubscription ? "" : "flex-1 gap-2"}
                  onClick={() => setUpgradeModalOpen(true)}
                >
                  {!hasStripeSubscription && <Rocket className="h-4 w-4" />}
                  Trocar Plano
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <FreelancerPlanUpgradeModal 
        open={upgradeModalOpen} 
        onOpenChange={setUpgradeModalOpen}
        currentPlan={tierToPlanType[displayTier] || "free"}
      />
    </>
  );
}
