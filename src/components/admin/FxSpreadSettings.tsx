import { useState, useEffect } from "react";
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
import { Save, RefreshCw, Plus, Percent, History, Settings2, AlertTriangle } from "lucide-react";

interface SpreadConfig {
  id: string;
  currency_code: string;
  spread_percent: number;
  is_enabled: boolean;
  updated_at: string;
}

interface SpreadHistory {
  id: string;
  currency_code: string;
  old_spread_percent: number;
  new_spread_percent: number;
  changed_at: string;
  change_reason: string | null;
}

interface SpreadLimits {
  min: number;
  max: number;
  default: number;
}

export default function FxSpreadSettings() {
  const [configs, setConfigs] = useState<SpreadConfig[]>([]);
  const [history, setHistory] = useState<SpreadHistory[]>([]);
  const [limits, setLimits] = useState<SpreadLimits>({ min: 0, max: 5, default: 0.8 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<SpreadConfig>>>({});
  const [newCurrency, setNewCurrency] = useState("");
  const [newSpread, setNewSpread] = useState("0.8");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchConfigs(),
      fetchHistory(),
      fetchLimits(),
    ]);
    setLoading(false);
  };

  const fetchConfigs = async () => {
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
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("fx_spread_change_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(50);
    
    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data || []);
    }
  };

  const fetchLimits = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["fx_spread_min_percent", "fx_spread_max_percent", "fx_spread_percent"]);
    
    if (data) {
      const minSetting = data.find(s => s.key === "fx_spread_min_percent");
      const maxSetting = data.find(s => s.key === "fx_spread_max_percent");
      const defaultSetting = data.find(s => s.key === "fx_spread_percent");
      
      setLimits({
        min: ((minSetting?.value as any)?.value ?? 0) * 100,
        max: ((maxSetting?.value as any)?.value ?? 0.05) * 100,
        default: ((defaultSetting?.value as any)?.value ?? 0.008) * 100,
      });
    }
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

  const isSpreadValid = (spreadPercent: number): boolean => {
    return spreadPercent >= limits.min && spreadPercent <= limits.max;
  };

  const saveChanges = async () => {
    // Validate all changes before saving
    for (const [id, changes] of Object.entries(editedConfigs)) {
      if (changes.spread_percent !== undefined) {
        const spreadPercent = changes.spread_percent * 100;
        if (!isSpreadValid(spreadPercent)) {
          toast.error(`Spread ${spreadPercent.toFixed(2)}% está fora dos limites [${limits.min}%, ${limits.max}%]`);
          return;
        }
      }
    }

    setSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      for (const [id, changes] of Object.entries(editedConfigs)) {
        const config = configs.find(c => c.id === id);
        if (!config) continue;
        
        // Log history for spread changes
        if (changes.spread_percent !== undefined && changes.spread_percent !== config.spread_percent) {
          await supabase
            .from("fx_spread_change_history")
            .insert({
              fx_spread_config_id: id,
              currency_code: config.currency_code,
              old_spread_percent: config.spread_percent,
              new_spread_percent: changes.spread_percent,
              changed_by_user_id: user?.id,
            });
        }
        
        const { error } = await supabase
          .from("fx_spread_configs")
          .update(changes)
          .eq("id", id);
        
        if (error) throw error;
      }
      
      toast.success("Configurações salvas");
      setEditedConfigs({});
      fetchData();
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

    const spreadPercent = parseFloat(newSpread);
    if (isNaN(spreadPercent) || !isSpreadValid(spreadPercent)) {
      toast.error(`Spread inválido. Deve estar entre ${limits.min}% e ${limits.max}%`);
      return;
    }

    const spreadDecimal = spreadPercent / 100;

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("fx_spread_configs")
      .insert({
        currency_code: newCurrency.toUpperCase(),
        spread_percent: spreadDecimal,
        is_enabled: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("Moeda já existe");
      } else {
        toast.error("Erro ao adicionar");
        console.error(error);
      }
    } else {
      // Log to history
      await supabase
        .from("fx_spread_change_history")
        .insert({
          fx_spread_config_id: data.id,
          currency_code: newCurrency.toUpperCase(),
          old_spread_percent: 0,
          new_spread_percent: spreadDecimal,
          changed_by_user_id: user?.id,
          change_reason: "Nova moeda adicionada",
        });
        
      toast.success("Moeda adicionada");
      setNewCurrency("");
      setNewSpread("0.8");
      fetchData();
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

  const getSpreadValidationClass = (config: SpreadConfig) => {
    const spreadPercent = parseFloat(getDisplaySpread(config));
    if (!isSpreadValid(spreadPercent)) {
      return "border-red-500 focus:border-red-500";
    }
    return "";
  };

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
                Limites de spread: mínimo <strong>{limits.min}%</strong>, máximo <strong>{limits.max}%</strong>. 
                Spread padrão: <strong>{limits.default.toFixed(2)}%</strong>. 
                Transações com spread fora dos limites serão bloqueadas.
              </AlertDescription>
            </Alert>

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
                  min={limits.min}
                  max={limits.max}
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
                            min={limits.min}
                            max={limits.max}
                            value={getDisplaySpread(config)}
                            onChange={(e) => handleSpreadChange(config.id, e.target.value)}
                            className={`w-24 ${getSpreadValidationClass(config)}`}
                          />
                          <span className="text-muted-foreground">%</span>
                          {!isSpreadValid(parseFloat(getDisplaySpread(config))) && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
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
                  <TableHead>Moeda</TableHead>
                  <TableHead>Spread Anterior</TableHead>
                  <TableHead>Novo Spread</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma alteração registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {entry.currency_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {(entry.old_spread_percent * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="font-mono">
                        {(entry.new_spread_percent * 100).toFixed(2)}%
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
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.change_reason || "—"}
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
