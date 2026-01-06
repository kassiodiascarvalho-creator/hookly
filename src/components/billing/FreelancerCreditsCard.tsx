import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, History, ShoppingCart, Sparkles } from "lucide-react";
import { BuyCreditsDialog } from "./BuyCreditsDialog";
import { format } from "date-fns";

interface FreelancerProfile {
  proposal_credits: number;
}

interface LedgerEntry {
  id: string;
  direction: string;
  credits_amount: number | null;
  credits_after: number | null;
  reason: string;
  created_at: string;
}

export function FreelancerCreditsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch freelancer profile with credits
    const { data: profileData } = await supabase
      .from("freelancer_profiles")
      .select("proposal_credits")
      .eq("user_id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch ledger entries for credit history
    const { data: ledgerData } = await supabase
      .from("ledger_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("user_type", "freelancer")
      .order("created_at", { ascending: false })
      .limit(10);

    if (ledgerData) {
      setLedgerEntries(ledgerData);
    }

    setLoading(false);
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "credits_purchase":
      case "credits_purchase_stripe":
      case "credits_purchase_mercadopago":
        return "Compra de créditos";
      case "proposal_sent":
        return "Proposta enviada";
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

  const credits = profile?.proposal_credits || 0;

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
          <BuyCreditsDialog onSuccess={fetchData} />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold">{credits}</span>
            <span className="text-lg text-muted-foreground">
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
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="p-4 rounded-lg border text-center">
              <p className="text-2xl font-bold">10</p>
              <p className="text-sm text-muted-foreground">créditos</p>
              <p className="text-lg font-semibold mt-1">R$ 10</p>
            </div>
            <div className="p-4 rounded-lg border text-center bg-primary/5 border-primary/20">
              <Badge className="mb-2">Popular</Badge>
              <p className="text-2xl font-bold">50</p>
              <p className="text-sm text-muted-foreground">créditos</p>
              <p className="text-lg font-semibold mt-1">R$ 45</p>
              <p className="text-xs text-green-600">Economize 10%</p>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <p className="text-2xl font-bold">100</p>
              <p className="text-sm text-muted-foreground">créditos</p>
              <p className="text-lg font-semibold mt-1">R$ 80</p>
              <p className="text-xs text-green-600">Economize 20%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit History */}
      {ledgerEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4" />
              Histórico de Créditos
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
                      {entry.direction === "credit" ? "+" : "-"}{entry.credits_amount || 0}
                    </p>
                    {entry.credits_after !== null && (
                      <p className="text-xs text-muted-foreground">
                        Saldo: {entry.credits_after}
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
