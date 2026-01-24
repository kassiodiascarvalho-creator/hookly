import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import type { FreelancerTier } from "@/components/freelancer/TierBadge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, MapPin, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface FreelancerDetail {
  id: string;
  user_id: string;
  full_name: string | null;
  title: string | null;
  bio: string | null;
  hourly_rate: number | null;
  location: string | null;
  verified: boolean | null;
  verified_at: string | null;
  verified_by_admin_id: string | null;
  skills: string[] | null;
  languages: string[] | null;
  avatar_url: string | null;
  total_revenue: number | null;
  created_at: string;
  tier: string | null;
}

export default function AdminFreelancerDetail() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [freelancer, setFreelancer] = useState<FreelancerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchFreelancer();
  }, [userId]);

  const fetchFreelancer = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("freelancer_profiles")
        .select("*, tier")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setFreelancer(data);
    } catch (error) {
      console.error("Error fetching freelancer:", error);
      toast.error(t("admin.errorLoading"));
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async () => {
    if (!freelancer || !user) return;
    setUpdating(true);

    try {
      const newStatus = !freelancer.verified;
      const { error } = await supabase
        .from("freelancer_profiles")
        .update({
          verified: newStatus,
          verified_at: newStatus ? new Date().toISOString() : null,
          verified_by_admin_id: newStatus ? user.id : null,
        })
        .eq("id", freelancer.id);

      if (error) throw error;

      setFreelancer({
        ...freelancer,
        verified: newStatus,
        verified_at: newStatus ? new Date().toISOString() : null,
        verified_by_admin_id: newStatus ? user.id : null,
      });

      toast.success(newStatus ? t("admin.freelancerVerified") : t("admin.freelancerUnverified"));
    } catch (error) {
      console.error("Error updating verification:", error);
      toast.error(t("admin.errorUpdating"));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!freelancer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("admin.freelancerNotFound")}</p>
        <Button onClick={() => navigate("/admin/freelancers")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/admin/freelancers")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
        <h1 className="text-3xl font-bold">{t("admin.freelancerDetail")}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <TieredAvatar
                  avatarUrl={freelancer.avatar_url}
                  name={freelancer.full_name}
                  tier={(freelancer.tier as FreelancerTier) || "standard"}
                  size="xl"
                  showBadge={true}
                />
                <div>
                  <CardTitle className="text-2xl">{freelancer.full_name || t("admin.noName")}</CardTitle>
                  <p className="text-muted-foreground">{freelancer.title || t("admin.noTitle")}</p>
                  {freelancer.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4" />
                      {freelancer.location}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate(`/freelancers/${freelancer.user_id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("admin.viewPublicProfile")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {freelancer.bio && (
              <div>
                <h3 className="font-semibold mb-2">{t("admin.bio")}</h3>
                <p className="text-muted-foreground">{freelancer.bio}</p>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">{t("admin.hourlyRate")}</h3>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{freelancer.hourly_rate ? `$${freelancer.hourly_rate}/h` : "-"}</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">{t("admin.totalRevenue")}</h3>
                <span className="text-green-600 font-semibold">
                  ${freelancer.total_revenue?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>

            {freelancer.skills && freelancer.skills.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">{t("admin.skills")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {freelancer.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {freelancer.languages && freelancer.languages.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">{t("admin.languages")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {freelancer.languages.map((lang) => (
                      <Badge key={lang} variant="outline">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">{t("admin.createdAt")}</h3>
              <p className="text-muted-foreground">
                {format(new Date(freelancer.created_at), "PPP")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Verification Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.verification")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {freelancer.verified ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {freelancer.verified ? t("admin.verified") : t("admin.unverified")}
                </span>
              </div>
              <Switch
                checked={freelancer.verified || false}
                onCheckedChange={toggleVerification}
                disabled={updating}
              />
            </div>

            {freelancer.verified && freelancer.verified_at && (
              <div className="text-sm text-muted-foreground">
                <p>{t("admin.verifiedOn")}: {format(new Date(freelancer.verified_at), "PPP")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
