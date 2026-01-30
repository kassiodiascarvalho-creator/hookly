import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Building2,
  Loader2,
  Eye,
  RefreshCcw,
  Trash2,
  FileImage,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { IdentityVerificationBadge } from "@/components/identity/IdentityVerificationBadge";
import type { IdentityStatus } from "@/components/identity/IdentityVerificationBadge";

interface VerificationItem {
  id: string;
  user_id: string;
  subject_type: string;
  status: string;
  country: string;
  document_type: string;
  provider: string;
  risk_score: number | null;
  risk_level: string | null;
  failure_reason: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  reviewed_by_admin_id: string | null;
  admin_decision: string | null;
  admin_notes: string | null;
  admin_decision_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  files_count: number;
  total_count: number;
}

interface VerificationDetail {
  verification: {
    id: string;
    user_id: string;
    subject_type: string;
    status: string;
    country: string;
    document_type: string;
    provider: string;
    risk_score: number | null;
    risk_level: string | null;
    failure_reason: string | null;
    attempts: number;
    max_attempts: number;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    verified_at: string | null;
    reviewed_by_admin_id: string | null;
    admin_decision: string | null;
    admin_notes: string | null;
    admin_decision_at: string | null;
  };
  files: Array<{
    id: string;
    file_type: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    quality_score: number | null;
    quality_issues: string[] | null;
    created_at: string;
  }>;
  audit_logs: Array<{
    id: string;
    actor_id: string | null;
    actor_type: string;
    action: string;
    previous_status: string | null;
    new_status: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}

interface FileWithUrl {
  file_type: string;
  storage_path: string;
  signed_url?: string;
  quality_score: number | null;
  quality_issues: string[] | null;
}

const STATUS_TABS = [
  { value: "all", label: "Todos", icon: Shield },
  { value: "manual_review", label: "Pendentes", icon: AlertTriangle },
  { value: "processing", label: "Processando", icon: Clock },
  { value: "verified", label: "Aprovados", icon: CheckCircle2 },
  { value: "rejected", label: "Rejeitados", icon: XCircle },
  { value: "failed_soft", label: "Falhou", icon: AlertTriangle },
];

const DOCUMENT_LABELS: Record<string, string> = {
  cnh: "CNH",
  rg: "RG",
  passport: "Passaporte",
  national_id: "ID Nacional",
  drivers_license: "Carteira de Motorista",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  document_front: "Documento (Frente)",
  document_back: "Documento (Verso)",
  selfie: "Selfie",
};

export default function AdminIdentityVerifications() {
  const { t } = useTranslation();
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Detail modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fileUrls, setFileUrls] = useState<FileWithUrl[]>([]);

