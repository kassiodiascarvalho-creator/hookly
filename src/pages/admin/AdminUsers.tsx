import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, FileText, Coins } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDataCard, MobileDataRow } from "@/components/admin/MobileDataCard";
import { UserCreditStatementModal } from "@/components/admin/UserCreditStatementModal";
import { formatMoneyFromCents } from "@/lib/formatMoney";

interface ProfileWithCredits {
  id: string;
  user_id: string;
  email: string;
  user_type: string | null;
  role: string;
  preferred_language: string;
  created_at: string;
  // Credit stats
  total_paid_usd: number;
  total_paid_by_currency: Record<string, number>;
  total_credits_granted: number;
  current_balance: number;
  last_purchase_at: string | null;
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<ProfileWithCredits[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [statementModalOpen, setStatementModalOpen] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        // Fetch base profiles
        const { data: profilesData, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Credit payment types for fallback query
        const CREDIT_PAYMENT_TYPES = [
          "freelancer_credits",
          "company_credits", 
          "platform_credits",
          "company_wallet"
        ];

        // Enrich with credit data
        const enrichedProfiles = await Promise.all(
          (profilesData || []).map(async (profile) => {
            // Fetch credit balance (INTEGER credits: 1 credit = $1 USD)
            // platform_credits is the SINGLE source of truth for platform credits
            const { data: platformCredits } = await supabase
              .from("platform_credits")
              .select("balance")
              .eq("user_id", profile.user_id)
              .maybeSingle();

            const currentBalance = platformCredits?.balance || 0;

            // Try credit_purchases first (primary source)
            const { data: purchases } = await supabase
              .from("credit_purchases")
              .select("amount_paid_minor, currency_paid, credits_granted, confirmed_at")
              .eq("user_id", profile.user_id)
              .eq("status", "confirmed")
              .order("confirmed_at", { ascending: false });

            const confirmedPurchases = purchases || [];
            
            // Calculate totals from credit_purchases or fallback to unified_payments
            let totalPaidByCurrency: Record<string, number> = {};
            let totalCreditsGranted = 0;
            let lastPurchaseAt: string | null = null;

            if (confirmedPurchases.length > 0) {
              // Use credit_purchases data
              confirmedPurchases.forEach((p) => {
                const currency = p.currency_paid || "USD";
                totalPaidByCurrency[currency] = (totalPaidByCurrency[currency] || 0) + p.amount_paid_minor;
                totalCreditsGranted += p.credits_granted;
              });
              lastPurchaseAt = confirmedPurchases[0]?.confirmed_at || null;
            } else {
              // Fallback: use unified_payments
              const { data: unifiedPayments } = await supabase
                .from("unified_payments")
                .select("payment_amount_minor, amount_cents, payment_currency, currency, credits_amount, paid_at")
                .eq("user_id", profile.user_id)
                .eq("status", "paid")
                .in("payment_type", CREDIT_PAYMENT_TYPES)
                .order("paid_at", { ascending: false });

              (unifiedPayments || []).forEach((p) => {
                const amount = p.payment_amount_minor ?? p.amount_cents;
                const currency = p.payment_currency || p.currency || "USD";
                totalPaidByCurrency[currency] = (totalPaidByCurrency[currency] || 0) + amount;
                totalCreditsGranted += p.credits_amount || 0;
              });
              lastPurchaseAt = unifiedPayments?.[0]?.paid_at || null;
            }

            return {
              ...profile,
              total_paid_usd: totalPaidByCurrency["USD"] || 0,
              total_paid_by_currency: totalPaidByCurrency,
              total_credits_granted: totalCreditsGranted,
              current_balance: currentBalance,
              last_purchase_at: lastPurchaseAt,
            };
          })
        );

        setProfiles(enrichedProfiles);
      } catch (error) {
        console.error("Error fetching profiles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.email.toLowerCase().includes(search.toLowerCase()) ||
      profile.user_type?.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewStatement = (userId: string) => {
    setSelectedUserId(userId);
    setStatementModalOpen(true);
  };

  const formatTotalPaid = (profile: ProfileWithCredits) => {
    const currencies = Object.keys(profile.total_paid_by_currency);
    if (currencies.length === 0) return "-";
    
    return currencies.map((currency) => (
      <div key={currency} className="text-xs">
        {formatMoneyFromCents(profile.total_paid_by_currency[currency], currency)}
      </div>
    ));
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("admin.users")}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t("admin.usersDescription")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg md:text-xl">{t("admin.allUsers")}</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.searchUsers")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isMobile ? (
            // Mobile view - card layout
            <div className="space-y-3">
              {filteredProfiles.map((profile) => (
                <MobileDataCard key={profile.id}>
                  <div className="font-medium text-sm break-all">{profile.email}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant={profile.user_type === "company" ? "default" : "secondary"}>
                      {profile.user_type || "-"}
                    </Badge>
                    <Badge variant={profile.role === "admin" ? "destructive" : "outline"}>
                      {profile.role}
                    </Badge>
                  </div>
                  <MobileDataRow label="Total Pago">
                    {formatTotalPaid(profile)}
                  </MobileDataRow>
                  <MobileDataRow label="Créditos Recebidos">
                    {profile.total_credits_granted > 0 ? profile.total_credits_granted : "-"}
                  </MobileDataRow>
                  <MobileDataRow label="Saldo Atual">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {profile.current_balance}
                    </span>
                  </MobileDataRow>
                  <MobileDataRow label={t("admin.createdAt")}>
                    {format(new Date(profile.created_at), "PP")}
                  </MobileDataRow>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => handleViewStatement(profile.user_id)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Extrato
                  </Button>
                </MobileDataCard>
              ))}
              {filteredProfiles.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  {t("admin.noUsersFound")}
                </div>
              )}
            </div>
          ) : (
            // Desktop view - table
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.email")}</TableHead>
                  <TableHead>{t("admin.userType")}</TableHead>
                  <TableHead>{t("admin.role")}</TableHead>
                  <TableHead className="text-right">Total Pago</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Última Compra</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
                    <TableCell>
                      <Badge variant={profile.user_type === "company" ? "default" : "secondary"}>
                        {profile.user_type || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile.role === "admin" ? "destructive" : "outline"}>
                        {profile.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatTotalPaid(profile)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {profile.total_credits_granted > 0 ? profile.total_credits_granted : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Coins className="h-3 w-3 text-muted-foreground" />
                        {profile.current_balance}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {profile.last_purchase_at 
                        ? format(new Date(profile.last_purchase_at), "dd/MM/yy")
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewStatement(profile.user_id)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProfiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {t("admin.noUsersFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Statement Modal */}
      <UserCreditStatementModal
        userId={selectedUserId}
        open={statementModalOpen}
        onOpenChange={setStatementModalOpen}
      />
    </div>
  );
}
