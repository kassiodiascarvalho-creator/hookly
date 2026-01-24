import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, Briefcase, Clock, CheckCircle, FileText, Loader2, 
  DollarSign, Calendar, Check, Flag, Sparkles
} from "lucide-react";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { format } from "date-fns";
import MilestonePayment from "@/components/payments/MilestonePayment";
import { formatMoney } from "@/lib/formatMoney";
import { GeniusRankingButton } from "@/components/genius";
import { ProposalCard, CounterproposalResponseModal } from "@/components/proposals";
import { useProposalRankings } from "@/hooks/useProposalRankings";
import { useProfileGate } from "@/hooks/useProfileGate";
import { usePublishProject } from "@/hooks/usePublishProject";
import { ProfileGateModal } from "@/components/profile/ProfileGateModal";
import { ProfileGateAlert } from "@/components/profile/ProfileGateAlert";

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "draft" | "open" | "in_progress" | "completed";
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  kpis: unknown;
  created_at: string;
  company_user_id: string;
}

interface Proposal {
  id: string;
  cover_letter: string | null;
  milestones: unknown;
  status: "sent" | "accepted" | "rejected";
  created_at: string;
  freelancer_user_id: string;
  is_counterproposal?: boolean;
  counterproposal_justification?: string | null;
  company_response?: string | null;
  freelancer?: {
    full_name: string | null;
    title: string | null;
    avatar_url: string | null;
    hourly_rate: number | null;
    location: string | null;
    verified: boolean | null;
  } | null;
}

interface Payment {
  id: string;
  amount: number;
  status: "pending" | "paid" | "released" | "failed";
  stripe_payment_intent_id: string | null;
}

const statusConfig = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  open: { label: "Open", color: "bg-green-100 text-green-800", icon: Briefcase },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800", icon: Clock },
  completed: { label: "Completed", color: "bg-primary/10 text-primary", icon: CheckCircle },
};

