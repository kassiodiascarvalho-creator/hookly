import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Crown, Zap, User, Rocket, Check, Sparkles, Mail
} from "lucide-react";
import { useFreelancerPlan } from "@/hooks/useFreelancerPlan";
import { useFreelancerPlanDefinitions } from "@/hooks/useFreelancerPlanDefinitions";
import { useLocalizedPlanPrice } from "@/hooks/useLocalizedPlanPrice";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FreelancerSubscriptionPaymentModal } from "./FreelancerSubscriptionPaymentModal";

interface FreelancerPlanUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
}

const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: User,
  starter: Zap,
  pro: Rocket,
  elite: Crown,
};

export function FreelancerPlanUpgradeModal({ 
  open, 
  onOpenChange, 
  currentPlan 
}: FreelancerPlanUpgradeModalProps) {
  const { t } = useTranslation();
  const { isSubscribed, openCustomerPortal, checkSubscription } = useFreelancerPlan();
  const { plans, loading: plansLoading } = useFreelancerPlanDefinitions();
  const { formatLocalPrice, loading: priceLoading } = useLocalizedPlanPrice();
  const [selectedPlan, setSelectedPlan] = useState<{ type: string; name: string } | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const handleSelectPlan = async (planType: string, planName: string) => {
    if (planType === "elite") {
      window.location.href = "mailto:contato@hookly.com.br?subject=Interesse no plano Freelancer Elite";
      return;
    }

    if (isSubscribed) {
      try {
        setOpeningPortal(true);
        await openCustomerPortal();
      } catch (err) {
        toast.error("Erro ao abrir portal");
      } finally {
        setOpeningPortal(false);
      }
      return;
    }

    // Open subscription payment modal
    setSelectedPlan({ type: planType, name: planName });
  };

  const handleSubscriptionConfirmed = () => {
    setSelectedPlan(null);
    onOpenChange(false);
    checkSubscription();
    toast.success("Assinatura ativada com sucesso!");
  };

  const isCurrentPlan = (planType: string) => planType === currentPlan;
  const isUpgrade = (planType: string) => {
    const order = ["free", "starter", "pro", "elite"];
    return order.indexOf(planType) > order.indexOf(currentPlan);
  };

  const activePlans = plans.filter((p) => p.is_active);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Escolha seu Plano Freelancer</DialogTitle>
            <DialogDescription>
              Maximize suas oportunidades e destaque-se no marketplace
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 py-4">
            {activePlans.map((plan, index) => {
              const PlanIcon = planIcons[plan.plan_type] || User;
              const isCurrent = isCurrentPlan(plan.plan_type);
              const canUpgrade = isUpgrade(plan.plan_type);

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className={`relative p-4 h-full flex flex-col ${
                      plan.popular 
                        ? "border-primary shadow-lg ring-2 ring-primary/20" 
                        : isCurrent 
                          ? "border-green-500/50 bg-green-500/5"
                          : ""
                    }`}
                  >
                    {plan.popular && (
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 gap-1">
                        <Sparkles className="h-3 w-3" />
                        Popular
                      </Badge>
                    )}

                    {isCurrent && (
                      <Badge variant="outline" className="absolute -top-2 right-2 bg-green-500/10 text-green-600 border-green-500/30">
                        Atual
                      </Badge>
                    )}

                    <div className="flex items-center gap-2 mb-3 mt-2">
                      <div className={`p-2 rounded-lg ${
                        plan.popular ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <PlanIcon className={`h-5 w-5 ${
                          plan.popular ? "text-primary" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      {plan.price_usd_cents === 0 ? (
                        <span className="text-2xl font-bold">Grátis</span>
                      ) : priceLoading ? (
                        <span className="text-2xl font-bold">...</span>
                      ) : (
                        <>
                          <span className="text-2xl font-bold">
                            {formatLocalPrice(plan.price_usd_cents)}
                          </span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </>
                      )}
                    </div>

                    <div className="flex-1 space-y-2 mb-4">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant={plan.popular && !isCurrent ? "default" : "outline"}
                      className="w-full"
                      onClick={() => handleSelectPlan(plan.plan_type, plan.name)}
                      disabled={isCurrent || openingPortal || plan.plan_type === "free"}
                    >
                      {isCurrent ? (
                        "Plano Atual"
                      ) : plan.plan_type === "elite" ? (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Falar com Vendas
                        </>
                      ) : canUpgrade ? (
                        "Fazer Upgrade"
                      ) : (
                        "Selecionar"
                      )}
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {selectedPlan && (
        <FreelancerSubscriptionPaymentModal
          open={!!selectedPlan}
          onOpenChange={(isOpen) => !isOpen && setSelectedPlan(null)}
          planType={selectedPlan.type}
          planName={selectedPlan.name}
          onSubscriptionConfirmed={handleSubscriptionConfirmed}
        />
      )}
    </>
  );
}
