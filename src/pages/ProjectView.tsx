import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, DollarSign, Calendar, Loader2, 
  Check, Plus, X, Send, Building2, Coins, AlertTriangle, Star, HelpCircle, Lock,
  ShieldCheck, ShieldX
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { usePlatformCredits, PLATFORM_ACTIONS } from "@/hooks/usePlatformCredits";
import { CreditCheckModal } from "@/components/credits/CreditCheckModal";
import { ViewCompanyDataButton } from "@/components/company/ViewCompanyDataButton";
import { GeniusProposalButton } from "@/components/genius";
import { useProfileGate } from "@/hooks/useProfileGate";

import { ProfileGateModal } from "@/components/profile/ProfileGateModal";
import { ProfileGateAlert } from "@/components/profile/ProfileGateAlert";
import { BudgetRangeDisplay, ProposalBudgetValidation, CounterproposalJustification, validateProposalBudget, ProposalQueueCard } from "@/components/proposals";
import { getCurrencySymbol, formatMoney } from "@/lib/formatMoney";
import { checkProjectHasPrefund } from "@/hooks/useProjectPrefund";

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  budget_min: number | null;
  budget_ideal: number | null;
  budget_max: number | null;
  currency: string;
  kpis: unknown;
  created_at: string;
  company_user_id: string;
  company?: {
    company_name: string | null;
    logo_url: string | null;
    about: string | null;
  } | null;
}

interface Proposal {
  id: string;
  cover_letter: string | null;
  milestones: unknown;
  status: "sent" | "accepted" | "rejected";
  created_at: string;
  is_counterproposal?: boolean;
  counterproposal_justification?: string | null;
}

interface ContractInfo {
  agreed_amount_cents: number | null;
  was_counterproposal: boolean | null;
  original_proposal_amount_cents: number | null;
}

interface Milestone {
  id: string;
  title: string;
  amount: string;
  description: string;
}

