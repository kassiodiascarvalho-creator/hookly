import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { FileText, Calendar, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, MessageCircle, Infinity, Rocket } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FreelancerCounterproposalResponseModal } from "@/components/proposals/FreelancerCounterproposalResponseModal";
import { formatMoney, formatMoneyFromCents } from "@/lib/formatMoney";
import { useFreelancerPlan } from "@/hooks/useFreelancerPlan";
interface Proposal {
  id: string;
  cover_letter: string | null;
  milestones: unknown;
  status: "sent" | "accepted" | "rejected";
  created_at: string;
  project_id: string;
  is_counterproposal?: boolean;
  counterproposal_justification?: string | null;
  company_response?: string | null;
  company_feedback?: string | null;
  agreed_amount_cents?: number | null;
  was_counterproposal?: boolean | null;
  project?: {
    title: string;
    category: string | null;
    budget_min: number | null;
    budget_max: number | null;
    status: string;
    currency: string;
    company_user_id: string;
  } | null;
}

const statusConfig = {
  sent: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

const companyResponseConfig = {
  accepted: { label: "Company Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  negotiating: { label: "Negotiating", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: MessageCircle },
  rejected: { label: "Company Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

export default function MyProposals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: freelancerPlan, loading: planLoading } = useFreelancerPlan();
  
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  
  useEffect(() => {
    if (user) fetchProposals();
  }, [user]);

  const fetchProposals = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("proposals")
      .select("id, cover_letter, milestones, status, created_at, project_id, is_counterproposal, counterproposal_justification, company_response, company_feedback, current_offer_cents, current_offer_by")
      .eq("freelancer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch project info and contract info for each proposal
      const proposalsWithProjects = await Promise.all(
        data.map(async (proposal) => {
          const { data: project } = await supabase
            .from("projects")
            .select("title, category, budget_min, budget_max, status, currency, company_user_id")
            .eq("id", proposal.project_id)
            .maybeSingle();
          
          // Fetch contract info for accepted proposals
          let agreedAmountCents: number | null = null;
          let wasCounterproposal: boolean | null = null;
          if (proposal.status === "accepted") {
            const { data: contract } = await supabase
              .from("contracts")
              .select("agreed_amount_cents, amount_cents, was_counterproposal")
              .eq("proposal_id", proposal.id)
              .maybeSingle();

            // Prefer agreed_amount_cents when present, otherwise fall back to amount_cents.
            // This prevents UI divergence for older contracts that may not have agreed_amount_cents populated.
            agreedAmountCents = (contract?.agreed_amount_cents ?? contract?.amount_cents) ?? null;
            wasCounterproposal = contract?.was_counterproposal ?? null;
          }
          
          return { ...proposal, project, agreed_amount_cents: agreedAmountCents, was_counterproposal: wasCounterproposal };
        })
      );
      setProposals(proposalsWithProjects);
    }
    setLoading(false);
  };

  const filteredProposals = proposals.filter((p) => {
    if (activeTab === "all") return true;
    return p.status === activeTab;
  });

  const getTotalAmount = (milestones: unknown) => {
    if (!milestones || !Array.isArray(milestones)) return 0;
    return milestones.reduce((sum, m) => sum + (m?.amount || 0), 0);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("myProposals.title")}</h1>
          <p className="text-muted-foreground">{t("myProposals.subtitle")}</p>
        </div>
        
        {/* Proposal usage card */}
        {!planLoading && freelancerPlan && (
          <Card className="w-full md:w-auto">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {freelancerPlan.unlimited_proposals ? (
                  <div className="flex items-center gap-2 text-primary">
                    <Infinity className="h-5 w-5" />
                    <span className="font-medium">Propostas ilimitadas</span>
                  </div>
                ) : (
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Propostas este mês</span>
                      <span className="font-medium">
                        {freelancerPlan.proposals_used} / {freelancerPlan.proposals_limit}
                      </span>
                    </div>
                    <Progress 
                      value={(freelancerPlan.proposals_used / (freelancerPlan.proposals_limit || 5)) * 100} 
                      className="h-2"
                    />
                    {freelancerPlan.reset_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Renova em {format(new Date(freelancerPlan.reset_at), "d 'de' MMMM", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                )}
                {!freelancerPlan.unlimited_proposals && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate('/settings?tab=billing')}
                    className="gap-1"
                  >
                    <Rocket className="h-4 w-4" />
                    Upgrade
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t("myProposals.all")} ({proposals.length})</TabsTrigger>
          <TabsTrigger value="sent">{t("myProposals.pending")} ({proposals.filter(p => p.status === "sent").length})</TabsTrigger>
          <TabsTrigger value="accepted">{t("myProposals.accepted")} ({proposals.filter(p => p.status === "accepted").length})</TabsTrigger>
          <TabsTrigger value="rejected">{t("myProposals.rejected")} ({proposals.filter(p => p.status === "rejected").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredProposals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t("myProposals.noProposals")}</h3>
                <p className="text-muted-foreground mb-4">{t("myProposals.noProposalsDesc")}</p>
                <Button onClick={() => navigate("/find-projects")}>
                  {t("myProposals.browseProjects")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredProposals.map((proposal) => {
                const config = statusConfig[proposal.status];
                const StatusIcon = config.icon;
                const totalAmount = getTotalAmount(proposal.milestones as { title: string; amount: number }[] | null);
                const responseConfig = proposal.company_response 
                  ? companyResponseConfig[proposal.company_response as keyof typeof companyResponseConfig]
                  : null;
                const ResponseIcon = responseConfig?.icon;
                
                return (
                  <Card 
                    key={proposal.id}
                    className={cn(
                      "cursor-pointer hover:shadow-md transition-shadow",
                      proposal.is_counterproposal && "border-amber-300 dark:border-amber-700",
                      proposal.company_response === "negotiating" && "border-blue-300 dark:border-blue-700"
                    )}
                    onClick={() => navigate(`/project/${proposal.project_id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <h3 className="font-semibold text-lg truncate">
                              {proposal.project?.title || t("myProposals.untitledProject")}
                            </h3>
                            {proposal.is_counterproposal && (
                              <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {t("proposals.counterproposal", "Counter-proposal")}
                              </Badge>
                            )}
                            <Badge className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          
                          {/* Company response to counter-proposal */}
                          {proposal.is_counterproposal && proposal.company_response && responseConfig && ResponseIcon && (
                            <div className="mb-3 p-3 rounded-lg bg-muted/50 border">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <Badge className={responseConfig.color}>
                                  <ResponseIcon className="h-3 w-3 mr-1" />
                                  {t(`counterproposal.status${proposal.company_response.charAt(0).toUpperCase() + proposal.company_response.slice(1)}`, responseConfig.label)}
                                </Badge>
                                {/* Action button for negotiating status */}
                                {proposal.company_response === "negotiating" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProposal(proposal);
                                      setResponseModalOpen(true);
                                    }}
                                  >
                                    <MessageCircle className="h-4 w-4 mr-1" />
                                    {t("counterproposal.respond", "Respond")}
                                  </Button>
                                )}
                              </div>
                              {proposal.company_feedback && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  <span className="font-medium">{t("counterproposal.companyFeedback", "Company feedback")}:</span> {proposal.company_feedback}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {proposal.cover_letter && (
                            <p className="text-muted-foreground line-clamp-2 mb-3">
                              {proposal.cover_letter}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {proposal.project?.category && (
                              <Badge variant="outline">{proposal.project.category}</Badge>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(proposal.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-lg font-semibold text-primary">
                            {formatMoney(totalAmount, proposal.project?.currency || "USD")}
                          </div>
                          <p className="text-xs text-muted-foreground">{t("myProposals.yourBid")}</p>
                          
                          {/* Show agreed amount for accepted negotiations (counter-proposal path) */}
                          {proposal.status === "accepted" &&
                            (proposal.was_counterproposal || proposal.is_counterproposal) &&
                            proposal.agreed_amount_cents !== null &&
                            proposal.agreed_amount_cents !== undefined && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <div className="text-lg font-semibold text-success">
                                  {formatMoneyFromCents(proposal.agreed_amount_cents, proposal.project?.currency || "USD")}
                                </div>
                                <p className="text-xs text-success/80">{t("myProposals.agreedAmount", "Valor Acordado")}</p>
                              </div>
                            )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Freelancer response modal */}
      {selectedProposal && selectedProposal.project && (
        <FreelancerCounterproposalResponseModal
          open={responseModalOpen}
          onOpenChange={setResponseModalOpen}
          proposal={{
            id: selectedProposal.id,
            milestones: selectedProposal.milestones,
            company_response: selectedProposal.company_response,
            company_feedback: selectedProposal.company_feedback,
            project_id: selectedProposal.project_id,
            current_offer_cents: (selectedProposal as any).current_offer_cents,
            current_offer_by: (selectedProposal as any).current_offer_by,
          }}
          project={{
            title: selectedProposal.project.title,
            budget_min: selectedProposal.project.budget_min,
            budget_max: selectedProposal.project.budget_max,
            currency: selectedProposal.project.currency || "USD",
            company_user_id: selectedProposal.project.company_user_id,
          }}
          onResponseSubmitted={fetchProposals}
        />
      )}
    </div>
  );
}