  // Action modal
  const [actionType, setActionType] = useState<"approve" | "reject" | "reset" | "delete_evidence" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)(
        "get_identity_verifications_admin",
        {
          p_status_filter: statusFilter === "all" ? null : statusFilter,
          p_search: search || null,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }
      );

      if (error) throw error;

      setVerifications(data || []);
      if (data && data.length > 0) {
        setTotalCount(data[0].total_count);
      } else {
        setTotalCount(0);
      }
    } catch (error) {
      console.error("Error fetching verifications:", error);
      toast.error("Erro ao carregar verificações");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const fetchDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setSelectedId(id);
      setFileUrls([]);

      const { data, error } = await (supabase.rpc as any)(
        "get_identity_verification_detail",
        { p_verification_id: id }
      );

      if (error) throw error;

      const detailData = data as VerificationDetail;
      setDetail(detailData);

      // Get signed URLs for files
      if (detailData.files && detailData.files.length > 0) {
        const urls: FileWithUrl[] = [];
        for (const file of detailData.files) {
          const { data: signedData } = await supabase.storage
            .from("identity_private")
            .createSignedUrl(file.storage_path, 600); // 10 minute expiry

          urls.push({
            file_type: file.file_type,
            storage_path: file.storage_path,
            signed_url: signedData?.signedUrl,
            quality_score: file.quality_score,
            quality_issues: file.quality_issues,
          });
        }
        setFileUrls(urls);
      }
    } catch (error) {
      console.error("Error fetching detail:", error);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedId || !actionType) return;

    setActionLoading(true);
    try {
      if (actionType === "delete_evidence") {
        // Delete evidence files
        const { data, error } = await (supabase.rpc as any)(
          "admin_delete_identity_evidence",
          { p_verification_id: selectedId }
        );

        if (error) throw error;

        // Delete from storage
        const filesToDelete = data?.files_to_delete || [];
        if (filesToDelete.length > 0) {
          await supabase.storage.from("identity_private").remove(filesToDelete);
        }

        toast.success("Evidências apagadas");
        setFileUrls([]);
        if (detail) {
          setDetail({ ...detail, files: [] });
        }
      } else {
        // Approve/Reject/Reset
        const response = await supabase.functions.invoke("admin-review-identity", {
          body: {
            verificationId: selectedId,
            decision: actionType === "reset" ? "reset" : actionType === "approve" ? "approved" : "rejected",
            notes: actionNotes,
          },
        });

        if (response.error) throw new Error(response.error.message);
        if (!response.data.success) throw new Error(response.data.message);

        toast.success(
          actionType === "approve"
            ? "Verificação aprovada"
            : actionType === "reject"
            ? "Verificação rejeitada"
            : "Tentativas resetadas"
        );

        // Refresh
        fetchVerifications();
        if (selectedId) fetchDetail(selectedId);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Erro na operação");
    } finally {
      setActionLoading(false);
      setActionType(null);
      setActionNotes("");
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setFileUrls([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "manual_review":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "failed_soft":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getRiskColor = (level: string | null) => {
    switch (level) {
      case "high":
        return "text-red-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-muted-foreground";
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Verificação de Identidade</h1>
        </div>
        <Button variant="outline" onClick={fetchVerifications} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <TabsList className="flex-wrap h-auto">
                {STATUS_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-1">
                    <tab.icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {totalCount} verificações encontradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : verifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma verificação encontrada
            </div>
          ) : (
            <div className="space-y-2">
              {verifications.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => fetchDetail(v.id)}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={v.avatar_url || undefined} />
                    <AvatarFallback>
                      {v.subject_type === "freelancer" ? (
                        <User className="h-5 w-5" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {v.display_name || v.email || "Sem nome"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {v.subject_type === "freelancer" ? "Freelancer" : "Empresa"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{v.country}</span>
                      <span>•</span>
                      <span>{DOCUMENT_LABELS[v.document_type] || v.document_type}</span>
                      <span>•</span>
                      <span>Tentativa {v.attempts}/{v.max_attempts}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {v.risk_score !== null && (
                      <div className={`text-sm ${getRiskColor(v.risk_level)}`}>
                        {(v.risk_score * 100).toFixed(0)}%
                      </div>
                    )}
                    <Badge className={getStatusColor(v.status)}>
                      {v.status === "manual_review" ? "Análise" : v.status}
                    </Badge>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <FileImage className="h-4 w-4" />
                      <span className="text-xs">{v.files_count}</span>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Verificação de Identidade
                </DialogTitle>
                <DialogDescription>
                  ID: {detail.verification.id}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">
                        <IdentityVerificationBadge
                          status={detail.verification.status as IdentityStatus}
                          size="md"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <p className="font-medium">
                        {detail.verification.subject_type === "freelancer" ? "Freelancer" : "Empresa"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">País</Label>
                      <p className="font-medium">{detail.verification.country}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Documento</Label>
                      <p className="font-medium">
                        {DOCUMENT_LABELS[detail.verification.document_type] || detail.verification.document_type}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Tentativas</Label>
                      <p className="font-medium">
                        {detail.verification.attempts}/{detail.verification.max_attempts}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Risk Score</Label>
                      <p className={`font-medium ${getRiskColor(detail.verification.risk_level)}`}>
                        {detail.verification.risk_score !== null
                          ? `${(detail.verification.risk_score * 100).toFixed(0)}% (${detail.verification.risk_level})`
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {detail.verification.failure_reason && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Motivo da Falha</Label>
                      <p className="text-sm text-destructive mt-1">
                        {detail.verification.failure_reason}
                      </p>
                    </div>
                  )}

                  {detail.verification.admin_notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Notas do Admin</Label>
                      <p className="text-sm mt-1">{detail.verification.admin_notes}</p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Criado: {format(new Date(detail.verification.created_at), "dd/MM/yyyy HH:mm")}</p>
                    <p>Atualizado: {format(new Date(detail.verification.updated_at), "dd/MM/yyyy HH:mm")}</p>
                    {detail.verification.verified_at && (
                      <p>Verificado: {format(new Date(detail.verification.verified_at), "dd/MM/yyyy HH:mm")}</p>
                    )}
                  </div>
                </div>

                {/* Files */}
                <div className="space-y-4">
                  <Label>Documentos Enviados</Label>
                  {fileUrls.length === 0 ? (
                    <div className="text-center py-8 border rounded-lg bg-muted/50">
                      <FileImage className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum arquivo</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {fileUrls.map((file) => (
                        <div key={file.file_type} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {FILE_TYPE_LABELS[file.file_type]}
                            </span>
                            {file.quality_score !== null && (
                              <Badge
                                variant={file.quality_score >= 0.7 ? "default" : "destructive"}
                              >
                                {(file.quality_score * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                          {file.signed_url ? (
                            <img
                              src={file.signed_url}
                              alt={FILE_TYPE_LABELS[file.file_type]}
                              className="w-full h-40 object-cover rounded cursor-pointer hover:opacity-90 transition"
                              onClick={() => window.open(file.signed_url, "_blank")}
                            />
                          ) : (
                            <div className="h-40 bg-muted rounded flex items-center justify-center">
                              <span className="text-sm text-muted-foreground">
                                Não disponível
                              </span>
                            </div>
                          )}
                          {file.quality_issues && file.quality_issues.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {file.quality_issues.map((issue) => (
                                <Badge key={issue} variant="outline" className="text-xs">
                                  {issue}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Logs */}
              <div className="mt-4">
                <Label>Histórico de Auditoria</Label>
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                  {detail.audit_logs.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Nenhum log</p>
                  ) : (
                    <div className="divide-y">
                      {detail.audit_logs.map((log) => (
                        <div key={log.id} className="p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{log.action}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM HH:mm")}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.actor_type}
                            {log.previous_status && log.new_status && (
                              <span>
                                {" "}• {log.previous_status} → {log.new_status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setActionType("delete_evidence")}
                  disabled={fileUrls.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Apagar Evidências
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActionType("reset")}
                  disabled={detail.verification.status === "verified"}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Resetar Tentativas
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setActionType("reject")}
                  disabled={detail.verification.status === "rejected"}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  onClick={() => setActionType("approve")}
                  disabled={detail.verification.status === "verified"}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Modal */}
      <Dialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Aprovar Verificação"}
              {actionType === "reject" && "Rejeitar Verificação"}
              {actionType === "reset" && "Resetar Tentativas"}
              {actionType === "delete_evidence" && "Apagar Evidências"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" && "Confirma que os documentos são válidos e a identidade está verificada?"}
              {actionType === "reject" && "Rejeitar esta verificação? O usuário será notificado."}
              {actionType === "reset" && "Resetar o contador de tentativas para permitir nova verificação?"}
              {actionType === "delete_evidence" && "Apagar todos os arquivos de evidência? Esta ação é irreversível."}
            </DialogDescription>
          </DialogHeader>

          {(actionType === "approve" || actionType === "reject") && (
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Adicione notas sobre esta decisão..."
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancelar
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
