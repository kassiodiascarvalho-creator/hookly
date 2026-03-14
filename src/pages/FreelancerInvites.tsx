import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Check, X, Building, DollarSign, Calendar, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";
import { format } from "date-fns";

interface Invite {
  id: string;
  project_id: string;
  company_user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  project: {
    id: string;
    title: string;
    description: string | null;
    budget_min: number | null;
    budget_max: number | null;
    currency: string;
    category: string | null;
  };
  company: {
    company_name: string | null;
    logo_url: string | null;
  } | null;
}

export default function FreelancerInvites() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("project_invites")
      .select(`
        id,
        project_id,
        company_user_id,
        status,
        message,
        created_at
      `)
      .eq("freelancer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invites:", error);
      setLoading(false);
      return;
    }

    // Fetch related data
    const invitesWithDetails: Invite[] = [];
    
    for (const invite of data || []) {
      // Fetch project
      const { data: project } = await supabase
        .from("projects")
        .select("id, title, description, budget_min, budget_max, currency, category")
        .eq("id", invite.project_id)
        .single();
      
      // Fetch company
      const { data: company } = await supabase
        .from("company_profiles")
        .select("company_name, logo_url")
        .eq("user_id", invite.company_user_id)
        .single();
      
      if (project) {
        invitesWithDetails.push({
          ...invite,
          project,
          company,
        });
      }
    }

    setInvites(invitesWithDetails);
    setLoading(false);
  };

  const handleAccept = async (invite: Invite) => {
    setProcessingId(invite.id);
    
    const { error } = await supabase
      .from("project_invites")
      .update({ 
        status: "accepted", 
        responded_at: new Date().toISOString() 
      })
      .eq("id", invite.id);

    if (error) {
      toast.error(t("common.error"));
      console.error(error);
    } else {
      toast.success(t("invites.accepted"));
      
      // Create notification for company
      await supabase.from("notifications").insert({
        user_id: invite.company_user_id,
        type: "invite_accepted",
        message: t("invites.notifications.accepted", { project: invite.project.title }),
        link: `/projects/${invite.project_id}`,
      });
      
      fetchInvites();
      // Navigate to project to send proposal
      navigate(`/project/${invite.project_id}`);
    }
    
    setProcessingId(null);
  };

  const handleDecline = async (invite: Invite) => {
    setProcessingId(invite.id);
    
    const { error } = await supabase
      .from("project_invites")
      .update({ 
        status: "declined", 
        responded_at: new Date().toISOString() 
      })
      .eq("id", invite.id);

    if (error) {
      toast.error(t("common.error"));
      console.error(error);
    } else {
      toast.success(t("invites.declined"));
      fetchInvites();
    }
    
    setProcessingId(null);
  };

  const pendingInvites = invites.filter(i => i.status === "pending");
  const respondedInvites = invites.filter(i => i.status !== "pending");

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
        <h1 className="text-3xl font-bold">{t("invites.title")}</h1>
        <p className="text-muted-foreground">{t("invites.subtitle")}</p>
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t("invites.pending")}</h2>
          <div className="grid gap-4">
            {pendingInvites.map((invite) => (
              <Card key={invite.id} className="border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={invite.company?.logo_url || undefined} />
                        <AvatarFallback>
                          <Building className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{invite.project.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Building className="h-3 w-3" />
                          {invite.company?.company_name || t("common.company")}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/10">
                      {t("invites.new")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invite.message && (
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                        {invite.message}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {(invite.project.budget_min || invite.project.budget_max) && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {invite.project.budget_min && invite.project.budget_max
                          ? `${formatMoney(invite.project.budget_min, invite.project.currency)} - ${formatMoney(invite.project.budget_max, invite.project.currency)}`
                          : invite.project.budget_min
                          ? `${t("common.from")} ${formatMoney(invite.project.budget_min, invite.project.currency)}`
                          : `${t("common.upTo")} ${formatMoney(invite.project.budget_max!, invite.project.currency)}`
                        }
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(invite.created_at), "dd/MM/yyyy")}
                    </span>
                    {invite.project.category && (
                      <Badge variant="secondary">{invite.project.category}</Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAccept(invite)}
                      disabled={processingId === invite.id}
                      className="flex-1 gap-2"
                    >
                      {processingId === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {t("invites.accept")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDecline(invite)}
                      disabled={processingId === invite.id}
                      className="flex-1 gap-2"
                    >
                      <X className="h-4 w-4" />
                      {t("invites.decline")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {respondedInvites.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t("invites.history")}</h2>
          <div className="grid gap-4">
            {respondedInvites.map((invite) => (
              <Card key={invite.id} className="opacity-75">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={invite.company?.logo_url || undefined} />
                        <AvatarFallback>
                          <Building className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{invite.project.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {invite.company?.company_name}
                        </p>
                      </div>
                    </div>
                    <Badge variant={invite.status === "accepted" ? "default" : "secondary"}>
                      {invite.status === "accepted" ? t("invites.statusAccepted") : t("invites.statusDeclined")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {invites.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">{t("invites.noInvites")}</h3>
            <p className="text-muted-foreground mb-4">{t("invites.noInvitesDesc")}</p>
            <Button onClick={() => navigate("/find-projects")}>
              {t("invites.browseProjects")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
