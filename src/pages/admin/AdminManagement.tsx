import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAdminPermissions,
  useAllAdmins,
  useAdminActions,
  AdminPermissions,
} from "@/hooks/useAdminPermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Shield, ShieldAlert, Trash2, Edit, Crown, User } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDataCard, MobileDataRow } from "@/components/admin/MobileDataCard";

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  can_manage_users: { label: "Usuários", description: "Visualizar e gerenciar usuários" },
  can_manage_freelancers: { label: "Freelancers", description: "Gerenciar perfis de freelancers" },
  can_manage_companies: { label: "Empresas", description: "Gerenciar perfis de empresas" },
  can_manage_projects: { label: "Projetos", description: "Gerenciar projetos" },
  can_manage_payments: { label: "Pagamentos", description: "Gerenciar pagamentos" },
  can_manage_finances: { label: "Finanças", description: "Visualizar e gerenciar finanças" },
  can_manage_tiers: { label: "Tiers/Planos", description: "Gerenciar tiers e planos" },
  can_manage_payment_providers: { label: "Provedores de Pagamento", description: "Configurar provedores de pagamento" },
  can_manage_landing_page: { label: "Landing Page", description: "Editar conteúdo da landing page" },
  can_manage_analytics: { label: "Analytics", description: "Visualizar dados de analytics e gravações" },
  can_manage_identity: { label: "Verificações de Identidade", description: "Revisar verificações de identidade (KYC)" },
  can_manage_feedbacks: { label: "Feedbacks", description: "Visualizar e gerenciar feedbacks de usuários" },
};

const DEFAULT_PERMISSIONS: Partial<AdminPermissions> = {
  can_manage_users: false,
  can_manage_freelancers: false,
  can_manage_companies: false,
  can_manage_projects: false,
  can_manage_payments: false,
  can_manage_finances: false,
  can_manage_tiers: false,
  can_manage_payment_providers: false,
  can_manage_landing_page: false,
  can_manage_analytics: false,
  can_manage_identity: false,
  can_manage_feedbacks: false,
};

export default function AdminManagement() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { isOwner, loading: permLoading } = useAdminPermissions();
  const { admins, loading: adminsLoading, refetch } = useAllAdmins();
  const { addSubAdmin, removeSubAdmin, updateSubAdminPermissions, loading: actionLoading } = useAdminActions();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<(typeof admins)[0] | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newPermissions, setNewPermissions] = useState<Partial<AdminPermissions>>(DEFAULT_PERMISSIONS);

  // Only owner can access this page
  if (permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso Restrito</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Apenas o proprietário da plataforma pode gerenciar administradores.
        </p>
      </div>
    );
  }

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      toast.error("Digite o email do usuário");
      return;
    }

    const result = await addSubAdmin(newAdminEmail.trim(), newPermissions);

    if (result.success) {
      toast.success("Administrador adicionado com sucesso!");
      setAddDialogOpen(false);
      setNewAdminEmail("");
      setNewPermissions(DEFAULT_PERMISSIONS);
      refetch();
    } else {
      toast.error(result.error || "Erro ao adicionar administrador");
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedAdmin) return;

    const result = await updateSubAdminPermissions(selectedAdmin.user_id, newPermissions);

    if (result.success) {
      toast.success("Permissões atualizadas!");
      setEditDialogOpen(false);
      setSelectedAdmin(null);
      refetch();
    } else {
      toast.error(result.error || "Erro ao atualizar permissões");
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    const result = await removeSubAdmin(userId);

    if (result.success) {
      toast.success("Administrador removido!");
      refetch();
    } else {
      toast.error(result.error || "Erro ao remover administrador");
    }
  };

  const openEditDialog = (admin: (typeof admins)[0]) => {
    setSelectedAdmin(admin);
    setNewPermissions({
      can_manage_users: admin.can_manage_users,
      can_manage_freelancers: admin.can_manage_freelancers,
      can_manage_companies: admin.can_manage_companies,
      can_manage_projects: admin.can_manage_projects,
      can_manage_payments: admin.can_manage_payments,
      can_manage_finances: admin.can_manage_finances,
      can_manage_tiers: admin.can_manage_tiers,
      can_manage_payment_providers: admin.can_manage_payment_providers,
      can_manage_landing_page: admin.can_manage_landing_page,
      can_manage_analytics: admin.can_manage_analytics,
      can_manage_identity: admin.can_manage_identity,
      can_manage_feedbacks: admin.can_manage_feedbacks,
    });
    setEditDialogOpen(true);
  };

  const countActivePermissions = (admin: (typeof admins)[0]) => {
    return Object.keys(PERMISSION_LABELS).filter(
      (key) => admin[key as keyof typeof admin] === true
    ).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7" />
            Gerenciar Administradores
          </h1>
          <p className="text-muted-foreground">
            Adicione e gerencie outros administradores com permissões limitadas
          </p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Administrador</DialogTitle>
              <DialogDescription>
                Digite o email de um usuário cadastrado para adicionar como administrador.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email do Usuário</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@email.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Permissões</Label>
                {Object.entries(PERMISSION_LABELS).map(([key, { label, description }]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={newPermissions[key as keyof AdminPermissions] === true}
                      onCheckedChange={(checked) =>
                        setNewPermissions({ ...newPermissions, [key]: checked })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddAdmin} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Administradores</CardTitle>
          <CardDescription>
            Lista de todos os administradores e suas permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adminsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum administrador cadastrado
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {admins.map((admin) => (
                <MobileDataCard key={admin.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {admin.is_owner ? (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">{admin.email}</span>
                      </div>
                      {admin.full_name && (
                        <p className="text-xs text-muted-foreground mt-1">{admin.full_name}</p>
                      )}
                    </div>
                    {admin.is_owner ? (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        Proprietário
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sub-admin</Badge>
                    )}
                  </div>

                  <MobileDataRow label="Permissões">
                    {admin.is_owner ? "Todas" : `${countActivePermissions(admin)} de ${Object.keys(PERMISSION_LABELS).length}`}
                  </MobileDataRow>

                  {!admin.is_owner && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(admin)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover Administrador</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover {admin.email} como administrador?
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveAdmin(admin.user_id)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </MobileDataCard>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {admin.is_owner ? (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{admin.email}</p>
                          {admin.full_name && (
                            <p className="text-sm text-muted-foreground">{admin.full_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.is_owner ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          Proprietário
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sub-admin</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin.is_owner ? (
                        <span className="text-sm text-muted-foreground">Todas as permissões</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(PERMISSION_LABELS)
                            .filter(([key]) => admin[key as keyof typeof admin] === true)
                            .map(([key, { label }]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {label}
                              </Badge>
                            ))}
                          {countActivePermissions(admin) === 0 && (
                            <span className="text-sm text-muted-foreground">Nenhuma</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!admin.is_owner && (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(admin)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Administrador</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover {admin.email} como administrador?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveAdmin(admin.user_id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Permissões</DialogTitle>
            <DialogDescription>
              {selectedAdmin?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {Object.entries(PERMISSION_LABELS).map(([key, { label, description }]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={newPermissions[key as keyof AdminPermissions] === true}
                  onCheckedChange={(checked) =>
                    setNewPermissions({ ...newPermissions, [key]: checked })
                  }
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePermissions} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
