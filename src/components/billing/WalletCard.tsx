import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, Loader2, History } from "lucide-react";
import { AddFundsDialog } from "./AddFundsDialog";
import { format } from "date-fns";

interface WalletData {
  balance_contracts: number;
}

interface Transaction {
  id: string;
  type: string;
  amount_contracts: number;
  currency: string;
  fiat_amount: number;
  status: string;
  created_at: string;
  description: string | null;
}

export function WalletCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;

    // Fetch or create wallet
    let { data: walletData } = await supabase
      .from("wallets")
      .select("balance_contracts")
      .eq("user_id", user.id)
      .single();

    if (!walletData) {
      // Create wallet if doesn't exist
      const { data: newWallet } = await supabase
        .from("wallets")
        .insert({ user_id: user.id, balance_contracts: 0 })
        .select("balance_contracts")
        .single();
      walletData = newWallet;
    }

    setWallet(walletData);

    // Fetch transactions
    const { data: txData } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (txData) {
      setTransactions(txData);
    }

    setLoading(false);
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
    <div className="space-y-6">
      {/* Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t("billing.walletBalance")}
            </CardTitle>
            <CardDescription>{t("billing.walletDescription")}</CardDescription>
          </div>
          <AddFundsDialog onSuccess={fetchWalletData} />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            {(wallet?.balance_contracts || 0).toLocaleString()}
            <span className="text-lg font-normal text-muted-foreground ml-2">
              {t("billing.contracts")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4" />
              {t("billing.transactionHistory")}
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
                    <p className="font-medium">
                      {tx.type === "topup" && t("billing.topup")}
                      {tx.type === "debit" && t("billing.debit")}
                      {tx.type === "credit" && t("billing.credit")}
                      {tx.type === "refund" && t("billing.refund")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.amount_contracts >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {tx.amount_contracts >= 0 ? "+" : ""}{tx.amount_contracts.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.fiat_amount} {tx.currency}
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
