import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Briefcase, DollarSign, Calendar, Loader2, Filter } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
  company_user_id: string;
  company?: {
    company_name: string | null;
    logo_url: string | null;
  };
  _hasProposal?: boolean;
}

const categories = [
  "All Categories",
  "Development",
  "Design",
  "Marketing",
  "Writing",
  "Data Science",
  "Video & Photo",
  "Consulting",
  "Finance",
  "Legal",
  "Other",
];

export default function FindProjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [myProposalIds, setMyProposalIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProjects();
    if (user) fetchMyProposals();
  }, [user]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch company info for each project
      const projectsWithCompany = await Promise.all(
        data.map(async (project) => {
          const { data: company } = await supabase
            .from("company_profiles")
            .select("company_name, logo_url")
            .eq("user_id", project.company_user_id)
            .maybeSingle();
          return { ...project, company };
        })
      );
      setProjects(projectsWithCompany);
    }
    setLoading(false);
  };

  const fetchMyProposals = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("proposals")
      .select("project_id")
      .eq("freelancer_user_id", user.id);

    if (data) {
      setMyProposalIds(new Set(data.map((p) => p.project_id)));
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = searchQuery === "" || 
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "All Categories" || 
      project.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("findProjects.title")}</h1>
        <p className="text-muted-foreground">{t("findProjects.subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("findProjects.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {filteredProjects.length} {t("findProjects.projectsFound")}
        </p>

        {filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t("findProjects.noProjects")}</h3>
              <p className="text-muted-foreground">{t("findProjects.noProjectsDesc")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProjects.map((project) => {
              const hasProposal = myProposalIds.has(project.id);
              
              return (
                <Card 
                  key={project.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{project.title}</h3>
                          {hasProposal && (
                            <Badge variant="secondary">{t("findProjects.proposalSent")}</Badge>
                          )}
                        </div>
                        
                        {project.description && (
                          <p className="text-muted-foreground line-clamp-2 mb-3">
                            {project.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          {project.category && (
                            <Badge variant="outline">{project.category}</Badge>
                          )}
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            {formatBudget(project.budget_min, project.budget_max)}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(project.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                        
                        {project.company?.company_name && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {t("findProjects.postedBy")}: {project.company.company_name}
                          </p>
                        )}
                      </div>
                      
                      <Button 
                        variant={hasProposal ? "outline" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/project/${project.id}`);
                        }}
                      >
                        {hasProposal ? t("findProjects.viewProposal") : t("findProjects.sendProposal")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
