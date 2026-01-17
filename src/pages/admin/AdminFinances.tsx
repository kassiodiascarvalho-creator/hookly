import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import FxSpreadSettings from "@/components/admin/FxSpreadSettings";
import PaymentFeeSettings from "@/components/admin/PaymentFeeSettings";
import FxRevenueReport from "@/components/admin/FxRevenueReport";
import FinancialAlertsCard from "@/components/admin/FinancialAlertsCard";
import { ActionCostsManager } from "@/components/admin/ActionCostsManager";
import { 
  Coins, 
  Wallet, 
  Lock, 
  ArrowUpCircle,
  Search,
  RefreshCw,
  Check,
  X,
  Clock,
  DollarSign,
  Users,
  Building2,
  User,
  Calendar,
  Globe,
  ArrowRightLeft,
  Settings2
} from "lucide-react";
import { subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns";

interface UserBalance {
  id: string;
  user_id: string;
  user_type: string;
  credits_available: number;
  earnings_available: number;
  escrow_held: number;
  currency: string;
  updated_at: string;
  email?: string;
  name?: string;
  country_code?: string;
  currency_code?: string;
}

interface WithdrawalRequest {
  id: string;
  freelancer_user_id: string;
  amount: number;
  currency: string;
  status: string;
  payout_details: any;
  admin_notes: string | null;
  created_at: string;
  freelancer_name?: string;
  freelancer_email?: string;
  freelancer_country?: string;
  freelancer_currency?: string;
  // FX fields
  payment_currency?: string;
  payment_amount_minor?: number;
  amount_usd_minor?: number;
  fx_rate_applied?: number;
  fx_spread_percent?: number;
  fx_spread_amount_usd_minor?: number;
}

interface LedgerTransaction {
  id: string;
  user_id: string;
  tx_type: string;
  amount: number;
  currency: string;
  context: string | null;
  created_at: string;
  // FX fields
  payment_currency?: string;
  payment_amount_minor?: number;
  payment_method?: string;
  gateway_provider?: string;
  amount_usd_minor?: number;
  fx_rate_applied?: number;
  fx_spread_percent?: number;
  fx_spread_amount_usd_minor?: number;
}

interface FinancialSummary {
  total_credits_usd: number;
  total_earnings_usd: number;
  total_escrow_usd: number;
  pending_withdrawals: number;
  pending_withdrawal_amount_usd: number;
  approved_withdrawals: number;
  approved_withdrawal_amount_usd: number;
  paid_withdrawals: number;
  paid_withdrawal_amount_usd: number;
  total_fx_spread_usd: number;
}

type DateFilterOption = "today" | "7days" | "30days" | "90days" | "1year" | "all";

export default function AdminFinances() {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary>({
    total_credits_usd: 0,
    total_earnings_usd: 0,
    total_escrow_usd: 0,
    pending_withdrawals: 0,
    pending_withdrawal_amount_usd: 0,
    approved_withdrawals: 0,
    approved_withdrawal_amount_usd: 0,
    paid_withdrawals: 0,
    paid_withdrawal_amount_usd: 0,
    total_fx_spread_usd: 0,
  });
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<string>("pending_review");
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");
  
  const [processingWithdrawal, setProcessingWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingAction, setProcessingAction] = useState<"approved" | "paid" | "rejected" | null>(null);

  const getDateRange = (filter: DateFilterOption): { start: Date | null; end: Date } => {
    const now = new Date();
    const end = endOfDay(now);
    
    switch (filter) {
      case "today":
        return { start: startOfDay(now), end };
      case "7days":
        return { start: startOfDay(subDays(now, 7)), end };
      case "30days":
        return { start: startOfDay(subMonths(now, 1)), end };
      case "90days":
        return { start: startOfDay(subMonths(now, 3)), end };
      case "1year":
        return { start: startOfDay(subYears(now, 1)), end };
      case "all":
      default:
        return { start: null, end };
    }
  };

  useEffect(() => {
    fetchData();
  }, [userTypeFilter, withdrawalStatusFilter, dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSummary(),
        fetchBalances(),
        fetchWithdrawals(),
        fetchRecentTransactions(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    let balanceQuery = supabase
      .from("user_balances")
      .select("credits_available, earnings_available, escrow_held, user_type, currency, updated_at");
    
    const { start } = getDateRange(dateFilter);
    if (start) {
      balanceQuery = balanceQuery.gte("updated_at", start.toISOString());
    }
    
    const { data: balanceData } = await balanceQuery;
    
    // Fetch all withdrawal data with FX fields
    let baseWithdrawalQuery = supabase
      .from("withdrawal_requests")
      .select("amount, status, created_at, currency, amount_usd_minor, fx_spread_amount_usd_minor");
    
    if (start) {
      baseWithdrawalQuery = baseWithdrawalQuery.gte("created_at", start.toISOString());
    }
    
    const { data: allWithdrawals } = await baseWithdrawalQuery;
    
    const pendingWithdrawals = allWithdrawals?.filter(w => w.status === "pending_review") || [];
    const approvedWithdrawals = allWithdrawals?.filter(w => w.status === "approved") || [];
    const paidWithdrawals = allWithdrawals?.filter(w => w.status === "paid") || [];
    
    // Calculate total FX spread earned
    const totalFxSpread = (allWithdrawals || []).reduce((sum, w) => 
      sum + Number(w.fx_spread_amount_usd_minor || 0), 0);
    
    if (balanceData) {
      // All amounts in user_balances are already in cents (or minor units)
      const totals = balanceData.reduce(
        (acc, b) => ({
          total_credits_usd: acc.total_credits_usd + Number(b.credits_available || 0),
          total_earnings_usd: acc.total_earnings_usd + Number(b.earnings_available || 0),
          // Only count escrow from companies
          total_escrow_usd: acc.total_escrow_usd + (b.user_type === 'company' ? Number(b.escrow_held || 0) : 0),
        }),
        { total_credits_usd: 0, total_earnings_usd: 0, total_escrow_usd: 0 }
      );
      
      // For withdrawals, use amount_usd_minor if available, fallback to amount
      const calcWithdrawalAmount = (withdrawals: any[]) => 
        withdrawals.reduce((sum, w) => sum + Number(w.amount_usd_minor || w.amount), 0);
      
      setSummary({
        ...totals,
        pending_withdrawals: pendingWithdrawals.length,
        pending_withdrawal_amount_usd: calcWithdrawalAmount(pendingWithdrawals),
        approved_withdrawals: approvedWithdrawals.length,
        approved_withdrawal_amount_usd: calcWithdrawalAmount(approvedWithdrawals),
        paid_withdrawals: paidWithdrawals.length,
        paid_withdrawal_amount_usd: calcWithdrawalAmount(paidWithdrawals),
        total_fx_spread_usd: totalFxSpread,
      });
    }
  };

  const fetchBalances = async () => {
    let query = supabase
      .from("user_balances")
      .select("*")
      .order("updated_at", { ascending: false });
    
    if (userTypeFilter !== "all") {
      query = query.eq("user_type", userTypeFilter);
    }
    
    const { start } = getDateRange(dateFilter);
    if (start) {
      query = query.gte("updated_at", start.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching balances:", error);
      return;
    }
    
    const enrichedBalances = await Promise.all(
      (data || []).map(async (balance) => {
        let email = "";
        let name = "";
        let country_code = "";
        let currency_code = "";
        
        if (balance.user_type === "freelancer") {
          const { data: profile } = await supabase
            .from("freelancer_profiles")
            .select("full_name, country_code, currency_code, country")
            .eq("user_id", balance.user_id)
            .single();
          name = profile?.full_name || "";
          country_code = profile?.country_code || profile?.country || "";
          currency_code = profile?.currency_code || "USD";
        } else {
          const { data: profile } = await supabase
            .from("company_profiles")
            .select("company_name, contact_name, country")
            .eq("user_id", balance.user_id)
            .single();
          name = profile?.company_name || profile?.contact_name || "";
          country_code = profile?.country || "";
        }
        
        const { data: profileData } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", balance.user_id)
          .single();
        email = profileData?.email || "";
        
        return { ...balance, email, name, country_code, currency_code };
      })
    );
    
    setBalances(enrichedBalances);
  };

  const fetchWithdrawals = async () => {
    let query = supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (withdrawalStatusFilter !== "all") {
      query = query.eq("status", withdrawalStatusFilter as any);
    }
    
    const { start } = getDateRange(dateFilter);
    if (start) {
      query = query.gte("created_at", start.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching withdrawals:", error);
      return;
    }
    
    const enrichedWithdrawals = await Promise.all(
      (data || []).map(async (withdrawal) => {
        const { data: profile } = await supabase
          .from("freelancer_profiles")
          .select("full_name, country_code, currency_code, country")
          .eq("user_id", withdrawal.freelancer_user_id)
          .single();
        
        const { data: profileData } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", withdrawal.freelancer_user_id)
          .single();
        
        return {
          ...withdrawal,
          freelancer_name: profile?.full_name || "",
          freelancer_email: profileData?.email || "",
          freelancer_country: profile?.country_code || profile?.country || "",
          freelancer_currency: profile?.currency_code || "USD",
        };
      })
    );
    
    setWithdrawals(enrichedWithdrawals);
  };

  const fetchRecentTransactions = async () => {
    let query = supabase
      .from("ledger_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    
    const { start } = getDateRange(dateFilter);
    if (start) {
      query = query.gte("created_at", start.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching transactions:", error);
      return;
    }
    
    setTransactions(data || []);
  };

  const handleProcessWithdrawal = async () => {
    if (!processingWithdrawal || !processingAction) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Não autenticado");
        return;
      }
      
      const { error } = await supabase.rpc("process_withdrawal", {
        p_withdrawal_id: processingWithdrawal.id,
        p_new_status: processingAction as "approved" | "paid" | "rejected",
        p_admin_id: user.id,
        p_admin_notes: adminNotes || null,
      } as any);
      
      if (error) throw error;
      
      toast.success(`Saque ${processingAction === "paid" ? "marcado como pago" : processingAction === "approved" ? "aprovado" : "rejeitado"}`);
      setProcessingWithdrawal(null);
      setAdminNotes("");
      setProcessingAction(null);
      fetchData();
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      toast.error("Erro ao processar saque");
    }
  };

  const filteredBalances = balances.filter((b) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      b.email?.toLowerCase().includes(query) ||
      b.name?.toLowerCase().includes(query) ||
      b.user_id.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "paid":
        return <Badge variant="default" className="bg-green-600"><DollarSign className="h-3 w-3 mr-1" />Pago</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTxTypeBadge = (txType: string) => {
    const colors: Record<string, string> = {
      topup_credit: "bg-green-100 text-green-800",
      spend_credit: "bg-orange-100 text-orange-800",
      contract_funding: "bg-blue-100 text-blue-800",
      escrow_release: "bg-purple-100 text-purple-800",
      withdrawal_request: "bg-yellow-100 text-yellow-800",
      withdrawal_paid: "bg-gray-100 text-gray-800",
      refund: "bg-red-100 text-red-800",
      adjustment: "bg-gray-100 text-gray-800",
    };
    
    const labels: Record<string, string> = {
      topup_credit: "Top-up",
      spend_credit: "Gasto",
      contract_funding: "Financiamento",
      escrow_release: "Liberação",
      withdrawal_request: "Saque Solicitado",
      withdrawal_paid: "Saque Pago",
      refund: "Reembolso",
      adjustment: "Ajuste",
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[txType] || "bg-gray-100"}`}>
        {labels[txType] || txType}
      </span>
    );
  };

  // Render dual currency display (original + USD)
  const renderDualCurrency = (
    amountUsdMinor: number | undefined | null, 
    paymentAmountMinor: number | undefined | null, 
    paymentCurrency: string | undefined | null
  ) => {
    const hasOriginal = paymentAmountMinor && paymentCurrency && paymentCurrency !== 'USD';
    
    return (
      <div className="text-right">
        <div className="font-mono font-bold">
          {formatMoneyFromCents(amountUsdMinor || 0, "USD")}
        </div>
        {hasOriginal && (
          <div className="text-xs text-muted-foreground">
            ({formatMoneyFromCents(paymentAmountMinor, paymentCurrency)})
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Finanças</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestão de créditos, ganhos e saques da plataforma (valores em USD)
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterOption)}>
            <SelectTrigger className="w-32 md:w-40">
              <Calendar className="h-4 w-4 mr-1 md:mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">7 dias</SelectItem>
              <SelectItem value="30days">30 dias</SelectItem>
              <SelectItem value="90days">3 meses</SelectItem>
              <SelectItem value="1year">1 ano</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchData} variant="outline" disabled={loading} size="sm" className="md:size-default">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline ml-2">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards - All in USD */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium truncate pr-1">Total Créditos</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold truncate">{formatMoneyFromCents(summary.total_credits_usd, "USD")}</div>
            <p className="text-xs text-muted-foreground">Não sacáveis</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ganhos</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatMoneyFromCents(summary.total_earnings_usd, "USD")}</div>
            <p className="text-xs text-muted-foreground">Sacáveis</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Escrow</CardTitle>
            <Lock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatMoneyFromCents(summary.total_escrow_usd, "USD")}</div>
            <p className="text-xs text-muted-foreground">Total em contratos</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saques Pendentes</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.pending_withdrawals}</div>
            <p className="text-xs text-muted-foreground">
              {formatMoneyFromCents(summary.pending_withdrawal_amount_usd, "USD")} total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saques Aprovados</CardTitle>
            <Check className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.approved_withdrawals}</div>
            <p className="text-xs text-muted-foreground">
              {formatMoneyFromCents(summary.approved_withdrawal_amount_usd, "USD")} total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita FX Spread</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatMoneyFromCents(summary.total_fx_spread_usd, "USD")}</div>
            <p className="text-xs text-muted-foreground">Ganho com câmbio</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="balances" className="space-y-4">
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1 md:w-auto md:flex-nowrap">
          <TabsTrigger value="balances" className="text-xs md:text-sm">Saldos</TabsTrigger>
          <TabsTrigger value="withdrawals" className="text-xs md:text-sm">
            Saques
            {summary.pending_withdrawals > 0 && (
              <Badge variant="destructive" className="ml-1 md:ml-2 text-xs">{summary.pending_withdrawals}</Badge>
            )}
          </TabsTrigger>
         <TabsTrigger value="transactions" className="text-xs md:text-sm">Transações</TabsTrigger>
          <TabsTrigger value="payment-fees" className="text-xs md:text-sm">
            <Settings2 className="h-3 w-3 md:h-4 md:w-4 mr-1" />
            Taxas
          </TabsTrigger>
          <TabsTrigger value="fx-settings" className="text-xs md:text-sm">
            <Settings2 className="h-3 w-3 md:h-4 md:w-4 mr-1" />
            <span className="hidden sm:inline">FX</span> Spread
          </TabsTrigger>
          <TabsTrigger value="action-costs" className="text-xs md:text-sm">
            <Coins className="h-3 w-3 md:h-4 md:w-4 mr-1" />
            Custos Ações
          </TabsTrigger>
        </TabsList>

        {/* Balances Tab */}
        <TabsContent value="balances" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por email ou nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="freelancer">Freelancers</SelectItem>
                <SelectItem value="company">Empresas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>País/Moeda</TableHead>
                  <TableHead className="text-right">Créditos (USD)</TableHead>
                  <TableHead className="text-right">Ganhos (USD)</TableHead>
                  <TableHead className="text-right">Escrow (USD)</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBalances.map((balance) => (
                  <TableRow key={balance.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{balance.name || "—"}</p>
                        <p className="text-sm text-muted-foreground">{balance.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {balance.user_type === "freelancer" ? (
                        <Badge variant="outline"><User className="h-3 w-3 mr-1" />Freelancer</Badge>
                      ) : (
                        <Badge variant="outline"><Building2 className="h-3 w-3 mr-1" />Empresa</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {balance.country_code && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1">
                                <Globe className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{balance.country_code}</span>
                                {balance.currency_code && (
                                  <Badge variant="secondary" className="text-xs ml-1">{balance.currency_code}</Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              País: {balance.country_code}, Moeda preferida: {balance.currency_code || 'USD'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {!balance.country_code && <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoneyFromCents(Number(balance.credits_available), "USD")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatMoneyFromCents(Number(balance.earnings_available), "USD")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-blue-600">
                      {formatMoneyFromCents(Number(balance.escrow_held), "USD")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(balance.updated_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBalances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum saldo encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals" className="space-y-4">
          <div className="flex gap-4">
            <Select value={withdrawalStatusFilter} onValueChange={setWithdrawalStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending_review">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Freelancer</TableHead>
                  <TableHead>País/Moeda</TableHead>
                  <TableHead className="text-right">Valor (USD)</TableHead>
                  <TableHead className="text-right">Valor Original</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{withdrawal.freelancer_name || "—"}</p>
                        <p className="text-sm text-muted-foreground">{withdrawal.freelancer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{withdrawal.freelancer_country || "—"}</span>
                        <Badge variant="secondary" className="text-xs ml-1">{withdrawal.freelancer_currency || "USD"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatMoneyFromCents(
                        withdrawal.amount_usd_minor || Number(withdrawal.amount), 
                        "USD"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {withdrawal.payment_amount_minor && withdrawal.payment_currency && withdrawal.payment_currency !== 'USD' ? (
                        <div>
                          <span className="font-mono text-sm">
                            {formatMoneyFromCents(withdrawal.payment_amount_minor, withdrawal.payment_currency)}
                          </span>
                          {withdrawal.fx_rate_applied && (
                            <p className="text-xs text-muted-foreground">
                              Taxa: {withdrawal.fx_rate_applied.toFixed(4)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {withdrawal.payout_details?.type === "pix" ? (
                          <div>
                            <p className="font-medium">PIX</p>
                            <p className="text-muted-foreground text-xs">
                              {withdrawal.payout_details?.pix_key_type}: {withdrawal.payout_details?.pix_key}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">Banco</p>
                            <p className="text-muted-foreground text-xs">
                              {withdrawal.payout_details?.bank_name} - Ag {withdrawal.payout_details?.branch} / CC {withdrawal.payout_details?.account}
                            </p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(withdrawal.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {withdrawal.status === "pending_review" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => {
                              setProcessingWithdrawal(withdrawal);
                              setProcessingAction("approved");
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => {
                              setProcessingWithdrawal(withdrawal);
                              setProcessingAction("rejected");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {withdrawal.status === "approved" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setProcessingWithdrawal(withdrawal);
                            setProcessingAction("paid");
                          }}
                        >
                          Marcar Pago
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {withdrawals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum saque encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Últimas Transações</CardTitle>
              <CardDescription>Histórico completo do ledger (valores internos em USD)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-right">Valor USD</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead>Contexto</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{getTxTypeBadge(tx.tx_type)}</TableCell>
                      <TableCell>
                        {tx.gateway_provider ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {tx.gateway_provider}
                            </Badge>
                            {tx.payment_method && (
                              <span className="text-xs text-muted-foreground">
                                ({tx.payment_method})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tx.user_id.slice(0, 8)}...</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${Number(tx.amount_usd_minor || tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(tx.amount_usd_minor || tx.amount) >= 0 ? "+" : ""}
                        {formatMoneyFromCents(Math.abs(Number(tx.amount_usd_minor || tx.amount)), "USD")}
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.payment_currency && tx.payment_amount_minor && tx.payment_currency !== 'USD' ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="text-xs text-muted-foreground">
                                  {formatMoneyFromCents(tx.payment_amount_minor, tx.payment_currency)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <p>Taxa: {tx.fx_rate_applied?.toFixed(4) || 'N/A'}</p>
                                  {tx.fx_spread_amount_usd_minor && (
                                    <p>Spread: {formatMoneyFromCents(tx.fx_spread_amount_usd_minor, 'USD')}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{tx.context || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(tx.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma transação encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
       </TabsContent>

        {/* Payment Fees Tab */}
        <TabsContent value="payment-fees" className="space-y-6">
          <PaymentFeeSettings />
        </TabsContent>

        {/* FX Settings Tab */}
        <TabsContent value="fx-settings" className="space-y-6">
          <FinancialAlertsCard />
          <FxSpreadSettings />
          <FxRevenueReport />
        </TabsContent>

        {/* Action Costs Tab */}
        <TabsContent value="action-costs" className="space-y-6">
          <ActionCostsManager />
        </TabsContent>
      </Tabs>

      {/* Withdrawal Processing Modal */}
      <Dialog open={!!processingWithdrawal} onOpenChange={() => {
        setProcessingWithdrawal(null);
        setAdminNotes("");
        setProcessingAction(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {processingAction === "paid" ? "Marcar como Pago" : 
               processingAction === "approved" ? "Aprovar Saque" : "Rejeitar Saque"}
            </DialogTitle>
            <DialogDescription>
              {processingWithdrawal && (
                <div className="mt-2 space-y-2">
                  <p><strong>Freelancer:</strong> {processingWithdrawal.freelancer_name}</p>
                  <p><strong>País/Moeda:</strong> {processingWithdrawal.freelancer_country || '—'} / {processingWithdrawal.freelancer_currency || 'USD'}</p>
                  <p><strong>Valor USD:</strong> {formatMoneyFromCents(processingWithdrawal.amount_usd_minor || Number(processingWithdrawal.amount), "USD")}</p>
                  {processingWithdrawal.payment_amount_minor && processingWithdrawal.payment_currency && processingWithdrawal.payment_currency !== 'USD' && (
                    <p><strong>Valor Original:</strong> {formatMoneyFromCents(processingWithdrawal.payment_amount_minor, processingWithdrawal.payment_currency)}</p>
                  )}
                  {processingWithdrawal.payout_details?.type === "pix" ? (
                    <p><strong>PIX:</strong> {processingWithdrawal.payout_details?.pix_key}</p>
                  ) : (
                    <p><strong>Conta:</strong> {processingWithdrawal.payout_details?.bank_name} - {processingWithdrawal.payout_details?.account}</p>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas do Admin (opcional)</label>
              <Textarea
                placeholder="Adicione notas sobre esta ação..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setProcessingWithdrawal(null);
              setAdminNotes("");
              setProcessingAction(null);
            }}>
              Cancelar
            </Button>
            <Button
              variant={processingAction === "rejected" ? "destructive" : "default"}
              onClick={handleProcessWithdrawal}
            >
              {processingAction === "paid" ? "Confirmar Pagamento" :
               processingAction === "approved" ? "Aprovar" : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}