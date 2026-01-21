import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Save, RefreshCw, Percent, History, Settings2, AlertTriangle, CreditCard } from "lucide-react";
import { getPaymentFeeLabel } from "@/lib/getPaymentFeeLabel";

interface FeeConfig {
  id: string;
  fee_key: string;
  fee_percent: number;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  updated_at: string;
}

interface FeeHistory {
  id: string;
  fee_key: string;
  old_fee_percent: number;
  new_fee_percent: number;
  changed_at: string;
  change_reason: string | null;
}

// Limits: 0% to 20%
const FEE_LIMITS = {
  min: 0,
  max: 20,
};

export default function PaymentFeeSettings() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<FeeConfig[]>([]);
  const [history, setHistory] = useState<FeeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<FeeConfig>>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchConfigs(), fetchHistory()]);
    setLoading(false);
  };

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from("payment_fee_configs")
      .select("*")
      .order("fee_key");

    if (error) {
      toast.error("Erro ao carregar configurações de taxas");
      console.error(error);
    } else {
      setConfigs(
        (data || []).map((c) => ({
          ...c,
          fee_percent: Number(c.fee_percent),
        }))
      );
    }
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("payment_fee_change_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(
        (data || []).map((h) => ({
          ...h,
          old_fee_percent: Number(h.old_fee_percent),
          new_fee_percent: Number(h.new_fee_percent),
        }))
      );
    }
  };

  const handleFeeChange = (id: string, value: string) => {
    const numValue = parseFloat(value) / 100; // Convert percentage to decimal
    setEditedConfigs((prev) => ({
      ...prev,
      [id]: { ...prev[id], fee_percent: numValue },
    }));
  };

  const handleEnabledChange = (id: string, enabled: boolean) => {
    setEditedConfigs((prev) => ({
      ...prev,
      [id]: { ...prev[id], is_enabled: enabled },
    }));
  };

  const isFeeValid = (feePercent: number): boolean => {
    return feePercent >= FEE_LIMITS.min && feePercent <= FEE_LIMITS.max;
  };

  const saveChanges = async () => {
    // Validate all changes before saving
    for (const [id, changes] of Object.entries(editedConfigs)) {
      if (changes.fee_percent !== undefined) {
        const feePercent = changes.fee_percent * 100;
        if (!isFeeValid(feePercent)) {
          toast.error(
            `Taxa ${feePercent.toFixed(2)}% está fora dos limites [${FEE_LIMITS.min}%, ${FEE_LIMITS.max}%]`
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      for (const [id, changes] of Object.entries(editedConfigs)) {
        const config = configs.find((c) => c.id === id);
        if (!config) continue;

        // Log history for fee changes
        if (changes.fee_percent !== undefined && changes.fee_percent !== config.fee_percent) {
          await supabase.from("payment_fee_change_history").insert({
            fee_config_id: id,
            fee_key: config.fee_key,
            old_fee_percent: config.fee_percent,
            new_fee_percent: changes.fee_percent,
            changed_by_user_id: user?.id,
          });
        }

        const { error } = await supabase
          .from("payment_fee_configs")
          .update({
            ...changes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) throw error;
      }

      toast.success("Configurações de taxas salvas");
      setEditedConfigs({});
      fetchData();
    } catch (error) {
      toast.error("Erro ao salvar");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const getDisplayFee = (config: FeeConfig) => {
    const edited = editedConfigs[config.id];
    if (edited?.fee_percent !== undefined) {
      return (edited.fee_percent * 100).toFixed(2);
    }
    return (config.fee_percent * 100).toFixed(2);
  };

  const getDisplayEnabled = (config: FeeConfig) => {
    const edited = editedConfigs[config.id];
    return edited?.is_enabled ?? config.is_enabled;
  };

  const hasChanges = Object.keys(editedConfigs).length > 0;

  const getFeeValidationClass = (config: FeeConfig) => {
    const feePercent = parseFloat(getDisplayFee(config));
    if (!isFeeValid(feePercent)) {
      return "border-destructive focus:border-destructive";
    }
    return "";
  };

  // Use i18n with safe fallback - never expose fee_key to users
  const getFeeKeyLabel = (feeKey: string, displayName?: string): string => {
    return getPaymentFeeLabel(feeKey, t, displayName);
  };

  const getFeeKeyVariant = (feeKey: string): "default" | "secondary" | "outline" => {
    switch (feeKey) {
      case "international_card":
        return "default";
      case "brl_pix":
        return "secondary";
      case "brl_card":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Taxas de Pagamento
        </CardTitle>
        <CardDescription>
          Configure as taxas cobradas em cada método de pagamento (0% a 20%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config">
              <Settings2 className="h-4 w-4 mr-1" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            {/* Limits Alert */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Limites de taxa: mínimo <strong>{FEE_LIMITS.min}%</strong>, máximo{" "}
                <strong>{FEE_LIMITS.max}%</strong>. Alterações são aplicadas imediatamente em
                novos pagamentos.
              </AlertDescription>
            </Alert>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead>Taxa (%)</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Última Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : configs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma configuração encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={getFeeKeyVariant(config.fee_key)}>
                            {getFeeKeyLabel(config.fee_key, config.display_name)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {config.description || config.display_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={FEE_LIMITS.min}
                            max={FEE_LIMITS.max}
                            value={getDisplayFee(config)}
                            onChange={(e) => handleFeeChange(config.id, e.target.value)}
                            className={`w-24 ${getFeeValidationClass(config)}`}
                          />
                          <span className="text-muted-foreground">%</span>
                          {!isFeeValid(parseFloat(getDisplayFee(config))) && (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={getDisplayEnabled(config)}
                          onCheckedChange={(checked) => handleEnabledChange(config.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(config.updated_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Save button */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button onClick={saveChanges} disabled={!hasChanges || saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead>Taxa Anterior</TableHead>
                  <TableHead>Nova Taxa</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma alteração registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="outline">{getFeeKeyLabel(entry.fee_key)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {(entry.old_fee_percent * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="font-mono">
                        {(entry.new_fee_percent * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(entry.changed_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
