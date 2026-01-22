import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit2, User, Star, RefreshCw, Save, X } from "lucide-react";
import { useFreelancerPlanDefinitions, FreelancerPlanDefinition } from "@/hooks/useFreelancerPlanDefinitions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMoneyFromCents } from "@/lib/formatMoney";

export function FreelancerPlanDefinitionsManager() {
  const { t } = useTranslation();
  const { plans, loading, refetch } = useFreelancerPlanDefinitions();
  const [editingPlan, setEditingPlan] = useState<FreelancerPlanDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_usd_cents: 0,
    stripe_price_id: "",
    features: "",
    proposals_limit: "",
    highlight_proposals: false,
    priority_support: false,
    verified_badge: false,
    popular: false,
    is_active: true,
  });

  const openEditModal = (plan: FreelancerPlanDefinition) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price_usd_cents: plan.price_usd_cents,
      stripe_price_id: plan.stripe_price_id || "",
      features: plan.features.join("\n"),
      proposals_limit: plan.proposals_limit?.toString() || "",
      highlight_proposals: plan.highlight_proposals,
      priority_support: plan.priority_support,
      verified_badge: plan.verified_badge,
      popular: plan.popular,
      is_active: plan.is_active,
    });
  };

  const handleSave = async () => {
    if (!editingPlan) return;

    try {
      setSaving(true);
      
      const featuresArray = formData.features
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const { error } = await supabase
        .from("freelancer_plan_definitions")
        .update({
          name: formData.name,
          description: formData.description || null,
          price_usd_cents: formData.price_usd_cents,
          stripe_price_id: formData.stripe_price_id || null,
          features: featuresArray,
          proposals_limit: formData.proposals_limit ? parseInt(formData.proposals_limit) : null,
          highlight_proposals: formData.highlight_proposals,
          priority_support: formData.priority_support,
          verified_badge: formData.verified_badge,
          popular: formData.popular,
          is_active: formData.is_active,
        })
        .eq("id", editingPlan.id);

      if (error) throw error;

      toast.success("Plano atualizado com sucesso!");
      setEditingPlan(null);
      refetch();
    } catch (err) {
      console.error("Error updating plan:", err);
      toast.error("Erro ao atualizar plano");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Planos Freelancer
              </CardTitle>
              <CardDescription>
                Gerencie os planos de assinatura para freelancers (valores em USD)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Preço (USD)</TableHead>
                <TableHead>Limite Propostas</TableHead>
                <TableHead>Recursos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {plan.popular && (
                        <Badge variant="default" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Popular
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{plan.plan_type}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {formatMoneyFromCents(plan.price_usd_cents, "USD")}
                    </span>
                    <span className="text-xs text-muted-foreground">/mês</span>
                  </TableCell>
                  <TableCell>
                    {plan.proposals_limit ? (
                      <Badge variant="outline">{plan.proposals_limit}/mês</Badge>
                    ) : (
                      <Badge variant="secondary">Ilimitado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {plan.highlight_proposals && (
                        <Badge variant="outline" className="text-xs">Destaque</Badge>
                      )}
                      {plan.priority_support && (
                        <Badge variant="outline" className="text-xs">Suporte</Badge>
                      )}
                      {plan.verified_badge && (
                        <Badge variant="outline" className="text-xs">Verificado</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(plan)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano: {editingPlan?.name}</DialogTitle>
            <DialogDescription>
              Os valores são armazenados em USD e convertidos automaticamente para a moeda local do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Plano</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (USD centavos)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price_usd_cents}
                  onChange={(e) =>
                    setFormData({ ...formData, price_usd_cents: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  = {formatMoneyFromCents(formData.price_usd_cents, "USD")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
                <Input
                  id="stripe_price_id"
                  value={formData.stripe_price_id}
                  onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                  placeholder="price_xxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposals_limit">Limite de Propostas/mês</Label>
                <Input
                  id="proposals_limit"
                  type="number"
                  value={formData.proposals_limit}
                  onChange={(e) => setFormData({ ...formData, proposals_limit: e.target.value })}
                  placeholder="Vazio = ilimitado"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Recursos (um por linha)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                rows={5}
                placeholder="Propostas ilimitadas&#10;Destaque em propostas&#10;Suporte prioritário"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="popular">Plano Popular</Label>
                <Switch
                  id="popular"
                  checked={formData.popular}
                  onCheckedChange={(checked) => setFormData({ ...formData, popular: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Ativo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="highlight" className="text-sm">Destaque</Label>
                <Switch
                  id="highlight"
                  checked={formData.highlight_proposals}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, highlight_proposals: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="support" className="text-sm">Suporte</Label>
                <Switch
                  id="support"
                  checked={formData.priority_support}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, priority_support: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="verified" className="text-sm">Verificado</Label>
                <Switch
                  id="verified"
                  checked={formData.verified_badge}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, verified_badge: checked })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
