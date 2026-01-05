import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, Building2 } from "lucide-react";
import { format } from "date-fns";

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
  created_at: string;
}

export default function AdminCompanies() {
  const { t } = useTranslation();
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

  const filteredCompanies = companies.filter(
    (c) =>
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.companies")}</h1>
        <p className="text-muted-foreground">{t("admin.companiesDescription")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("admin.allCompanies")}</CardTitle>
            <div className="relative w-64">
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.company")}</TableHead>
                  <TableHead>{t("admin.contact")}</TableHead>
                  <TableHead>{t("admin.industry")}</TableHead>
                  <TableHead>{t("admin.size")}</TableHead>
                  <TableHead>{t("admin.location")}</TableHead>
                  <TableHead>{t("admin.website")}</TableHead>
                  <TableHead>{t("admin.createdAt")}</TableHead>
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
                          href={company.website}
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
                      {format(new Date(company.created_at), "PP")}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCompanies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
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
