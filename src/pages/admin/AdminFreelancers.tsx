import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface FreelancerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  title: string | null;
  hourly_rate: number | null;
  location: string | null;
  verified: boolean | null;
  skills: string[] | null;
  created_at: string;
}

export default function AdminFreelancers() {
  const { t } = useTranslation();
  const [freelancers, setFreelancers] = useState<FreelancerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchFreelancers();
  }, []);

  const fetchFreelancers = async () => {
    try {
      const { data, error } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFreelancers(data || []);
    } catch (error) {
      console.error("Error fetching freelancers:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async (id: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("freelancer_profiles")
        .update({ verified: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      setFreelancers((prev) =>
        prev.map((f) => (f.id === id ? { ...f, verified: !currentStatus } : f))
      );

      toast.success(
        currentStatus
          ? t("admin.freelancerUnverified")
          : t("admin.freelancerVerified")
      );
    } catch (error) {
      console.error("Error toggling verification:", error);
      toast.error(t("admin.errorUpdating"));
    }
  };

  const filteredFreelancers = freelancers.filter(
    (f) =>
      f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.title?.toLowerCase().includes(search.toLowerCase()) ||
      f.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.freelancers")}</h1>
        <p className="text-muted-foreground">{t("admin.freelancersDescription")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("admin.allFreelancers")}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.searchFreelancers")}
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
                  <TableHead>{t("admin.name")}</TableHead>
                  <TableHead>{t("admin.title")}</TableHead>
                  <TableHead>{t("admin.hourlyRate")}</TableHead>
                  <TableHead>{t("admin.location")}</TableHead>
                  <TableHead>{t("admin.skills")}</TableHead>
                  <TableHead>{t("admin.verified")}</TableHead>
                  <TableHead>{t("admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFreelancers.map((freelancer) => (
                  <TableRow key={freelancer.id}>
                    <TableCell className="font-medium">
                      {freelancer.full_name || "-"}
                    </TableCell>
                    <TableCell>{freelancer.title || "-"}</TableCell>
                    <TableCell>
                      {freelancer.hourly_rate
                        ? `$${freelancer.hourly_rate}/h`
                        : "-"}
                    </TableCell>
                    <TableCell>{freelancer.location || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {freelancer.skills?.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {freelancer.skills && freelancer.skills.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{freelancer.skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {freelancer.verified ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={freelancer.verified || false}
                          onCheckedChange={() =>
                            toggleVerification(freelancer.id, freelancer.verified)
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {freelancer.verified
                            ? t("admin.verified")
                            : t("admin.unverified")}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredFreelancers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {t("admin.noFreelancersFound")}
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
