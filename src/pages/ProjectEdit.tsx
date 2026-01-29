import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { ArrowLeft, ArrowRight, Loader2, Check, X, Plus, Save } from "lucide-react";
import { CurrencySelect } from "@/components/CurrencySelect";
import { BudgetRangeInput } from "@/components/projects/BudgetRangeInput";

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

export default function ProjectEdit() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    budget_min: "",
    budget_ideal: "",
    budget_max: "",
    currency: "USD",
  });
  
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [newKpi, setNewKpi] = useState({ name: "", target: "" });

  // Load project data
  useEffect(() => {
    if (!id || !user) return;

    const fetchProject = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq("company_user_id", user.id)
        .single();

      if (error || !data) {
        toast.error(t("projects.notFound"));
        navigate("/projects");
        return;
      }

      // Only allow editing draft projects
      if (data.status !== "draft") {
        toast.error(t("projects.edit.onlyDrafts"));
        navigate(`/projects/${id}`);
        return;
      }

      setFormData({
        title: data.title || "",
        description: data.description || "",
        category: data.category || "",
        budget_min: data.budget_min?.toString() || "",
        budget_ideal: data.budget_ideal?.toString() || "",
        budget_max: data.budget_max?.toString() || "",
        currency: data.currency || "USD",
      });

      // Load KPIs if they exist
      if (data.kpis && Array.isArray(data.kpis)) {
        setKpis(
          (data.kpis as { name: string; target: string }[]).map((kpi) => ({
            id: crypto.randomUUID(),
            name: kpi.name,
            target: kpi.target,
          }))
        );
      }

      setLoading(false);
    };

    fetchProject();
  }, [id, user, navigate, t]);

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

  const removeKpi = (kpiId: string) => {
    setKpis(kpis.filter((k) => k.id !== kpiId));
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
    const ideal = formData.budget_ideal ? parseFloat(formData.budget_ideal) : undefined;
    const max = formData.budget_max ? parseFloat(formData.budget_max) : undefined;
    
    const newErrors: Record<string, string> = {};
    
    if (min && max && min > max) {
      newErrors.budget = t("projects.validation.budgetMinMax");
    }
    
    if (min && ideal && min > ideal) {
      newErrors.budget = t("projects.edit.idealGreaterThanMin");
    }
    
    if (ideal && max && ideal > max) {
      newErrors.budget = t("projects.edit.idealLessThanMax");
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

  const handleSave = async () => {
    if (!user || !id) {
      toast.error(t("auth.mustBeLoggedIn"));
      return;
    }

    setSaving(true);
    
    const projectData = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
      budget_ideal: formData.budget_ideal ? parseFloat(formData.budget_ideal) : null,
      budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
      currency: formData.currency,
      kpis: kpis.map(({ name, target }) => ({ name, target })),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("projects")
      .update(projectData)
      .eq("id", id)
      .eq("company_user_id", user.id)
      .eq("status", "draft"); // Extra safety check

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success(t("projects.edit.success"));
    navigate(`/projects/${id}`);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(`/projects/${id}`)} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      <h1 className="text-2xl font-bold">{t("projects.edit.title")}</h1>

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
                <p className="text-sm text-muted-foreground mb-2">{t("projects.budget")}</p>
                {formData.budget_min || formData.budget_ideal || formData.budget_max ? (
                  <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{t("projects.budgetMin")}</p>
                      <p className="font-medium">
                        {formData.budget_min ? `${formData.currency} ${parseFloat(formData.budget_min).toLocaleString()}` : "-"}
                      </p>
                    </div>
                    <div className="text-center border-x border-border">
                      <p className="text-xs text-primary">{t("projects.budgetIdeal")}</p>
                      <p className="font-medium text-primary">
                        {formData.budget_ideal ? `${formData.currency} ${parseFloat(formData.budget_ideal).toLocaleString()}` : "-"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{t("projects.budgetMax")}</p>
                      <p className="font-medium">
                        {formData.budget_max ? `${formData.currency} ${parseFloat(formData.budget_max).toLocaleString()}` : "-"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t("projects.budgetNegotiable")}</p>
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

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back")}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("projects.edit.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
