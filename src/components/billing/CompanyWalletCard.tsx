import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Ticket, Loader2, History, TrendingUp, Info } from "lucide-react";
import { CompanyAddFundsDialog } from "./CompanyAddFundsDialog";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PlatformCredits {
  balance: number;
  currency: string;
}

interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  action: string;
  description: string | null;
  created_at: string;
}

export function CompanyWalletCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<PlatformCredits | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch platform credits balance
    const { data: creditsData } = await supabase
      .from("platform_credits")
      .select("balance, currency")
      .eq("user_id", user.id)
      .maybeSingle();

    if (creditsData) {
      setCredits(creditsData);
    } else {
      setCredits({ balance: 0, currency: "USD" });
    }

    // Fetch credit transactions
    const { data: txData } = await supabase
      .from("platform_credit_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (txData) {
      setTransactions(txData);
    }

    setLoading(false);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "topup":
        return t("billing.topup", "Créditos Adicionados");
      case "spend_send_proposal":
        return t("billing.actions.sendProposal", "Envio de proposta");
      case "spend_view_company_data":
        return t("billing.actions.viewData", "Visualização de dados");
      case "spend_highlight_proposal":
        return t("billing.actions.highlightProposal", "Destaque de proposta");
      case "spend_boost_profile":
        return t("billing.actions.boostProfile", "Impulsionar perfil");
      default:
        return t("billing.actions.unknown", "Ação na plataforma");
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

  const balance = credits?.balance || 0;

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              {t("finances.credits.title", "Créditos Hookly")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t("finances.credits.tooltip", "Créditos exclusivos para funcionalidades internas da plataforma. Não podem ser utilizados para pagamento de freelancers ou sacados.")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              {t("finances.credits.description", "Créditos para visibilidade e funcionalidades premium")} • {t("billing.nonWithdrawable", "Não sacável")}
            </CardDescription>
          </div>
          <CompanyAddFundsDialog onSuccess={fetchData} />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {/* Primary balance in credits */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{balance}</span>
              <span className="text-lg text-muted-foreground">{t("billing.credits", "créditos")}</span>
            </div>
          </div>
          
          {balance === 0 && (
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-primary">{t("finances.credits.addCredits", "Adicione créditos")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("finances.credits.useCases.boost", "Use créditos para impulsionar visibilidade")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("billing.whatCanYouDo", "O que você pode fazer com créditos")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border">
              <p className="font-medium">📊 {t("billing.features.viewData", "Ver Dados Completos")}</p>
              <p className="text-sm text-muted-foreground">
                {t("billing.features.viewDataDesc", "Acesse informações detalhadas de freelancers")}
              </p>
              <p className="text-xs text-primary mt-1">1 {t("billing.credit", "crédito")}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">⭐ {t("billing.features.highlight", "Destaque de Vagas")}</p>
              <p className="text-sm text-muted-foreground">
                {t("billing.features.highlightDesc", "Coloque suas vagas em destaque")}
              </p>
              <p className="text-xs text-primary mt-1">2 {t("billing.credits", "créditos")}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">🚀 {t("billing.features.boost", "Impulsionar Perfil")}</p>
              <p className="text-sm text-muted-foreground">
                {t("billing.features.boostDesc", "Aumente a visibilidade da sua empresa")}
              </p>
              <p className="text-xs text-primary mt-1">5 {t("billing.credits", "créditos")}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">🔍 {t("billing.features.advancedSearch", "Busca Avançada")}</p>
              <p className="text-sm text-muted-foreground">
                {t("billing.features.advancedSearchDesc", "Filtros avançados para encontrar talentos")}
              </p>
              <p className="text-xs text-primary mt-1">{t("common.comingSoon", "Em breve")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4" />
              {t("billing.transactionHistory", "Histórico de Transações")}
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
                    <p className="font-medium">{getActionLabel(tx.action)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.amount > 0 ? "text-primary" : "text-destructive"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} {t("billing.credits", "créditos")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("billing.balance", "Saldo")}: {tx.balance_after} {t("billing.credits", "créditos")}
                    </p>
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
