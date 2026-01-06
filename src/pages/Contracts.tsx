import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, Building2, User, Calendar, DollarSign, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  milestones: any[];
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  project_id: string;
  company_user_id: string;
  freelancer_user_id: string;
  company_name?: string;
  freelancer_name?: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  funded: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function Contracts() {
  const { t } = useTranslation();
  const { user, userType } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      fetchContracts();
    }
  }, [user]);

  const fetchContracts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch related names
      const contractsWithNames = await Promise.all(
        (data || []).map(async (contract) => {
          let company_name = "";
          let freelancer_name = "";

          // Fetch company name
          const { data: companyData } = await supabase
            .from("company_profiles")
            .select("company_name")
            .eq("user_id", contract.company_user_id)
            .single();
          company_name = companyData?.company_name || "Unknown Company";

          // Fetch freelancer name
          const { data: freelancerData } = await supabase
            .from("freelancer_profiles")
            .select("full_name")
            .eq("user_id", contract.freelancer_user_id)
            .single();
          freelancer_name = freelancerData?.full_name || "Unknown Freelancer";

          return {
            ...contract,
            milestones: Array.isArray(contract.milestones) ? contract.milestones : [],
            company_name,
            freelancer_name,
          };
        })
      );

      setContracts(contractsWithNames);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    if (activeTab === "all") return true;
    return contract.status === activeTab;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: t("contracts.statusDraft"),
      active: t("contracts.statusActive"),
      funded: t("contracts.statusFunded"),
      completed: t("contracts.statusCompleted"),
      cancelled: t("contracts.statusCancelled"),
    };
    return labels[status] || status;
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
        <h1 className="text-3xl font-bold">{t("contracts.title")}</h1>
        <p className="text-muted-foreground">{t("contracts.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t("contracts.all")}</TabsTrigger>
          <TabsTrigger value="active">{t("contracts.active")}</TabsTrigger>
          <TabsTrigger value="funded">{t("contracts.funded")}</TabsTrigger>
          <TabsTrigger value="completed">{t("contracts.completed")}</TabsTrigger>
          <TabsTrigger value="cancelled">{t("contracts.cancelled")}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredContracts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t("contracts.noContracts")}</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {t("contracts.noContractsDesc")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredContracts.map((contract) => (
                <Card key={contract.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{contract.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {contract.description}
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[contract.status] || "bg-muted"}>
                        {getStatusLabel(contract.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatMoney(contract.amount_cents / 100, contract.currency)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{contract.company_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{contract.freelancer_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(contract.created_at), "dd/MM/yyyy")}</span>
                      </div>
                    </div>

                    {contract.milestones.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">
                          {t("contracts.milestones")} ({contract.milestones.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {contract.milestones.slice(0, 3).map((milestone: any, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {milestone.title} - {formatMoney(milestone.amount || 0, contract.currency)}
                            </Badge>
                          ))}
                          {contract.milestones.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{contract.milestones.length - 3} {t("contracts.more")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/projects/${contract.project_id}`)}
                      >
                        {t("contracts.viewProject")}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
