import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, DollarSign, Star, CheckCircle, MessageSquare, 
  Loader2, Briefcase, Globe, Calendar, ExternalLink, Award, CreditCard
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { FreelancerPlanCard } from "@/components/billing/FreelancerPlanCard";
import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import { TierBadge, FreelancerTier } from "@/components/freelancer/TierBadge";

interface FreelancerData {
  id: string;
  user_id: string;
  full_name: string | null;
  title: string | null;
  bio: string | null;
  hourly_rate: number | null;
  location: string | null;
  skills: string[] | null;
  languages: string[] | null;
  avatar_url: string | null;
  verified: boolean | null;
  tier: FreelancerTier | null;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  project_id: string;
  company_user_id: string;
  project?: { title: string };
  company?: { company_name: string | null; user_id?: string };
}

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  project_url: string | null;
  tags: string[] | null;
}

interface Certification {
  id: string;
  name: string;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_url: string | null;
}

interface Project {
  id: string;
  title: string;
  status: string;
}

export default function FreelancerProfile() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [freelancer, setFreelancer] = useState<FreelancerData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [userType, setUserType] = useState<string | null>(null);
  const [openProjects, setOpenProjects] = useState<Project[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchFreelancerData();
      fetchUserType();
    }
  }, [userId]);

  const fetchUserType = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .single();
    if (data) setUserType(data.user_type);
  };

  const fetchFreelancerData = async () => {
    if (!userId) return;

    // Fetch freelancer profile
    const { data: freelancerData, error } = await (supabase as any)
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !freelancerData) {
      setLoading(false);
      return;
    }

    setFreelancer({
      ...freelancerData,
      tier: ((freelancerData as any).tier as FreelancerTier) || "standard",
    });

    // Fetch reviews with project info
    const { data: reviewsData } = await supabase
      .from("reviews")
      .select(`
        *,
        project:projects(title)
      `)
      .eq("freelancer_user_id", userId)
      .order("created_at", { ascending: false });

    if (reviewsData) {
      // Fetch company names and user_ids separately
      const companyIds = [...new Set(reviewsData.map(r => r.company_user_id))];
      const { data: companiesData } = await supabase
        .from("company_profiles")
        .select("user_id, company_name")
        .in("user_id", companyIds);

      const companyMap = new Map(companiesData?.map(c => [c.user_id, { company_name: c.company_name, user_id: c.user_id }]) || []);

      const mappedReviews = reviewsData.map(r => ({
        ...r,
        project: r.project as { title: string } | undefined,
        company: companyMap.get(r.company_user_id) || { company_name: null, user_id: r.company_user_id }
      }));
      setReviews(mappedReviews);
      if (mappedReviews.length > 0) {
        const avg = mappedReviews.reduce((sum, r) => sum + r.rating, 0) / mappedReviews.length;
        setAverageRating(avg);
      }
    }

    // Fetch portfolio items
    const { data: portfolioData } = await (supabase as any)
      .from("portfolio_items")
      .select("*")
      .eq("freelancer_user_id", userId)
      .order("created_at", { ascending: false });

    if (portfolioData) setPortfolio(portfolioData as PortfolioItem[]);

    // Fetch certifications
    const { data: certsData } = await supabase
      .from("certifications")
      .select("*")
      .eq("freelancer_user_id", userId)
      .order("issue_date", { ascending: false });

    if (certsData) setCertifications(certsData);

    // Fetch open projects for invite (if company)
    if (user) {
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, title, status")
        .eq("company_user_id", user.id)
        .eq("status", "open");
      
      if (projectsData) setOpenProjects(projectsData);
    }

    setLoading(false);
  };

  const handleStartConversation = async () => {
    if (!user || !freelancer) return;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("company_user_id", user.id)
      .eq("freelancer_user_id", freelancer.user_id)
      .maybeSingle();

    if (existing) {
      navigate(`/messages?conversation=${existing.id}`);
    } else {
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          company_user_id: user.id,
          freelancer_user_id: freelancer.user_id,
        })
        .select()
        .single();

      if (!error && newConv) {
        navigate(`/messages?conversation=${newConv.id}`);
      }
    }
  };

  const handleInviteToProject = async () => {
    if (!user || !freelancer || !selectedProject) return;
    setSending(true);

    try {
      // Find or create conversation
      let conversationId: string;
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("company_user_id", user.id)
        .eq("freelancer_user_id", freelancer.user_id)
        .eq("project_id", selectedProject)
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({
            company_user_id: user.id,
            freelancer_user_id: freelancer.user_id,
            project_id: selectedProject,
          })
          .select()
          .single();

        if (error || !newConv) throw error;
        conversationId = newConv.id;
      }

      // Send invite message
      const project = openProjects.find(p => p.id === selectedProject);
      const message = inviteMessage || t("freelancerProfile.defaultInviteMessage", { projectTitle: project?.title });

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_user_id: user.id,
        content: message,
      });

      // Create notification
      await supabase.from("notifications").insert({
        user_id: freelancer.user_id,
        type: "project_invite",
        message: t("notifications.projectInvite", { projectTitle: project?.title }),
        link: `/project/${selectedProject}`,
      });

      toast.success(t("freelancerProfile.inviteSent"));
      setInviteDialogOpen(false);
      setSelectedProject("");
      setInviteMessage("");
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setSending(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
      />
    ));
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
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="font-semibold mb-2">{t("freelancerProfile.notFound")}</h3>
          <Button onClick={() => navigate("/talent-pool")}>{t("common.goBack")}</Button>
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
            <TieredAvatar
              avatarUrl={freelancer.avatar_url}
              name={freelancer.full_name}
              tier={freelancer.tier}
              size="xl"
            />

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">{freelancer.full_name || t("freelancerProfile.unnamed")}</h1>
                {freelancer.verified && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
                {freelancer.tier && freelancer.tier !== "standard" && (
                  <TierBadge tier={freelancer.tier} size="md" />
                )}
              </div>
              <p className="text-lg text-muted-foreground mb-3">{freelancer.title}</p>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                {freelancer.hourly_rate && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    ${freelancer.hourly_rate}/hr
                  </span>
                )}
                {freelancer.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {freelancer.location}
                  </span>
                )}
                {reviews.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    {averageRating.toFixed(1)} ({reviews.length} {t("freelancerProfile.reviews")})
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t("freelancerProfile.memberSince")} {format(new Date(freelancer.created_at), "MMM yyyy")}
                </span>
              </div>

              {freelancer.skills && freelancer.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {freelancer.skills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              )}

              {userType === "company" && (
                <div className="flex gap-2">
                  <Button onClick={handleStartConversation} className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t("freelancerProfile.sendMessage")}
                  </Button>
                  {openProjects.length > 0 && (
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Briefcase className="h-4 w-4" />
                          {t("freelancerProfile.inviteToProject")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("freelancerProfile.inviteToProject")}</DialogTitle>
                          <DialogDescription>
                            {t("freelancerProfile.inviteDescription")}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>{t("freelancerProfile.selectProject")}</Label>
                            <Select value={selectedProject} onValueChange={setSelectedProject}>
                              <SelectTrigger>
                                <SelectValue placeholder={t("freelancerProfile.chooseProject")} />
                              </SelectTrigger>
                              <SelectContent>
                                {openProjects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("freelancerProfile.personalMessage")}</Label>
                            <Textarea
                              value={inviteMessage}
                              onChange={(e) => setInviteMessage(e.target.value)}
                              placeholder={t("freelancerProfile.inviteMessagePlaceholder")}
                              rows={4}
                            />
                          </div>
                          <Button 
                            onClick={handleInviteToProject} 
                            disabled={!selectedProject || sending}
                            className="w-full"
                          >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t("freelancerProfile.sendInvite")}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="about" className="space-y-6">
        <TabsList>
          <TabsTrigger value="about">{t("freelancerProfile.about")}</TabsTrigger>
          <TabsTrigger value="portfolio">{t("freelancerProfile.portfolio")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("freelancerProfile.reviewsTab")}</TabsTrigger>
          <TabsTrigger value="certifications">{t("freelancerProfile.certifications")}</TabsTrigger>
          {user && user.id === userId && (
            <TabsTrigger value="billing" className="gap-1">
              <CreditCard className="h-4 w-4" />
              {t("freelancerProfile.billing")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>{t("freelancerProfile.aboutMe")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {freelancer.bio && (
                <p className="text-muted-foreground whitespace-pre-wrap">{freelancer.bio}</p>
              )}

              {freelancer.languages && freelancer.languages.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t("freelancerProfile.languages")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {freelancer.languages.map((lang, idx) => (
                      <Badge key={idx} variant="outline">{lang}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio">
          {portfolio.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">{t("freelancerProfile.noPortfolio")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {portfolio.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                        {item.description}
                      </p>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {item.project_url && (
                      <Button variant="outline" size="sm" asChild className="gap-1">
                        <a href={item.project_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          {t("freelancerProfile.viewProject")}
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">{t("freelancerProfile.noReviews")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        {review.company?.user_id ? (
                          <button
                            onClick={() => navigate(`/companies/${review.company?.user_id}`)}
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {review.company?.company_name || t("freelancerProfile.anonymousCompany")}
                          </button>
                        ) : (
                          <p className="font-medium">{review.company?.company_name || t("freelancerProfile.anonymousCompany")}</p>
                        )}
                        <p className="text-sm text-muted-foreground">{review.project?.title}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-muted-foreground">{review.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      {format(new Date(review.created_at), "MMM d, yyyy")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certifications">
          {certifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">{t("freelancerProfile.noCertifications")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {certifications.map((cert) => (
                <Card key={cert.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Award className="h-8 w-8 text-primary shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold">{cert.name}</h3>
                        {cert.issuer && (
                          <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {cert.issue_date && (
                            <span>{t("freelancerProfile.issued")}: {format(new Date(cert.issue_date), "MMM yyyy")}</span>
                          )}
                          {cert.expiry_date && (
                            <span>{t("freelancerProfile.expires")}: {format(new Date(cert.expiry_date), "MMM yyyy")}</span>
                          )}
                        </div>
                        {cert.credential_url && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto mt-2">
                            <a href={cert.credential_url} target="_blank" rel="noopener noreferrer">
                              {t("freelancerProfile.viewCredential")}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Billing Tab - Only visible to profile owner */}
        {user && user.id === userId && (
          <TabsContent value="billing">
            <div className="space-y-6">
              <FreelancerPlanCard />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
