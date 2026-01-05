import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, Loader2, Clock, CheckCircle, AlertCircle,
  CreditCard, TrendingUp, Wallet
} from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function CompanyFinances() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totals, setTotals] = useState({ 
    totalSpent: 0, 
    inEscrow: 0, 
    released: 0 
  });

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    if (!user) return;

    const { data, error } = await supabase
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
      setLoading(false);
      return;
    }

    if (data) {
      const mapped = data.map(p => ({
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("finances.title")}</h1>
        <p className="text-muted-foreground">{t("finances.subtitle")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("finances.totalSpent")}</p>
                <p className="text-2xl font-bold">${totals.totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <Wallet className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("finances.inEscrow")}</p>
                <p className="text-2xl font-bold">${totals.inEscrow.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("finances.released")}</p>
                <p className="text-2xl font-bold">${totals.released.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      ${Number(payment.amount).toFixed(2)} {payment.currency}
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
