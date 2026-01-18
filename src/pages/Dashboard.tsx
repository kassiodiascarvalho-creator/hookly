import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Briefcase, Users, MessageSquare, DollarSign, Plus, ArrowRight } from "lucide-react";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stats = [
    { label: t("dashboard.company.stats.activeProjects"), value: "0", icon: Briefcase, color: "text-primary" },
    { label: t("dashboard.company.stats.pendingProposals"), value: "0", icon: Users, color: "text-secondary" },
    { label: t("dashboard.unreadMessages", "Mensagens"), value: "0", icon: MessageSquare, color: "text-accent-foreground" },
    { label: t("dashboard.company.stats.totalSpent"), value: "$0", icon: DollarSign, color: "text-green-500" },
  ];

  const quickActions = [
    { label: t("dashboard.company.quickActions.newProject"), icon: Plus, path: "/projects/new", primary: true },
    { label: t("dashboard.company.quickActions.findTalent"), icon: Users, path: "/talent-pool" },
    { label: t("dashboard.company.quickActions.viewMessages"), icon: MessageSquare, path: "/messages" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("dashboard.company.welcome")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.companySubtitle", "Gerencie seus projetos e contratações")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
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
