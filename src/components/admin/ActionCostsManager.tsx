import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Coins, Settings } from "lucide-react";

interface ActionCost {
  id: string;
  action_key: string;
  display_name: string;
  description: string | null;
  cost_credits: number;
  is_enabled: boolean;
}

export function ActionCostsManager() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [actionCosts, setActionCosts] = useState<ActionCost[]>([]);

  useEffect(() => {
    fetchActionCosts();
  }, []);

  const fetchActionCosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_action_costs")
      .select("*")
      .order("display_name");

    if (error) {
      toast.error("Erro ao carregar custos de ações");
      console.error(error);
    } else if (data) {
      setActionCosts(data);
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string, updates: Partial<ActionCost>) => {
    setSaving(id);

    const { error } = await supabase
      .from("platform_action_costs")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar");
      console.error(error);
    } else {
      toast.success("Atualizado com sucesso");
      setActionCosts((prev) =>
        prev.map((ac) => (ac.id === id ? { ...ac, ...updates } : ac))
      );
    }
    setSaving(null);
  };

  const handleCostChange = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setActionCosts((prev) =>
      prev.map((ac) => (ac.id === id ? { ...ac, cost_credits: numValue } : ac))
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Custos de Ações da Plataforma
        </CardTitle>
        <CardDescription>
          Configure o custo em créditos para cada ação da plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {actionCosts.map((action) => (
            <div
              key={action.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{action.display_name}</h4>
                  {!action.is_enabled && (
                    <Badge variant="secondary">Desabilitado</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {action.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Chave: <code className="bg-muted px-1 rounded">{action.action_key}</code>
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {/* Cost input */}
                <div className="flex items-center gap-2">
                  <Label htmlFor={`cost-${action.id}`} className="text-sm whitespace-nowrap">
                    <Coins className="h-4 w-4 inline mr-1" />
                    Custo:
                  </Label>
                  <Input
                    id={`cost-${action.id}`}
                    type="number"
                    min="0"
                    value={action.cost_credits}
                    onChange={(e) => handleCostChange(action.id, e.target.value)}
                    className="w-20"
                  />
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={action.is_enabled}
                    onCheckedChange={(checked) =>
                      handleUpdate(action.id, { is_enabled: checked })
                    }
                  />
                </div>

                {/* Save button */}
                <Button
                  size="sm"
                  onClick={() =>
                    handleUpdate(action.id, { cost_credits: action.cost_credits })
                  }
                  disabled={saving === action.id}
                >
                  {saving === action.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