export default function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [agreedAmountCents, setAgreedAmountCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showGeniusModal, setShowGeniusModal] = useState(false);
  const [showProfileGateModal, setShowProfileGateModal] = useState(false);
  const [counterproposalModalOpen, setCounterproposalModalOpen] = useState(false);
  const [selectedCounterproposal, setSelectedCounterproposal] = useState<Proposal | null>(null);
  
  // Profile gate for companies (to publish projects)
  const { allowed: profileAllowed, completionPercent, loading: gateLoading } = useProfileGate('company');
  const { publishProject, isPublishing } = usePublishProject();
  
  // Fetch AI rankings for proposals
  const { 
    getRankingForProposal, 
    sortProposalsByScore, 
    hasCache: hasRankingCache,
    refetch: refetchRankings 
  } = useProposalRankings(id);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchProposals();
      fetchPayments();
      fetchContractAgreedAmount();
    }
  }, [id]);

  // Handle payment success/cancel from Stripe redirect
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success(t("payments.success"));
      fetchPayments();
    } else if (paymentStatus === "cancelled") {
      toast.info(t("payments.cancelled"));
    }
  }, [searchParams]);

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      setProject(data);
    }
    setLoading(false);
  };

  const fetchProposals = async () => {
    const { data: proposalData, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    if (!error && proposalData) {
      // Fetch freelancer profiles for each proposal (including tier)
      const proposalsWithFreelancers = await Promise.all(
        proposalData.map(async (proposal) => {
          const { data: freelancer } = await supabase
            .from("freelancer_profiles")
            .select("full_name, title, avatar_url, hourly_rate, location, verified, tier")
            .eq("user_id", proposal.freelancer_user_id)
            .maybeSingle();
          return { ...proposal, freelancer };
        })
      );
      setProposals(proposalsWithFreelancers);
    }
  };

  const fetchPayments = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from("payments")
      .select("id, amount, status, stripe_payment_intent_id")
      .eq("project_id", id);
    
    if (data) setPayments(data);
  };

  const fetchContractAgreedAmount = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from("contracts")
      .select("agreed_amount_cents")
      .eq("project_id", id)
      .maybeSingle();
    
    if (data?.agreed_amount_cents) {
      setAgreedAmountCents(data.agreed_amount_cents);
    }
  };

  const handlePublish = async () => {
    if (!project) return;

    // If the profile gate already says it's not allowed, don't call the publish RPC.
    // This avoids a generic error toast when the backend function is unavailable.
    if (gateLoading) return;
    if (!profileAllowed) {
      toast.info(t("profileGate.companyAlertTitle"));
      setShowProfileGateModal(true);
      return;
    }
    
    // Use centralized RPC that validates profile completion server-side
    const result = await publishProject(project.id);
    
    if (result.success) {
      setProject({ ...project, status: "open" });
    } else if (result.error === 'COMPANY_PROFILE_INCOMPLETE') {
      toast.info(t("profileGate.companyAlertTitle"));
      setShowProfileGateModal(true);
    }
  };

  const handleAcceptProposal = async (proposalId: string, freelancerUserId: string) => {
    if (!project || !user) return;
    setActionLoading(proposalId);

    try {
      // Usar RPC centralizada - fonte única de verdade
      // Esta RPC: atualiza proposal, projeto, cria/atualiza contrato, recalcula milestones
      const { data: contractId, error: rpcError } = await supabase.rpc(
        "finalize_proposal_acceptance",
        { p_proposal_id: proposalId }
      );

      if (rpcError) throw rpcError;

      // Create or get conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("company_user_id", user.id)
        .eq("freelancer_user_id", freelancerUserId)
        .eq("project_id", project.id)
        .maybeSingle();

      if (!existingConv) {
        await supabase.from("conversations").insert({
          company_user_id: user.id,
          freelancer_user_id: freelancerUserId,
          project_id: project.id,
        });
      }

      // Create notification for freelancer
      await supabase.from("notifications").insert({
        user_id: freelancerUserId,
        type: "proposal_accepted",
        message: `Your proposal for "${project.title}" has been accepted!`,
        link: `/contracts`,
      });

      toast.success(t("proposals.accepted"));
      
      // Refetch para garantir dados atualizados do backend
      fetchProposals();
      fetchProject();
      fetchContractAgreedAmount();
      
    } catch (error) {
      console.error("Error accepting proposal:", error);
      toast.error(t("common.error", "An error occurred"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectProposal = async (proposalId: string, freelancerUserId: string) => {
    setActionLoading(proposalId);

    const { error } = await supabase
      .from("proposals")
      .update({ status: "rejected" })
      .eq("id", proposalId);

    if (error) {
      toast.error(error.message);
    } else {
      // Create notification for freelancer
      if (project) {
        await supabase.from("notifications").insert({
          user_id: freelancerUserId,
          type: "proposal_rejected",
          message: `Your proposal for "${project.title}" was not selected.`,
          link: `/my-proposals`,
        });
      }
      
      toast.success(t("proposals.rejected"));
      setProposals(proposals.map(p => 
        p.id === proposalId ? { ...p, status: "rejected" } : p
      ));
    }
    setActionLoading(null);
  };

  const handleRespondToCounterproposal = (proposal: Proposal) => {
    setSelectedCounterproposal(proposal);
    setCounterproposalModalOpen(true);
  };

  const handleCompleteProject = async () => {
    if (!project || !acceptedProposal) return;
    setActionLoading("complete");

    const { error } = await supabase
      .from("projects")
      .update({ status: "completed" })
      .eq("id", project.id);

    if (error) {
      toast.error(error.message);
      setActionLoading(null);
      return;
    }

    // Notify freelancer about project completion
    await supabase.from("notifications").insert({
      user_id: acceptedProposal.freelancer_user_id,
      type: "project_completed",
      message: t("notifications.projectCompleted", { projectTitle: project.title }),
      link: `/my-proposals`,
    });

    toast.success(t("projects.completed"));
    setProject({ ...project, status: "completed" });
    setShowReviewForm(true);
    setActionLoading(null);
  };

  const formatBudget = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return t("projects.budgetNegotiable");
    if (min && max) return `${formatMoney(min, currency)} - ${formatMoney(max, currency)}`;
    if (min) return `${t("projects.from")} ${formatMoney(min, currency)}`;
    return `${t("projects.upTo")} ${formatMoney(max || 0, currency)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">{t("projects.notFound")}</h2>
        <Button variant="outline" onClick={() => navigate("/projects")}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  const config = statusConfig[project.status];
  const StatusIcon = config.icon;
  const isOwner = user?.id === project.company_user_id;
  const kpis = Array.isArray(project.kpis) ? project.kpis : [];
  const acceptedProposal = proposals.find(p => p.status === "accepted");
  const acceptedProposalMilestones = acceptedProposal?.milestones 
    ? (acceptedProposal.milestones as { title: string; amount: number; description?: string }[])
    : [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/projects")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-2xl">{project.title}</CardTitle>
                    <Badge className={config.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-4">
                    {project.category && <span>{project.category}</span>}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(project.created_at), "MMM d, yyyy")}
                    </span>
                  </CardDescription>
                </div>
                
                <div className="flex gap-2">
                  {isOwner && project.status === "draft" && (
                    <Button onClick={handlePublish} disabled={isPublishing}>
                      {isPublishing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t("projects.publish")}
                    </Button>
                  )}
                  
                  {isOwner && project.status === "in_progress" && acceptedProposal && (
                    <Button 
                      onClick={handleCompleteProject} 
                      disabled={actionLoading === "complete"}
                      className="gap-2"
                    >
                      {actionLoading === "complete" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Flag className="h-4 w-4" />
                      )}
                      {t("projects.markComplete")}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">{t("projects.description")}</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{project.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">{t("projects.budget")}</span>
                  </div>
                  <p className="font-semibold">{formatBudget(project.budget_min, project.budget_max, project.currency || "USD")}</p>
                  
                  {/* Show agreed amount when project is in progress or completed */}
                  {agreedAmountCents && (project.status === "in_progress" || project.status === "completed") && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">{t("projects.agreedAmount", "Valor Acordado")}</span>
                      </div>
                      <p className="font-semibold text-green-500">{formatMoney(agreedAmountCents / 100, project.currency || "USD")}</p>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">{t("projects.proposals")}</span>
                  </div>
                  <p className="font-semibold">{proposals.length}</p>
                </div>
              </div>

              {kpis.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">{t("projects.kpis")}</h3>
                  <div className="grid gap-2">
                    {kpis.map((kpi, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="font-medium">{kpi.name}</p>
                          <p className="text-sm text-muted-foreground">{t("projects.target")}: {kpi.target}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proposals Section */}
          {isOwner && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {t("proposals.received")} ({proposals.length})
                    {hasRankingCache && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Sparkles className="h-3 w-3" />
                        {t("ai.analyzed", "Analisado")}
                      </Badge>
                    )}
                  </CardTitle>
                  {proposals.filter(p => p.status === "sent").length >= 2 && (
                    <GeniusRankingButton
                      projectId={project.id}
                      proposalsCount={proposals.filter(p => p.status === "sent").length}
                      onRankingGenerated={() => refetchRankings()}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {proposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{t("proposals.noProposals")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortProposalsByScore(proposals).map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        currency={project.currency || "USD"}
                        ranking={getRankingForProposal(proposal.id)}
                        actionLoading={actionLoading}
                        onAccept={handleAcceptProposal}
                        onReject={handleRejectProposal}
                        onViewProfile={(userId) => navigate(`/freelancers/${userId}`)}
                        onRespondToCounterproposal={handleRespondToCounterproposal}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Section - Show for in_progress or completed projects */}
          {(project.status === "in_progress" || project.status === "completed") && acceptedProposal && (
            <MilestonePayment
              projectId={project.id}
              projectTitle={project.title}
              milestones={acceptedProposalMilestones}
              freelancerUserId={acceptedProposal.freelancer_user_id}
              isCompany={isOwner}
              payments={payments}
              currency={project.currency || "USD"}
              onPaymentComplete={fetchPayments}
            />
          )}
        </div>
      </div>

      {/* Review Form Dialog */}
      {acceptedProposal && (
        <ReviewForm
          projectId={project.id}
          freelancerUserId={acceptedProposal.freelancer_user_id}
          open={showReviewForm}
          onOpenChange={setShowReviewForm}
          onReviewSubmitted={() => setShowReviewForm(false)}
        />
      )}

      {/* Profile Gate Modal for publishing */}
      <ProfileGateModal
        open={showProfileGateModal}
        onOpenChange={setShowProfileGateModal}
        userType="company"
        completionPercent={completionPercent}
      />

      {/* Counter-proposal Response Modal */}
      {selectedCounterproposal && project && user && (
        <CounterproposalResponseModal
          open={counterproposalModalOpen}
          onOpenChange={setCounterproposalModalOpen}
          proposal={selectedCounterproposal}
          project={{
            id: project.id,
            budget_min: project.budget_min,
            budget_ideal: null,
            budget_max: project.budget_max,
            currency: project.currency || "USD",
          }}
          companyUserId={user.id}
          onResponseSubmitted={() => {
            fetchProposals();
            fetchProject();
            setSelectedCounterproposal(null);
          }}
        />
      )}
    </div>
  );
}
