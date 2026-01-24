import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, History, ShoppingCart, Sparkles, Gift, AlertCircle, Info } from "lucide-react";
import { BuyCreditsDialog } from "./BuyCreditsDialog";
import { format } from "date-fns";
import { usePlanCredits } from "@/hooks/usePlanCredits";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Same packages as BuyCreditsDialog for consistency
const CREDIT_PACKAGES = [
  { credits: 10, price: 10, bonus: 0, label: "Básico" },
  { credits: 25, price: 22.5, bonus: 2.5, label: "Econômico", discount: "10%" },
  { credits: 50, price: 40, bonus: 10, label: "Popular", discount: "20%", popular: true },
  { credits: 100, price: 70, bonus: 30, label: "Profissional", discount: "30%" },
];

interface CreditTransaction {
  id: string;
  action: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export function FreelancerCreditsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  
  // Use the enhanced hook for credits breakdown
  const { info: planCredits, refetch: refetchPlanCredits } = usePlanCredits('freelancer');

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    // Fetch platform credit transactions for credit history
    const { data: txData } = await supabase
      .from("platform_credit_transactions")
      .select("id, action, amount, balance_after, description, created_at")
      .eq("user_id", user.id)
      .eq("user_type", "freelancer")
      .order("created_at", { ascending: false })
      .limit(10);

    if (txData) {
      setTransactions(txData);
    }

    setLoading(false);
  };

  const handlePurchaseSuccess = () => {
    refetchPlanCredits();
    fetchTransactions();
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "topup":
      case "credits_purchase":
      case "credits_purchase_stripe":
      case "credits_purchase_mercadopago":
        return "Compra de créditos";
      case "send_proposal":
      case "proposal_sent":
        return "Envio de proposta";
      case "view_company_data":
        return "Ver dados da empresa";
      case "highlight_proposal":
        return "Destaque de proposta";
      case "boost_profile":
        return "Impulsionar perfil";
      case "refund":
        return "Reembolso";
      default:
        return reason;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalCredits = planCredits?.totalAvailable ?? 0;
  const planAvailable = planCredits?.planAvailable ?? 0;
  const purchasedAvailable = planCredits?.purchasedAvailable ?? 0;

  return (
    <div className="space-y-6">
      {/* Credits Balance Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
          <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Créditos de Proposta
            </CardTitle>
            <CardDescription>
              Use créditos para enviar propostas aos projetos
            </CardDescription>
          </div>
          <BuyCreditsDialog onSuccess={handlePurchaseSuccess} />
        </CardHeader>
        <CardContent>
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
            <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-primary">Créditos exclusivos da plataforma</p>
              <p className="text-muted-foreground">Sem taxa de câmbio • Não sacável • Uso interno</p>
            </div>
          </div>

          {/* Main total display */}
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold">{totalCredits}</span>
            <span className="text-lg text-muted-foreground">
              créditos disponíveis
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                <p className="text-xs">
                  Ao consumir créditos, os do plano são usados primeiro, depois os avulsos.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Breakdown: plan + purchased */}
          {(planAvailable > 0 || purchasedAvailable > 0) && (
            <div className="mt-2 text-sm text-muted-foreground">
              Inclui: <span className="font-medium">{planAvailable}</span> do plano
              {purchasedAvailable > 0 && (
                <> + <span className="font-medium">{purchasedAvailable}</span> avulsos</>
              )}
            </div>
          )}
          
          {totalCredits === 0 && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Sem créditos</p>
                  <p className="text-sm text-muted-foreground">
                    Compre créditos para começar a enviar propostas e conquistar novos projetos!
                  </p>
                </div>
              </div>
            </div>
          )}

          {totalCredits > 0 && totalCredits <= 5 && (
            <div className="mt-4 p-3 rounded-lg bg-accent/50 border border-accent">
              <p className="text-sm text-accent-foreground">
                💡 Você tem poucos créditos restantes. Considere recarregar para não perder oportunidades!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Packages Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-4 w-4" />
            Pacotes de Créditos
          </CardTitle>
          <CardDescription>
            Compre em pacotes maiores e ganhe bônus de créditos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <div 
                key={pkg.credits}
                className={`p-4 rounded-lg border text-center relative ${
                  pkg.popular ? "bg-primary/5 border-primary/20" : ""
                }`}
              >
                {pkg.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs">Popular</Badge>
                )}
                <p className="text-2xl font-bold">{pkg.credits}</p>
                <p className="text-sm text-muted-foreground">créditos</p>
                <p className="text-lg font-semibold mt-1">R$ {pkg.price.toFixed(2).replace('.', ',')}</p>
                {pkg.bonus > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Gift className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">
                      +{pkg.bonus} bônus ({pkg.discount})
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credit History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4" />
              Histórico de Créditos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{getReasonLabel(tx.action)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </p>
                    {tx.balance_after !== null && (
                      <p className="text-xs text-muted-foreground">
                        Saldo: {tx.balance_after}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
