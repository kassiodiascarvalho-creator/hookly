import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Clock, CheckCircle, AlertCircle,
  CreditCard, Ticket, Landmark, ArrowDownToLine, Info, Sparkles, Rocket
} from "lucide-react";
import { format } from "date-fns";
import { formatMoney, formatMoneyFromCents } from "@/lib/formatMoney";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CompanyAddFundsDialog } from "@/components/billing/CompanyAddFundsDialog";
import { CompanyPlanCard } from "@/components/billing/CompanyPlanCard";
import { useCompanyPlan } from "@/hooks/useCompanyPlan";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "released" | "failed";
  escrow_status: string | null;
  created_at: string;
  paid_at: string | null;
  released_at: string | null;
  project?: { title: string };
  freelancer?: { full_name: string } | null;
}

interface PlatformCredits {
  balance: number;
  currency: string;
}

export default function CompanyFinances() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { checkSubscription } = useCompanyPlan();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [credits, setCredits] = useState<PlatformCredits | null>(null);
  const [totals, setTotals] = useState({ 
    totalSpent: 0, 
    inEscrow: 0, 
    released: 0 
  });

  // Handle subscription success/cancel from Stripe redirect
  useEffect(() => {
    const subscriptionStatus = searchParams.get("subscription");
    if (subscriptionStatus === "success") {
      toast.success("Assinatura ativada com sucesso!");
      checkSubscription();
    } else if (subscriptionStatus === "canceled") {
      toast.info("Assinatura cancelada");
    }
  }, [searchParams, checkSubscription]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch payments
    const { data: paymentsData, error } = await supabase
      .from("payments")
      .select(`
        *,
        project:projects(title),
        freelancer:freelancer_profiles!payments_freelancer_user_id_fkey(full_name)
      `)
      .eq("company_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching payments:", error);
    }

    // Fetch platform credits
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

    if (paymentsData) {
      const mapped = paymentsData.map(p => ({
        ...p,
        project: p.project as { title: string } | undefined,
        freelancer: Array.isArray(p.freelancer) ? p.freelancer[0] : p.freelancer
      }));
      setPayments(mapped);

      // Calculate totals
      const released = mapped.filter(p => p.status === "released").reduce((sum, p) => sum + Number(p.amount), 0);
      const inEscrow = mapped.filter(p => p.status === "paid" && p.escrow_status === "held").reduce((sum, p) => sum + Number(p.amount), 0);
      const totalSpent = released + inEscrow;
      
      setTotals({ totalSpent, inEscrow, released });
    }

    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "released":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "paid":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (payment: Payment) => {
    if (payment.status === "paid" && payment.escrow_status === "held") {
      return <Badge variant="secondary">{t("finances.inEscrow")}</Badge>;
    }
    if (payment.status === "released") {
      return <Badge variant="default">{t("finances.releasedToFreelancer")}</Badge>;
    }
    if (payment.status === "pending") {
      return <Badge variant="outline">{t("finances.pending")}</Badge>;
    }
    if (payment.status === "failed") {
      return <Badge variant="destructive">{t("finances.failed")}</Badge>;
    }
    return <Badge variant="outline">{payment.status}</Badge>;
  };

  // Safe display for zero/empty values - uses standard formatting
  const formatSafeValue = (value: number, currency: string) => {
    if (value === 0) return t("finances.noData");
    return formatMoney(value, currency);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const creditBalance = credits?.balance || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("finances.title")}</h1>
        <p className="text-muted-foreground">{t("finances.subtitle")}</p>
      </div>

      {/* Company Plan Card */}
      <CompanyPlanCard />

      {/* Summary Cards - Separated Credits vs Escrow */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Credits Card - Internal currency */}
        <Card className="relative overflow-hidden border-primary/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Ticket className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground font-medium">
                    {t("finances.credits.title")}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{t("finances.credits.tooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {creditBalance > 0 ? `${creditBalance} créditos` : t("finances.noData")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("finances.credits.description")}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <CompanyAddFundsDialog onSuccess={fetchData} />
            </div>
          </CardContent>
        </Card>

        {/* Escrow Card - Real money */}
        <Card className="border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <Landmark className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground font-medium">
                    {t("finances.escrow.title")}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{t("finances.escrow.tooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {formatSafeValue(totals.inEscrow, "USD")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("finances.escrow.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Released Card - Completed payments */}
        <Card className="border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <ArrowDownToLine className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground font-medium">
                  {t("finances.released.title")}
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatSafeValue(totals.released, "USD")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("finances.released.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA for Credits - Strategic Visibility */}
      {creditBalance === 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {t("finances.credits.useCases.boost")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("finances.credits.useCases.visibility")}
                </p>
              </div>
              <CompanyAddFundsDialog onSuccess={fetchData} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("finances.paymentHistory")}</CardTitle>
          <CardDescription>{t("finances.paymentHistoryDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2">{t("finances.noPayments")}</h3>
              <p className="text-muted-foreground">{t("finances.noPaymentsDesc")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finances.project")}</TableHead>
                  <TableHead>{t("finances.freelancer")}</TableHead>
                  <TableHead>{t("finances.amount")}</TableHead>
                  <TableHead>{t("finances.status")}</TableHead>
                  <TableHead>{t("finances.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.project?.title || t("finances.unknownProject")}
                    </TableCell>
                    <TableCell>
                      {payment.freelancer?.full_name || t("finances.unknownFreelancer")}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatMoney(Number(payment.amount), payment.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        {getStatusBadge(payment)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(payment.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
