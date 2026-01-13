import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, Building2, CheckCircle, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDataCard, MobileDataRow } from "@/components/admin/MobileDataCard";

interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string | null;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  logo_url: string | null;
  website: string | null;
  is_verified: boolean | null;
  verified_at: string | null;
  verified_by_admin_id: string | null;
  created_at: string;
}

export default function AdminCompanies() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from("company_profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCompanies(data || []);
      } catch (error) {
        console.error("Error fetching companies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const toggleVerification = async (company: CompanyProfile) => {
    if (!user) return;

    try {
      const newStatus = !company.is_verified;
      const { data, error } = await supabase
        .from("company_profiles")
        .update({ 
          is_verified: newStatus,
          verified_at: newStatus ? new Date().toISOString() : null,
          verified_by_admin_id: newStatus ? user.id : null,
        })
        .eq("id", company.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === company.id ? data : c))
        );
      }

      toast.success(
        newStatus
          ? t("admin.companyVerified")
          : t("admin.companyUnverified")
      );
    } catch (error) {
      console.error("Error toggling verification:", error);
      toast.error(t("admin.errorUpdating"));
    }
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("admin.companies")}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t("admin.companiesDescription")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg md:text-xl">{t("admin.allCompanies")}</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.searchCompanies")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isMobile ? (
            // Mobile view - card layout
            <div className="space-y-3">
              {filteredCompanies.map((company) => (
                <MobileDataCard key={company.id}>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={company.logo_url || ""} />
                      <AvatarFallback>
                        <Building2 className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{company.company_name || "-"}</div>
                      <div className="text-sm text-muted-foreground truncate">{company.contact_name || "-"}</div>
                    </div>
                    {company.is_verified ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  {company.industry && (
                    <Badge variant="secondary" className="mt-2">{company.industry}</Badge>
                  )}
                  <MobileDataRow label={t("admin.size")}>
                    {company.company_size || "-"}
                  </MobileDataRow>
                  <MobileDataRow label={t("admin.location")}>
                    {company.location || "-"}
                  </MobileDataRow>
                  {company.website && (
                    <MobileDataRow label={t("admin.website")}>
                      <a
                        href={normalizeUrl(company.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {t("admin.visit")}
                      </a>
                    </MobileDataRow>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t("admin.verified")}</span>
                      <Switch
                        checked={company.is_verified || false}
                        onCheckedChange={() => toggleVerification(company)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/companies/${company.user_id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t("admin.view")}
                    </Button>
                  </div>
                </MobileDataCard>
              ))}
              {filteredCompanies.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  {t("admin.noCompaniesFound")}
                </div>
              )}
            </div>
          ) : (
            // Desktop view - table
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.company")}</TableHead>
                  <TableHead>{t("admin.contact")}</TableHead>
                  <TableHead>{t("admin.industry")}</TableHead>
                  <TableHead>{t("admin.size")}</TableHead>
                  <TableHead>{t("admin.location")}</TableHead>
                  <TableHead>{t("admin.website")}</TableHead>
                  <TableHead>{t("admin.verified")}</TableHead>
                  <TableHead>{t("admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={company.logo_url || ""} />
                          <AvatarFallback>
                            <Building2 className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {company.company_name || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{company.contact_name || "-"}</TableCell>
                    <TableCell>
                      {company.industry ? (
                        <Badge variant="secondary">{company.industry}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{company.company_size || "-"}</TableCell>
                    <TableCell>{company.location || "-"}</TableCell>
                    <TableCell>
                      {company.website ? (
                        <a
                          href={normalizeUrl(company.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {t("admin.visit")}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {company.is_verified ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={company.is_verified || false}
                          onCheckedChange={() => toggleVerification(company)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/companies/${company.user_id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCompanies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {t("admin.noCompaniesFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
