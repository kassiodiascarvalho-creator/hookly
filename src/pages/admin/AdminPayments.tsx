import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, Loader2, DollarSign, Clock, CheckCircle, AlertTriangle,
  Eye, CreditCard, Building, User
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  escrow_status: string | null;
  project_id: string | null;
  company_user_id: string | null;
  freelancer_user_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
  released_at: string | null;
  released_by_admin_id: string | null;
  project?: { title: string } | null;
  company?: { company_name: string } | null;
  freelancer?: { full_name: string } | null;
  payout_method?: {
    type: string;
    pix_key?: string | null;
    pix_key_type?: string | null;
    bank_name?: string | null;
    bank_code?: string | null;
    branch?: string | null;
    account?: string | null;
    account_type?: string | null;
    holder_name?: string | null;
    holder_doc?: string | null;
  } | null;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  paid: "secondary",
  released: "default",
  failed: "destructive",
};

export default function AdminPayments() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          project:projects(title),
          company:company_profiles!payments_company_user_id_fkey(company_name),
          freelancer:freelancer_profiles!payments_freelancer_user_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map data to handle array responses
      const mapped = (data || []).map(p => ({
        ...p,
        project: p.project as { title: string } | null,
        company: Array.isArray(p.company) ? p.company[0] : p.company,
        freelancer: Array.isArray(p.freelancer) ? p.freelancer[0] : p.freelancer
      }));
      
      setPayments(mapped);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const fetchPayoutMethod = async (freelancerUserId: string): Promise<Payment["payout_method"]> => {
    const { data } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("freelancer_user_id", freelancerUserId)
      .eq("is_default", true)
      .maybeSingle();
    
    return data;
  };

  const handleViewDetails = async (payment: Payment) => {
    setSelectedPayment(payment);
    
    // Fetch payout method if freelancer exists
    if (payment.freelancer_user_id) {
      const payoutMethod = await fetchPayoutMethod(payment.freelancer_user_id);
      setSelectedPayment(prev => prev ? { ...prev, payout_method: payoutMethod } : null);
    }
    
    setDetailsOpen(true);
  };

  const handleReleasePayment = async () => {
    if (!selectedPayment) return;
    
    setReleasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("release-payment", {
        body: { paymentId: selectedPayment.id }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(t("admin.paymentReleased"));
      setConfirmOpen(false);
      setDetailsOpen(false);
      fetchPayments();
    } catch (error) {
      console.error("Error releasing payment:", error);
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setReleasing(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.id.toLowerCase().includes(search.toLowerCase()) ||
      payment.stripe_payment_intent_id?.toLowerCase().includes(search.toLowerCase()) ||
      payment.project?.title?.toLowerCase().includes(search.toLowerCase()) ||
      payment.company?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      payment.freelancer?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
    inEscrow: payments.filter(p => p.status === "paid" && p.escrow_status === "held").reduce((sum, p) => sum + Number(p.amount), 0),
    released: payments.filter(p => p.status === "released").reduce((sum, p) => sum + Number(p.amount), 0),
    pending: payments.filter(p => p.status === "pending").length,
    awaitingRelease: payments.filter(p => p.status === "paid" && p.escrow_status === "held").length
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.payments")}</h1>
        <p className="text-muted-foreground">{t("admin.paymentsDescription")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.totalVolume")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">${stats.totalAmount.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.inEscrow")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-2xl font-bold">${stats.inEscrow.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.awaitingRelease} {t("admin.awaitingRelease")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.released")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">${stats.released.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.pendingPayments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold">{stats.pending}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>{t("admin.allPayments")}</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t("admin.filterByStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.allStatuses")}</SelectItem>
                  <SelectItem value="pending">{t("admin.pending")}</SelectItem>
                  <SelectItem value="paid">{t("admin.paid")}</SelectItem>
                  <SelectItem value="released">{t("admin.released")}</SelectItem>
                  <SelectItem value="failed">{t("admin.failed")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("admin.searchPayments")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.project")}</TableHead>
                  <TableHead>{t("admin.company")}</TableHead>
                  <TableHead>{t("admin.freelancer")}</TableHead>
                  <TableHead>{t("admin.amount")}</TableHead>
                  <TableHead>{t("admin.status")}</TableHead>
                  <TableHead>{t("admin.createdAt")}</TableHead>
                  <TableHead>{t("admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.project?.title || "-"}
                    </TableCell>
                    <TableCell>
                      {payment.company?.company_name || "-"}
                    </TableCell>
                    <TableCell>
                      {payment.freelancer?.full_name || "-"}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${Number(payment.amount).toLocaleString()} {payment.currency}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={statusColors[payment.status] || "secondary"}>
                          {t(`admin.${payment.status}`)}
                        </Badge>
                        {payment.escrow_status === "held" && payment.status === "paid" && (
                          <span className="text-xs text-yellow-600">{t("admin.inEscrowLabel")}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(payment.created_at), "PPp")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(payment)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {t("admin.view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {t("admin.noPaymentsFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.paymentDetails")}</DialogTitle>
            <DialogDescription>{t("admin.paymentDetailsDesc")}</DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.amount")}</p>
                  <p className="font-semibold text-lg">
                    ${Number(selectedPayment.amount).toFixed(2)} {selectedPayment.currency}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.status")}</p>
                  <Badge variant={statusColors[selectedPayment.status] || "secondary"}>
                    {t(`admin.${selectedPayment.status}`)}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Project & Parties */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.project")}</p>
                    <p className="font-medium">{selectedPayment.project?.title || "-"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.company")}</p>
                    <p className="font-medium">{selectedPayment.company?.company_name || "-"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.freelancer")}</p>
                    <p className="font-medium">{selectedPayment.freelancer?.full_name || "-"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payout Method */}
              {selectedPayment.payout_method && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">{t("admin.payoutMethod")}</h4>
                  {selectedPayment.payout_method.type === "pix" ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.pixKeyType")}</span>
                        <span className="font-medium uppercase">{selectedPayment.payout_method.pix_key_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.pixKey")}</span>
                        <span className="font-mono">{selectedPayment.payout_method.pix_key}</span>
                      </div>
                      {selectedPayment.payout_method.holder_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("admin.holderName")}</span>
                          <span>{selectedPayment.payout_method.holder_name}</span>
                        </div>
                      )}
                      {selectedPayment.payout_method.holder_doc && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("admin.holderDoc")}</span>
                          <span className="font-mono">{selectedPayment.payout_method.holder_doc}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.bank")}</span>
                        <span>{selectedPayment.payout_method.bank_name} ({selectedPayment.payout_method.bank_code})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.branch")}</span>
                        <span className="font-mono">{selectedPayment.payout_method.branch}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.account")}</span>
                        <span className="font-mono">{selectedPayment.payout_method.account} ({selectedPayment.payout_method.account_type})</span>
                      </div>
                      {selectedPayment.payout_method.holder_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("admin.holderName")}</span>
                          <span>{selectedPayment.payout_method.holder_name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!selectedPayment.payout_method && selectedPayment.freelancer_user_id && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <p className="text-sm text-yellow-600">
                    {t("admin.noPayoutMethod")}
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("admin.paidAt")}</p>
                  <p>{selectedPayment.paid_at ? format(new Date(selectedPayment.paid_at), "PPp") : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("admin.releasedAt")}</p>
                  <p>{selectedPayment.released_at ? format(new Date(selectedPayment.released_at), "PPp") : "-"}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedPayment?.status === "paid" && selectedPayment?.escrow_status === "held" && (
              <Button 
                onClick={() => setConfirmOpen(true)}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t("admin.markAsPaid")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Release Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmRelease")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.confirmReleaseDesc", { 
                amount: `$${Number(selectedPayment?.amount || 0).toFixed(2)}`,
                freelancer: selectedPayment?.freelancer?.full_name || "the freelancer"
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releasing}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReleasePayment} disabled={releasing}>
              {releasing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {t("admin.confirmPaid")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
