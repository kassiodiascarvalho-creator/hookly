import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  ArrowLeft, Briefcase, Clock, CheckCircle, FileText, Loader2, 
  DollarSign, MessageSquare, Star, Calendar, MapPin, Check, X, Flag
} from "lucide-react";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { format } from "date-fns";
import MilestonePayment from "@/components/payments/MilestonePayment";

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "draft" | "open" | "in_progress" | "completed";
  budget_min: number | null;
  budget_max: number | null;
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchProposals();
      fetchPayments();
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
      // Fetch freelancer profiles for each proposal
      const proposalsWithFreelancers = await Promise.all(
        proposalData.map(async (proposal) => {
          const { data: freelancer } = await supabase
            .from("freelancer_profiles")
            .select("full_name, title, avatar_url, hourly_rate, location, verified")
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

  const handlePublish = async () => {
    if (!project) return;
    setActionLoading("publish");
    
    const { error } = await supabase
      .from("projects")
      .update({ status: "open" })
      .eq("id", project.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("projects.published"));
      setProject({ ...project, status: "open" });
    }
    setActionLoading(null);
  };

  const handleAcceptProposal = async (proposalId: string, freelancerUserId: string) => {
    if (!project || !user) return;
    setActionLoading(proposalId);

    // Update proposal status
    const { error: proposalError } = await supabase
      .from("proposals")
      .update({ status: "accepted" })
      .eq("id", proposalId);

    if (proposalError) {
      toast.error(proposalError.message);
      setActionLoading(null);
      return;
    }

    // Update project status
    const { error: projectError } = await supabase
      .from("projects")
      .update({ status: "in_progress" })
      .eq("id", project.id);

    if (projectError) {
      toast.error(projectError.message);
      setActionLoading(null);
      return;
    }

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
      link: `/messages`,
    });

    toast.success(t("proposals.accepted"));
    setProject({ ...project, status: "in_progress" });
    setProposals(proposals.map(p => 
      p.id === proposalId ? { ...p, status: "accepted" } : p
    ));
    setActionLoading(null);
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

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return t("projects.budgetNegotiable");
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `${t("projects.from")} $${min.toLocaleString()}`;
    return `${t("projects.upTo")} $${max?.toLocaleString()}`;
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
                    <Button onClick={handlePublish} disabled={actionLoading === "publish"}>
                      {actionLoading === "publish" ? (
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
                  <p className="font-semibold">{formatBudget(project.budget_min, project.budget_max)}</p>
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
                <CardTitle>{t("proposals.received")} ({proposals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {proposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{t("proposals.noProposals")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proposals.map((proposal) => (
                      <div key={proposal.id} className="border rounded-lg p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={proposal.freelancer?.avatar_url || undefined} />
                            <AvatarFallback>
                              {proposal.freelancer?.full_name?.charAt(0) || "F"}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">
                                {proposal.freelancer?.full_name || "Freelancer"}
                              </h4>
                              {proposal.freelancer?.verified && (
                                <Badge variant="secondary" className="text-xs">
                                  <Check className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                              <Badge 
                                variant={proposal.status === "accepted" ? "default" : proposal.status === "rejected" ? "destructive" : "secondary"}
                              >
                                {proposal.status}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-2">
                              {proposal.freelancer?.title}
                            </p>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              {proposal.freelancer?.hourly_rate && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${proposal.freelancer.hourly_rate}/hr
                                </span>
                              )}
                              {proposal.freelancer?.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {proposal.freelancer.location}
                                </span>
                              )}
                            </div>
                            
                            {proposal.cover_letter && (
                              <p className="text-sm mb-3 line-clamp-3">{proposal.cover_letter}</p>
                            )}

                            {proposal.milestones && Array.isArray(proposal.milestones) && proposal.milestones.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm font-medium mb-1">{t("proposals.milestones")}:</p>
                                <div className="flex flex-wrap gap-2">
                                  {(proposal.milestones as { title: string; amount: number }[]).map((m, idx) => (
                                    <Badge key={idx} variant="outline">
                                      {m.title}: ${m.amount}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {proposal.status === "sent" && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleAcceptProposal(proposal.id, proposal.freelancer_user_id)}
                                  disabled={actionLoading === proposal.id}
                                >
                                  {actionLoading === proposal.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                  )}
                                  {t("proposals.accept")}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleRejectProposal(proposal.id, proposal.freelancer_user_id)}
                                  disabled={actionLoading === proposal.id}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t("proposals.reject")}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => navigate(`/freelancers/${proposal.freelancer_user_id}`)}
                                >
                                  {t("proposals.viewProfile")}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
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
    </div>
  );
}
