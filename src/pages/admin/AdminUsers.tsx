import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDataCard, MobileDataRow } from "@/components/admin/MobileDataCard";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  user_type: string | null;
  role: string;
  preferred_language: string;
  created_at: string;
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProfiles(data || []);
      } catch (error) {
        console.error("Error fetching profiles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.email.toLowerCase().includes(search.toLowerCase()) ||
      profile.user_type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("admin.users")}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t("admin.usersDescription")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg md:text-xl">{t("admin.allUsers")}</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.searchUsers")}
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
              {filteredProfiles.map((profile) => (
                <MobileDataCard key={profile.id}>
                  <div className="font-medium text-sm break-all">{profile.email}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant={profile.user_type === "company" ? "default" : "secondary"}>
                      {profile.user_type || "-"}
                    </Badge>
                    <Badge variant={profile.role === "admin" ? "destructive" : "outline"}>
                      {profile.role}
                    </Badge>
                  </div>
                  <MobileDataRow label={t("admin.language")}>
                    {profile.preferred_language.toUpperCase()}
                  </MobileDataRow>
                  <MobileDataRow label={t("admin.createdAt")}>
                    {format(new Date(profile.created_at), "PP")}
                  </MobileDataRow>
                </MobileDataCard>
              ))}
              {filteredProfiles.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  {t("admin.noUsersFound")}
                </div>
              )}
            </div>
          ) : (
            // Desktop view - table
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.email")}</TableHead>
                  <TableHead>{t("admin.userType")}</TableHead>
                  <TableHead>{t("admin.role")}</TableHead>
                  <TableHead>{t("admin.language")}</TableHead>
                  <TableHead>{t("admin.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
                    <TableCell>
                      <Badge variant={profile.user_type === "company" ? "default" : "secondary"}>
                        {profile.user_type || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile.role === "admin" ? "destructive" : "outline"}>
                        {profile.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{profile.preferred_language.toUpperCase()}</TableCell>
                    <TableCell>{format(new Date(profile.created_at), "PPp")}</TableCell>
                  </TableRow>
                ))}
                {filteredProfiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("admin.noUsersFound")}
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
