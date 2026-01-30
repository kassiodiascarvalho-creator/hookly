import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Search, FileText, MessageSquare, DollarSign, ArrowRight, Briefcase, Loader2, Rocket, Star, Sparkles, TrendingUp } from "lucide-react";
import { AchievementsCard } from "@/components/achievements";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/formatMoney";
import { useLocalCurrencyDisplay } from "@/hooks/useLocalCurrencyDisplay";
import { computeFreelancerCompletion } from "@/lib/profileCompletion";
import { TrustMessage } from "@/components/trust/TrustBadge";
import { TierBadge, FreelancerTier } from "@/components/freelancer/TierBadge";

interface DashboardStats {
  activeProjects: number;
  pendingProposals: number;
  conversations: number;
  totalEarnings: number;
  currency: string;
  profileCompletion: number;
  tier: FreelancerTier;
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
    currency: "USD",
    profileCompletion: 0,
    tier: "standard",
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
        paidWithdrawalsResult,
        freelancerProfileResult,
        portfolioCountResult,
        payoutCountResult
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
          .eq("status", "paid"),
        
        // Freelancer profile for real-time completion calculation
        supabase
          .from("freelancer_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        
        // Portfolio items count
        supabase
          .from("portfolio_items")
          .select("*", { count: "exact", head: true })
          .eq("freelancer_user_id", user.id),
        
        // Payout methods count
        supabase
          .from("payout_methods")
          .select("*", { count: "exact", head: true })
          .eq("freelancer_user_id", user.id)
      ]);

      // Calculate totals
      const activeProjects = contractsResult.count || 0;
      const pendingProposals = proposalsResult.count || 0;
      const conversations = conversationsResult.count || 0;
      
      // user_balances stores values in MAJOR UNITS (numeric with decimals)
      // contracts.amount_cents and withdrawal_requests.amount are in MINOR UNITS (cents)
      const earningsAvailableMajor = Number(balanceResult.data?.earnings_available || 0);
      
      // contracts.amount_cents is stored in MINOR UNITS (cents)
      const contractsEscrowCents = (activeContractsResult.data || [])
        .reduce((sum, c) => sum + (c.amount_cents || 0), 0);
      
      // withdrawal_requests.amount is stored in MAJOR UNITS
      const paidWithdrawalsMajor = (paidWithdrawalsResult.data || [])
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
      
      // Total earnings in MAJOR UNITS = available + contracts escrow (converted) + already withdrawn
      const totalEarningsMajor = earningsAvailableMajor + (contractsEscrowCents / 100) + paidWithdrawalsMajor;
      const currency = balanceResult.data?.currency || "BRL";
      
      // Calculate profile completion in real-time (not from stale database value)
      let profileCompletion = 0;
      if (freelancerProfileResult.data) {
        const completion = computeFreelancerCompletion(
          freelancerProfileResult.data,
          (portfolioCountResult.count || 0) > 0,
          (payoutCountResult.count || 0) > 0
        );
        profileCompletion = completion.percent;
      }

      // Get tier from freelancer profile
      const tier = (freelancerProfileResult.data?.tier as FreelancerTier) || "standard";

      setStats({
        activeProjects,
        pendingProposals,
        conversations,
        totalEarnings: totalEarningsMajor, // Store in MAJOR UNITS
        currency,
        profileCompletion,
        tier,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render earnings with local currency approximation - uses MAJOR UNITS
  const renderEarningsValue = () => {
    if (stats.totalEarnings === 0) {
      return { usdValue: "—", localValue: null };
    }
    // totalEarnings is already in MAJOR UNITS, use formatMoney directly
    const usdValue = formatMoney(stats.totalEarnings, stats.currency);
    // For local currency conversion, convertToLocal expects cents so we multiply by 100
    const localValue = localCurrency !== "USD" && !fxLoading && stats.totalEarnings > 0
      ? `≈ ${formatMoney(convertToLocal(stats.totalEarnings * 100) || 0, localCurrency)}`
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
    { label: t("dashboard.freelancer.quickActions.findProjects"), icon: Search, path: "/find-projects", primary: true },
    { label: t("dashboard.freelancer.quickActions.myProposals"), icon: FileText, path: "/my-proposals" },
    { label: t("dashboard.freelancer.quickActions.viewMessages"), icon: MessageSquare, path: "/messages" },
  ];

  // Smart CTA based on user state
  const getSmartCTA = () => {
    if (stats.profileCompletion < 100) {
      return {
        message: t("dashboard.freelancer.emptyState.profileIncomplete"),
        cta: t("dashboard.freelancer.emptyState.profileIncompleteCta"),
        action: () => navigate("/settings"),
        icon: Star,
        variant: "warning" as const,
      };
    }
    if (stats.pendingProposals === 0 && stats.activeProjects === 0) {
      return {
        message: t("dashboard.freelancer.emptyState.noProposals"),
        cta: t("dashboard.freelancer.emptyState.noProposalsCta"),
        action: () => navigate("/find-projects"),
        icon: Rocket,
        variant: "primary" as const,
      };
    }
    if (stats.activeProjects > 0) {
      return {
        message: `${stats.activeProjects} projeto${stats.activeProjects > 1 ? 's' : ''} em andamento`,
        cta: t("contracts.title", "Ver Contratos"),
        action: () => navigate("/contracts"),
        icon: TrendingUp,
        variant: "success" as const,
      };
    }
    return null;
  };

  const smartCTA = getSmartCTA();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("freelancerDashboard.welcome")}</h1>
          <p className="text-muted-foreground mt-1">{t("freelancerDashboard.subtitle")}</p>
        </div>
        {stats.tier !== "standard" && (
          <TierBadge tier={stats.tier} size="lg" />
        )}
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

      {/* Smart CTA based on user state */}
      {smartCTA && (
        <Card className={`border-primary/20 ${
          smartCTA.variant === 'warning' 
            ? 'bg-gradient-to-r from-amber-500/5 to-orange-500/10 border-amber-500/20' 
            : smartCTA.variant === 'success'
            ? 'bg-gradient-to-r from-emerald-500/5 to-green-500/10 border-emerald-500/20'
            : 'bg-gradient-to-r from-primary/5 to-primary/10'
        }`}>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                smartCTA.variant === 'warning' ? 'bg-amber-500/10' : 
                smartCTA.variant === 'success' ? 'bg-emerald-500/10' : 'bg-primary/10'
              }`}>
                <smartCTA.icon className={`h-6 w-6 ${
                  smartCTA.variant === 'warning' ? 'text-amber-600' : 
                  smartCTA.variant === 'success' ? 'text-emerald-600' : 'text-primary'
                }`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{smartCTA.message}</p>
                <p className="text-sm text-muted-foreground">{smartCTA.cta}</p>
              </div>
              <Button onClick={smartCTA.action} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {smartCTA.cta}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier Status Card (show current tier or upgrade hint) */}
      {stats.profileCompletion === 100 && stats.tier === "standard" && (
        <Card className="border-amber-500/20 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <TierBadge tier={stats.tier} size="sm" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {t("dashboard.freelancer.tierUpgrade.currentTier")}
                  </span>
                </div>
                <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                  {t("dashboard.freelancer.tierUpgrade.upgradeHint")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements Card - My Evolution */}
      <AchievementsCard />

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{t("dashboard.freelancer.quickActions.title")}</CardTitle>
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

      {/* Trust Message */}
      <div className="flex justify-center">
        <TrustMessage messageKey="releaseOnApproval" />
      </div>

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
