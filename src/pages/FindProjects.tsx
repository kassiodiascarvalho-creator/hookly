import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Briefcase, DollarSign, Calendar, Loader2, ShieldX, Filter, X } from "lucide-react";
import { format, isAfter } from "date-fns";
import { BoostedBadge } from "@/components/projects/BoostedBadge";
import { CompanyAvatar } from "@/components/company/CompanyAvatar";
import { CompanyNameBadges } from "@/components/company/CompanyNameBadges";
import { fetchCompanyBadges, CompanyPlanType } from "@/hooks/useCompanyPlanData";
import { VerifiedPaymentBadge } from "@/components/projects/VerifiedPaymentBadge";
import { fetchProjectsPrefundStatus } from "@/hooks/useProjectPrefund";
import { CategoryFilterSelect } from "@/components/projects/CategoryFilterSelect";
import { CategoryChips } from "@/components/projects/CategoryChips";
import { fetchProjectsCategoriesMap, type Category } from "@/hooks/useCategories";
import { CurrencySelect } from "@/components/CurrencySelect";
import { getCurrencySymbol } from "@/lib/formatMoney";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Project {
  id: string;
  title: string;
  description: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  created_at: string;
  company_user_id: string;
  boosted_until: string | null;
  company?: {
    company_name: string | null;
    logo_url: string | null;
    plan_type?: CompanyPlanType;
    is_verified?: boolean;
  };
  categories?: Category[];
  _hasProposal?: boolean;
}

