import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Crown, Zap, Building2, Rocket, Check, ArrowRight, 
  Calendar, Settings, ChevronRight, Sparkles 
} from "lucide-react";
import { useCompanyPlan, COMPANY_PLANS, type PlanConfig } from "@/hooks/useCompanyPlan";
import { PlanUpgradeModal } from "./PlanUpgradeModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Building2,
  starter: Zap,
  pro: Rocket,
  elite: Crown,
};

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  pro: "bg-primary/10 text-primary border-primary/20",
  elite: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export function CompanyPlanCard() {
  const { t } = useTranslation();
  const { plan, loading, isSubscribed, openCustomerPortal } = useCompanyPlan();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);

  const currentPlanConfig = COMPANY_PLANS.find((p) => p.type === plan?.plan_type) || COMPANY_PLANS[0];
  const PlanIcon = planIcons[currentPlanConfig.type] || Building2;

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

  if (loading) {
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
              <div className={`p-2 rounded-lg ${planColors[currentPlanConfig.type]}`}>
                <PlanIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {currentPlanConfig.name}
                  {currentPlanConfig.popular && (
                    <Badge variant="default" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isSubscribed ? "Plano ativo" : "Plano gratuito"}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Plan usage */}
          {plan?.projects_limit && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm mb-1">
                <span>Projetos este mês</span>
                <span className="font-medium">
                  {plan.projects_used} / {plan.projects_limit}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ 
                    width: `${Math.min(100, (plan.projects_used / plan.projects_limit) * 100)}%` 
                  }}
                />
              </div>
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
            {!isSubscribed ? (
              <Button 
                className="flex-1 gap-2" 
                onClick={() => setUpgradeModalOpen(true)}
              >
                <Rocket className="h-4 w-4" />
                Ver Planos Empresariais
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

      <PlanUpgradeModal 
        open={upgradeModalOpen} 
        onOpenChange={setUpgradeModalOpen}
        currentPlan={plan?.plan_type || "free"}
      />
    </>
  );
}
