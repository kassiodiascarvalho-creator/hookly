import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, CheckCircle, DollarSign, Users, Loader2, TrendingUp } from "lucide-react";

interface CompanyWithHistory {
  id: string;
  user_id: string;
  company_name: string | null;
  logo_url: string | null;
  location: string | null;
  industry: string | null;
  is_verified: boolean | null;
  total_paid: number;
  freelancers_hired: number;
  payment_reliability: number; // percentage of released vs held payments
}

export default function VerifiedCompanies() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<CompanyWithHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompaniesWithHistory();
  }, []);

  const fetchCompaniesWithHistory = async () => {
    try {
      // Get all companies
      const { data: companiesData } = await supabase
        .from("company_profiles")
        .select("id, user_id, company_name, logo_url, location, industry, is_verified");

      if (!companiesData) {
        setLoading(false);
        return;
      }

      // Get payment stats for each company
      const companiesWithStats: CompanyWithHistory[] = [];

      for (const company of companiesData) {
        // Get total paid
        const { data: payments } = await supabase
          .from("payments")
          .select("amount, status, escrow_status")
          .eq("company_user_id", company.user_id);

        if (!payments || payments.length === 0) continue;

        const totalPaid = payments
          .filter(p => p.status === "paid" || p.status === "released")
          .reduce((sum, p) => sum + Number(p.amount), 0);

        if (totalPaid === 0) continue;

        // Calculate payment reliability
        const releasedCount = payments.filter(p => p.status === "released" || p.escrow_status === "released").length;
        const totalFunded = payments.filter(p => p.status !== "pending" && p.status !== "failed").length;
        const reliability = totalFunded > 0 ? (releasedCount / totalFunded) * 100 : 0;

        // Get distinct freelancers
        const { data: proposals } = await supabase
          .from("proposals")
          .select("freelancer_user_id, project:projects!inner(company_user_id)")
          .eq("status", "accepted");

        const uniqueFreelancers = new Set(
          proposals?.filter(p => (p.project as any)?.company_user_id === company.user_id).map(p => p.freelancer_user_id)
        );

        companiesWithStats.push({
          ...company,
          total_paid: totalPaid,
          freelancers_hired: uniqueFreelancers.size,
          payment_reliability: reliability,
        });
      }

      // Sort by total paid descending
      companiesWithStats.sort((a, b) => b.total_paid - a.total_paid);
      setCompanies(companiesWithStats);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const getReliabilityColor = (reliability: number) => {
    if (reliability >= 80) return "text-green-500";
    if (reliability >= 50) return "text-yellow-500";
    return "text-red-500";
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
        <h1 className="text-3xl font-bold">{t("verifiedCompanies.title")}</h1>
        <p className="text-muted-foreground">{t("verifiedCompanies.subtitle")}</p>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">{t("verifiedCompanies.noCompanies")}</h3>
            <p className="text-muted-foreground">{t("verifiedCompanies.noCompaniesDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={company.logo_url || undefined} />
                    <AvatarFallback>
                      <Building2 className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg truncate">
                        {company.company_name || t("verifiedCompanies.unnamed")}
                      </CardTitle>
                      {company.is_verified && (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {company.industry && (
                        <Badge variant="secondary" className="text-xs">
                          {company.industry}
                        </Badge>
                      )}
                      {company.location && (
                        <span className="text-xs text-muted-foreground truncate">
                          {company.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                      <DollarSign className="h-3 w-3 text-green-500" />
                      <span className="font-semibold text-sm">
                        ${company.total_paid >= 1000 
                          ? `${(company.total_paid / 1000).toFixed(0)}k`
                          : company.total_paid.toFixed(0)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("verifiedCompanies.paid")}</p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-3 w-3 text-primary" />
                      <span className="font-semibold text-sm">{company.freelancers_hired}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("verifiedCompanies.hired")}</p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className={`h-3 w-3 ${getReliabilityColor(company.payment_reliability)}`} />
                      <span className={`font-semibold text-sm ${getReliabilityColor(company.payment_reliability)}`}>
                        {company.payment_reliability.toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("verifiedCompanies.reliability")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