export default function ProjectView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [myProposal, setMyProposal] = useState<Proposal | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [coverLetter, setCoverLetter] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: crypto.randomUUID(), title: "", amount: "", description: "" }
  ]);
  const [creditCheckOpen, setCreditCheckOpen] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [counterproposalJustification, setCounterproposalJustification] = useState("");
  const [hasVerifiedPayment, setHasVerifiedPayment] = useState<boolean | null>(null);

  // Platform credits hook
  const { balance: creditBalance, loading: creditsLoading, spendCredits, getActionCost, checkCredits } = usePlatformCredits();
  const proposalCost = getActionCost(PLATFORM_ACTIONS.SEND_PROPOSAL);
  const highlightCost = getActionCost(PLATFORM_ACTIONS.HIGHLIGHT_PROPOSAL);

  // Profile gate for freelancers
  const { allowed: profileAllowed, completionPercent, loading: gateLoading, checkMonthlyCredits } = useProfileGate('freelancer');
  const [gateModalOpen, setGateModalOpen] = useState(false);

  // Check monthly credits on mount
  useEffect(() => {
    if (user) {
      checkMonthlyCredits();
    }
  }, [user, checkMonthlyCredits]);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchPrefundStatus();
      if (user) {
        fetchMyProposal();
        fetchContractInfo();
      }
    }
  }, [id, user]);

  const fetchPrefundStatus = async () => {
    if (!id) return;
    const hasPrefund = await checkProjectHasPrefund(id);
    setHasVerifiedPayment(hasPrefund);
  };

  const fetchProject = async () => {
    // Fetch project with open OR in_progress status (for accepted freelancers)
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .in("status", ["open", "in_progress", "completed"])
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch company info
      const { data: company } = await supabase
        .from("company_profiles")
        .select("company_name, logo_url, about")
        .eq("user_id", data.company_user_id)
        .maybeSingle();
      
      setProject({ ...data, company });
    }
    setLoading(false);
  };

  const fetchMyProposal = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("proposals")
      .select("*")
      .eq("project_id", id)
      .eq("freelancer_user_id", user.id)
      .maybeSingle();

    if (data) {
      setMyProposal(data);
      setCoverLetter(data.cover_letter || "");
      if (data.milestones && Array.isArray(data.milestones) && data.milestones.length > 0) {
        setMilestones(
          (data.milestones as { title: string; amount: number; description?: string }[]).map((m) => ({
            id: crypto.randomUUID(),
            title: m.title,
            amount: m.amount.toString(),
            description: m.description || "",
          }))
        );
      }
    }
  };

  const fetchContractInfo = async () => {
    if (!user || !id) return;
    
    const { data } = await supabase
      .from("contracts")
      .select("agreed_amount_cents, was_counterproposal, original_proposal_amount_cents")
      .eq("project_id", id)
      .eq("freelancer_user_id", user.id)
      .maybeSingle();

    if (data) {
      setContractInfo(data);
    }
  };

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      { id: crypto.randomUUID(), title: "", amount: "", description: "" }
    ]);
  };

  const removeMilestone = (id: string) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((m) => m.id !== id));
    }
  };

  const updateMilestone = (id: string, field: keyof Milestone, value: string) => {
    setMilestones(milestones.map((m) => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const handleSubmitProposal = async () => {
    if (!user || !project) return;

    if (!coverLetter.trim()) {
      toast.error(t("proposals.coverLetterRequired"));
      return;
    }

    const validMilestones = milestones.filter((m) => m.title && m.amount);
    if (validMilestones.length === 0) {
      toast.error(t("proposals.milestonesRequired"));
      return;
    }

    // Calculate total and check if it's a counterproposal
    const proposalTotal = validMilestones.reduce((sum, m) => sum + parseFloat(m.amount || "0"), 0);
    const isCounterproposal = project.budget_max ? proposalTotal > project.budget_max : false;
    const excessAmount = isCounterproposal && project.budget_max ? proposalTotal - project.budget_max : 0;

    // Validate counterproposal justification
    if (isCounterproposal && (!counterproposalJustification || counterproposalJustification.length < 50)) {
      toast.error("Para enviar uma contraproposta, é necessário uma justificativa de pelo menos 50 caracteres");
      return;
    }

    // Check credits for new proposals (not edits)
    const isNewProposal = !myProposal;
    const totalCreditsNeeded = (isNewProposal ? proposalCost : 0) + (isHighlighted ? highlightCost : 0);
    
    if (totalCreditsNeeded > 0 && creditBalance < totalCreditsNeeded) {
      setCreditCheckOpen(true);
      return;
    }

    setSubmitting(true);

    // Spend credits for new proposals
    if (isNewProposal && proposalCost > 0) {
      const { success, error } = await spendCredits(
        PLATFORM_ACTIONS.SEND_PROPOSAL,
        `Proposta enviada para: ${project.title}`
      );

      if (!success) {
        toast.error(error || "Erro ao consumir créditos");
        setSubmitting(false);
        return;
      }
    }

    // Spend credits for highlighting
    if (isHighlighted && highlightCost > 0) {
      const { success, error } = await spendCredits(
        PLATFORM_ACTIONS.HIGHLIGHT_PROPOSAL,
        `Proposta destacada para: ${project.title}`
      );

      if (!success) {
        toast.error(error || "Erro ao consumir créditos para destaque");
        setSubmitting(false);
        return;
      }
    }

    const proposalData = {
      project_id: project.id,
      freelancer_user_id: user.id,
      cover_letter: coverLetter,
      milestones: validMilestones.map((m) => ({
        title: m.title,
        amount: parseFloat(m.amount),
        description: m.description,
      })),
      status: "sent" as const,
      is_highlighted: isHighlighted,
      highlighted_at: isHighlighted ? new Date().toISOString() : null,
      is_counterproposal: isCounterproposal,
      counterproposal_justification: isCounterproposal ? counterproposalJustification : null,
    };

    const { data, error } = myProposal
      ? await supabase
          .from("proposals")
          .update(proposalData)
          .eq("id", myProposal.id)
          .select()
          .single()
      : await supabase
          .from("proposals")
          .insert(proposalData)
          .select()
          .single();

    if (error) {
      // Handle counterproposal validation error from trigger
      if (error.message.includes("counterproposal") || error.message.includes("justification")) {
        toast.error("Proposta acima do orçamento máximo. Adicione uma justificativa.");
      } else {
        toast.error(error.message);
      }
    } else {

      // Create notification for company
      const notificationMessage = isCounterproposal 
        ? `Nova contraproposta recebida para "${project.title}"`
        : `Nova proposta recebida para "${project.title}"`;
      
      await supabase.from("notifications").insert({
        user_id: project.company_user_id,
        type: isCounterproposal ? "counterproposal" : "new_proposal",
        message: notificationMessage,
        link: `/projects/${project.id}`,
      });

      toast.success(myProposal ? t("proposals.updated") : (isCounterproposal ? "Contraproposta enviada!" : t("proposals.sent")));
      setMyProposal(data);
      setDialogOpen(false);
    }

    setSubmitting(false);
  };

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return t("projects.budgetNegotiable");
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `${t("projects.from")} $${min.toLocaleString()}`;
    return `${t("projects.upTo")} $${max?.toLocaleString()}`;
  };

  const totalProposalAmount = milestones
    .filter((m) => m.amount)
    .reduce((sum, m) => sum + parseFloat(m.amount), 0);

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
        <Button variant="outline" onClick={() => navigate("/find-projects")}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  const kpis = Array.isArray(project.kpis) ? project.kpis : [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/find-projects")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-2xl">{project.title}</CardTitle>
                    {/* Payment Verification Badge */}
                    {hasVerifiedPayment !== null && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {hasVerifiedPayment ? (
                              <div className="inline-flex items-center gap-1 text-green-600 dark:text-green-500">
                                <ShieldCheck className="h-4 w-4" />
                                <span className="text-xs font-medium">{t("projects.verifiedPayment", "Pagamento Verificado")}</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-muted-foreground">
                                <ShieldX className="h-4 w-4" />
                                <span className="text-xs font-medium">{t("projects.unverifiedPayment", "Pagamento Não Verificado")}</span>
                              </div>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm max-w-xs">
                              {hasVerifiedPayment
                                ? t("projects.verifiedPaymentTooltip", "Esta empresa adicionou fundos para este projeto, garantindo segurança no pagamento.")
                                : t("projects.unverifiedPaymentTooltip", "Esta empresa ainda não adicionou fundos para este projeto.")
                              }
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-4 mt-2">
                    {project.category && <Badge variant="outline">{project.category}</Badge>}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(project.created_at), "MMM d, yyyy")}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">{t("projects.description")}</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{project.description}</p>
              </div>

              <BudgetRangeDisplay
                budgetMin={project.budget_min}
                budgetIdeal={project.budget_ideal}
                budgetMax={project.budget_max}
                currency={project.currency}
              />

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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("findProjects.aboutCompany")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                  {project.company?.logo_url ? (
                    <img src={project.company.logo_url} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{project.company?.company_name || "Company"}</p>
                </div>
              </div>
              {project.company?.about && (
                <p className="text-sm text-muted-foreground line-clamp-4">{project.company.about}</p>
              )}
              
              {/* View Company Data Button - Only for freelancers */}
              {user && user.id !== project.company_user_id && (
                <ViewCompanyDataButton 
                  companyUserId={project.company_user_id} 
                  companyName={project.company?.company_name}
                />
              )}
            </CardContent>
          </Card>

          {/* Proposal Action */}
          <Card>
            <CardContent className="pt-6">
              {myProposal ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={
                        myProposal.status === "accepted" ? "default" : 
                        myProposal.status === "rejected" ? "destructive" : "secondary"
                      }
                    >
                      {myProposal.status === "accepted" ? t("proposals.accepted") :
                       myProposal.status === "rejected" ? t("proposals.rejected") :
                       t("proposals.pending")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("proposals.submittedOn")} {format(new Date(myProposal.created_at), "MMM d, yyyy")}
                  </p>
                  
                  {/* Show agreed amount when proposal is accepted */}
                  {myProposal.status === "accepted" && contractInfo && (
                    <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                          {t("projects.agreedAmount", "Valor Acordado")}
                        </span>
                      </div>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {formatMoney((contractInfo.agreed_amount_cents || 0) / 100, project.currency)}
                      </p>
                      {contractInfo.was_counterproposal && contractInfo.original_proposal_amount_cents && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("contracts.negotiatedFrom", "Negociado a partir de")} {formatMoney(contractInfo.original_proposal_amount_cents / 100, project.currency)}
                        </p>
                      )}
                    </div>
                  )}
                  {myProposal.status === "sent" && (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          {t("proposals.editProposal")}
                        </Button>
                      </DialogTrigger>
                      <ProposalDialog 
                        coverLetter={coverLetter}
                        setCoverLetter={setCoverLetter}
                        milestones={milestones}
                        addMilestone={addMilestone}
                        removeMilestone={removeMilestone}
                        updateMilestone={updateMilestone}
                        totalAmount={totalProposalAmount}
                        submitting={submitting}
                        onSubmit={handleSubmitProposal}
                        isEdit
                        projectId={project.id}
                        t={t}
                        budgetMin={project.budget_min}
                        budgetIdeal={project.budget_ideal}
                        budgetMax={project.budget_max}
                        currency={project.currency}
                        counterproposalJustification={counterproposalJustification}
                        setCounterproposalJustification={setCounterproposalJustification}
                      />
                    </Dialog>
                  )}
                </div>
              ) : !profileAllowed ? (
                <div className="space-y-3">
                  <Button 
                    className="w-full gap-2" 
                    variant="outline"
                    onClick={() => setGateModalOpen(true)}
                  >
                    <Lock className="h-4 w-4" />
                    {t("proposals.submitProposal")}
                  </Button>
                  <ProfileGateAlert 
                    completionPercent={completionPercent} 
                    userType="freelancer" 
                  />
                </div>
              ) : (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full gap-2" disabled={creditsLoading || gateLoading}>
                      <Send className="h-4 w-4" />
                      {t("proposals.submitProposal")}
                      {proposalCost > 0 && (
                        <Badge variant="secondary" className="ml-1 gap-1">
                          <Coins className="h-3 w-3" />
                          {proposalCost}
                        </Badge>
                      )}
                    </Button>
                  </DialogTrigger>
                  <ProposalDialog 
                    coverLetter={coverLetter}
                    setCoverLetter={setCoverLetter}
                    milestones={milestones}
                    addMilestone={addMilestone}
                    removeMilestone={removeMilestone}
                    updateMilestone={updateMilestone}
                    totalAmount={totalProposalAmount}
                    submitting={submitting}
                    onSubmit={handleSubmitProposal}
                    proposalCost={proposalCost}
                    highlightCost={highlightCost}
                    creditBalance={creditBalance}
                    isHighlighted={isHighlighted}
                    setIsHighlighted={setIsHighlighted}
                    projectId={project.id}
                    t={t}
                    budgetMin={project.budget_min}
                    budgetIdeal={project.budget_ideal}
                    budgetMax={project.budget_max}
                    currency={project.currency}
                    counterproposalJustification={counterproposalJustification}
                    setCounterproposalJustification={setCounterproposalJustification}
                  />
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Proposal Queue - visible for freelancers */}
          {user && user.id !== project.company_user_id && (
            <ProposalQueueCard 
              projectId={project.id} 
              myProposalId={myProposal?.id}
            />
          )}
        </div>
      </div>

      {/* Credit Check Modal */}
      <CreditCheckModal
        open={creditCheckOpen}
        onOpenChange={setCreditCheckOpen}
        actionName="Enviar Proposta"
        requiredCredits={proposalCost}
        currentBalance={creditBalance}
      />

      {/* Profile Gate Modal */}
      <ProfileGateModal
        open={gateModalOpen}
        onOpenChange={setGateModalOpen}
        completionPercent={completionPercent}
        userType="freelancer"
      />
    </div>
  );
}

// Proposal Dialog Component
function ProposalDialog({
  coverLetter,
  setCoverLetter,
  milestones,
  addMilestone,
  removeMilestone,
  updateMilestone,
  totalAmount,
  submitting,
  onSubmit,
  isEdit = false,
  proposalCost = 0,
  highlightCost = 0,
  creditBalance = 0,
  isHighlighted = false,
  setIsHighlighted,
  projectId,
  t,
  budgetMin = null,
  budgetIdeal = null,
  budgetMax = null,
  currency = "USD",
  counterproposalJustification = "",
  setCounterproposalJustification,
}: {
  coverLetter: string;
  setCoverLetter: (v: string) => void;
  milestones: Milestone[];
  addMilestone: () => void;
  removeMilestone: (id: string) => void;
  updateMilestone: (id: string, field: keyof Milestone, value: string) => void;
  totalAmount: number;
  submitting: boolean;
  onSubmit: () => void;
  isEdit?: boolean;
  proposalCost?: number;
  highlightCost?: number;
  creditBalance?: number;
  isHighlighted?: boolean;
  setIsHighlighted?: (v: boolean) => void;
  projectId: string;
  t: (key: string) => string;
  budgetMin?: number | null;
  budgetIdeal?: number | null;
  budgetMax?: number | null;
  currency?: string;
  counterproposalJustification?: string;
  setCounterproposalJustification?: (v: string) => void;
}) {
  const totalCreditsNeeded = (isEdit ? 0 : proposalCost) + (isHighlighted ? highlightCost : 0);
  const insufficientCredits = totalCreditsNeeded > 0 && creditBalance < totalCreditsNeeded;
  const isCounterproposal = budgetMax ? totalAmount > budgetMax : false;
  const excessAmount = isCounterproposal && budgetMax ? totalAmount - budgetMax : 0;
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? t("proposals.editProposal") : t("proposals.submitProposal")}</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("proposals.coverLetter")} *</Label>
            <GeniusProposalButton 
              projectId={projectId} 
              onProposalGenerated={(text) => setCoverLetter(text)}
            />
          </div>
          <Textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            placeholder={t("proposals.coverLetterPlaceholder")}
            rows={5}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>{t("proposals.milestones")} *</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs p-4 space-y-2">
                    <p className="font-semibold text-sm">{t("proposals.milestonesHelp.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("proposals.milestonesHelp.description")}</p>
                    <ul className="text-xs space-y-1 mt-2">
                      <li><strong>Title:</strong> {t("proposals.milestonesHelp.titleTip")}</li>
                      <li><strong>Amount:</strong> {t("proposals.milestonesHelp.amountTip")}</li>
                      <li><strong>Description:</strong> {t("proposals.milestonesHelp.descriptionTip")}</li>
                    </ul>
                    <p className="text-xs text-primary font-medium mt-2">💡 {t("proposals.milestonesHelp.proTip")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addMilestone}>
              <Plus className="h-4 w-4 mr-1" />
              {t("proposals.addMilestone")}
            </Button>
          </div>
          
          {milestones.map((milestone, idx) => (
            <div key={milestone.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("proposals.milestone")} {idx + 1}</span>
                {milestones.length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => removeMilestone(milestone.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t("proposals.milestoneTitle")}</Label>
                  <Input
                    value={milestone.title}
                    onChange={(e) => updateMilestone(milestone.id, "title", e.target.value)}
                    placeholder="e.g., Design Phase"
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("proposals.milestoneAmount")}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={milestone.amount}
                      onChange={(e) => updateMilestone(milestone.id, "amount", e.target.value)}
                      placeholder="0"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">{t("proposals.milestoneDescription")}</Label>
                <Textarea
                  value={milestone.description}
                  onChange={(e) => updateMilestone(milestone.id, "description", e.target.value)}
                  placeholder={t("proposals.milestoneDescPlaceholder")}
                  rows={2}
                />
              </div>
            </div>
          ))}

          {/* Budget Validation */}
          <ProposalBudgetValidation
            proposalTotal={totalAmount}
            budgetMin={budgetMin}
            budgetMax={budgetMax}
            budgetIdeal={budgetIdeal}
            currency={currency}
            isCounterproposal={isCounterproposal}
          />

          {/* Counterproposal Justification */}
          {isCounterproposal && setCounterproposalJustification && (
            <CounterproposalJustification
              value={counterproposalJustification}
              onChange={setCounterproposalJustification}
              required={isCounterproposal}
              excessAmount={excessAmount}
              currency={getCurrencySymbol(currency)}
            />
          )}

          {/* Highlight option */}
          {!isEdit && setIsHighlighted && highlightCost > 0 && (
            <div 
              className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                isHighlighted 
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" 
                  : "border-muted hover:border-muted-foreground/20"
              }`}
              onClick={() => setIsHighlighted(!isHighlighted)}
            >
              <Checkbox 
                checked={isHighlighted} 
                onCheckedChange={(checked) => setIsHighlighted(!!checked)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Star className={`h-4 w-4 ${isHighlighted ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                  <span className="font-medium">Destacar proposta</span>
                  <Badge variant="secondary" className="gap-1">
                    <Coins className="h-3 w-3" />
                    {highlightCost}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua proposta aparecerá no topo da lista para a empresa
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Credit cost warning */}
        {((!isEdit && proposalCost > 0) || isHighlighted) && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${insufficientCredits ? "bg-destructive/10 border border-destructive/20" : "bg-primary/5 border border-primary/20"}`}>
            {insufficientCredits ? (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            ) : (
              <Coins className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              {insufficientCredits ? (
                <>
                  <p className="font-medium text-destructive">Créditos insuficientes</p>
                  <p className="text-muted-foreground">
                    Você precisa de {totalCreditsNeeded} crédito(s) mas tem apenas {creditBalance}. 
                    <a href="/settings?tab=billing" className="text-primary underline ml-1">Comprar créditos</a>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-primary">
                    Custo total: {totalCreditsNeeded} crédito(s)
                    {isHighlighted && !isEdit && proposalCost > 0 && (
                      <span className="font-normal text-muted-foreground ml-1">
                        ({proposalCost} proposta + {highlightCost} destaque)
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground">Seu saldo: {creditBalance} crédito(s)</p>
                </>
              )}
            </div>
          </div>
        )}

        <Button onClick={onSubmit} disabled={submitting || insufficientCredits} className="w-full gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isHighlighted && <Star className="h-4 w-4 fill-current" />}
          {isEdit ? t("proposals.updateProposal") : t("proposals.sendProposal")}
          {totalCreditsNeeded > 0 && (
            <Badge variant="secondary" className="ml-1 gap-1">
              <Coins className="h-3 w-3" />
              {totalCreditsNeeded}
            </Badge>
          )}
        </Button>
      </div>
    </DialogContent>
  );
}
