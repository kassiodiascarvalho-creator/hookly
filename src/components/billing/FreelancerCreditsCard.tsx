import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, History, ShoppingCart, Sparkles, Gift, AlertCircle } from "lucide-react";
import { BuyCreditsDialog } from "./BuyCreditsDialog";
import { format } from "date-fns";

// Same packages as BuyCreditsDialog for consistency
const CREDIT_PACKAGES = [
  { credits: 10, price: 10, bonus: 0, label: "Básico" },
  { credits: 25, price: 22.5, bonus: 2.5, label: "Econômico", discount: "10%" },
  { credits: 50, price: 40, bonus: 10, label: "Popular", discount: "20%", popular: true },
  { credits: 100, price: 70, bonus: 30, label: "Profissional", discount: "30%" },
];
interface PlatformCredits {
  balance: number;
}

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
  const [credits, setCredits] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch from platform_credits table (the correct source)
    const { data: platformCredits } = await supabase
      .from("platform_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (platformCredits) {
      setCredits(platformCredits.balance || 0);
    } else {
      // Fallback to freelancer_profiles for migration
      const { data: profile } = await supabase
        .from("freelancer_profiles")
        .select("proposal_credits")
        .eq("user_id", user.id)
        .maybeSingle();
      
      setCredits(profile?.proposal_credits || 0);
    }

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

  return (
    <div className="space-y-6 pb-8">
      {/* Credits Balance Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Coins className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">Créditos de Proposta</span>
            </CardTitle>
            <CardDescription className="mt-1">
              Use créditos para enviar propostas aos projetos
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <BuyCreditsDialog onSuccess={fetchData} />
          </div>
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

          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-bold">{credits}</span>
            <span className="text-base sm:text-lg text-muted-foreground">
              créditos disponíveis
            </span>
          </div>
          
          {credits === 0 && (
            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-600">Sem créditos</p>
                  <p className="text-sm text-muted-foreground">
                    Compre créditos para começar a enviar propostas e conquistar novos projetos!
                  </p>
                </div>
              </div>
            </div>
          )}

          {credits > 0 && credits <= 5 && (
            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-600">
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
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <div 
                key={pkg.credits}
                className={`p-3 sm:p-4 rounded-lg border text-center relative ${
                  pkg.popular ? "bg-primary/5 border-primary/20" : ""
                }`}
              >
                {pkg.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs px-1.5">Popular</Badge>
                )}
                <p className="text-xl sm:text-2xl font-bold">{pkg.credits}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">créditos</p>
                <p className="text-sm sm:text-lg font-semibold mt-1">R$ {pkg.price.toFixed(2).replace('.', ',')}</p>
                {pkg.bonus > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Gift className="h-3 w-3 text-green-600" />
                    <span className="text-[10px] sm:text-xs text-green-600">
                      +{pkg.bonus} ({pkg.discount})
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
            <div className="space-y-2 sm:space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base truncate">{getReasonLabel(tx.action)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold text-sm sm:text-base ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </p>
                    {tx.balance_after !== null && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
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
