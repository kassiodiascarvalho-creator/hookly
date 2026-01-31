import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDataCard, MobileDataRow } from "@/components/admin/MobileDataCard";
import { AdminContractModal } from "@/components/admin/AdminContractModal";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  created_at: string;
  company_user_id: string;
}

const statusColors: Record<string, string> = {
  draft: "secondary",
  open: "default",
  in_progress: "outline",
  completed: "destructive",
};

export default function AdminProjects() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleViewContract = (project: Project) => {
    setSelectedProject(project);
    setContractModalOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-project", {
        body: { projectId: projectToDelete.id },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Falha ao excluir projeto");
      }
      
      toast.success(t("admin.projectDeleted", "Projeto excluído com sucesso"));
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
    } catch (error: any) {
      console.error("Error deleting project:", error);
      toast.error(error?.message || t("admin.projectDeleteError", "Erro ao excluir projeto"));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProjects(data || []);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(search.toLowerCase()) ||
      project.category?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("admin.projects")}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t("admin.projectsDescription")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3">
            <CardTitle className="text-lg md:text-xl">{t("admin.allProjects")}</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={t("admin.filterByStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.allStatuses")}</SelectItem>
                  <SelectItem value="draft">{t("projects.statusDraft")}</SelectItem>
                  <SelectItem value="open">{t("projects.statusOpen")}</SelectItem>
                  <SelectItem value="in_progress">{t("projects.statusInProgress")}</SelectItem>
                  <SelectItem value="completed">{t("projects.statusCompleted")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("admin.searchProjects")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isMobile ? (
            // Mobile view - card layout
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <MobileDataCard key={project.id}>
                  <div className="font-medium line-clamp-2">{project.title}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {project.category && (
                      <Badge variant="outline">{project.category}</Badge>
                    )}
                    <Badge variant={statusColors[project.status] as any || "secondary"}>
                      {t(`projects.status${project.status.charAt(0).toUpperCase() + project.status.slice(1).replace("_", "")}`)}
                    </Badge>
                  </div>
                  <MobileDataRow label={t("admin.budget")}>
                    {project.budget_min && project.budget_max
                      ? `$${project.budget_min.toLocaleString()} - $${project.budget_max.toLocaleString()}`
                      : "-"}
                  </MobileDataRow>
                  <MobileDataRow label={t("admin.createdAt")}>
                    {format(new Date(project.created_at), "PP")}
                  </MobileDataRow>
                  <div className="mt-3 pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewContract(project)}
                      className="flex-1"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {t("admin.viewContract", "Ver Contrato")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </MobileDataCard>
              ))}
              {filteredProjects.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  {t("admin.noProjectsFound")}
                </div>
              )}
            </div>
          ) : (
            // Desktop view - table
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.projectTitle")}</TableHead>
                  <TableHead>{t("admin.category")}</TableHead>
                  <TableHead>{t("admin.budget")}</TableHead>
                  <TableHead>{t("admin.status")}</TableHead>
                  <TableHead>{t("admin.createdAt")}</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {project.title}
                    </TableCell>
                    <TableCell>
                      {project.category ? (
                        <Badge variant="outline">{project.category}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {project.budget_min && project.budget_max
                        ? `$${project.budget_min.toLocaleString()} - $${project.budget_max.toLocaleString()}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[project.status] as any || "secondary"}>
                        {t(`projects.status${project.status.charAt(0).toUpperCase() + project.status.slice(1).replace("_", "")}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(project.created_at), "PP")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewContract(project)}
                        title={t("admin.viewContract", "Ver Contrato")}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(project)}
                        title={t("admin.deleteProject", "Excluir Projeto")}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t("admin.noProjectsFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Contract Modal */}
      {selectedProject && (
        <AdminContractModal
          open={contractModalOpen}
          onOpenChange={setContractModalOpen}
          projectId={selectedProject.id}
          projectTitle={selectedProject.title}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmDeleteProject", "Confirmar Exclusão")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.confirmDeleteProjectMessage", "Tem certeza que deseja excluir o projeto \"{{title}}\"? Esta ação não pode ser desfeita.", { title: projectToDelete?.title || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel", "Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("common.delete", "Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
