import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Users, TrendingDown, Building2 } from "lucide-react";
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

interface CompanyWithPlan {
  user_id: string;
  company_name: string | null;
  plan_type: string;
  status: string;
  plan_source: string;
  stripe_subscription_id: string | null;
  updated_at: string | null;
}

type CompanyPlanType = "free" | "starter" | "pro" | "elite";

export default function AdminTierManager() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<TierFeeOverride[]>([]);
  const [freelancers, setFreelancers] = useState<FreelancerWithTier[]>([]);
  const [companies, setCompanies] = useState<CompanyWithPlan[]>([]);
  const [editedOverrides, setEditedOverrides] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<FreelancerTier | "all">("all");
  const [companyPlanFilter, setCompanyPlanFilter] = useState<CompanyPlanType | "all">("all");
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [overridesResult, freelancersResult, companyProfilesResult, companyPlansResult] = await Promise.all([
        supabase.from("tier_fee_overrides").select("*").order("tier"),
        supabase.from("freelancer_profiles")
          .select("user_id, full_name, title, tier, total_revenue, verified")
          .order("total_revenue", { ascending: false })
          .limit(100),
        supabase.from("company_profiles")
          .select("user_id, company_name")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("company_plans")
          .select("company_user_id, plan_type, status, plan_source, stripe_subscription_id, updated_at"),
      ]);

      if (overridesResult.error) throw overridesResult.error;
      if (freelancersResult.error) throw freelancersResult.error;
      if (companyProfilesResult.error) throw companyProfilesResult.error;
      if (companyPlansResult.error) throw companyPlansResult.error;

      setOverrides(overridesResult.data as TierFeeOverride[] || []);
      setFreelancers(freelancersResult.data as FreelancerWithTier[] || []);
      
      // Merge company profiles with plans
      const plansMap = new Map(
        (companyPlansResult.data || []).map(p => [p.company_user_id, p])
      );
      
      const mergedCompanies: CompanyWithPlan[] = (companyProfilesResult.data || []).map(profile => {
        const plan = plansMap.get(profile.user_id);
        return {
          user_id: profile.user_id,
          company_name: profile.company_name,
          plan_type: plan?.plan_type || "free",
          status: plan?.status || "active",
          plan_source: plan?.plan_source || "manual",
          stripe_subscription_id: plan?.stripe_subscription_id || null,
          updated_at: plan?.updated_at || null,
        };
      });
      
      setCompanies(mergedCompanies);
    } catch (error) {
      console.error("Error fetching tier data:", error);
      toast.error(t("admin.errorLoading"));
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
        .update({ 
          tier: newTier,
          tier_source: 'manual',
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;
      
      toast.success(`Tier atualizado para ${newTier} (manual)`);
      fetchData();
    } catch (error) {
      console.error("Error updating tier:", error);
      toast.error("Erro ao atualizar tier");
    }
  };

  const updateCompanyPlan = async (userId: string, newPlan: CompanyPlanType) => {
    try {
      const { error } = await supabase
        .from("company_plans")
        .upsert({
          company_user_id: userId,
          plan_type: newPlan,
          status: "active",
          plan_source: "manual",
          stripe_subscription_id: null,
          stripe_customer_id: null,
          cancel_at_period_end: false,
          current_period_start: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_user_id" });

      if (error) throw error;
      
      toast.success(t("admin.planUpdated", { plan: newPlan.toUpperCase() }));
      fetchData();
    } catch (error) {
      console.error("Error updating company plan:", error);
      toast.error(t("admin.errorLoading"));
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

  const filteredCompanies = companies.filter(c => {
    const matchesSearch = !companySearchQuery || 
      c.company_name?.toLowerCase().includes(companySearchQuery.toLowerCase()) ||
      c.user_id.toLowerCase().includes(companySearchQuery.toLowerCase());
    const matchesPlan = companyPlanFilter === "all" || c.plan_type === companyPlanFilter;
    return matchesSearch && matchesPlan;
  });

  // Group overrides by tier
  const overridesByTier = overrides.reduce((acc, o) => {
    if (!acc[o.tier]) acc[o.tier] = [];
    acc[o.tier].push(o);
    return acc;
  }, {} as Record<string, TierFeeOverride[]>);

  const getPlanSourceBadge = (planSource: string) => {
    if (planSource === "manual") {
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {t("admin.manualOverride")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        {t("admin.stripeManaged")}
      </Badge>
    );
  };

  const getPlanBadge = (planType: string) => {
    const planColors: Record<string, string> = {
      free: "bg-muted text-muted-foreground",
      starter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      pro: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      elite: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
    return (
      <Badge className={planColors[planType] || planColors.free}>
        {planType.toUpperCase()}
      </Badge>
    );
  };

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
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            {t("admin.companies")}
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

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <CardTitle>{t("admin.companies")}</CardTitle>
                  <CardDescription>{t("admin.companyPlanManagement")}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("admin.searchCompanies")}
                    value={companySearchQuery}
                    onChange={(e) => setCompanySearchQuery(e.target.value)}
                    className="w-48"
                  />
                  <Select value={companyPlanFilter} onValueChange={(v) => setCompanyPlanFilter(v as CompanyPlanType | "all")}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.allPlans")}</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.companies")}</TableHead>
                    <TableHead>{t("admin.currentPlan")}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{t("admin.source")}</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map(company => (
                    <TableRow key={company.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{company.company_name || t("admin.noName")}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[150px]">{company.user_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPlanBadge(company.plan_type)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.status === "active" ? "default" : "secondary"}>
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getPlanSourceBadge(company.plan_source)}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={company.plan_type} 
                          onValueChange={(v) => updateCompanyPlan(company.user_id, v as CompanyPlanType)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredCompanies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t("admin.noCompaniesFound")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
