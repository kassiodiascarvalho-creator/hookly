import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, RefreshCw, Plus, Percent } from "lucide-react";

interface SpreadConfig {
  id: string;
  currency_code: string;
  spread_percent: number;
  is_enabled: boolean;
  updated_at: string;
}

export default function FxSpreadSettings() {
  const [configs, setConfigs] = useState<SpreadConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<SpreadConfig>>>({});
  const [newCurrency, setNewCurrency] = useState("");
  const [newSpread, setNewSpread] = useState("0.8");

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fx_spread_configs")
      .select("*")
      .order("currency_code");
    
    if (error) {
      toast.error("Erro ao carregar configurações");
      console.error(error);
    } else {
      setConfigs(data || []);
    }
    setLoading(false);
  };

  const handleSpreadChange = (id: string, value: string) => {
    const numValue = parseFloat(value) / 100; // Convert percentage to decimal
    setEditedConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], spread_percent: numValue }
    }));
  };

  const handleEnabledChange = (id: string, enabled: boolean) => {
    setEditedConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], is_enabled: enabled }
    }));
  };

  const saveChanges = async () => {
    setSaving(true);
    
    try {
      for (const [id, changes] of Object.entries(editedConfigs)) {
        const { error } = await supabase
          .from("fx_spread_configs")
          .update(changes)
          .eq("id", id);
        
        if (error) throw error;
      }
      
      toast.success("Configurações salvas");
      setEditedConfigs({});
      fetchConfigs();
    } catch (error) {
      toast.error("Erro ao salvar");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const addNewCurrency = async () => {
    if (!newCurrency || newCurrency.length !== 3) {
      toast.error("Código de moeda inválido (deve ter 3 letras)");
      return;
    }

    const spreadDecimal = parseFloat(newSpread) / 100;
    if (isNaN(spreadDecimal) || spreadDecimal < 0 || spreadDecimal > 5) {
      toast.error("Spread inválido (0-5%)");
      return;
    }

    const { error } = await supabase
      .from("fx_spread_configs")
      .insert({
        currency_code: newCurrency.toUpperCase(),
        spread_percent: spreadDecimal,
        is_enabled: true,
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Moeda já existe");
      } else {
        toast.error("Erro ao adicionar");
        console.error(error);
      }
    } else {
      toast.success("Moeda adicionada");
      setNewCurrency("");
      setNewSpread("0.8");
      fetchConfigs();
    }
  };

  const getDisplaySpread = (config: SpreadConfig) => {
    const edited = editedConfigs[config.id];
    if (edited?.spread_percent !== undefined) {
      return (edited.spread_percent * 100).toFixed(2);
    }
    return (config.spread_percent * 100).toFixed(2);
  };

  const getDisplayEnabled = (config: SpreadConfig) => {
    const edited = editedConfigs[config.id];
    return edited?.is_enabled ?? config.is_enabled;
  };

  const hasChanges = Object.keys(editedConfigs).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Configuração de Spread por Moeda
        </CardTitle>
        <CardDescription>
          Defina o spread (margem de lucro) aplicado na conversão de cada moeda para USD
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new currency */}
        <div className="flex gap-2 items-end p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <label className="text-sm font-medium">Nova Moeda (ISO-4217)</label>
            <Input
              placeholder="BRL, EUR, GBP..."
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="uppercase"
            />
          </div>
          <div className="w-32">
            <label className="text-sm font-medium">Spread (%)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={newSpread}
              onChange={(e) => setNewSpread(e.target.value)}
            />
          </div>
          <Button onClick={addNewCurrency} variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Moeda</TableHead>
              <TableHead>Spread (%)</TableHead>
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
                    <Badge variant="outline" className="font-mono">
                      {config.currency_code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        value={getDisplaySpread(config)}
                        onChange={(e) => handleSpreadChange(config.id, e.target.value)}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">%</span>
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
          <Button variant="outline" onClick={fetchConfigs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={saveChanges} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}