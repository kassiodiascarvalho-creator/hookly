import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, CheckCircle, DollarSign, Users, Loader2, TrendingUp } from "lucide-react";
import { ViewCompanyDataButton } from "@/components/company/ViewCompanyDataButton";
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
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFreelancer, setIsFreelancer] = useState(false);

  useEffect(() => {
    fetchCompaniesWithHistory();
    checkUserType();
  }, [user]);

  const checkUserType = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .maybeSingle();
    setIsFreelancer(data?.user_type === "freelancer");
  };

  const fetchCompaniesWithHistory = async () => {
    try {
      // Get all companies with is_verified = true OR that have payment history
      const { data: companiesData } = await supabase
        .from("company_profiles")
        .select("id, user_id, company_name, logo_url, location, industry, is_verified");

      if (!companiesData || companiesData.length === 0) {
        setLoading(false);
        return;
      }

      // Get all payments at once to avoid N+1 queries
      const { data: allPayments } = await supabase
        .from("payments")
        .select("company_user_id, amount, status, escrow_status");

      // Get all accepted proposals with project info
      const { data: allProposals } = await supabase
        .from("proposals")
        .select("freelancer_user_id, project:projects!inner(company_user_id)")
        .eq("status", "accepted");

      const companiesWithStats: CompanyWithHistory[] = [];

      for (const company of companiesData) {
        // Filter payments for this company
        const payments = allPayments?.filter(p => p.company_user_id === company.user_id) || [];
        
        // Calculate total paid (paid or released status)
        const totalPaid = payments
          .filter(p => p.status === "paid" || p.status === "released")
          .reduce((sum, p) => sum + Number(p.amount), 0);

        // Skip companies with no payment history AND not verified
        if (totalPaid === 0 && !company.is_verified) continue;

        // Calculate payment reliability
        const releasedCount = payments.filter(p => p.status === "released" || p.escrow_status === "released").length;
        const totalFunded = payments.filter(p => p.status !== "pending" && p.status !== "failed").length;
        const reliability = totalFunded > 0 ? (releasedCount / totalFunded) * 100 : 0;

        // Get distinct freelancers hired
        const uniqueFreelancers = new Set(
          allProposals?.filter(p => (p.project as any)?.company_user_id === company.user_id).map(p => p.freelancer_user_id)
        );

        companiesWithStats.push({
          ...company,
          total_paid: totalPaid,
          freelancers_hired: uniqueFreelancers.size,
          payment_reliability: reliability,
        });
      }

      // Sort: verified companies first, then by total paid descending
      companiesWithStats.sort((a, b) => {
        if (a.is_verified && !b.is_verified) return -1;
        if (!a.is_verified && b.is_verified) return 1;
        return b.total_paid - a.total_paid;
      });
      
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
              <CardContent className="pt-0 space-y-3">
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
                
                {/* View Company Data Button - only for freelancers */}
                {isFreelancer && (
                  <ViewCompanyDataButton 
                    companyUserId={company.user_id} 
                    companyName={company.company_name} 
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
