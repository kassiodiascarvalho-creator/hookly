import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Briefcase, Users, MessageSquare, DollarSign, Plus, ArrowRight, Sparkles, Rocket, TrendingUp } from "lucide-react";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TrustMessage } from "@/components/trust/TrustBadge";

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [stats, setStats] = useState({
    activeProjects: 0,
    pendingProposals: 0,
    unreadMessages: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [
        { count: projectsCount },
        { count: proposalsCount },
        { count: messagesCount },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("company_user_id", user?.id)
          .in("status", ["open", "in_progress"]),
        supabase
          .from("proposals")
          .select("*, projects!inner(company_user_id)", { count: "exact", head: true })
          .eq("projects.company_user_id", user?.id)
          .eq("status", "sent"),
        supabase
          .from("messages")
          .select("*, conversations!inner(company_user_id)", { count: "exact", head: true })
          .eq("conversations.company_user_id", user?.id)
          .is("read_at", null),
      ]);

      setStats({
        activeProjects: projectsCount || 0,
        pendingProposals: proposalsCount || 0,
        unreadMessages: messagesCount || 0,
        totalSpent: 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: t("dashboard.company.stats.activeProjects"), value: stats.activeProjects, icon: Briefcase, color: "text-primary" },
    { label: t("dashboard.company.stats.pendingProposals"), value: stats.pendingProposals, icon: Users, color: "text-secondary" },
    { label: t("dashboard.unreadMessages", "Mensagens"), value: stats.unreadMessages, icon: MessageSquare, color: "text-accent-foreground" },
    { label: t("dashboard.company.stats.totalSpent"), value: stats.totalSpent > 0 ? `$${stats.totalSpent}` : "—", icon: DollarSign, color: "text-green-500" },
  ];

  const quickActions = [
    { label: t("dashboard.company.quickActions.newProject"), icon: Plus, path: "/projects/new", primary: true },
    { label: t("dashboard.company.quickActions.findTalent"), icon: Users, path: "/talent-pool" },
    { label: t("dashboard.company.quickActions.viewMessages"), icon: MessageSquare, path: "/messages" },
  ];

  // Determine which CTA to show based on user state
  const getSmartCTA = () => {
    if (stats.activeProjects === 0) {
      return {
        message: t("dashboard.company.emptyState.noProjects"),
        cta: t("dashboard.company.emptyState.noProjectsCta"),
        action: () => navigate("/projects/new"),
        icon: Rocket,
      };
    }
    if (stats.pendingProposals > 0) {
      return {
        message: t("dashboard.company.emptyState.noProposals", { count: stats.pendingProposals }),
        cta: t("proposals.title", "Ver Propostas"),
        action: () => navigate("/proposals"),
        icon: TrendingUp,
      };
    }
    return null;
  };

  const smartCTA = getSmartCTA();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("dashboard.company.welcome")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.companySubtitle", "Gerencie seus projetos e contratações")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{loading ? "..." : stat.value}</p>
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
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <smartCTA.icon className="h-6 w-6 text-primary" />
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

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{t("dashboard.company.quickActions.title")}</CardTitle>
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
        <TrustMessage messageKey="escrowProtection" />
      </div>

      {/* Recent Activity */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("dashboard.recentActivity", "Atividade Recente")}</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1">
            {t("common.viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("dashboard.noActivity", "Nenhuma atividade recente")}</p>
            <Button variant="link" onClick={() => navigate("/projects/new")} className="mt-2">
              {t("dashboard.createFirstProject", "Criar seu primeiro projeto")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
