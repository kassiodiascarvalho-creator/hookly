import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Crown, Zap, User, Rocket, Check,
  Calendar, Settings, ChevronRight, Sparkles, Coins, RefreshCw
} from "lucide-react";
import { useFreelancerPlan } from "@/hooks/useFreelancerPlan";
import { useFreelancerPlanDefinitions } from "@/hooks/useFreelancerPlanDefinitions";
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

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  standard: "bg-muted text-muted-foreground",
  starter: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  pro: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  top_rated: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  elite: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

// Map tier from DB to display name
const tierDisplayName: Record<string, string> = {
  standard: "Grátis",
  pro: "Pro",
  top_rated: "Elite",
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

  useEffect(() => {
    async function fetchTier() {
      if (!user) {
        setTierLoading(false);
        return;
      }
      const { data } = await supabase
        .from("freelancer_profiles")
        .select("tier, avatar_url, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setFreelancerTier((data.tier as FreelancerTier) || "standard");
        setFreelancerProfile({ avatar_url: data.avatar_url, full_name: data.full_name });
      }
      setTierLoading(false);
    }
    fetchTier();
  }, [user]);

  // Use tier from DB for display, not plan_type from subscription
  const displayTier = freelancerTier;
  const currentPlanConfig = plans.find((p) => p.plan_type === plan?.plan_type) || plans[0];
  const PlanIcon = planIcons[displayTier] || User;

  const handleManageSubscription = async () => {
    try {
      setManagingPortal(true);
      await openCustomerPortal();
    } catch (err) {
      toast.error("Erro ao abrir portal de gerenciamento");
    } finally {
      setManagingPortal(false);
    }
  };

  if (loading || plansLoading || tierLoading || !currentPlanConfig) {
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

  const isPaidTier = displayTier === "pro" || displayTier === "top_rated";

  const monthlyCredits = creditsInfo?.monthlyCredits || currentPlanConfig?.monthly_credits || 0;
  const creditCap = creditsInfo?.creditCap || currentPlanConfig?.credit_cap || null;

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Decorative gradient */}
        {isSubscribed && (
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
                  {displayTier !== "standard" && (
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

          {/* Current Balance */}
          {!creditsLoading && creditsInfo && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm">Saldo atual</span>
                <span className="font-bold text-lg">{creditsInfo.currentBalance} créditos</span>
              </div>
              {creditsInfo.nextGrantDate && creditsInfo.daysUntilGrant !== null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <RefreshCw className="h-3 w-3" />
                  <span>
                    Próxima recarga em {creditsInfo.daysUntilGrant} dias 
                    ({format(creditsInfo.nextGrantDate, "d MMM", { locale: ptBR })})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Plan usage */}
          {plan?.proposals_limit && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm mb-1">
                <span>Propostas este mês</span>
                <span className="font-medium">
                  {plan.proposals_used} / {plan.proposals_limit}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ 
                    width: `${Math.min(100, (plan.proposals_used / plan.proposals_limit) * 100)}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Unlimited badge */}
          {!plan?.proposals_limit && isPaidTier && (
            <div className="p-3 rounded-lg bg-primary/10 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Propostas ilimitadas</span>
            </div>
          )}

          {/* Subscription info */}
          {isSubscribed && plan?.subscription_end && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {plan.cancel_at_period_end ? "Cancela em " : "Renova em "}
                {format(new Date(plan.subscription_end), "d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
          )}

          {/* Features preview */}
          <div className="space-y-2">
            {currentPlanConfig.features.slice(0, 3).map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
            {currentPlanConfig.features.length > 3 && (
              <div className="text-sm text-muted-foreground">
                +{currentPlanConfig.features.length - 3} recursos
              </div>
            )}
          </div>

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
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={handleManageSubscription}
                  disabled={managingPortal}
                >
                  <Settings className="h-4 w-4" />
                  {managingPortal ? "Abrindo..." : "Gerenciar"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setUpgradeModalOpen(true)}
                >
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
        currentPlan={plan?.plan_type || "free"}
      />
    </>
  );
}
