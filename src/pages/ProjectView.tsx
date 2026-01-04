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
  ArrowLeft, Briefcase, DollarSign, Calendar, Loader2, 
  Check, Plus, X, Send, Building2
} from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [coverLetter, setCoverLetter] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: crypto.randomUUID(), title: "", amount: "", description: "" }
  ]);

  useEffect(() => {
    if (id) {
      fetchProject();
      if (user) fetchMyProposal();
    }
  }, [id, user]);

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("status", "open")
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

    setSubmitting(true);

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
      toast.error(error.message);
    } else {
      // Create notification for company
      await supabase.from("notifications").insert({
        user_id: project.company_user_id,
        type: "new_proposal",
        message: `New proposal received for "${project.title}"`,
        link: `/projects/${project.id}`,
      });

      toast.success(myProposal ? t("proposals.updated") : t("proposals.sent"));
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
                  <CardTitle className="text-2xl">{project.title}</CardTitle>
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

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">{t("projects.budget")}</span>
                </div>
                <p className="font-semibold text-lg">{formatBudget(project.budget_min, project.budget_max)}</p>
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("findProjects.aboutCompany")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-3">
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
                        t={t}
                      />
                    </Dialog>
                  )}
                </div>
              ) : (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full gap-2">
                      <Send className="h-4 w-4" />
                      {t("proposals.submitProposal")}
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
                    t={t}
                  />
                </Dialog>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
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
  t,
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
  t: (key: string) => string;
}) {
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? t("proposals.editProposal") : t("proposals.submitProposal")}</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Label>{t("proposals.coverLetter")} *</Label>
          <Textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            placeholder={t("proposals.coverLetterPlaceholder")}
            rows={5}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t("proposals.milestones")} *</Label>
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

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="font-medium">{t("proposals.totalAmount")}</span>
            <span className="text-xl font-bold text-primary">${totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <Button onClick={onSubmit} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isEdit ? t("proposals.updateProposal") : t("proposals.sendProposal")}
        </Button>
      </div>
    </DialogContent>
  );
}
