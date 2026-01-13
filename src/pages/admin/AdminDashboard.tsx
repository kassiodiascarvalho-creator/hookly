import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, Building2, Briefcase, CreditCard, Mail, FolderOpen } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalCompanies: number;
  totalFreelancers: number;
  totalProjects: number;
  totalPayments: number;
  totalLeads: number;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalCompanies: 0,
    totalFreelancers: 0,
    totalProjects: 0,
    totalPayments: 0,
    totalLeads: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: usersCount },
          { count: companiesCount },
          { count: freelancersCount },
          { count: projectsCount },
          { count: paymentsCount },
          { count: leadsCount },
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("company_profiles").select("*", { count: "exact", head: true }),
          supabase.from("freelancer_profiles").select("*", { count: "exact", head: true }),
          supabase.from("projects").select("*", { count: "exact", head: true }),
          supabase.from("payments").select("*", { count: "exact", head: true }),
          supabase.from("leads").select("*", { count: "exact", head: true }),
        ]);

        setStats({
          totalUsers: usersCount || 0,
          totalCompanies: companiesCount || 0,
          totalFreelancers: freelancersCount || 0,
          totalProjects: projectsCount || 0,
          totalPayments: paymentsCount || 0,
          totalLeads: leadsCount || 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: t("admin.totalUsers"), value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { title: t("admin.totalCompanies"), value: stats.totalCompanies, icon: Building2, color: "text-green-500" },
    { title: t("admin.totalFreelancers"), value: stats.totalFreelancers, icon: Users, color: "text-purple-500" },
    { title: t("admin.totalProjects"), value: stats.totalProjects, icon: FolderOpen, color: "text-orange-500" },
    { title: t("admin.totalPayments"), value: stats.totalPayments, icon: CreditCard, color: "text-pink-500" },
    { title: t("admin.totalLeads"), value: stats.totalLeads, icon: Mail, color: "text-cyan-500" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("admin.dashboard")}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t("admin.dashboardDescription")}</p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-medium truncate pr-2">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 md:h-5 md:w-5 ${stat.color} flex-shrink-0`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">
                {loading ? "..." : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
