import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Check, X, Plus } from "lucide-react";
import { z } from "zod";
import { CurrencySelect } from "@/components/CurrencySelect";
import { getCurrencySymbol } from "@/lib/formatMoney";
import { useProfileGate } from "@/hooks/useProfileGate";
import { ProfileGateAlert } from "@/components/profile/ProfileGateAlert";
import { ProfileGateModal } from "@/components/profile/ProfileGateModal";
import { usePublishProject } from "@/hooks/usePublishProject";
import { BudgetSuggestion } from "@/components/projects/BudgetSuggestion";
import { BudgetRangeInput } from "@/components/projects/BudgetRangeInput";
import { KpiSuggestion } from "@/components/projects/KpiSuggestion";
import { ProjectPrefundModal } from "@/components/projects/ProjectPrefundModal";
import { CategoryMultiSelect } from "@/components/projects/CategoryMultiSelect";
import { setProjectCategories } from "@/hooks/useCategories";
import { useCategories } from "@/hooks/useCategories";

interface KPI {
  id: string;
  name: string;
  target: string;
}

export default function ProjectNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefundModalOpen, setPrefundModalOpen] = useState(false);
  const [showProfileGateModal, setShowProfileGateModal] = useState(false);
  
  // Track the created draft project ID - this prevents creating duplicates
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);

  // Profile gate for companies
  const { allowed: profileAllowed, completionPercent, loading: gateLoading, checkMonthlyCredits } = useProfileGate('company');
  
  // Centralized publish hook
  const { publishProject, isPublishing } = usePublishProject();
  
  // Check monthly credits on mount
  useEffect(() => {
    if (user) {
      checkMonthlyCredits();
    }
  }, [user, checkMonthlyCredits]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    budget_min: "",
    budget_ideal: "",
    budget_max: "",
    currency: "USD",
  });
  
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const { categories, getLocalizedName } = useCategories();
  
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [newKpi, setNewKpi] = useState({ name: "", target: "" });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const addKpi = () => {
    if (newKpi.name && newKpi.target) {
      setKpis([...kpis, { id: crypto.randomUUID(), ...newKpi }]);
      setNewKpi({ name: "", target: "" });
    }
  };

  const removeKpi = (id: string) => {
    setKpis(kpis.filter((k) => k.id !== id));
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.title.length < 5) {
      newErrors.title = t("projects.validation.titleMin");
    }
    if (formData.description.length < 20) {
      newErrors.description = t("projects.validation.descriptionMin");
    }
    if (selectedCategoryIds.length === 0) {
      newErrors.category = t("categories.minError", "Selecione pelo menos 1 categoria");
    }
    if (selectedCategoryIds.length > 5) {
      newErrors.category = t("categories.maxError", { max: 5 });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const min = formData.budget_min ? parseFloat(formData.budget_min) : undefined;
    const ideal = formData.budget_ideal ? parseFloat(formData.budget_ideal) : undefined;
    const max = formData.budget_max ? parseFloat(formData.budget_max) : undefined;
    
    const newErrors: Record<string, string> = {};
    
    if (min && max && min > max) {
      newErrors.budget = t("projects.validation.budgetMinMax");
    }
    
    if (min && ideal && min > ideal) {
      newErrors.budget = "O orçamento ideal deve ser maior que o mínimo";
    }
    
    if (ideal && max && ideal > max) {
      newErrors.budget = "O orçamento ideal deve ser menor que o máximo";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (asDraft: boolean, skipPrefund = false) => {
    if (!user) {
      toast.error(t("auth.mustBeLoggedIn"));
      return;
    }

    setLoading(true);
    
    const projectData = {
      title: formData.title,
      description: formData.description,
      budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
      budget_ideal: formData.budget_ideal ? parseFloat(formData.budget_ideal) : null,
      budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
      currency: formData.currency,
      kpis: kpis.map(({ name, target }) => ({ name, target })),
      status: "draft" as const,
      company_user_id: user.id,
    };

    let projectId = draftProjectId;

    // If we already have a draft project, UPDATE it instead of creating a new one
    if (projectId) {
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          title: projectData.title,
          description: projectData.description,
          budget_min: projectData.budget_min,
          budget_ideal: projectData.budget_ideal,
          budget_max: projectData.budget_max,
          currency: projectData.currency,
          kpis: projectData.kpis,
        })
        .eq("id", projectId)
        .eq("company_user_id", user.id)
        .eq("status", "draft");

      if (updateError) {
        console.error('[ProjectNew] Update error:', updateError);
        toast.error(updateError.message);
        setLoading(false);
        return;
      }
    } else {
      // Create new draft project
      const { data, error } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      projectId = data.id;
      setDraftProjectId(data.id); // Save the ID so we don't create duplicates
    }

    // If user wants to save as draft only
    if (asDraft) {
      toast.success(t("projects.savedAsDraft"));
      navigate(`/projects/${projectId}`);
      setLoading(false);
      return;
    }

    // If user wants to publish
    // Check if we should show prefund modal (has budget_max and not skipping)
    const hasBudgetMax = formData.budget_max && parseFloat(formData.budget_max) > 0;
    
    if (hasBudgetMax && !skipPrefund) {
      // Show prefund modal - project stays as draft until payment or skip
      setLoading(false);
      setPrefundModalOpen(true);
      return;
    }

    // Publish the project (either skipped prefund or no budget_max)
    const publishResult = await publishProject(projectId!);
    
    if (!publishResult.success) {
      if (publishResult.error === 'COMPANY_PROFILE_INCOMPLETE') {
        setShowProfileGateModal(true);
        toast.info(t("projects.savedAsDraft"));
        navigate(`/projects/${projectId}`);
        setLoading(false);
        return;
      }
      toast.info(t("projects.savedAsDraft"));
      navigate(`/projects/${projectId}`);
      setLoading(false);
      return;
    }
    
    toast.success(t("projects.published"));
    navigate(`/projects/${projectId}`);
    setLoading(false);
  };

  const handlePrefundComplete = async () => {
    setPrefundModalOpen(false);
    if (draftProjectId) {
      await publishProject(draftProjectId);
      toast.success(t("projects.published"));
      navigate(`/projects/${draftProjectId}`);
    }
  };

  const handleSkipPrefund = async () => {
    setPrefundModalOpen(false);
    if (draftProjectId) {
      await publishProject(draftProjectId);
      toast.success(t("projects.published"));
      navigate(`/projects/${draftProjectId}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/projects")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      {/* Profile Gate Alert */}
      {!profileAllowed && !gateLoading && (
        <ProfileGateAlert completionPercent={completionPercent} userType="company" />
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className={`hidden sm:inline text-sm ${s === step ? "font-medium" : "text-muted-foreground"}`}>
              {s === 1 ? t("projects.step1") : s === 2 ? t("projects.step2") : t("projects.step3")}
            </span>
            {s < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("projects.basicInfo")}</CardTitle>
            <CardDescription>{t("projects.basicInfoDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("projects.projectTitle")} *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder={t("projects.titlePlaceholder")}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("projects.categories", "Categorias")} *</Label>
              <CategoryMultiSelect
                value={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                maxCategories={5}
                error={errors.category}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("projects.description")} *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder={t("projects.descriptionPlaceholder")}
                rows={6}
                className={errors.description ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/5000 {t("projects.characters")}
              </p>
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            </div>

            <div className="flex justify-end">
              <Button onClick={nextStep}>
                {t("common.next")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Budget & KPIs */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("projects.budgetKpis")}</CardTitle>
            <CardDescription>{t("projects.budgetKpisDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI Budget Suggestion */}
            <BudgetSuggestion
              title={formData.title}
              description={formData.description}
              category={categories.find(c => c.id === selectedCategoryIds[0])?.slug || ""}
              currency={formData.currency}
              currentMin={formData.budget_min}
              currentMax={formData.budget_max}
              onApplySuggestion={(min, max) => {
                handleChange("budget_min", min.toString());
                handleChange("budget_ideal", Math.round((min + max) / 2).toString());
                handleChange("budget_max", max.toString());
              }}
            />
            
            <div className="space-y-2">
              <Label>{t("projects.currency")} *</Label>
              <CurrencySelect
                value={formData.currency}
                onValueChange={(v) => handleChange("currency", v)}
                className="w-48"
              />
            </div>
            
            {/* Budget Range Input */}
            <BudgetRangeInput
              budgetMin={formData.budget_min}
              budgetIdeal={formData.budget_ideal}
              budgetMax={formData.budget_max}
              currency={formData.currency}
              onMinChange={(v) => handleChange("budget_min", v)}
              onIdealChange={(v) => handleChange("budget_ideal", v)}
              onMaxChange={(v) => handleChange("budget_max", v)}
              errors={errors.budget ? { range: errors.budget } : {}}
            />

            <div className="space-y-4">
              <Label>{t("projects.kpis")}</Label>
              <p className="text-sm text-muted-foreground">{t("projects.kpisDesc")}</p>
              
              {/* AI KPI Suggestion */}
              <KpiSuggestion
                title={formData.title}
                description={formData.description}
                category={categories.find(c => c.id === selectedCategoryIds[0])?.slug || ""}
                existingKpis={kpis}
                onAddKpi={(name, target) => {
                  setKpis(prev => [...prev, { id: crypto.randomUUID(), name, target }]);
                }}
              />
              
              {kpis.length > 0 && (
                <div className="space-y-2">
                  {kpis.map((kpi) => (
                    <div key={kpi.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{kpi.name}</p>
                        <p className="text-sm text-muted-foreground">{t("projects.target")}: {kpi.target}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeKpi(kpi.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder={t("projects.kpiName")}
                  value={newKpi.name}
                  onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })}
                />
                <Input
                  placeholder={t("projects.kpiTarget")}
                  value={newKpi.target}
                  onChange={(e) => setNewKpi({ ...newKpi, target: e.target.value })}
                />
                <Button variant="outline" onClick={addKpi} disabled={!newKpi.name || !newKpi.target}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back")}
              </Button>
              <Button onClick={nextStep}>
                {t("common.next")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("projects.preview")}</CardTitle>
            <CardDescription>{t("projects.previewDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-lg p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("projects.projectTitle")}</p>
                <h2 className="text-xl font-semibold">{formData.title}</h2>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">{t("projects.categories", "Categorias")}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedCategoryIds.length > 0 ? (
                    categories
                      .filter(c => selectedCategoryIds.includes(c.id))
                      .map(c => (
                        <span key={c.id} className="px-2 py-0.5 bg-muted rounded text-sm">
                          {getLocalizedName(c)}
                        </span>
                      ))
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">{t("projects.description")}</p>
                <p className="whitespace-pre-wrap">{formData.description}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("projects.budget")}</p>
                {formData.budget_min || formData.budget_ideal || formData.budget_max ? (
                  <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Mín</p>
                      <p className="font-medium">{formData.budget_min ? `${getCurrencySymbol(formData.currency)}${parseFloat(formData.budget_min).toLocaleString()}` : "-"}</p>
                    </div>
                    <div className="text-center border-x border-border">
                      <p className="text-xs text-muted-foreground">Ideal</p>
                      <p className="font-medium text-primary">{formData.budget_ideal ? `${getCurrencySymbol(formData.currency)}${parseFloat(formData.budget_ideal).toLocaleString()}` : "-"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Máx</p>
                      <p className="font-medium">{formData.budget_max ? `${getCurrencySymbol(formData.currency)}${parseFloat(formData.budget_max).toLocaleString()}` : "∞"}</p>
                    </div>
                  </div>
                ) : (
                  <p>{t("projects.budgetNegotiable")}</p>
                )}
              </div>
              
              {kpis.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t("projects.kpis")}</p>
                  <div className="space-y-2">
                    {kpis.map((kpi) => (
                      <div key={kpi.id} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{kpi.name}: {kpi.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back")}
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => handleSubmit(true)} disabled={loading || isPublishing}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("projects.saveAsDraft")}
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={loading || isPublishing}>
                  {(loading || isPublishing) ? <Loader2 className="h-4 w-4 animate-spin" /> : t("projects.publish")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Gate Modal */}
      <ProfileGateModal
        open={showProfileGateModal}
        onOpenChange={setShowProfileGateModal}
        userType="company"
        completionPercent={completionPercent}
      />

      {/* Prefund Modal */}
      {draftProjectId && (
        <ProjectPrefundModal
          open={prefundModalOpen}
          onOpenChange={setPrefundModalOpen}
          projectId={draftProjectId}
          budgetMax={formData.budget_max ? parseFloat(formData.budget_max) : 0}
          currency={formData.currency}
          onPrefundComplete={handlePrefundComplete}
          onSkip={handleSkipPrefund}
        />
      )}
    </div>
  );
}
