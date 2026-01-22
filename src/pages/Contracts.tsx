import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, FileText, Building2, User, Calendar, DollarSign, 
  ChevronRight, CheckCircle, Clock, AlertTriangle
} from "lucide-react";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ContractAcceptanceModal } from "@/components/contracts/ContractAcceptanceModal";

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  milestones: any[];
  deadline: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  company_accepted_at: string | null;
  freelancer_accepted_at: string | null;
  project_id: string;
  company_user_id: string;
  freelancer_user_id: string;
  was_counterproposal?: boolean;
  agreed_amount_cents?: number | null;
  original_proposal_amount_cents?: number | null;
  company_name?: string;
  freelancer_name?: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_acceptance: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  funded: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function Contracts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
          company_name = companyData?.company_name || "Empresa";

          // Fetch freelancer name
          const { data: freelancerData } = await supabase
            .from("freelancer_profiles")
            .select("full_name")
            .eq("user_id", contract.freelancer_user_id)
            .single();
          freelancer_name = freelancerData?.full_name || "Freelancer";

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
    if (activeTab === "pending") {
      return contract.status === "draft" || contract.status === "pending_acceptance";
    }
    return contract.status === activeTab;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Rascunho",
      pending_acceptance: "Aguardando Aceites",
      active: t("contracts.statusActive"),
      funded: t("contracts.statusFunded"),
      completed: t("contracts.statusCompleted"),
      cancelled: t("contracts.statusCancelled"),
    };
    return labels[status] || status;
  };

  const getAcceptanceStatus = (contract: Contract) => {
    const isCompany = user?.id === contract.company_user_id;
    const userAccepted = isCompany ? contract.company_accepted_at : contract.freelancer_accepted_at;
    const otherAccepted = isCompany ? contract.freelancer_accepted_at : contract.company_accepted_at;
    
    return { userAccepted: !!userAccepted, otherAccepted: !!otherAccepted };
  };

  const handleOpenContract = (contract: Contract) => {
    setSelectedContract(contract);
    setModalOpen(true);
  };

  const needsAction = (contract: Contract) => {
    if (contract.status === "active" || contract.status === "funded" || 
        contract.status === "completed" || contract.status === "cancelled") {
      return false;
    }
    const { userAccepted } = getAcceptanceStatus(contract);
    return !userAccepted;
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
          <TabsTrigger value="pending" className="gap-1">
            Pendentes
            {contracts.filter(c => needsAction(c)).length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center rounded-full">
                {contracts.filter(c => needsAction(c)).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">{t("contracts.active")}</TabsTrigger>
          <TabsTrigger value="funded">{t("contracts.funded")}</TabsTrigger>
          <TabsTrigger value="completed">{t("contracts.completed")}</TabsTrigger>
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
              {filteredContracts.map((contract) => {
                const { userAccepted, otherAccepted } = getAcceptanceStatus(contract);
                const bothAccepted = userAccepted && otherAccepted;
                const showAcceptButton = !userAccepted && contract.status !== "cancelled";

                return (
                  <Card 
                    key={contract.id} 
                    className={`hover:shadow-md transition-shadow ${
                      showAcceptButton ? "border-amber-500/50" : ""
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl">{contract.title}</CardTitle>
                            {showAcceptButton && (
                              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500">
                                <AlertTriangle className="h-3 w-3" />
                                Ação Necessária
                              </Badge>
                            )}
                          </div>
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
                      {/* Acceptance Status */}
                      {(contract.status === "draft" || contract.status === "pending_acceptance") && (
                        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm">
                            {contract.company_accepted_at ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={contract.company_accepted_at ? "text-green-600" : "text-muted-foreground"}>
                              Empresa {contract.company_accepted_at ? "aceitou" : "pendente"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {contract.freelancer_accepted_at ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={contract.freelancer_accepted_at ? "text-green-600" : "text-muted-foreground"}>
                              Freelancer {contract.freelancer_accepted_at ? "aceitou" : "pendente"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {formatMoneyFromCents(contract.amount_cents, contract.currency)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {contract.currency}
                          </Badge>
                          {contract.was_counterproposal && (
                            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500">
                              <AlertTriangle className="h-3 w-3" />
                              Negociado
                            </Badge>
                          )}
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
                                {milestone.title} - {formatMoneyFromCents((milestone.amount || 0) * 100, contract.currency)}
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

                      <div className="mt-4 flex justify-end gap-2">
                        {showAcceptButton && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenContract(contract)}
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            Revisar e Aceitar
                          </Button>
                        )}
                        
                        {!showAcceptButton && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenContract(contract)}
                          >
                            Ver Contrato
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const isCompanyUser = user?.id === contract.company_user_id;
                            const path = isCompanyUser 
                              ? `/projects/${contract.project_id}` 
                              : `/project/${contract.project_id}`;
                            navigate(path);
                          }}
                        >
                          {t("contracts.viewProject")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Contract Acceptance Modal */}
      {selectedContract && (
        <ContractAcceptanceModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          contract={selectedContract}
          onAccepted={fetchContracts}
        />
      )}
    </div>
  );
}
