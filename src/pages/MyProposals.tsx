import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, DollarSign, Calendar, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface Proposal {
  id: string;
  cover_letter: string | null;
  milestones: unknown;
  status: "sent" | "accepted" | "rejected";
  created_at: string;
  project_id: string;
  project?: {
    title: string;
    category: string | null;
    budget_min: number | null;
    budget_max: number | null;
    status: string;
  } | null;
}

const statusConfig = {
  sent: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

export default function MyProposals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) fetchProposals();
  }, [user]);

  const fetchProposals = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("freelancer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch project info for each proposal
      const proposalsWithProjects = await Promise.all(
        data.map(async (proposal) => {
          const { data: project } = await supabase
            .from("projects")
            .select("title, category, budget_min, budget_max, status")
            .eq("id", proposal.project_id)
            .maybeSingle();
          return { ...proposal, project };
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
      <div>
        <h1 className="text-3xl font-bold">{t("myProposals.title")}</h1>
        <p className="text-muted-foreground">{t("myProposals.subtitle")}</p>
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
                
                return (
                  <Card 
                    key={proposal.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/project/${proposal.project_id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg truncate">
                              {proposal.project?.title || t("myProposals.untitledProject")}
                            </h3>
                            <Badge className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          
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
                          <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                            <DollarSign className="h-4 w-4" />
                            {totalAmount.toLocaleString()}
                          </div>
                          <p className="text-xs text-muted-foreground">{t("myProposals.yourBid")}</p>
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
    </div>
  );
}
