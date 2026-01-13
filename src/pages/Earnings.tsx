import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  DollarSign, Loader2, Clock, CheckCircle, AlertCircle,
  Wallet, Building, CreditCard, Plus, Trash2, Save, ArrowDownToLine, Banknote, Shield
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { WithdrawalRequestModal } from "@/components/earnings/WithdrawalRequestModal";
import { formatMoney } from "@/lib/formatMoney";
interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "released" | "failed";
  created_at: string;
  company_user_id?: string | null;
  project?: { title: string };
  project_id?: string | null;
}

interface PayoutMethod {
  id: string;
  type: "pix" | "bank";
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  branch?: string | null;
  account?: string | null;
  account_type?: string | null;
  holder_name?: string | null;
  holder_doc?: string | null;
  is_default: boolean | null;
}

interface ReceivableDetail {
  companyName: string;
  companyUserId: string;
  projectTitle: string;
  amount: number;
  currency: string;
  status: string;
  projectStatus?: string;
}

const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "phone", "random"];

export default function Earnings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [totals, setTotals] = useState({ available: 0, pending: 0, receivable: 0, total: 0 });
  const [receivableDetails, setReceivableDetails] = useState<ReceivableDetail[]>([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [hasCompletedProjects, setHasCompletedProjects] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [userBalance, setUserBalance] = useState({ earnings_available: 0, credits_available: 0, escrow_held: 0, currency: "USD" });
  const [contractsEscrow, setContractsEscrow] = useState(0);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [totalPaidWithdrawals, setTotalPaidWithdrawals] = useState(0);
  
  // Payout method form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [methodType, setMethodType] = useState<"pix" | "bank">("pix");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [branch, setBranch] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [holderName, setHolderName] = useState("");
  const [holderDoc, setHolderDoc] = useState("");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from("payments")
      .select(`
        *,
        project:projects(title)
      `)
      .eq("freelancer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (paymentsData) {
      const mapped = paymentsData.map(p => ({
        ...p,
        project: p.project as { title: string } | undefined
      }));
      setPayments(mapped);

      // Calculate totals
      // Released = paid out to freelancer (historically received)
      const paidOut = mapped.filter(p => p.status === "released" && (p as any).paid_out_at).reduce((sum, p) => sum + Number(p.amount), 0);
      // Receivable = released but not yet paid out (awaiting admin transfer)
      const receivablePayments = mapped.filter(p => p.status === "released" && !(p as any).paid_out_at);
      const receivable = receivablePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      // In escrow = paid by company, held
      const pending = mapped.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
      setTotals({
        available: paidOut,
        pending: pending,
        receivable: receivable,
        total: paidOut + receivable + pending
      });

      // Fetch details for receivable payments (company names and project status)
      if (receivablePayments.length > 0) {
        const companyIds = [...new Set(receivablePayments.map(p => p.company_user_id).filter(Boolean))];
        const projectIds = [...new Set(receivablePayments.map(p => p.project_id).filter(Boolean))];
        
        const { data: companies } = await supabase
          .from("company_profiles")
          .select("user_id, company_name")
          .in("user_id", companyIds as string[]);
        
        const { data: projects } = await supabase
          .from("projects")
          .select("id, title, status")
          .in("id", projectIds as string[]);
        
        const companyMap = new Map(companies?.map(c => [c.user_id, c.company_name]) || []);
        const projectMap = new Map(projects?.map(p => [p.id, { title: p.title, status: p.status }]) || []);
        
        const details: ReceivableDetail[] = receivablePayments.map(p => {
          const projectInfo = p.project_id ? projectMap.get(p.project_id) : null;
          return {
            companyName: p.company_user_id ? companyMap.get(p.company_user_id) || t("earnings.unknownCompany") : t("earnings.unknownCompany"),
            companyUserId: p.company_user_id || "",
            projectTitle: projectInfo?.title || p.project?.title || t("earnings.unknownProject"),
            amount: Number(p.amount),
            currency: p.currency,
            status: p.status,
            projectStatus: projectInfo?.status,
          };
        });
        
        setReceivableDetails(details);
        setHasCompletedProjects(details.some(d => d.projectStatus === "completed"));
      }
    }

    // Fetch payout methods
    const { data: methodsData } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("freelancer_user_id", user.id)
      .order("is_default", { ascending: false });

    if (methodsData) setPayoutMethods(methodsData);

    // Fetch user balance from new ledger system
    const { data: balanceData } = await supabase
      .from("user_balances")
      .select("earnings_available, credits_available, escrow_held, currency")
      .eq("user_id", user.id)
      .eq("user_type", "freelancer")
      .maybeSingle();

    if (balanceData) {
      // Values are stored in cents, convert to currency units
      setUserBalance({
        earnings_available: (Number(balanceData.earnings_available) || 0) / 100,
        credits_available: Number(balanceData.credits_available) || 0, // credits stay as units
        escrow_held: (Number(balanceData.escrow_held) || 0) / 100,
        currency: balanceData.currency || "BRL"
      });
    }

    // Fetch active contracts (accepted but not yet funded/completed)
    const { data: activeContracts } = await supabase
      .from("contracts")
      .select("amount_cents, currency")
      .eq("freelancer_user_id", user.id)
      .eq("status", "active"); // active = aceito, funded = financiado

    const escrowFromContracts = activeContracts?.reduce(
      (sum, c) => sum + (c.amount_cents || 0), 0
    ) || 0;

    setContractsEscrow(escrowFromContracts / 100); // convert from cents

    // Fetch withdrawal requests
    const { data: withdrawalsData } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("freelancer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (withdrawalsData) {
      setWithdrawalRequests(withdrawalsData);
      // Calculate total paid withdrawals (values are stored in cents)
      const paidWithdrawals = withdrawalsData
        .filter(w => w.status === 'paid')
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
      setTotalPaidWithdrawals(paidWithdrawals / 100); // convert from cents
    }

    setLoading(false);
  };

  const resetForm = () => {
    setMethodType("pix");
    setPixKeyType("cpf");
    setPixKey("");
    setBankName("");
    setBankCode("");
    setBranch("");
    setAccount("");
    setAccountType("checking");
    setHolderName("");
    setHolderDoc("");
  };

  const handleAddPayoutMethod = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const isFirst = payoutMethods.length === 0;
      
      const newMethod: Omit<PayoutMethod, "id"> & { freelancer_user_id: string } = {
        freelancer_user_id: user.id,
        type: methodType,
        is_default: isFirst,
        pix_key: methodType === "pix" ? pixKey : null,
        pix_key_type: methodType === "pix" ? pixKeyType : null,
        bank_name: methodType === "bank" ? bankName : null,
        bank_code: methodType === "bank" ? bankCode : null,
        branch: methodType === "bank" ? branch : null,
        account: methodType === "bank" ? account : null,
        account_type: methodType === "bank" ? accountType : null,
        holder_name: holderName || null,
        holder_doc: holderDoc || null,
      };

      const { error } = await supabase.from("payout_methods").insert(newMethod);

      if (error) throw error;

      toast.success(t("earnings.payoutMethodAdded"));
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayoutMethod = async (id: string) => {
    const { error } = await supabase.from("payout_methods").delete().eq("id", id);
    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(t("earnings.payoutMethodDeleted"));
      fetchData();
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;

    // Unset all defaults first
    await supabase
      .from("payout_methods")
      .update({ is_default: false })
      .eq("freelancer_user_id", user.id);

    // Set new default
    const { error } = await supabase
      .from("payout_methods")
      .update({ is_default: true })
      .eq("id", id);

    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(t("earnings.defaultUpdated"));
      fetchData();
    }
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      released: "default",
      paid: "secondary",
      pending: "outline",
      failed: "destructive"
    };
    return <Badge variant={variants[status] || "outline"}>{t(`earnings.status.${status}`)}</Badge>;
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
        <h1 className="text-3xl font-bold">{t("earnings.title")}</h1>
        <p className="text-muted-foreground">{t("earnings.subtitle")}</p>
      </div>

      {/* Withdrawal Request Modal */}
      <WithdrawalRequestModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        earningsAvailable={userBalance.earnings_available}
        currency={userBalance.currency}
        payoutMethods={payoutMethods}
        onSuccess={fetchData}
      />

      {/* Withdrawable Balance Card - Always show */}
      <Card className={`border-2 ${userBalance.earnings_available > 0 ? 'border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10' : 'border-muted'}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl ${userBalance.earnings_available > 0 ? 'bg-green-500/20' : 'bg-muted'}`}>
                <Banknote className={`h-8 w-8 ${userBalance.earnings_available > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("earnings.withdrawableBalance")}</p>
                <p className={`text-3xl font-bold ${userBalance.earnings_available > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {userBalance.currency} {userBalance.earnings_available.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {userBalance.earnings_available > 0 
                    ? t("earnings.withdrawableDesc")
                    : contractsEscrow > 0
                      ? t("earnings.pendingFundingDesc", { amount: `${userBalance.currency} ${contractsEscrow.toFixed(2)}` })
                      : t("earnings.noWithdrawableBalance")
                  }
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setWithdrawalModalOpen(true)} 
              size="lg"
              className="gap-2"
              variant={userBalance.earnings_available > 0 ? "default" : "outline"}
              disabled={userBalance.earnings_available <= 0 || payoutMethods.length === 0}
            >
              <Banknote className="h-5 w-5" />
              {t("earnings.requestWithdrawal")}
            </Button>
          </div>
          {payoutMethods.length === 0 && (
            <p className="text-xs text-amber-600 mt-3">
              ⚠️ {t("earnings.configurePayoutFirst")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Received Card - Shows earnings_available only */}
        <Card className={userBalance.earnings_available > 0 ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Wallet className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("earnings.received")}</p>
                <p className="text-2xl font-bold text-green-600">
                  {userBalance.currency} {userBalance.earnings_available.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("earnings.receivedDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Escrow Card - Shows contracts accepted but not yet funded */}
        {contractsEscrow > 0 && (
          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Shield className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("earnings.inEscrow")}</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {userBalance.currency} {contractsEscrow.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("earnings.pendingFunding")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {totals.receivable > 0 && (
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              hasCompletedProjects 
                ? "border-green-500/50 bg-green-500/5" 
                : "border-yellow-500/50 bg-yellow-500/5"
            }`}
            onClick={() => setDetailModalOpen(true)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${hasCompletedProjects ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
                  <ArrowDownToLine className={`h-6 w-6 ${hasCompletedProjects ? "text-green-500" : "text-yellow-500"}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("earnings.receivable")}</p>
                  <p className={`text-2xl font-bold ${hasCompletedProjects ? "text-green-600" : "text-yellow-600"}`}>
                    ${totals.receivable.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("earnings.clickForDetails")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Receivable Details Modal */}
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                {t("earnings.receivableDetails")}
              </DialogTitle>
              <DialogDescription>
                {t("earnings.receivableDetailsDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {receivableDetails.map((detail, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-lg border ${
                    detail.projectStatus === "completed" 
                      ? "bg-green-500/5 border-green-500/30" 
                      : "bg-yellow-500/5 border-yellow-500/30"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{detail.companyName}</p>
                      <p className="text-sm text-muted-foreground">{detail.projectTitle}</p>
                      <Badge 
                        variant="outline" 
                        className={`mt-2 ${
                          detail.projectStatus === "completed" 
                            ? "border-green-500 text-green-600" 
                            : "border-yellow-500 text-yellow-600"
                        }`}
                      >
                        {detail.projectStatus === "completed" 
                          ? t("earnings.projectCompleted") 
                          : t("earnings.projectInProgress")}
                      </Badge>
                    </div>
                    <p className="font-bold text-lg">
                      ${detail.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("earnings.inEscrow")}</p>
                <p className="text-2xl font-bold">${totals.pending.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("earnings.totalEarnings")}</p>
                <p className="text-2xl font-bold text-primary">
                  {formatMoney(userBalance.earnings_available + contractsEscrow + totalPaidWithdrawals, userBalance.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("earnings.received")}: {formatMoney(userBalance.earnings_available, userBalance.currency)} 
                  {contractsEscrow > 0 && ` + ${t("earnings.inEscrow")}: ${formatMoney(contractsEscrow, userBalance.currency)}`}
                  {totalPaidWithdrawals > 0 && ` + ${t("earnings.withdrawn")}: ${formatMoney(totalPaidWithdrawals, userBalance.currency)}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-6">
        <TabsList>
          <TabsTrigger value="history">{t("earnings.paymentHistory")}</TabsTrigger>
          <TabsTrigger value="withdrawals">{t("earnings.withdrawalHistory")}</TabsTrigger>
          <TabsTrigger value="payout">{t("earnings.payoutMethods")}</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          {payments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">{t("earnings.noPayments")}</h3>
                <p className="text-muted-foreground">{t("earnings.noPaymentsDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(payment.status)}
                        <div>
                          <p className="font-medium">{payment.project?.title || t("earnings.unknownProject")}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(payment.status)}
                        <p className="font-semibold">
                          ${Number(payment.amount).toFixed(2)} {payment.currency}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="withdrawals">
          {withdrawalRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Banknote className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">{t("earnings.noWithdrawals")}</h3>
                <p className="text-muted-foreground">{t("earnings.noWithdrawalsDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {withdrawalRequests.map((withdrawal) => {
                    const statusConfig: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
                      pending_review: { 
                        icon: <Clock className="h-4 w-4 text-yellow-500" />, 
                        variant: "outline", 
                        label: t("earnings.withdrawalStatus.pending_review") 
                      },
                      approved: { 
                        icon: <CheckCircle className="h-4 w-4 text-blue-500" />, 
                        variant: "secondary", 
                        label: t("earnings.withdrawalStatus.approved") 
                      },
                      paid: { 
                        icon: <CheckCircle className="h-4 w-4 text-green-500" />, 
                        variant: "default", 
                        label: t("earnings.withdrawalStatus.paid") 
                      },
                      rejected: { 
                        icon: <AlertCircle className="h-4 w-4 text-destructive" />, 
                        variant: "destructive", 
                        label: t("earnings.withdrawalStatus.rejected") 
                      },
                    };
                    const config = statusConfig[withdrawal.status] || statusConfig.pending_review;
                    
                    return (
                      <div key={withdrawal.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {config.icon}
                          <div>
                            <p className="font-medium">
                              {t("earnings.withdrawalRequest")} - {formatMoney(Number(withdrawal.amount), withdrawal.currency)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(withdrawal.created_at), "MMM d, yyyy HH:mm")}
                            </p>
                            {withdrawal.admin_notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("earnings.adminNotes")}: {withdrawal.admin_notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          {withdrawal.paid_at && (
                            <p className="text-xs text-muted-foreground">
                              {t("earnings.paidAt")}: {format(new Date(withdrawal.paid_at), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payout">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("earnings.payoutMethods")}</CardTitle>
                <CardDescription>{t("earnings.payoutMethodsDesc")}</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("earnings.addPayoutMethod")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("earnings.addPayoutMethod")}</DialogTitle>
                    <DialogDescription>{t("earnings.addPayoutMethodDesc")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <RadioGroup value={methodType} onValueChange={(v) => setMethodType(v as "pix" | "bank")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pix" id="pix" />
                        <Label htmlFor="pix" className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          PIX
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bank" id="bank" />
                        <Label htmlFor="bank" className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          {t("earnings.bankAccount")}
                        </Label>
                      </div>
                    </RadioGroup>

                    <Separator />

                    {methodType === "pix" ? (
                      <>
                        <div className="space-y-2">
                          <Label>{t("earnings.pixKeyType")}</Label>
                          <Select value={pixKeyType} onValueChange={setPixKeyType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PIX_KEY_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {t(`earnings.pixKeyTypes.${type}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("earnings.pixKey")}</Label>
                          <Input
                            value={pixKey}
                            onChange={(e) => setPixKey(e.target.value)}
                            placeholder={t("earnings.pixKeyPlaceholder")}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{t("earnings.bankName")}</Label>
                            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("earnings.bankCode")}</Label>
                            <Input value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{t("earnings.branch")}</Label>
                            <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("earnings.account")}</Label>
                            <Input value={account} onChange={(e) => setAccount(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("earnings.accountType")}</Label>
                          <Select value={accountType} onValueChange={setAccountType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="checking">{t("earnings.checking")}</SelectItem>
                              <SelectItem value="savings">{t("earnings.savings")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <Label>{t("earnings.holderName")}</Label>
                      <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("earnings.holderDoc")}</Label>
                      <Input 
                        value={holderDoc} 
                        onChange={(e) => setHolderDoc(e.target.value)}
                        placeholder="CPF/CNPJ"
                      />
                    </div>

                    <Button onClick={handleAddPayoutMethod} disabled={saving} className="w-full gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t("common.save")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {payoutMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("earnings.noPayoutMethods")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payoutMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {method.type === "pix" ? (
                          <CreditCard className="h-5 w-5 text-primary" />
                        ) : (
                          <Building className="h-5 w-5 text-primary" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {method.type === "pix" 
                                ? `PIX (${t(`earnings.pixKeyTypes.${method.pix_key_type}`)})`
                                : method.bank_name}
                            </p>
                            {method.is_default && (
                              <Badge variant="secondary">{t("earnings.default")}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {method.type === "pix" 
                              ? method.pix_key 
                              : `${t("earnings.account")}: ${method.account}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!method.is_default && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSetDefault(method.id)}
                          >
                            {t("earnings.setDefault")}
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeletePayoutMethod(method.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
