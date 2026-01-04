import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Search, FileText, MessageSquare, DollarSign, ArrowRight, Briefcase } from "lucide-react";

export default function FreelancerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stats = [
    { label: t("freelancerDashboard.activeProjects"), value: "0", icon: Briefcase, color: "text-primary" },
    { label: t("freelancerDashboard.pendingProposals"), value: "0", icon: FileText, color: "text-secondary" },
    { label: t("freelancerDashboard.messages"), value: "0", icon: MessageSquare, color: "text-accent-foreground" },
    { label: t("freelancerDashboard.totalEarnings"), value: "$0", icon: DollarSign, color: "text-green-500" },
  ];

  const quickActions = [
    { label: t("freelancerDashboard.findProjects"), icon: Search, path: "/find-projects", primary: true },
    { label: t("freelancerDashboard.myProposals"), icon: FileText, path: "/my-proposals" },
    { label: t("freelancerDashboard.viewMessages"), icon: MessageSquare, path: "/messages" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("freelancerDashboard.welcome")}</h1>
        <p className="text-muted-foreground mt-1">{t("freelancerDashboard.subtitle")}</p>
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
