import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Briefcase, Clock, CheckCircle, FileText, Loader2, Rocket } from "lucide-react";
import { format, Locale, isAfter } from "date-fns";
import { ptBR, enUS, es, fr, de, zhCN } from "date-fns/locale";
import { ProjectBoostButton } from "@/components/projects/ProjectBoostButton";
import { BoostedBadge } from "@/components/projects/BoostedBadge";

const dateLocales: Record<string, Locale> = {
  pt: ptBR,
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  zh: zhCN,
};

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "draft" | "open" | "in_progress" | "completed";
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
  boosted_until: string | null;
  _count?: { proposals: number };
}

const statusConfig = {
  draft: { labelKey: "projects.draft", color: "bg-muted text-muted-foreground", icon: FileText },
  open: { labelKey: "projects.open", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: Briefcase },
  in_progress: { labelKey: "projects.inProgress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: Clock },
  completed: { labelKey: "projects.completed", color: "bg-primary/10 text-primary", icon: CheckCircle },
};

export default function Projects() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  
  const currentLocale = dateLocales[i18n.language] || enUS;

  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("company_user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch proposal counts for each project
      const projectsWithCounts = await Promise.all(
        data.map(async (project) => {
          const { count } = await supabase
            .from("proposals")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);
          return { ...project, _count: { proposals: count || 0 } };
        })
      );
      setProjects(projectsWithCounts);
    }
    setLoading(false);
  };

  const filteredProjects = projects.filter((p) => {
    if (activeTab === "all") return true;
    return p.status === activeTab;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("projects.title")}</h1>
          <p className="text-muted-foreground">{t("projects.subtitle")}</p>
        </div>
        <Button onClick={() => navigate("/projects/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("projects.newProject")}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t("projects.all")} ({projects.length})</TabsTrigger>
          <TabsTrigger value="draft">{t("projects.draft")} ({projects.filter(p => p.status === "draft").length})</TabsTrigger>
          <TabsTrigger value="open">{t("projects.open")} ({projects.filter(p => p.status === "open").length})</TabsTrigger>
          <TabsTrigger value="in_progress">{t("projects.inProgress")} ({projects.filter(p => p.status === "in_progress").length})</TabsTrigger>
          <TabsTrigger value="completed">{t("projects.completed")} ({projects.filter(p => p.status === "completed").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredProjects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t("projects.noProjects")}</h3>
                <p className="text-muted-foreground mb-4">{t("projects.noProjectsDesc")}</p>
                <Button onClick={() => navigate("/projects/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("projects.createFirst")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredProjects.map((project) => {
                const config = statusConfig[project.status];
                const StatusIcon = config.icon;
                const isBoosted = project.boosted_until && isAfter(new Date(project.boosted_until), new Date());
                
                return (
                  <Card 
                    key={project.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      isBoosted ? "border-primary/30 bg-primary/5" : ""
                    }`}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="font-semibold text-lg truncate">{project.title}</h3>
                            <Badge className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {t(config.labelKey)}
                            </Badge>
                            {isBoosted && <BoostedBadge />}
                          </div>
                          
                          {project.description && (
                            <p className="text-muted-foreground line-clamp-2 mb-3">
                              {project.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {project.category && (
                              <span className="bg-muted px-2 py-1 rounded">{t(`categories.${project.category}`, project.category)}</span>
                            )}
                            <span>{formatBudget(project.budget_min, project.budget_max)}</span>
                            <span>{format(new Date(project.created_at), "d MMM yyyy", { locale: currentLocale })}</span>
                            {isBoosted && project.boosted_until && (
                              <span className="text-primary flex items-center gap-1">
                                <Rocket className="h-3 w-3" />
                                {t("projects.boost.activeUntil", { 
                                  date: format(new Date(project.boosted_until), "dd/MM/yyyy") 
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{project._count?.proposals || 0}</p>
                            <p className="text-xs text-muted-foreground">{t("projects.proposals")}</p>
                          </div>
                          {project.status === "open" && (
                            <ProjectBoostButton
                              projectId={project.id}
                              projectStatus={project.status}
                              boostedUntil={project.boosted_until}
                              onBoostSuccess={fetchProjects}
                              variant="compact"
                            />
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
    </div>
  );
}
