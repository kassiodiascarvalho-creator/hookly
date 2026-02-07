import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bug,
  Lightbulb,
  Eye,
  Trash2,
  Loader2,
  MessageSquare,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  User,
} from "lucide-react";

interface Feedback {
  id: string;
  user_id: string;
  user_type: "company" | "freelancer";
  feedback_type: "bug" | "suggestion";
  title: string;
  description: string;
  page_url: string | null;
  status: "pending" | "in_progress" | "resolved" | "closed";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminFeedbacks() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dateLocale = i18n.language === "pt" ? ptBR : enUS;

  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: feedbacks, isLoading } = useQuery({
    queryKey: ["admin-feedbacks"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("user_feedbacks" as any) as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Feedback[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await (supabase.from("user_feedbacks" as any) as any)
        .update({
          status,
          admin_notes: notes,
          resolved_by_admin_id: status === "resolved" ? user?.id : null,
          resolved_at: status === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedbacks"] });
      toast.success(t("admin.feedbacks.updated"));
      setSelectedFeedback(null);
    },
    onError: () => {
      toast.error(t("admin.feedbacks.updateError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("user_feedbacks" as any) as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedbacks"] });
      toast.success(t("admin.feedbacks.deleted"));
    },
    onError: () => {
      toast.error(t("admin.feedbacks.deleteError"));
    },
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      pending: { variant: "secondary", icon: <Clock className="h-3 w-3 text-yellow-500" /> },
      in_progress: { variant: "default", icon: <Loader2 className="h-3 w-3" /> },
      resolved: { variant: "outline", icon: <CheckCircle className="h-3 w-3 text-emerald-500" /> },
      closed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    };
    const { variant, icon } = config[status] || config.pending;
    return (
      <Badge variant={variant} className="gap-1">
        {icon}
        {t(`admin.feedbacks.status.${status}`)}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    if (type === "bug") {
      return (
        <Badge variant="destructive" className="gap-1">
          <Bug className="h-3 w-3" />
          {t("admin.feedbacks.type.bug")}
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-primary">
        <Lightbulb className="h-3 w-3" />
        {t("admin.feedbacks.type.suggestion")}
      </Badge>
    );
  };

  const filteredFeedbacks = feedbacks?.filter((f) => {
    if (filterType !== "all" && f.feedback_type !== filterType) return false;
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    return true;
  });

  const bugCount = feedbacks?.filter((f) => f.feedback_type === "bug").length || 0;
  const suggestionCount = feedbacks?.filter((f) => f.feedback_type === "suggestion").length || 0;
  const pendingCount = feedbacks?.filter((f) => f.status === "pending").length || 0;

  const handleOpenDetail = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setAdminNotes(feedback.admin_notes || "");
    setNewStatus(feedback.status);
  };

  const handleUpdate = () => {
    if (!selectedFeedback) return;
    updateMutation.mutate({
      id: selectedFeedback.id,
      status: newStatus,
      notes: adminNotes,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.feedbacks.title")}</h1>
        <p className="text-muted-foreground">{t("admin.feedbacks.description")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.feedbacks.total")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feedbacks?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Bug className="h-4 w-4 text-destructive" />
              {t("admin.feedbacks.bugs")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{bugCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              {t("admin.feedbacks.suggestions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{suggestionCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              {t("admin.feedbacks.pending")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("admin.feedbacks.list")}
          </CardTitle>
          <CardDescription>{t("admin.feedbacks.listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.feedbacks.filterType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.feedbacks.allTypes")}</SelectItem>
                  <SelectItem value="bug">{t("admin.feedbacks.type.bug")}</SelectItem>
                  <SelectItem value="suggestion">{t("admin.feedbacks.type.suggestion")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.feedbacks.filterStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.feedbacks.allStatus")}</SelectItem>
                  <SelectItem value="pending">{t("admin.feedbacks.status.pending")}</SelectItem>
                  <SelectItem value="in_progress">{t("admin.feedbacks.status.in_progress")}</SelectItem>
                  <SelectItem value="resolved">{t("admin.feedbacks.status.resolved")}</SelectItem>
                  <SelectItem value="closed">{t("admin.feedbacks.status.closed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFeedbacks && filteredFeedbacks.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.feedbacks.tableType")}</TableHead>
                    <TableHead>{t("admin.feedbacks.tableTitle")}</TableHead>
                    <TableHead>{t("admin.feedbacks.tableUserType")}</TableHead>
                    <TableHead>{t("admin.feedbacks.tableStatus")}</TableHead>
                    <TableHead>{t("admin.feedbacks.tableDate")}</TableHead>
                    <TableHead className="text-right">{t("admin.feedbacks.tableActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeedbacks.map((feedback) => (
                    <TableRow key={feedback.id}>
                      <TableCell>{getTypeBadge(feedback.feedback_type)}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {feedback.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {feedback.user_type === "company" ? (
                            <Building2 className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                          {feedback.user_type === "company" ? t("common.company") : t("common.freelancer")}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(feedback.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(feedback.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDetail(feedback)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(t("admin.feedbacks.confirmDelete"))) {
                                deleteMutation.mutate(feedback.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.feedbacks.noFeedbacks")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFeedback?.feedback_type === "bug" ? (
                <Bug className="h-5 w-5 text-destructive" />
              ) : (
                <Lightbulb className="h-5 w-5 text-primary" />
              )}
              {selectedFeedback?.title}
            </DialogTitle>
            <DialogDescription>
              {t("admin.feedbacks.detailDescription")}
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4 mt-4">
              <div className="flex gap-2">
                {getTypeBadge(selectedFeedback.feedback_type)}
                {getStatusBadge(selectedFeedback.status)}
                <Badge variant="outline" className="gap-1">
                  {selectedFeedback.user_type === "company" ? (
                    <Building2 className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {selectedFeedback.user_type === "company" ? t("common.company") : t("common.freelancer")}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("admin.feedbacks.descriptionLabel")}</Label>
                <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                  {selectedFeedback.description}
                </div>
              </div>

              {selectedFeedback.page_url && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t("admin.feedbacks.pageUrl")}</Label>
                  <div className="bg-muted p-3 rounded-md text-sm font-mono">
                    {selectedFeedback.page_url}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("admin.feedbacks.createdAt")}</Label>
                <div className="text-sm">
                  {format(new Date(selectedFeedback.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.feedbacks.updateStatus")}</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("admin.feedbacks.status.pending")}</SelectItem>
                    <SelectItem value="in_progress">{t("admin.feedbacks.status.in_progress")}</SelectItem>
                    <SelectItem value="resolved">{t("admin.feedbacks.status.resolved")}</SelectItem>
                    <SelectItem value="closed">{t("admin.feedbacks.status.closed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.feedbacks.adminNotes")}</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={t("admin.feedbacks.adminNotesPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("admin.feedbacks.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