export default function FindProjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [myProposalIds, setMyProposalIds] = useState<Set<string>>(new Set());
  const [prefundedProjects, setPrefundedProjects] = useState<Map<string, boolean>>(new Map());
  
  // New filters
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    fetchProjects();
    if (user) fetchMyProposals();
  }, [user]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const companyUserIds = [...new Set(data.map((p) => p.company_user_id))];
      const projectIds = data.map((p) => p.id);
      
      // Parallel fetching: company profiles, badges, prefund status, and categories
      const [{ data: companies }, badgeMap, prefundMap, categoriesMap] = await Promise.all([
        supabase
          .from("company_profiles")
          .select("user_id, company_name, logo_url")
          .in("user_id", companyUserIds),
        fetchCompanyBadges(companyUserIds),
        fetchProjectsPrefundStatus(projectIds),
        fetchProjectsCategoriesMap(projectIds),
      ]);

      const companyMap = new Map(companies?.map((c) => [c.user_id, c]) || []);
      setPrefundedProjects(prefundMap);

      const projectsWithData = data.map((project) => {
        const company = companyMap.get(project.company_user_id);
        const badge = badgeMap.get(project.company_user_id) || { plan_type: "free", is_verified: false };
        const projectCategories = categoriesMap.get(project.id) || [];

        return {
          ...project,
          company: company
            ? { ...company, plan_type: badge.plan_type, is_verified: badge.is_verified }
            : undefined,
          categories: projectCategories,
        };
      });
      
      setProjects(projectsWithData);
    }
    setLoading(false);
  };

  const fetchMyProposals = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("proposals")
      .select("project_id")
      .eq("freelancer_user_id", user.id);

    if (data) {
      setMyProposalIds(new Set(data.map((p) => p.project_id)));
    }
  };

  // Check if any filters are active
  const hasActiveFilters = selectedCategoryIds.length > 0 || selectedCurrency !== "" || budgetMin !== "" || budgetMax !== "";

  const clearAllFilters = () => {
    setSelectedCategoryIds([]);
    setSelectedCurrency("");
    setBudgetMin("");
    setBudgetMax("");
  };

  // Filter and sort: boosted projects first, then by category match
  const filteredProjects = useMemo(() => {
    const minBudget = budgetMin ? parseFloat(budgetMin) : null;
    const maxBudget = budgetMax ? parseFloat(budgetMax) : null;

    return projects
      .filter((project) => {
        const matchesSearch = searchQuery === "" || 
          project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Filter by categories (OR logic - match any selected category)
        const matchesCategory = selectedCategoryIds.length === 0 || 
          (project.categories?.some(cat => selectedCategoryIds.includes(cat.id)) ?? false);
        
        // Filter by currency
        const matchesCurrency = selectedCurrency === "" || 
          (project.currency || "USD") === selectedCurrency;
        
        // Filter by budget range
        let matchesBudget = true;
        if (minBudget !== null) {
          // Project must have a max budget >= filter min
          matchesBudget = matchesBudget && (project.budget_max !== null && project.budget_max >= minBudget);
        }
        if (maxBudget !== null) {
          // Project must have a min budget <= filter max
          matchesBudget = matchesBudget && (project.budget_min !== null && project.budget_min <= maxBudget);
        }
        
        return matchesSearch && matchesCategory && matchesCurrency && matchesBudget;
      })
      .sort((a, b) => {
        const aIsBoosted = a.boosted_until && isAfter(new Date(a.boosted_until), new Date());
        const bIsBoosted = b.boosted_until && isAfter(new Date(b.boosted_until), new Date());
        
        // Boosted projects come first
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;
        
        // Then sort by created_at
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [projects, searchQuery, selectedCategoryIds, selectedCurrency, budgetMin, budgetMax]);

  const formatBudget = (min: number | null, max: number | null, currency: string = "USD") => {
    const symbol = getCurrencySymbol(currency);
    if (!min && !max) return t("projects.budgetNegotiable");
    if (min && max) return `${symbol}${min.toLocaleString()} - ${symbol}${max.toLocaleString()}`;
    if (min) return `${t("projects.from")} ${symbol}${min.toLocaleString()}`;
    return `${t("projects.upTo")} ${symbol}${max?.toLocaleString()}`;
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
        <h1 className="text-3xl font-bold">{t("findProjects.title")}</h1>
        <p className="text-muted-foreground">{t("findProjects.subtitle")}</p>
      </div>

      {/* Main Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("findProjects.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <CategoryFilterSelect
            value={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={showAdvancedFilters ? "bg-primary/10 border-primary" : ""}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Advanced Filters */}
        <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <CollapsibleContent className="space-y-4">
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Currency Filter */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm font-medium mb-2 block">
                      {t("findProjects.currency", "Moeda")}
                    </label>
                    <CurrencySelect
                      value={selectedCurrency}
                      onValueChange={setSelectedCurrency}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Budget Range */}
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">
                      {t("findProjects.budgetRange", "Faixa de Orçamento")}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={t("findProjects.min", "Mín")}
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value)}
                        className="w-full"
                        min={0}
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder={t("findProjects.max", "Máx")}
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                        className="w-full"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("findProjects.activeFilters", "Filtros ativos")}:</span>
            {selectedCategoryIds.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                {t("findProjects.categories", "Categorias")}: {selectedCategoryIds.length}
              </Badge>
            )}
            {selectedCurrency && (
              <Badge variant="secondary" className="gap-1">
                {t("findProjects.currency", "Moeda")}: {selectedCurrency}
              </Badge>
            )}
            {(budgetMin || budgetMax) && (
              <Badge variant="secondary" className="gap-1">
                {t("findProjects.budget", "Orçamento")}: {budgetMin || "0"} - {budgetMax || "∞"}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              {t("findProjects.clearFilters", "Limpar")}
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {filteredProjects.length} {t("findProjects.projectsFound")}
        </p>

        {filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t("findProjects.noProjects")}</h3>
              <p className="text-muted-foreground">{t("findProjects.noProjectsDesc")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProjects.map((project) => {
              const hasProposal = myProposalIds.has(project.id);
              const isBoosted = project.boosted_until && isAfter(new Date(project.boosted_until), new Date());
              const hasVerifiedPayment = prefundedProjects.get(project.id) || false;
              
              return (
                <Card 
                  key={project.id} 
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    isBoosted ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20" : ""
                  }`}
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{project.title}</h3>
                          {isBoosted && <BoostedBadge />}
                          {hasVerifiedPayment ? (
                            <VerifiedPaymentBadge size="sm" showLabel />
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1">
                              <ShieldX className="h-3 w-3" />
                              {t("projects.unverifiedPayment", "Pagamento Não Verificado")}
                            </Badge>
                          )}
                          {hasProposal && (
                            <Badge variant="secondary">{t("findProjects.proposalSent")}</Badge>
                          )}
                        </div>
                        
                        {project.description && (
                          <p className="text-muted-foreground line-clamp-2 mb-3">
                            {project.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          {/* Category chips */}
                          {project.categories && project.categories.length > 0 && (
                            <CategoryChips 
                              categories={project.categories} 
                              maxVisible={2} 
                              size="sm" 
                            />
                          )}
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            {formatBudget(project.budget_min, project.budget_max, project.currency || "USD")}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(project.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                        
                        {project.company && (
                          <div className="flex items-center gap-2 mt-2">
                            <CompanyAvatar
                              logoUrl={project.company.logo_url}
                              companyName={project.company.company_name}
                              planType={project.company.plan_type}
                              size="sm"
                            />
                            <CompanyNameBadges
                              name={project.company.company_name || t("findProjects.unknownCompany")}
                              isVerified={project.company.is_verified}
                              planType={project.company.plan_type}
                              badgeSize="sm"
                              nameClassName="text-sm text-muted-foreground"
                            />
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        variant={hasProposal ? "outline" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/project/${project.id}`);
                        }}
                      >
                        {hasProposal ? t("findProjects.viewProposal") : t("findProjects.sendProposal")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
