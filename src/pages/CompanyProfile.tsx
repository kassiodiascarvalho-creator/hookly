import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Globe, Building, Users,
  Loader2, ExternalLink, Briefcase, Star
} from "lucide-react";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { CompanyAvatar } from "@/components/company/CompanyAvatar";
import { CompanyNameBadges } from "@/components/company/CompanyNameBadges";
import { CompanyPlanType, CompanyPlanBadge } from "@/components/company/CompanyPlanBadge";

interface CompanyData {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string | null;
  about: string | null;
  location: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  logo_url: string | null;
  is_verified: boolean | null;
  created_at: string;
}

interface CompanyStats {
  totalProjects: number;
  totalPaid: number;
  freelancersHired: number;
  avgRating: number;
}

export default function CompanyProfile() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [planType, setPlanType] = useState<CompanyPlanType>("free");
  const [stats, setStats] = useState<CompanyStats>({ 
    totalProjects: 0, 
    totalPaid: 0, 
    freelancersHired: 0,
    avgRating: 0 
  });

  useEffect(() => {
    if (userId) {
      fetchCompanyData();
    }
  }, [userId]);

  const fetchCompanyData = async () => {
    if (!userId) return;

    // Fetch company profile and plan in parallel
    const [{ data: companyData, error }, { data: planData }] = await Promise.all([
      supabase
        .from("company_profiles")
        .select("*")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("company_plans")
        .select("plan_type, status, plan_source")
        .eq("company_user_id", userId)
        .maybeSingle(),
    ]);

    if (error || !companyData) {
      setLoading(false);
      return;
    }

    setCompany(companyData);
    
    // Determine effective plan
    if (planData) {
      let effectivePlan: CompanyPlanType = "free";
      if (planData.plan_source === "manual") {
        effectivePlan = planData.plan_type as CompanyPlanType;
      } else if (planData.plan_source === "stripe" && (planData.status === "active" || planData.status === "trialing")) {
        effectivePlan = planData.plan_type as CompanyPlanType;
      }
      setPlanType(effectivePlan);
    }

    // Fetch stats
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("company_user_id", userId);

    const { data: payments } = await supabase
      .from("payments")
      .select("amount, freelancer_user_id")
      .eq("company_user_id", userId)
      .in("status", ["paid", "released"]);

    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("company_user_id", userId);

    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const freelancersHired = new Set(payments?.map(p => p.freelancer_user_id)).size;
    const avgRating = reviews?.length 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    setStats({
      totalProjects: projects?.length || 0,
      totalPaid,
      freelancersHired,
      avgRating,
    });

    setLoading(false);
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
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="font-semibold mb-2">{t("companyProfile.notFound")}</h3>
          <Button onClick={() => navigate(-1)}>{t("common.goBack")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <CompanyAvatar
              logoUrl={company.logo_url}
              companyName={company.company_name}
              planType={planType}
              size="xl"
              showBadge={true}
            />

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <CompanyNameBadges
                  name={company.company_name || t("companyProfile.unnamed")}
                  isVerified={company.is_verified || false}
                  planType={planType}
                  badgeSize="md"
                  nameClassName="text-2xl font-bold"
                />
              </div>

              {company.industry && (
                <p className="text-lg text-muted-foreground mb-3">{company.industry}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                {company.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {company.location}
                  </span>
                )}
                {company.company_size && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {company.company_size} {t("companyProfile.employees")}
                  </span>
                )}
                {company.website && (
                  <a
                    href={normalizeUrl(company.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    {t("companyProfile.website")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("companyProfile.projects")}</p>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Building className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("companyProfile.totalPaid")}</p>
                <p className="text-2xl font-bold">${stats.totalPaid.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("companyProfile.freelancersHired")}</p>
                <p className="text-2xl font-bold">{stats.freelancersHired}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("companyProfile.avgRating")}</p>
                <p className="text-2xl font-bold">
                  {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About */}
      {company.about && (
        <Card>
          <CardHeader>
            <CardTitle>{t("companyProfile.about")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{company.about}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
