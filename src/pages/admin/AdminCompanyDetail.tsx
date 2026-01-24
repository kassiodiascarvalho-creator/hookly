import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle, XCircle, MapPin, Building2, Globe, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeUrl } from "@/lib/normalizeUrl";

interface CompanyDetail {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string | null;
  about: string | null;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  is_verified: boolean | null;
  verified_at: string | null;
  verified_by_admin_id: string | null;
  created_at: string;
}

interface CompanyPlan {
  plan_type: string;
  status: string;
  plan_source: string;
  stripe_subscription_id: string | null;
}

const PLAN_OPTIONS = ['free', 'starter', 'pro', 'elite'] as const;

export default function AdminCompanyDetail() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [companyPlan, setCompanyPlan] = useState<CompanyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [stats, setStats] = useState({ projects: 0, totalPaid: 0, freelancersHired: 0 });

  useEffect(() => {
    fetchCompany();
    fetchCompanyPlan();
    fetchStats();
  }, [userId]);

  const fetchCompany = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setCompany(data);
    } catch (error) {
      console.error("Error fetching company:", error);
      toast.error(t("admin.errorLoading"));
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyPlan = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("company_plans")
        .select("plan_type, status, plan_source, stripe_subscription_id")
        .eq("company_user_id", userId)
        .maybeSingle();

      if (error) throw error;
      setCompanyPlan(data);
    } catch (error) {
      console.error("Error fetching company plan:", error);
    }
  };

  const fetchStats = async () => {
    if (!userId) return;

    try {
      // Get projects count
      const { count: projectsCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("company_user_id", userId);

      // Get total paid
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("company_user_id", userId)
        .in("status", ["paid", "released"]);

      const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Get distinct freelancers hired
      const { data: freelancers } = await supabase
        .from("proposals")
        .select("freelancer_user_id, project:projects!inner(company_user_id)")
        .eq("status", "accepted");

      const uniqueFreelancers = new Set(
        freelancers?.filter(p => (p.project as any)?.company_user_id === userId).map(p => p.freelancer_user_id)
      );

      setStats({
        projects: projectsCount || 0,
        totalPaid,
        freelancersHired: uniqueFreelancers.size,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const toggleVerification = async () => {
    if (!company || !user) return;
    setUpdating(true);

    try {
      const newStatus = !company.is_verified;
      const { error } = await supabase
        .from("company_profiles")
        .update({
          is_verified: newStatus,
          verified_at: newStatus ? new Date().toISOString() : null,
          verified_by_admin_id: newStatus ? user.id : null,
        })
        .eq("id", company.id);

      if (error) throw error;

      setCompany({
        ...company,
        is_verified: newStatus,
        verified_at: newStatus ? new Date().toISOString() : null,
        verified_by_admin_id: newStatus ? user.id : null,
      });

      toast.success(newStatus ? t("admin.companyVerified") : t("admin.companyUnverified"));
    } catch (error) {
      console.error("Error updating verification:", error);
      toast.error(t("admin.errorUpdating"));
    } finally {
      setUpdating(false);
    }
  };

  const handlePlanChange = async (newPlanType: string) => {
    if (!userId || !user) return;
    setUpdatingPlan(true);

    try {
      // Upsert company_plans with plan_source='manual'
      const { error } = await supabase
        .from("company_plans")
        .upsert({
          company_user_id: userId,
          plan_type: newPlanType,
          status: 'active',
          plan_source: 'manual', // Admin override - protected from Stripe
          stripe_subscription_id: null, // Clear Stripe reference
          stripe_customer_id: null,
          cancel_at_period_end: false,
          current_period_start: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: 'company_user_id' 
        });

      if (error) throw error;

      setCompanyPlan({
        plan_type: newPlanType,
        status: 'active',
        plan_source: 'manual',
        stripe_subscription_id: null,
      });

      toast.success(t("admin.planUpdated", { plan: newPlanType }));
    } catch (error) {
      console.error("Error updating plan:", error);
      toast.error(t("admin.errorUpdating"));
    } finally {
      setUpdatingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("admin.companyNotFound")}</p>
        <Button onClick={() => navigate("/admin/companies")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/admin/companies")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
        <h1 className="text-3xl font-bold">{t("admin.companyDetail")}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={company.logo_url || undefined} />
                  <AvatarFallback>
                    <Building2 className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{company.company_name || t("admin.noName")}</CardTitle>
                  <p className="text-muted-foreground">{company.contact_name || t("admin.noContact")}</p>
                  {company.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4" />
                      {company.location}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {company.about && (
              <div>
                <h3 className="font-semibold mb-2">{t("admin.about")}</h3>
                <p className="text-muted-foreground">{company.about}</p>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold mb-2">{t("admin.industry")}</h3>
                {company.industry ? (
                  <Badge variant="secondary">{company.industry}</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">{t("admin.size")}</h3>
                <span>{company.company_size || "-"}</span>
              </div>
              <div>
                <h3 className="font-semibold mb-2">{t("admin.phone")}</h3>
                <span>{company.phone || "-"}</span>
              </div>
            </div>

            {company.website && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">{t("admin.website")}</h3>
                  <a
                    href={normalizeUrl(company.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-4 w-4" />
                    {company.website}
                  </a>
                </div>
              </>
            )}

            <Separator />

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{stats.projects}</p>
                <p className="text-sm text-muted-foreground">{t("admin.projects")}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-green-600">${stats.totalPaid.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">{t("admin.totalPaid")}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{stats.freelancersHired}</p>
                <p className="text-sm text-muted-foreground">{t("admin.freelancersHired")}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">{t("admin.createdAt")}</h3>
              <p className="text-muted-foreground">
                {format(new Date(company.created_at), "PPP")}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Verification Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.verification")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {company.is_verified ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    {company.is_verified ? t("admin.verified") : t("admin.unverified")}
                  </span>
                </div>
                <Switch
                  checked={company.is_verified || false}
                  onCheckedChange={toggleVerification}
                  disabled={updating}
                />
              </div>

              {company.is_verified && company.verified_at && (
                <div className="text-sm text-muted-foreground">
                  <p>{t("admin.verifiedOn")}: {format(new Date(company.verified_at), "PPP")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Management Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                {t("admin.planManagement")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t("admin.currentPlan")}</label>
                <Select
                  value={companyPlan?.plan_type || 'free'}
                  onValueChange={handlePlanChange}
                  disabled={updatingPlan}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan.charAt(0).toUpperCase() + plan.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant={companyPlan?.status === 'active' ? 'default' : 'secondary'}>
                  {companyPlan?.status || 'free'}
                </Badge>
                <Badge variant={companyPlan?.plan_source === 'manual' ? 'outline' : 'secondary'}>
                  {companyPlan?.plan_source === 'manual' ? t("admin.manualOverride") : t("admin.stripeManaged")}
                </Badge>
              </div>

              {companyPlan?.plan_source === 'manual' && (
                <p className="text-xs text-muted-foreground">
                  {t("admin.manualPlanProtected")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
