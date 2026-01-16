import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, Loader2, History, TrendingUp, Info } from "lucide-react";
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
        return "Recarga de créditos";
      case "spend_send_proposal":
        return "Envio de proposta";
      case "spend_view_company_data":
        return "Visualização de dados";
      case "spend_highlight_proposal":
        return "Destaque de proposta";
      case "spend_boost_profile":
        return "Impulsionar perfil";
      default:
        return action;
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
              <Wallet className="h-5 w-5 text-primary" />
              Créditos da Plataforma
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Créditos exclusivos para funcionalidades internas da plataforma. Não podem ser utilizados para pagamento de freelancers ou sacados.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Créditos para uso exclusivo na plataforma • Não sacável
            </CardDescription>
          </div>
          <CompanyAddFundsDialog onSuccess={fetchData} />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {/* Primary balance in credits */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{balance}</span>
              <span className="text-lg text-muted-foreground">créditos</span>
            </div>
          </div>
          
          {balance === 0 && (
            <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-600">Adicione créditos</p>
                  <p className="text-sm text-muted-foreground">
                    Use créditos para acessar funcionalidades premium: ver dados detalhados 
                    de freelancers, destacar suas vagas, e muito mais!
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
          <CardTitle className="text-lg">O que você pode fazer com créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border">
              <p className="font-medium">📊 Ver Dados Completos</p>
              <p className="text-sm text-muted-foreground">
                Acesse informações detalhadas de freelancers
              </p>
              <p className="text-xs text-primary mt-1">1 crédito</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">⭐ Destaque de Vagas</p>
              <p className="text-sm text-muted-foreground">
                Coloque suas vagas em destaque
              </p>
              <p className="text-xs text-primary mt-1">2 créditos</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">🚀 Impulsionar Perfil</p>
              <p className="text-sm text-muted-foreground">
                Aumente a visibilidade da sua empresa
              </p>
              <p className="text-xs text-primary mt-1">5 créditos</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">🔍 Busca Avançada</p>
              <p className="text-sm text-muted-foreground">
                Filtros avançados para encontrar talentos
              </p>
              <p className="text-xs text-primary mt-1">Em breve</p>
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
              Histórico de Transações
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
                    <p className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} créditos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: {tx.balance_after} créditos
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
