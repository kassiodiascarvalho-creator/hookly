import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Star, Zap, Shield, Users, TrendingDown } from "lucide-react";
import { TierBadge, FreelancerTier } from "@/components/freelancer/TierBadge";
import { formatMoneyFromCents } from "@/lib/formatMoney";

interface TierFeeOverride {
  id: string;
  tier: FreelancerTier;
  fee_key: string;
  fee_percent_override: number;
  created_at: string;
  updated_at: string;
}

interface FreelancerWithTier {
  user_id: string;
  full_name: string | null;
  title: string | null;
  tier: FreelancerTier;
  total_revenue: number | null;
  verified: boolean;
}

export default function AdminTierManager() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<TierFeeOverride[]>([]);
  const [freelancers, setFreelancers] = useState<FreelancerWithTier[]>([]);
  const [editedOverrides, setEditedOverrides] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<FreelancerTier | "all">("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [overridesResult, freelancersResult] = await Promise.all([
        supabase.from("tier_fee_overrides").select("*").order("tier"),
        supabase.from("freelancer_profiles")
          .select("user_id, full_name, title, tier, total_revenue, verified")
          .order("total_revenue", { ascending: false })
          .limit(100),
      ]);

      if (overridesResult.error) throw overridesResult.error;
      if (freelancersResult.error) throw freelancersResult.error;

      setOverrides(overridesResult.data as TierFeeOverride[] || []);
      setFreelancers(freelancersResult.data as FreelancerWithTier[] || []);
    } catch (error) {
      console.error("Error fetching tier data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideChange = (id: string, value: string) => {
    const numValue = parseFloat(value) / 100; // Convert percentage to decimal
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 0.20) {
      setEditedOverrides(prev => ({ ...prev, [id]: numValue }));
    }
  };

  const saveOverrides = async () => {
    try {
      setSaving(true);
      
      for (const [id, newPercent] of Object.entries(editedOverrides)) {
        const { error } = await supabase
          .from("tier_fee_overrides")
          .update({ fee_percent_override: newPercent })
          .eq("id", id);
        
        if (error) throw error;
      }
      
      toast.success("Taxas atualizadas com sucesso");
      setEditedOverrides({});
      fetchData();
    } catch (error) {
      console.error("Error saving overrides:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const updateFreelancerTier = async (userId: string, newTier: FreelancerTier) => {
    try {
      const { error } = await supabase
        .from("freelancer_profiles")
        .update({ tier: newTier })
        .eq("user_id", userId);

      if (error) throw error;
      
      toast.success(`Tier atualizado para ${newTier}`);
      fetchData();
    } catch (error) {
      console.error("Error updating tier:", error);
      toast.error("Erro ao atualizar tier");
    }
  };

  const getFeeKeyLabel = (feeKey: string): string => {
    const labels: Record<string, string> = {
      international_card: "Cartão Internacional",
      brl_pix: "PIX Brasil",
      brl_card: "Cartão Brasil",
    };
    return labels[feeKey] || feeKey;
  };

  const filteredFreelancers = freelancers.filter(f => {
    const matchesSearch = !searchQuery || 
      f.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === "all" || f.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  // Group overrides by tier
  const overridesByTier = overrides.reduce((acc, o) => {
    if (!acc[o.tier]) acc[o.tier] = [];
    acc[o.tier].push(o);
    return acc;
  }, {} as Record<string, TierFeeOverride[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Gerenciamento de Tiers</h1>
        <p className="text-muted-foreground">Configure taxas diferenciadas e gerencie níveis de freelancers</p>
      </div>

      <Tabs defaultValue="fees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fees" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Taxas por Tier
          </TabsTrigger>
          <TabsTrigger value="freelancers" className="gap-2">
            <Users className="h-4 w-4" />
            Freelancers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fees" className="space-y-4">
          {/* Tier Fee Overrides */}
          {(["pro", "top_rated"] as FreelancerTier[]).map(tier => (
            <Card key={tier}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <TierBadge tier={tier} size="lg" />
                  <div>
                    <CardTitle className="text-lg">
                      {tier === "pro" ? "Desconto Pro" : "Desconto Top Rated"}
                    </CardTitle>
                    <CardDescription>
                      Taxas reduzidas para freelancers {tier}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Método de Pagamento</TableHead>
                      <TableHead>Taxa Padrão</TableHead>
                      <TableHead>Taxa {tier}</TableHead>
                      <TableHead>Economia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overridesByTier[tier] || []).map(override => {
                      const currentValue = editedOverrides[override.id] ?? override.fee_percent_override;
                      // For display, assume standard is 15%, 2%, 6%
                      const standardRates: Record<string, number> = {
                        international_card: 0.15,
                        brl_pix: 0.02,
                        brl_card: 0.06,
                      };
                      const standardRate = standardRates[override.fee_key] || 0;
                      const savings = standardRate - currentValue;
                      
                      return (
                        <TableRow key={override.id}>
                          <TableCell className="font-medium">
                            {getFeeKeyLabel(override.fee_key)}
                          </TableCell>
                          <TableCell>{(standardRate * 100).toFixed(1)}%</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="20"
                                value={(currentValue * 100).toFixed(1)}
                                onChange={(e) => handleOverrideChange(override.id, e.target.value)}
                                className="w-20"
                              />
                              <span className="text-muted-foreground">%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              -{(savings * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {Object.keys(editedOverrides).length > 0 && (
            <div className="flex justify-end">
              <Button onClick={saveOverrides} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Alterações
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="freelancers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <CardTitle>Freelancers por Tier</CardTitle>
                  <CardDescription>Gerencie o nível de cada freelancer</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48"
                  />
                  <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as FreelancerTier | "all")}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="top_rated">Top Rated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Freelancer</TableHead>
                    <TableHead>Receita Total</TableHead>
                    <TableHead>Tier Atual</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFreelancers.map(freelancer => (
                    <TableRow key={freelancer.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{freelancer.full_name || "Sem nome"}</p>
                          <p className="text-sm text-muted-foreground">{freelancer.title || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {freelancer.total_revenue 
                          ? formatMoneyFromCents(Number(freelancer.total_revenue), "USD")
                          : "—"
                        }
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={freelancer.tier || "standard"} />
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={freelancer.tier || "standard"} 
                          onValueChange={(v) => updateFreelancerTier(freelancer.user_id, v as FreelancerTier)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="top_rated">Top Rated</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredFreelancers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum freelancer encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
