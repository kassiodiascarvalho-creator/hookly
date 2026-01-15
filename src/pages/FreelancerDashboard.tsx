import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Search, FileText, MessageSquare, DollarSign, ArrowRight, Briefcase, Loader2 } from "lucide-react";
import { AchievementsCard } from "@/components/achievements";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatMoneyFromCents } from "@/lib/formatMoney";
import { useLocalCurrencyDisplay } from "@/hooks/useLocalCurrencyDisplay";

interface DashboardStats {
  activeProjects: number;
  pendingProposals: number;
  conversations: number;
  totalEarnings: number;
  currency: string;
}

export default function FreelancerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { localCurrency, convertToLocal, loading: fxLoading } = useLocalCurrencyDisplay();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingProposals: 0,
    conversations: 0,
    totalEarnings: 0,
    currency: "USD"
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch all data in parallel
      const [
        contractsResult,
        proposalsResult,
        conversationsResult,
        balanceResult,
        activeContractsResult,
        paidWithdrawalsResult
      ] = await Promise.all([
        // Active contracts (accepted proposals = contracts created)
        supabase
          .from("contracts")
          .select("id", { count: "exact" })
          .eq("freelancer_user_id", user.id)
          .in("status", ["active", "funded"]),
        
        // Pending proposals (sent but not yet accepted/rejected)
        supabase
          .from("proposals")
          .select("id", { count: "exact" })
          .eq("freelancer_user_id", user.id)
          .eq("status", "sent"),
        
        // Conversations count
        supabase
          .from("conversations")
          .select("id", { count: "exact" })
          .eq("freelancer_user_id", user.id),
        
        // User balance (earnings)
        supabase
          .from("user_balances")
          .select("earnings_available, currency")
          .eq("user_id", user.id)
          .eq("user_type", "freelancer")
          .maybeSingle(),
        
        // Active contracts amount (escrow from contracts)
        supabase
          .from("contracts")
          .select("amount_cents")
          .eq("freelancer_user_id", user.id)
          .eq("status", "active"),
        
        // Paid withdrawals (already received)
        supabase
          .from("withdrawal_requests")
          .select("amount")
          .eq("freelancer_user_id", user.id)
          .eq("status", "paid")
      ]);

      // Calculate totals
      const activeProjects = contractsResult.count || 0;
      const pendingProposals = proposalsResult.count || 0;
      const conversations = conversationsResult.count || 0;
      
      // All values are stored in cents - keep in cents for proper formatting
      const earningsAvailable = Number(balanceResult.data?.earnings_available || 0);
      const contractsEscrow = (activeContractsResult.data || [])
        .reduce((sum, c) => sum + (c.amount_cents || 0), 0);
      const paidWithdrawals = (paidWithdrawalsResult.data || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
      
      // Total earnings in cents = available + contracts escrow + already withdrawn
      const totalEarningsCents = earningsAvailable + contractsEscrow + paidWithdrawals;
      const currency = balanceResult.data?.currency || "BRL";

      setStats({
        activeProjects,
        pendingProposals,
        conversations,
        totalEarnings: totalEarningsCents, // Store in cents
        currency
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render earnings with local currency approximation
  const renderEarningsValue = () => {
    const usdValue = formatMoneyFromCents(stats.totalEarnings, stats.currency);
    const localValue = localCurrency !== "USD" && !fxLoading && stats.totalEarnings > 0
      ? `≈ ${formatMoney(convertToLocal(stats.totalEarnings) || 0, localCurrency)}`
      : null;
    
    return { usdValue, localValue };
  };

  const earningsDisplay = renderEarningsValue();

  const statsDisplay = [
    { label: t("freelancerDashboard.activeProjects"), value: stats.activeProjects.toString(), icon: Briefcase, color: "text-primary" },
    { label: t("freelancerDashboard.pendingProposals"), value: stats.pendingProposals.toString(), icon: FileText, color: "text-secondary" },
    { label: t("freelancerDashboard.messages"), value: stats.conversations.toString(), icon: MessageSquare, color: "text-accent-foreground" },
    { 
      label: t("freelancerDashboard.totalEarnings"), 
      value: earningsDisplay.usdValue, 
      subValue: earningsDisplay.localValue,
      icon: DollarSign, 
      color: "text-green-500" 
    },
  ];

  const quickActions = [
    { label: t("freelancerDashboard.findProjects"), icon: Search, path: "/find-projects", primary: true },
    { label: t("freelancerDashboard.myProposals"), icon: FileText, path: "/my-proposals" },
    { label: t("freelancerDashboard.viewMessages"), icon: MessageSquare, path: "/messages" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("freelancerDashboard.welcome")}</h1>
        <p className="text-muted-foreground mt-1">{t("freelancerDashboard.subtitle")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsDisplay.map((stat, idx) => (
          <Card key={idx} className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  {/* Show local currency approximation for earnings */}
                  {'subValue' in stat && stat.subValue && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {stat.subValue}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profile Completion Card */}
      <ProfileCompletionCard />

      {/* Achievements Card - My Evolution */}
      <AchievementsCard />

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{t("freelancerDashboard.quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.primary ? "default" : "outline"}
                onClick={() => navigate(action.path)}
                className="gap-2"
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Projects Preview */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("freelancerDashboard.recommendedProjects")}</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/find-projects")}>
            {t("common.viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("freelancerDashboard.noProjects")}</p>
            <Button variant="link" onClick={() => navigate("/find-projects")} className="mt-2">
              {t("freelancerDashboard.browseProjects")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
