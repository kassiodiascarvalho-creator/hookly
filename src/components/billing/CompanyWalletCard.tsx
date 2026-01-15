import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, Loader2, History, TrendingUp } from "lucide-react";
import { CompanyAddFundsDialog } from "./CompanyAddFundsDialog";
import { format } from "date-fns";
import { formatMoneyFromCents, formatMoney } from "@/lib/formatMoney";
import { useLocalCurrencyDisplay } from "@/hooks/useLocalCurrencyDisplay";

interface UserBalance {
  credits_available: number;
  currency: string;
}

interface LedgerEntry {
  id: string;
  direction: string;
  amount_cents: number;
  currency: string;
  balance_after_cents: number | null;
  reason: string;
  created_at: string;
}

export function CompanyWalletCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const { localCurrency, convertToLocal, loading: fxLoading } = useLocalCurrencyDisplay();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch user balance from the new ledger system (user_balances table)
    const { data: balanceData } = await supabase
      .from("user_balances")
      .select("credits_available, currency")
      .eq("user_id", user.id)
      .eq("user_type", "company")
      .maybeSingle();

    if (balanceData) {
      setBalance(balanceData);
    }

    // Fetch ledger transactions
    const { data: ledgerData } = await supabase
      .from("ledger_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (ledgerData) {
      // Map ledger_transactions to LedgerEntry format
      const mappedEntries: LedgerEntry[] = ledgerData.map((tx: any) => ({
        id: tx.id,
        direction: tx.tx_type.includes('spend') || tx.tx_type.includes('withdrawal') ? 'debit' : 'credit',
        amount_cents: Math.round(tx.amount * 100),
        currency: tx.currency,
        balance_after_cents: tx.balance_after_credits ? Math.round(tx.balance_after_credits * 100) : null,
        reason: tx.context || tx.tx_type,
        created_at: tx.created_at,
      }));
      setLedgerEntries(mappedEntries);
    }

    setLoading(false);
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "wallet_topup":
      case "wallet_topup_stripe":
      case "wallet_topup_mercadopago":
        return "Recarga de fundos";
      case "premium_feature":
        return "Funcionalidade premium";
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

  // Balance is stored as a decimal in user_balances, convert to cents for display
  const balanceUsd = balance?.credits_available || 0;
  const balanceCents = Math.round(balanceUsd * 100);
  const currency = balance?.currency || "USD";

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Carteira da Empresa
            </CardTitle>
            <CardDescription>
              Saldo para funcionalidades premium e recursos avançados
            </CardDescription>
          </div>
          <CompanyAddFundsDialog onSuccess={fetchData} />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {/* Primary balance in USD */}
            <span className="text-4xl font-bold">
              {formatMoneyFromCents(balanceCents, currency)}
            </span>
            
            {/* Approximate local currency value */}
            {localCurrency !== "USD" && !fxLoading && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-sm">≈</span>
                <span className="text-base">
                  {formatMoney(convertToLocal(balanceCents) || 0, localCurrency)}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  (estimativa)
                </span>
              </div>
            )}
          </div>
          
          {balanceCents === 0 && (
            <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-600">Adicione fundos</p>
                  <p className="text-sm text-muted-foreground">
                    Use sua carteira para acessar dados detalhados de freelancers, 
                    relatórios avançados e muito mais!
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
          <CardTitle className="text-lg">Funcionalidades Premium</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border">
              <p className="font-medium">📊 Histórico Avançado</p>
              <p className="text-sm text-muted-foreground">
                Veja histórico completo de projetos e avaliações
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">📈 Relatórios</p>
              <p className="text-sm text-muted-foreground">
                Acesse relatórios detalhados de contratações
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">⭐ Destaque de Vagas</p>
              <p className="text-sm text-muted-foreground">
                Coloque suas vagas em destaque
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="font-medium">🔍 Busca Avançada</p>
              <p className="text-sm text-muted-foreground">
                Filtros avançados para encontrar talentos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      {ledgerEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4" />
              Histórico de Transações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ledgerEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{getReasonLabel(entry.reason)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${entry.direction === "credit" ? "text-green-600" : "text-destructive"}`}>
                      {entry.direction === "credit" ? "+" : "-"}
                      {formatMoneyFromCents(entry.amount_cents, entry.currency)}
                    </p>
                    {entry.balance_after_cents !== null && (
                      <p className="text-xs text-muted-foreground">
                        Saldo: {formatMoneyFromCents(entry.balance_after_cents, entry.currency)}
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
