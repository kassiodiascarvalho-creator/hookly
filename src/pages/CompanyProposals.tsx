import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import { FileText, DollarSign, Loader2, CheckCircle, XCircle, Clock, ChevronRight, Star, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { GeniusRankingButton } from "@/components/genius";

interface ProposalGroup {
  project: {
    id: string;
    title: string;
    status: string;
  };
  proposals: {
    id: string;
    cover_letter: string | null;
    milestones: unknown;
    status: "sent" | "accepted" | "rejected";
    created_at: string;
    freelancer_user_id: string;
    is_highlighted?: boolean;
    highlighted_at?: string | null;
    is_counterproposal?: boolean;
    freelancer?: {
      full_name: string | null;
      avatar_url: string | null;
      title: string | null;
      tier: string | null;
    } | null;
  }[];
}

const statusConfig = {
  sent: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function CompanyProposals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [proposalGroups, setProposalGroups] = useState<ProposalGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchProposals();
  }, [user]);

  const fetchProposals = async () => {
    if (!user) return;
    
    // First get all projects by this company
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, title, status")
      .eq("company_user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectsError || !projects) {
      setLoading(false);
      return;
    }

    // For each project, get proposals
    const groups: ProposalGroup[] = [];
    
    for (const project of projects) {
      const { data: proposals } = await supabase
        .from("proposals")
        .select("*")
        .eq("project_id", project.id)
        .order("is_highlighted", { ascending: false })
        .order("created_at", { ascending: false });

      if (proposals && proposals.length > 0) {
        // Fetch freelancer info for each proposal (including tier)
        const proposalsWithFreelancers = await Promise.all(
          proposals.map(async (proposal) => {
            const { data: freelancer } = await (supabase as any)
              .from("freelancer_profiles")
              .select("full_name, avatar_url, title, tier")
              .eq("user_id", proposal.freelancer_user_id)
              .maybeSingle();
            return { ...proposal, freelancer } as any;
          })
        );
        
        groups.push({
          project,
          proposals: proposalsWithFreelancers,
        });
      }
    }
    
    setProposalGroups(groups);
    setLoading(false);
  };

  const getTotalAmount = (milestones: unknown) => {
    if (!milestones || !Array.isArray(milestones)) return 0;
    return milestones.reduce((sum, m) => sum + (m?.amount || 0), 0);
  };

  const totalProposals = proposalGroups.reduce((sum, g) => sum + g.proposals.length, 0);
  const pendingProposals = proposalGroups.reduce(
    (sum, g) => sum + g.proposals.filter(p => p.status === "sent").length, 0
  );

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
        <h1 className="text-3xl font-bold">{t("companyProposals.title")}</h1>
        <p className="text-muted-foreground">
          {t("companyProposals.subtitle", { total: totalProposals, pending: pendingProposals })}
        </p>
      </div>

      {proposalGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("companyProposals.noProposals")}</h3>
            <p className="text-muted-foreground mb-4">{t("companyProposals.noProposalsDesc")}</p>
            <Button onClick={() => navigate("/projects/new")}>
              {t("companyProposals.postProject")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {proposalGroups.map((group) => (
            <Card key={group.project.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{group.project.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    {group.proposals.filter(p => p.status === "sent").length >= 2 && (
                      <GeniusRankingButton 
                        projectId={group.project.id} 
                        proposalsCount={group.proposals.filter(p => p.status === "sent").length}
                      />
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/projects/${group.project.id}`)}
                    >
                      {t("common.view")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {group.proposals.map((proposal) => {
                    const config = statusConfig[proposal.status];
                    const StatusIcon = config.icon;
                    const totalAmount = getTotalAmount(proposal.milestones as { title: string; amount: number }[] | null);
                    
                    return (
                      <div 
                        key={proposal.id}
                        className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                          proposal.is_highlighted ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : ""
                        }`}
                        onClick={() => navigate(`/projects/${group.project.id}`)}
                      >
                        <div className="relative">
                          <TieredAvatar
                            avatarUrl={proposal.freelancer?.avatar_url}
                            name={proposal.freelancer?.full_name}
                            tier={(proposal.freelancer?.tier as "standard" | "pro" | "top_rated") || "standard"}
                            size="md"
                            showBadge={true}
                          />
                          {proposal.is_highlighted && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                              <Star className="h-3 w-3 text-white fill-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium truncate">
                              {proposal.freelancer?.full_name || "Freelancer"}
                            </p>
                            {proposal.is_highlighted && (
                              <Badge variant="outline" className="border-amber-500 text-amber-500 gap-1">
                                <Star className="h-3 w-3 fill-current" />
                                Destacado
                              </Badge>
                            )}
                            <Badge className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                            {proposal.status === "accepted" && proposal.is_counterproposal && (
                              <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500">
                                <AlertTriangle className="h-3 w-3" />
                                Negociado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {proposal.freelancer?.title || proposal.cover_letter?.slice(0, 50)}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-1 font-semibold">
                            <DollarSign className="h-4 w-4" />
                            {totalAmount.toLocaleString()}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(proposal.created_at), "MMM d")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
