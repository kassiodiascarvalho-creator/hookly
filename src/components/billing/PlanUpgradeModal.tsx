import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, Zap, Building2, Rocket, Check, ArrowRight, 
  Sparkles, Phone
} from "lucide-react";
import { useCompanyPlan, COMPANY_PLANS } from "@/hooks/useCompanyPlan";
import { SubscriptionPaymentModal } from "./SubscriptionPaymentModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlanUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
}

const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Building2,
  starter: Zap,
  pro: Rocket,
  elite: Crown,
};

export function PlanUpgradeModal({ open, onOpenChange, currentPlan }: PlanUpgradeModalProps) {
  const { t } = useTranslation();
  const { openCustomerPortal, isSubscribed, checkSubscription } = useCompanyPlan();
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro" | "elite" | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleSelectPlan = async (planType: string) => {
    if (planType === "free") return;
    
    if (planType === "elite") {
      // For elite, show contact sales
      window.open("mailto:comercial@hookly.com.br?subject=Interesse no Plano Elite", "_blank");
      return;
    }

    if (isSubscribed) {
      // Already subscribed, open portal to change plan
      try {
        setLoadingPortal(true);
        await openCustomerPortal();
        onOpenChange(false);
      } catch (err) {
        toast.error("Erro ao abrir portal. Tente novamente.");
      } finally {
        setLoadingPortal(false);
      }
    } else {
      // Open transparent checkout
      setSelectedPlan(planType as "starter" | "pro" | "elite");
      setPaymentModalOpen(true);
    }
  };

  const handleSubscriptionConfirmed = () => {
    setPaymentModalOpen(false);
    setSelectedPlan(null);
    onOpenChange(false);
    checkSubscription();
    toast.success("Assinatura ativada com sucesso!");
  };

  const isCurrentPlan = (planType: string) => currentPlan === planType;
  const isUpgrade = (planType: string) => {
    const order = ["free", "starter", "pro", "elite"];
    return order.indexOf(planType) > order.indexOf(currentPlan);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              Planos Empresariais
            </DialogTitle>
            <DialogDescription>
              Escolha o plano ideal para turbinar sua contratação. 
              Cancele a qualquer momento sem compromisso.
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {COMPANY_PLANS.map((plan, index) => {
              const PlanIcon = planIcons[plan.type];
              const isCurrent = isCurrentPlan(plan.type);
              const upgrade = isUpgrade(plan.type);
              
              return (
                <motion.div
                  key={plan.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "relative rounded-xl border p-4 transition-all",
                    plan.popular && "border-primary shadow-lg shadow-primary/10",
                    isCurrent && "border-primary bg-primary/5"
                  )}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <Badge 
                      className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1"
                      variant="default"
                    >
                      <Sparkles className="h-3 w-3" />
                      Mais Popular
                    </Badge>
                  )}

                  {/* Current plan badge */}
                  {isCurrent && (
                    <Badge 
                      className="absolute -top-3 left-1/2 -translate-x-1/2"
                      variant="secondary"
                    >
                      Seu Plano
                    </Badge>
                  )}

                  <div className="space-y-4">
                    {/* Header */}
                    <div className="text-center pt-2">
                      <div className={cn(
                        "inline-flex p-2 rounded-lg mb-2",
                        plan.type === "elite" ? "bg-amber-100 dark:bg-amber-900/30" :
                        plan.popular ? "bg-primary/10" : "bg-muted"
                      )}>
                        <PlanIcon className={cn(
                          "h-6 w-6",
                          plan.type === "elite" ? "text-amber-600 dark:text-amber-400" :
                          plan.popular ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <div className="mt-2">
                        <span className="text-2xl font-bold">{plan.priceDisplay}</span>
                        {plan.price > 0 && (
                          <span className="text-muted-foreground text-sm">/mês</span>
                        )}
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Button
                      className="w-full gap-2"
                      variant={plan.popular ? "default" : "outline"}
                      disabled={isCurrent || loadingPortal}
                      onClick={() => handleSelectPlan(plan.type)}
                    >
                      {loadingPortal && plan.type !== "free" && plan.type !== "elite" ? (
                        "Abrindo..."
                      ) : isCurrent ? (
                        "Plano Atual"
                      ) : plan.type === "free" ? (
                        "Grátis"
                      ) : plan.type === "elite" ? (
                        <>
                          <Phone className="h-4 w-4" />
                          Falar com Vendas
                        </>
                      ) : upgrade ? (
                        <>
                          Assinar
                          <ArrowRight className="h-4 w-4" />
                        </>
                      ) : (
                        "Trocar Plano"
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Trust badges */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Check className="h-4 w-4 text-primary" />
                Cancele a qualquer momento
              </div>
              <div className="flex items-center gap-1">
                <Check className="h-4 w-4 text-primary" />
                Pagamento seguro via Stripe
              </div>
              <div className="flex items-center gap-1">
                <Check className="h-4 w-4 text-primary" />
                Suporte dedicado
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transparent Payment Modal */}
      {selectedPlan && (
        <SubscriptionPaymentModal
          open={paymentModalOpen}
          onOpenChange={(open) => {
            setPaymentModalOpen(open);
            if (!open) setSelectedPlan(null);
          }}
          planType={selectedPlan}
          onSubscriptionConfirmed={handleSubscriptionConfirmed}
        />
      )}
    </>
  );
}
