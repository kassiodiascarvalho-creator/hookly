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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { KpiSuggestion } from "@/components/projects/KpiSuggestion";

const categoryKeys = [
  "development",
  "design",
  "marketing",
  "writing",
  "dataScience",
  "videoPhoto",
  "consulting",
  "finance",
  "legal",
  "other",
];

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
  const [showProfileGateModal, setShowProfileGateModal] = useState(false);

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
    category: "",
    budget_min: "",
    budget_max: "",
    currency: "USD",
  });
  
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
    if (!formData.category) {
      newErrors.category = t("projects.validation.categoryRequired");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const min = formData.budget_min ? parseFloat(formData.budget_min) : undefined;
    const max = formData.budget_max ? parseFloat(formData.budget_max) : undefined;
    
    if (min && max && min > max) {
      setErrors({ budget: t("projects.validation.budgetMinMax") });
      return false;
    }
    
    setErrors({});
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!user) {
      toast.error(t("auth.mustBeLoggedIn"));
      return;
    }

    setLoading(true);
    
    // Always create project as draft first, then publish via RPC if needed
    const projectData = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
      budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
      currency: formData.currency,
      kpis: kpis.map(({ name, target }) => ({ name, target })),
      status: "draft" as const, // Always create as draft first
      company_user_id: user.id,
    };

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

    // If user wants to publish, use centralized RPC
    if (!asDraft) {
      const publishResult = await publishProject(data.id);
      
      if (!publishResult.success) {
        if (publishResult.error === 'COMPANY_PROFILE_INCOMPLETE') {
          setShowProfileGateModal(true);
          // Still navigate to project (it's saved as draft)
          toast.info(t("projects.savedAsDraft"));
          navigate(`/projects/${data.id}`);
          setLoading(false);
          return;
        }
        // Other errors - project saved as draft
        toast.info(t("projects.savedAsDraft"));
        navigate(`/projects/${data.id}`);
        setLoading(false);
        return;
      }
    }
    
    toast.success(asDraft ? t("projects.savedAsDraft") : t("projects.published"));
    navigate(`/projects/${data.id}`);
    setLoading(false);
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
              <Label htmlFor="category">{t("projects.category")} *</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange("category", v)}>
                <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("projects.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categoryKeys.map((key) => (
                    <SelectItem key={key} value={key}>{t(`categories.${key}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
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
              category={formData.category}
              currency={formData.currency}
              currentMin={formData.budget_min}
              currentMax={formData.budget_max}
              onApplySuggestion={(min, max) => {
                handleChange("budget_min", min.toString());
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
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget_min">{t("projects.budgetMin")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {getCurrencySymbol(formData.currency)}
                  </span>
                  <Input
                    id="budget_min"
                    type="number"
                    value={formData.budget_min}
                    onChange={(e) => handleChange("budget_min", e.target.value)}
                    placeholder="0"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget_max">{t("projects.budgetMax")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {getCurrencySymbol(formData.currency)}
                  </span>
                  <Input
                    id="budget_max"
                    type="number"
                    value={formData.budget_max}
                    onChange={(e) => handleChange("budget_max", e.target.value)}
                    placeholder="0"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            {errors.budget && <p className="text-sm text-destructive">{errors.budget}</p>}

            <div className="space-y-4">
              <Label>{t("projects.kpis")}</Label>
              <p className="text-sm text-muted-foreground">{t("projects.kpisDesc")}</p>
              
              {/* AI KPI Suggestion */}
              <KpiSuggestion
                title={formData.title}
                description={formData.description}
                category={formData.category}
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
                <p className="text-sm text-muted-foreground">{t("projects.category")}</p>
                <p>{formData.category ? t(`categories.${formData.category}`) : "-"}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">{t("projects.description")}</p>
                <p className="whitespace-pre-wrap">{formData.description}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">{t("projects.budget")}</p>
                <p>
                  {formData.budget_min || formData.budget_max
                    ? `${getCurrencySymbol(formData.currency)}${formData.budget_min || "0"} - ${getCurrencySymbol(formData.currency)}${formData.budget_max || "∞"} (${formData.currency})`
                    : t("projects.budgetNegotiable")}
                </p>
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
    </div>
  );
}
